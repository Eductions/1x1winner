-- ============================================================================
-- Tower of English — Supabase schema (Step 1)
-- ----------------------------------------------------------------------------
-- Tables: profiles · questions · room_matches (+ room_answers for idempotency)
-- Includes: enums, triggers, RLS policies, atomic RPCs (race-condition safe),
--           Realtime publication and seed questions.
-- Run order: execute this whole file inside Supabase SQL Editor.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'match_status') then
    create type public.match_status as enum ('waiting', 'playing', 'finished', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'team_side') then
    create type public.team_side as enum ('A', 'B');
  end if;
  if not exists (select 1 from pg_type where typname = 'question_category') then
    create type public.question_category as enum (
      'grammar', 'vocabulary', 'reading', 'listening', 'writing'
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. profiles (1:1 with auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  constraint profiles_username_len check (char_length(username) between 3 and 30)
);

create unique index if not exists profiles_username_key on public.profiles (lower(username));

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. questions (English question bank, tagged by tower floor 1–10)
-- ----------------------------------------------------------------------------
create table if not exists public.questions (
  id            uuid primary key default gen_random_uuid(),
  floor_level   smallint not null check (floor_level between 1 and 10),
  category      public.question_category not null default 'grammar',
  prompt        text not null,
  -- options shape: [{"key":"A","text":"..."}, ...] exactly 4 options
  options       jsonb not null,
  correct_key   text not null check (correct_key in ('A', 'B', 'C', 'D')),
  explanation   text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint questions_options_is_array check (jsonb_typeof(options) = 'array'),
  constraint questions_four_options check (jsonb_array_length(options) = 4)
);

create index if not exists questions_floor_idx
  on public.questions (floor_level) where is_active;

-- ----------------------------------------------------------------------------
-- 4. room_matches (one row per game room — this is the Realtime broadcast row)
-- ----------------------------------------------------------------------------
create table if not exists public.room_matches (
  id                   uuid primary key default gen_random_uuid(),
  room_code            text not null,
  status               public.match_status not null default 'waiting',
  created_by           uuid not null references public.profiles (id),
  team_a_player_id     uuid references public.profiles (id),
  team_b_player_id     uuid references public.profiles (id),
  -- 0 = ground floor, 10 = top of the tower
  team_a_position      smallint not null default 0 check (team_a_position between 0 and 10),
  team_b_position      smallint not null default 0 check (team_b_position between 0 and 10),
  current_turn         public.team_side not null default 'A',
  current_question_id  uuid references public.questions (id),
  winner               public.team_side,
  -- optimistic-concurrency version, bumped on every state transition
  version              bigint not null default 0,
  started_at           timestamptz,
  finished_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint room_code_len check (char_length(room_code) = 6),
  constraint winner_only_when_finished check (
    winner is null or status = 'finished'
  )
);

create unique index if not exists room_matches_room_code_key
  on public.room_matches (room_code);

-- ----------------------------------------------------------------------------
-- 5. room_answers (audit log + idempotency guard against double submission)
--    A team can only answer a given question once — the unique constraint is
--    the database-level guarantee behind the race-condition protection.
-- ----------------------------------------------------------------------------
create table if not exists public.room_answers (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.room_matches (id) on delete cascade,
  question_id   uuid not null references public.questions (id),
  team          public.team_side not null,
  player_id     uuid not null references public.profiles (id),
  selected_key  text not null check (selected_key in ('A', 'B', 'C', 'D')),
  is_correct    boolean not null,
  created_at    timestamptz not null default now(),
  unique (room_id, question_id, team)
);

create index if not exists room_answers_room_idx on public.room_answers (room_id);

-- ----------------------------------------------------------------------------
-- 6. updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists room_matches_touch on public.room_matches;
create trigger room_matches_touch
  before update on public.room_matches
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 7. Atomic RPCs — ALL game mutations go through these functions.
--    SELECT ... FOR UPDATE takes a row-level lock so two answers submitted in
--    the same millisecond are serialised: the second waits, then sees the
--    rotated turn / recorded answer and is rejected. No client-side UPDATE is
--    ever permitted (see RLS below), which removes the race at its source.
-- ============================================================================

-- 7.1 Start a match: assign both players and draw the first question.
create or replace function public.start_match(p_room_id uuid)
returns public.room_matches
language plpgsql
security definer set search_path = public
as $$
declare
  v_room public.room_matches%rowtype;
  v_question public.questions%rowtype;
begin
  select * into v_room from public.room_matches where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.created_by <> auth.uid() then raise exception 'ONLY_HOST_CAN_START'; end if;
  if v_room.status <> 'waiting' then raise exception 'MATCH_ALREADY_STARTED'; end if;
  if v_room.team_a_player_id is null or v_room.team_b_player_id is null then
    raise exception 'ROOM_NEEDS_TWO_PLAYERS';
  end if;

  select * into v_question
    from public.questions
   where is_active and floor_level = 1
   order by random()
   limit 1;

  update public.room_matches
     set status = 'playing',
         current_turn = 'A',
         current_question_id = v_question.id,
         started_at = now(),
         version = version + 1
   where id = p_room_id
   returning * into v_room;

  return v_room;
end;
$$;

-- 7.2 Submit an answer atomically and advance the game state.
create or replace function public.submit_answer(
  p_room_id       uuid,
  p_team          public.team_side,
  p_question_id   uuid,
  p_selected_key  text
)
returns public.room_matches
language plpgsql
security definer set search_path = public
as $$
declare
  v_room          public.room_matches%rowtype;
  v_question      public.questions%rowtype;
  v_player_id     uuid := auth.uid();
  v_is_correct    boolean;
  v_new_position  smallint;
  v_next_turn     public.team_side;
  v_next_question public.questions%rowtype;
begin
  -- Row lock: concurrent submissions queue here instead of overwriting.
  select * into v_room from public.room_matches where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  -- Business-rule guards (evaluated inside the lock on fresh data).
  if v_room.status <> 'playing' then
    raise exception 'MATCH_NOT_ACTIVE';
  end if;
  if v_room.current_turn <> p_team then
    raise exception 'NOT_YOUR_TURN';
  end if;
  if v_room.current_question_id is distinct from p_question_id then
    raise exception 'QUESTION_MISMATCH';
  end if;
  if p_team = 'A' and v_room.team_a_player_id is distinct from v_player_id then
    raise exception 'NOT_TEAM_MEMBER';
  end if;
  if p_team = 'B' and v_room.team_b_player_id is distinct from v_player_id then
    raise exception 'NOT_TEAM_MEMBER';
  end if;

  -- Idempotency: re-submission (double click / duplicated Realtime event) fails.
  if exists (
    select 1 from public.room_answers
     where room_id = p_room_id and question_id = p_question_id and team = p_team
  ) then
    raise exception 'ANSWER_ALREADY_RECORDED';
  end if;

  select * into v_question from public.questions where id = p_question_id;
  v_is_correct := (v_question.correct_key = p_selected_key);

  insert into public.room_answers (room_id, question_id, team, player_id, selected_key, is_correct)
  values (p_room_id, p_question_id, p_team, v_player_id, p_selected_key, v_is_correct);

  -- Correct answer => climb one floor (capped at 10).
  if v_is_correct then
    if p_team = 'A' then
      v_new_position := least(v_room.team_a_position + 1, 10);
    else
      v_new_position := least(v_room.team_b_position + 1, 10);
    end if;
  end if;

  v_next_turn := case when p_team = 'A' then 'B'::public.team_side else 'A'::public.team_side end;

  -- Draw a question suited to the next team's current floor.
  select * into v_next_question
    from public.questions
   where is_active
     and floor_level = least(
       case when v_next_turn = 'A'
            then coalesce(v_new_position, v_room.team_a_position) + 1
            else coalesce(v_new_position, v_room.team_b_position) + 1
       end, 10)
   order by random()
   limit 1;

  -- Single committed state transition (version bump enables client staleness checks).
  update public.room_matches
     set team_a_position = case when p_team = 'A' then coalesce(v_new_position, team_a_position)
                                else team_a_position end,
         team_b_position = case when p_team = 'B' then coalesce(v_new_position, team_b_position)
                                else team_b_position end,
         current_turn = v_next_turn,
         current_question_id = v_next_question.id,
         status = case when v_new_position >= 10 then 'finished'::public.match_status else status end,
         winner = case when v_new_position >= 10 then p_team else winner end,
         finished_at = case when v_new_position >= 10 then now() else finished_at end,
         version = version + 1
   where id = p_room_id
   returning * into v_room;

  return v_room;
end;
$$;

-- 7.3 Generate a human-friendly unique room code.
create or replace function public.create_room()
returns public.room_matches
language plpgsql
security definer set search_path = public
as $$
declare
  v_code text;
  v_room public.room_matches%rowtype;
begin
  v_code := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
  insert into public.room_matches (room_code, created_by, team_a_player_id)
  values (v_code, auth.uid(), auth.uid())
  returning * into v_room;
  return v_room;
end;
$$;

grant execute on function public.create_room() to authenticated;
grant execute on function public.start_match(uuid) to authenticated;
grant execute on function public.submit_answer(uuid, public.team_side, uuid, text) to authenticated;

-- ============================================================================
-- 8. Row Level Security
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.room_matches enable row level security;
alter table public.room_answers enable row level security;

-- profiles: everyone signed-in can read; you can only modify your own profile.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- questions: read-only question bank for signed-in users.
drop policy if exists "questions_select" on public.questions;
create policy "questions_select" on public.questions
  for select to authenticated using (is_active);

-- room_matches: only participants can read; direct writes are blocked and
-- must go through the SECURITY DEFINER RPCs (which run outside RLS).
drop policy if exists "room_matches_select_participants" on public.room_matches;
create policy "room_matches_select_participants" on public.room_matches
  for select to authenticated
  using (
    auth.uid() = created_by
    or auth.uid() = team_a_player_id
    or auth.uid() = team_b_player_id
  );

-- room_answers: participants read their room's audit trail; writes via RPC only.
drop policy if exists "room_answers_select_participants" on public.room_answers;
create policy "room_answers_select_participants" on public.room_answers
  for select to authenticated
  using (
    exists (
      select 1 from public.room_matches r
       where r.id = room_answers.room_id
         and (auth.uid() = r.created_by
              or auth.uid() = r.team_a_player_id
              or auth.uid() = r.team_b_player_id)
    )
  );

-- ============================================================================
-- 9. Realtime — broadcast every room_matches change to subscribed clients
-- ============================================================================
do $$
begin
  alter publication supabase_realtime add table public.room_matches;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.room_answers;
exception
  when duplicate_object then null;
end $$;

-- ============================================================================
-- 10. Seed questions (sample 10 — one per floor). Extend freely.
-- ============================================================================
insert into public.questions (floor_level, category, prompt, options, correct_key, explanation)
values
  (1, 'grammar',
   'She ___ to university every morning.',
   '[{"key":"A","text":"go"},{"key":"B","text":"goes"},{"key":"C","text":"going"},{"key":"D","text":"gone"}]',
   'B', 'Third-person singular takes "goes".'),
  (2, 'vocabulary',
   'Choose the synonym of "happy".',
   '[{"key":"A","text":"Sad"},{"key":"B","text":"Angry"},{"key":"C","text":"Joyful"},{"key":"D","text":"Tired"}]',
   'C', '"Joyful" means feeling great happiness.'),
  (3, 'grammar',
   'They have lived in Tripoli ___ 2019.',
   '[{"key":"A","text":"since"},{"key":"B","text":"for"},{"key":"C","text":"from"},{"key":"D","text":"in"}]',
   'A', 'Use "since" with a point in time.'),
  (4, 'reading',
   '"The lecturer postponed the exam." means the exam was…',
   '[{"key":"A","text":"cancelled forever"},{"key":"B","text":"moved to a later time"},{"key":"C","text":"made easier"},{"key":"D","text":"held online"}]',
   'B', 'Postpone = delay to another time.'),
  (5, 'grammar',
   'If I ___ rich, I would travel the world.',
   '[{"key":"A","text":"am"},{"key":"B","text":"was"},{"key":"C","text":"were"},{"key":"D","text":"be"}]',
   'C', 'Second conditional uses "were" for all subjects.'),
  (6, 'vocabulary',
   'The opposite of "generous" is…',
   '[{"key":"A","text":"Kind"},{"key":"B","text":"Stingy"},{"key":"C","text":"Brave"},{"key":"D","text":"Polite"}]',
   'B', 'A stingy person dislikes giving.'),
  (7, 'grammar',
   'The report ___ by the team yesterday.',
   '[{"key":"A","text":"writes"},{"key":"B","text":"wrote"},{"key":"C","text":"was written"},{"key":"D","text":"is writing"}]',
   'C', 'Passive voice past simple: was/were + past participle.'),
  (8, 'writing',
   'Which sentence is formally correct?',
   '[{"key":"A","text":"Hey gimme the book"},{"key":"B","text":"Please provide me with the book."},{"key":"C","text":"Book give now please."},{"key":"D","text":"Give book, yes?"}]',
   'B', 'Formal style uses complete, polite phrasing.'),
  (9, 'grammar',
   'Hardly ___ the lecture started when the lights went out.',
   '[{"key":"A","text":"has"},{"key":"B","text":"had"},{"key":"C","text":"did"},{"key":"D","text":"was"}]',
   'B', 'Inversion after "hardly" uses past perfect: "Hardly had…".'),
  (10, 'vocabulary',
   'Choose the word meaning "a strong desire to achieve something".',
   '[{"key":"A","text":"Ambition"},{"key":"B","text":"Permission"},{"key":"C","text":"Collision"},{"key":"D","text":"Revision"}]',
   'A', 'Ambition is the drive to reach a goal.')
on conflict do nothing;

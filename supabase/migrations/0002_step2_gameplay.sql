-- ============================================================================
-- Tower of English — Step 2 migration
-- Run AFTER supabase/schema.sql.
--
-- Adds: join/leave RPCs, hidden-answer question access, a richer answer RPC
--       that returns correctness + explanation, turn expiry (timer), an open
--       rooms listing for the lobby, and tightens question RLS so players
--       can never read correct_key before answering.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Composite result returned by answer_question()
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'answer_result') then
    create type public.answer_result as (
      room         public.room_matches,
      is_correct   boolean,
      correct_key  text,
      explanation  text
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Join a waiting room by its 6-character code.
--    FOR UPDATE serialises two players joining at the same instant so they
--    can never both be assigned to team B.
-- ----------------------------------------------------------------------------
create or replace function public.join_room(p_code text)
returns public.room_matches
language plpgsql
security definer set search_path = public
as $$
declare
  v_room public.room_matches%rowtype;
begin
  select * into v_room
    from public.room_matches
   where room_code = upper(p_code)
   for update;

  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status <> 'waiting' then raise exception 'ROOM_NOT_JOINABLE'; end if;

  -- Idempotent re-join: a player already in the room gets the row back.
  if auth.uid() = v_room.team_a_player_id
     or auth.uid() = v_room.team_b_player_id then
    return v_room;
  end if;

  if v_room.team_a_player_id is null then
    update public.room_matches
       set team_a_player_id = auth.uid(), version = version + 1
     where id = v_room.id returning * into v_room;
  elsif v_room.team_b_player_id is null then
    update public.room_matches
       set team_b_player_id = auth.uid(), version = version + 1
     where id = v_room.id returning * into v_room;
  else
    raise exception 'ROOM_FULL';
  end if;

  return v_room;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Leave a room that has not started yet. Host leaving cancels (deletes)
--    the room; a guest frees team B.
-- ----------------------------------------------------------------------------
create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_room public.room_matches%rowtype;
begin
  select * into v_room from public.room_matches where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status <> 'waiting' then raise exception 'MATCH_ALREADY_STARTED'; end if;

  if auth.uid() = v_room.created_by then
    delete from public.room_matches where id = p_room_id;
    return;
  end if;

  update public.room_matches
     set team_b_player_id = nullif(team_b_player_id, auth.uid()),
         team_a_player_id = nullif(team_a_player_id, auth.uid()),
         version = version + 1
   where id = p_room_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Secure question access: clients may fetch a question to PLAY, but the
--    correct key and explanation never leave the database until they answer.
-- ----------------------------------------------------------------------------
create or replace function public.get_question(p_question_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', q.id,
    'floor_level', q.floor_level,
    'category', q.category,
    'prompt', q.prompt,
    'options', q.options
  )
  into v_result
  from public.questions q
 where q.id = p_question_id and q.is_active;

  if v_result is null then raise exception 'QUESTION_NOT_FOUND'; end if;
  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. answer_question: the full atomic answering flow (same locking model as
--    submit_answer) but it also tells the client whether the answer was
--    correct and returns the explanation for the feedback screen.
-- ----------------------------------------------------------------------------
create or replace function public.answer_question(
  p_room_id       uuid,
  p_team          public.team_side,
  p_question_id   uuid,
  p_selected_key  text
)
returns public.answer_result
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
  select * into v_room from public.room_matches where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  if v_room.status <> 'playing' then raise exception 'MATCH_NOT_ACTIVE'; end if;
  if v_room.current_turn <> p_team then raise exception 'NOT_YOUR_TURN'; end if;
  if v_room.current_question_id is distinct from p_question_id then
    raise exception 'QUESTION_MISMATCH';
  end if;
  if p_team = 'A' and v_room.team_a_player_id is distinct from v_player_id then
    raise exception 'NOT_TEAM_MEMBER';
  end if;
  if p_team = 'B' and v_room.team_b_player_id is distinct from v_player_id then
    raise exception 'NOT_TEAM_MEMBER';
  end if;
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

  if v_is_correct then
    if p_team = 'A' then
      v_new_position := least(v_room.team_a_position + 1, 10);
    else
      v_new_position := least(v_room.team_b_position + 1, 10);
    end if;
  end if;

  v_next_turn := case when p_team = 'A' then 'B'::public.team_side else 'A'::public.team_side end;

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

  return (v_room, v_is_correct, v_question.correct_key, v_question.explanation)::public.answer_result;
end;
$$;

-- Keep the Step 1 RPC working: it now delegates to answer_question.
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
  v_result public.answer_result;
begin
  v_result := public.answer_question(p_room_id, p_team, p_question_id, p_selected_key);
  return v_result.room;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Timer expiry: rotate the turn without moving anyone and draw the next
--    question. No answer row is written — the timeout itself is the miss.
-- ----------------------------------------------------------------------------
create or replace function public.expire_turn(
  p_room_id uuid,
  p_team    public.team_side
)
returns public.room_matches
language plpgsql
security definer set search_path = public
as $$
declare
  v_room          public.room_matches%rowtype;
  v_next_turn     public.team_side;
  v_next_question public.questions%rowtype;
begin
  select * into v_room from public.room_matches where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status <> 'playing' then raise exception 'MATCH_NOT_ACTIVE'; end if;
  if v_room.current_turn <> p_team then raise exception 'NOT_YOUR_TURN'; end if;

  v_next_turn := case when p_team = 'A' then 'B'::public.team_side else 'A'::public.team_side end;

  select * into v_next_question
    from public.questions
   where is_active
     and floor_level = least(
       case when v_next_turn = 'A' then v_room.team_a_position + 1
            else v_room.team_b_position + 1 end, 10)
   order by random()
   limit 1;

  update public.room_matches
     set current_turn = v_next_turn,
         current_question_id = v_next_question.id,
         version = version + 1
   where id = p_room_id
   returning * into v_room;

  return v_room;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Lobby listing: open rooms with occupant usernames and the free slot.
-- ----------------------------------------------------------------------------
create or replace function public.list_waiting_rooms()
returns table (
  room_code          text,
  team_a_username    text,
  team_b_username    text,
  free_slot          public.team_side,
  created_at         timestamptz
)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
    select r.room_code,
           pa.username,
           pb.username,
           case when r.team_b_player_id is null then 'B'::public.team_side
                else 'A'::public.team_side end,
           r.created_at
      from public.room_matches r
      left join public.profiles pa on pa.id = r.team_a_player_id
      left join public.profiles pb on pb.id = r.team_b_player_id
     where r.status = 'waiting'
       and (r.team_a_player_id is null or r.team_b_player_id is null)
     order by r.created_at desc
     limit 20;
end;
$$;

grant execute on function public.join_room(text) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;
grant execute on function public.get_question(uuid) to authenticated;
grant execute on function public.answer_question(uuid, public.team_side, uuid, text) to authenticated;
grant execute on function public.submit_answer(uuid, public.team_side, uuid, text) to authenticated;
grant execute on function public.expire_turn(uuid, public.team_side) to authenticated;
grant execute on function public.list_waiting_rooms() to authenticated;

-- ----------------------------------------------------------------------------
-- 8. Lock down the questions table: no direct reads (correct_key would leak).
--    All question access now flows through get_question / answer_question.
-- ----------------------------------------------------------------------------
drop policy if exists "questions_select" on public.questions;
-- RLS stays enabled with zero policies → every direct table access is denied.

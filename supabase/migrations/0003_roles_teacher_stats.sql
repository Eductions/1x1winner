-- ============================================================================
-- Tower of English — Step 3 migration
-- Run AFTER schema.sql and 0002_step2_gameplay.sql.
--
-- Adds: user roles (student/teacher), teacher question-bank CRUD RPCs,
--       personal stats, match history and a global leaderboard, plus an
--       expanded seed question bank.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Roles and question authorship
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists role text not null default 'student'
  check (role in ('student', 'teacher'));

alter table public.questions
  add column if not exists created_by uuid references public.profiles (id);

-- Even though profiles has an owner UPDATE policy, column privileges make sure
-- a student cannot escalate their own role directly. Role changes only happen
-- through the SECURITY DEFINER RPC below.
revoke update (role) on public.profiles from authenticated;

-- ----------------------------------------------------------------------------
-- 2. Authorization helper
-- ----------------------------------------------------------------------------
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'teacher'
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. Self role switch (classroom prototype; gate behind an admin approval
--    flow in production deployments).
-- ----------------------------------------------------------------------------
create or replace function public.update_my_role(p_role text)
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if p_role not in ('student', 'teacher') then
    raise exception 'INVALID_ROLE';
  end if;

  update public.profiles
     set role = p_role
   where id = auth.uid()
   returning * into v_profile;

  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  return v_profile;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Teacher question-bank CRUD (all teacher-guarded, all SECURITY DEFINER)
-- ----------------------------------------------------------------------------
create or replace function public.create_question(
  p_floor_level  smallint,
  p_category     public.question_category,
  p_prompt       text,
  p_options      jsonb,
  p_correct_key  text,
  p_explanation  text default null
)
returns public.questions
language plpgsql
security definer set search_path = public
as $$
declare
  v_question public.questions%rowtype;
begin
  if not public.is_teacher() then raise exception 'TEACHER_ONLY'; end if;
  if p_floor_level not between 1 and 10 then raise exception 'INVALID_FLOOR'; end if;
  if jsonb_array_length(p_options) <> 4 then raise exception 'OPTIONS_MUST_BE_FOUR'; end if;
  if p_correct_key not in ('A', 'B', 'C', 'D') then raise exception 'INVALID_KEY'; end if;
  if char_length(trim(p_prompt)) < 10 then raise exception 'PROMPT_TOO_SHORT'; end if;

  insert into public.questions
    (floor_level, category, prompt, options, correct_key, explanation, created_by)
  values
    (p_floor_level, p_category, p_prompt, p_options, p_correct_key, p_explanation, auth.uid())
  returning * into v_question;

  return v_question;
end;
$$;

create or replace function public.update_question(
  p_id           uuid,
  p_floor_level  smallint,
  p_category     public.question_category,
  p_prompt       text,
  p_options      jsonb,
  p_correct_key  text,
  p_explanation  text
)
returns public.questions
language plpgsql
security definer set search_path = public
as $$
declare
  v_question public.questions%rowtype;
begin
  if not public.is_teacher() then raise exception 'TEACHER_ONLY'; end if;
  if jsonb_array_length(p_options) <> 4 then raise exception 'OPTIONS_MUST_BE_FOUR'; end if;

  update public.questions
     set floor_level = p_floor_level,
         category = p_category,
         prompt = p_prompt,
         options = p_options,
         correct_key = p_correct_key,
         explanation = p_explanation
   where id = p_id
   returning * into v_question;

  if not found then raise exception 'QUESTION_NOT_FOUND'; end if;
  return v_question;
end;
$$;

-- Soft delete: keeps room_answers history intact.
create or replace function public.archive_question(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_teacher() then raise exception 'TEACHER_ONLY'; end if;
  update public.questions set is_active = false where id = p_id;
  if not found then raise exception 'QUESTION_NOT_FOUND'; end if;
end;
$$;

-- Full question rows (including correct_key) for teachers only.
create or replace function public.teacher_list_questions(p_include_inactive boolean default false)
returns setof public.questions
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_teacher() then raise exception 'TEACHER_ONLY'; end if;

  return query
    select q.*
      from public.questions q
     where p_include_inactive or q.is_active
     order by q.floor_level, q.created_at desc;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Personal statistics
-- ----------------------------------------------------------------------------
create or replace function public.get_my_stats()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_played  int;
  v_wins    int;
  v_answers int;
  v_correct int;
begin
  select count(*) into v_played
    from public.room_matches r
   where r.status = 'finished'
     and (r.team_a_player_id = auth.uid() or r.team_b_player_id = auth.uid());

  select count(*) into v_wins
    from public.room_matches r
   where r.status = 'finished'
     and (
       (r.winner = 'A' and r.team_a_player_id = auth.uid())
       or (r.winner = 'B' and r.team_b_player_id = auth.uid())
     );

  select count(*), count(*) filter (where is_correct)
    into v_answers, v_correct
    from public.room_answers
   where player_id = auth.uid();

  return jsonb_build_object(
    'matches_played', v_played,
    'matches_won', v_wins,
    'answers_total', v_answers,
    'answers_correct', v_correct
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Global leaderboard: wins first, then correct answers, then accuracy.
-- ----------------------------------------------------------------------------
create or replace function public.get_leaderboard(p_limit int default 10)
returns table (
  username        text,
  matches_played  bigint,
  matches_won     bigint,
  answers_total   bigint,
  answers_correct bigint,
  accuracy        numeric
)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
    with finished_sides as (
      select team_a_player_id as player_id, (winner = 'A') as user_won
        from public.room_matches
       where status = 'finished' and team_a_player_id is not null
      union all
      select team_b_player_id, (winner = 'B')
        from public.room_matches
       where status = 'finished' and team_b_player_id is not null
    ),
    played as (
      select player_id,
             count(*) as matches_played,
             count(*) filter (where user_won) as matches_won
        from finished_sides
       group by player_id
    ),
    answered as (
      select player_id,
             count(*) as answers_total,
             count(*) filter (where is_correct) as answers_correct
        from public.room_answers
       group by player_id
    )
    select p.username,
           coalesce(pl.matches_played, 0),
           coalesce(pl.matches_won, 0),
           coalesce(an.answers_total, 0),
           coalesce(an.answers_correct, 0),
           case when coalesce(an.answers_total, 0) = 0 then 0
                else round(100.0 * an.answers_correct / an.answers_total, 1)
           end
      from public.profiles p
      left join played pl on pl.player_id = p.id
      left join answered an on an.player_id = p.id
     where coalesce(pl.matches_played, 0) + coalesce(an.answers_total, 0) > 0
     order by matches_won desc, answers_correct desc, username asc
     limit greatest(1, least(p_limit, 50));
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Personal match history
-- ----------------------------------------------------------------------------
create or replace function public.get_my_matches()
returns table (
  room_code    text,
  status       public.match_status,
  my_team      public.team_side,
  my_position  smallint,
  winner       public.team_side,
  finished_at  timestamptz
)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
    select r.room_code,
           r.status,
           case when r.team_a_player_id = auth.uid() then 'A'::public.team_side
                else 'B'::public.team_side end,
           case when r.team_a_player_id = auth.uid() then r.team_a_position
                else r.team_b_position end,
           r.winner,
           r.finished_at
      from public.room_matches r
     where r.team_a_player_id = auth.uid() or r.team_b_player_id = auth.uid()
     order by coalesce(r.finished_at, r.created_at) desc
     limit 20;
end;
$$;

grant execute on function public.update_my_role(text) to authenticated;
grant execute on function public.create_question(smallint, public.question_category, text, jsonb, text, text) to authenticated;
grant execute on function public.update_question(uuid, smallint, public.question_category, text, jsonb, text, text) to authenticated;
grant execute on function public.archive_question(uuid) to authenticated;
grant execute on function public.teacher_list_questions(boolean) to authenticated;
grant execute on function public.get_my_stats() to authenticated;
grant execute on function public.get_leaderboard(integer) to authenticated;
grant execute on function public.get_my_matches() to authenticated;

-- ----------------------------------------------------------------------------
-- 8. Expanded question bank: two extra questions per floor (20 new rows).
-- ----------------------------------------------------------------------------
insert into public.questions (floor_level, category, prompt, options, correct_key, explanation)
select v.floor_level, v.category, v.prompt, v.options::jsonb, v.correct_key, v.explanation
from (values
  (1, 'vocabulary', 'Choose the word for the place where university classes are held.',
   '[{"key":"A","text":"Campus"},{"key":"B","text":"Kitchen"},{"key":"C","text":"Garage"},{"key":"D","text":"Harbor"}]',
   'A', 'A campus is the grounds and buildings of a university.'),
  (1, 'grammar', 'My brother and I ___ students at the same faculty.',
   '[{"key":"A","text":"am"},{"key":"B","text":"is"},{"key":"C","text":"are"},{"key":"D","text":"be"}]',
   'C', 'Plural subject "my brother and I" takes "are".'),
  (2, 'grammar', 'There ___ many books in the university library.',
   '[{"key":"A","text":"is"},{"key":"B","text":"are"},{"key":"C","text":"was"},{"key":"D","text":"be"}]',
   'B', '"Many books" is plural, so use "there are".'),
  (2, 'vocabulary', 'A person who studies at a university is called a…',
   '[{"key":"A","text":"Patient"},{"key":"B","text":"Client"},{"key":"C","text":"Student"},{"key":"D","text":"Customer"}]',
   'C', 'University attendees are students.'),
  (3, 'vocabulary', 'Choose the synonym of "begin".',
   '[{"key":"A","text":"Finish"},{"key":"B","text":"Start"},{"key":"C","text":"Stop"},{"key":"D","text":"Delay"}]',
   'B', '"Begin" and "start" are synonyms.'),
  (3, 'grammar', 'She is interested ___ environmental engineering.',
   '[{"key":"A","text":"on"},{"key":"B","text":"at"},{"key":"C","text":"in"},{"key":"D","text":"for"}]',
   'C', 'The adjective "interested" takes the preposition "in".'),
  (4, 'grammar', 'The students ___ their assignments when the internet cut out.',
   '[{"key":"A","text":"submit"},{"key":"B","text":"were submitting"},{"key":"C","text":"submits"},{"key":"D","text":"are submit"}]',
   'B', 'An action in progress in the past uses past continuous.'),
  (4, 'vocabulary', 'Choose the antonym of "ancient".',
   '[{"key":"A","text":"Old"},{"key":"B","text":"Modern"},{"key":"C","text":"Historic"},{"key":"D","text":"Rare"}]',
   'B', '"Modern" is the opposite of "ancient".'),
  (5, 'reading', '"The deadline was extended by a week." means students have…',
   '[{"key":"A","text":"less time"},{"key":"B","text":"one more week"},{"key":"C","text":"no deadline"},{"key":"D","text":"a stricter rule"}]',
   'B', 'Extending a deadline adds extra time.'),
  (5, 'grammar', 'Neither the lecturer nor the assistants ___ available yesterday.',
   '[{"key":"A","text":"is"},{"key":"B","text":"was"},{"key":"C","text":"were"},{"key":"D","text":"be"}]',
   'C', 'With "nor", the verb agrees with the nearer plural subject.'),
  (6, 'grammar', 'The scholarship application must ___ before Friday.',
   '[{"key":"A","text":"submit"},{"key":"B","text":"be submitted"},{"key":"C","text":"submitting"},{"key":"D","text":"submitted"}]',
   'B', 'Passive modal: must + be + past participle.'),
  (6, 'vocabulary', 'Choose the synonym of "reliable".',
   '[{"key":"A","text":"Trustworthy"},{"key":"B","text":"Careless"},{"key":"C","text":"Expensive"},{"key":"D","text":"Hidden"}]',
   'A', 'A reliable person can be trusted.'),
  (7, 'writing', 'Which is the most formal way to open an email to a professor?',
   '[{"key":"A","text":"Hey prof!"},{"key":"B","text":"Dear Dr. Ahmed,"},{"key":"C","text":"What'"'"'s up?"},{"key":"D","text":"Yo!"}]',
   'B', 'Formal emails use a title and surname after "Dear".'),
  (7, 'grammar', 'If she ___ the workshop, she would have earned the certificate.',
   '[{"key":"A","text":"attends"},{"key":"B","text":"attended"},{"key":"C","text":"had attended"},{"key":"D","text":"will attend"}]',
   'C', 'Third conditional uses past perfect in the if-clause.'),
  (8, 'grammar', 'The research, ___ was published last month, is widely cited.',
   '[{"key":"A","text":"who"},{"key":"B","text":"which"},{"key":"C","text":"where"},{"key":"D","text":"whose"}]',
   'B', '"Which" refers to a thing (the research) in a non-defining clause.'),
  (8, 'vocabulary', 'Choose the word meaning "to look at something quickly".',
   '[{"key":"A","text":"Glance"},{"key":"B","text":"Stare"},{"key":"C","text":"Whisper"},{"key":"D","text":"March"}]',
   'A', 'To glance is to take a quick look.'),
  (9, 'writing', 'Choose the sentence with correct punctuation.',
   '[{"key":"A","text":"Its a well known fact."},{"key":"B","text":"It'"'"'s a well-known fact."},{"key":"C","text":"Its a well-known fact,"},{"key":"D","text":"It'"'"'s a well known fact"}]',
   'B', '"It'"'"'s" needs an apostrophe; "well-known" is hyphenated.'),
  (9, 'grammar', 'Rarely ___ such a brilliant lecture before.',
   '[{"key":"A","text":"I have heard"},{"key":"B","text":"have I heard"},{"key":"C","text":"I heard"},{"key":"D","text":"did I heard"}]',
   'B', 'Negative adverbials trigger inversion: "Rarely have I heard".'),
  (10, 'vocabulary', 'Choose the word meaning "the ability to keep trying despite difficulty".',
   '[{"key":"A","text":"Perseverance"},{"key":"B","text":"Indifference"},{"key":"C","text":"Confusion"},{"key":"D","text":"Permission"}]',
   'A', 'Perseverance is persistent effort through obstacles.'),
  (10, 'grammar', 'Had the data been accurate, the conclusion ___ valid.',
   '[{"key":"A","text":"is"},{"key":"B","text":"was"},{"key":"C","text":"would have been"},{"key":"D","text":"will be"}]',
   'C', 'Inverted third conditional pairs with "would have + past participle".')
) as v(floor_level, category, prompt, options, correct_key, explanation)
where not exists (
  select 1 from public.questions q where q.prompt = v.prompt
);

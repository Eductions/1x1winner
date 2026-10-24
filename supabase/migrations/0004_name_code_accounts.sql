-- ============================================================================
-- Tower of English — Step 4: supervisor-managed name + access-code accounts
-- Run AFTER schema.sql, 0002_step2_gameplay.sql and
-- 0003_roles_teacher_stats.sql.
--
-- Product rule:
--   * Nobody signs up by email and nobody creates their own account.
--   * The first supervisor is created through the protected one-time /setup
--     flow in the web app.
--   * The supervisor then creates each student with a unique name + code.
--
-- Technically, Supabase Auth still supplies the session/password engine. The
-- app derives a non-deliverable internal identifier ending in
-- @login.1x1winner.local from the player's name and uses the access code as
-- the password. Users only ever see/type their name and code.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Names and roles are managed only by the server-side Admin API.
--    Authenticated players may not rename themselves (their name is their
--    sign-in identity) and may never change their own role.
-- ----------------------------------------------------------------------------
revoke update (username, role) on public.profiles from authenticated;

-- The Step-3 classroom prototype allowed any signed-in player to promote
-- themselves. Remove that escape hatch entirely.
drop function if exists public.update_my_role(text);

create index if not exists profiles_role_idx on public.profiles (role);

-- ----------------------------------------------------------------------------
-- 2. Only managed accounts may receive a profile.
--
-- The Next.js server creates users through Supabase's Admin API with:
--   app_metadata.managed_account = true
--   app_metadata.managed_role    = 'student' | 'teacher' (supervisor)
--   email                        = ...@login.1x1winner.local
--
-- Public callers cannot set app_metadata through signUp. If a direct public
-- sign-up is attempted, this trigger rejects the auth-user insert. For
-- defence in depth, also disable public sign-ups in Supabase Auth settings.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'managed_account', '') <> 'true'
     or lower(coalesce(new.email, '')) not like '%@login.1x1winner.local' then
    raise exception 'MANAGED_ACCOUNTS_ONLY';
  end if;

  insert into public.profiles (id, username, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    case
      when new.raw_app_meta_data ->> 'managed_role' = 'teacher' then 'teacher'
      else 'student'
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

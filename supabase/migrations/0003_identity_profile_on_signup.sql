-- Migration 0003 (identity): create a profiles row automatically when a user signs up (FR-ID-01).
-- Append-only: 0001 and 0002 are never edited.
--
-- Why a trigger and not an insert from the app: with phone confirmation on, sign-up returns no session,
-- so the app cannot insert into profiles under RLS (own_profile requires id = auth.uid()).
-- The trigger runs inside the same transaction as the auth.users insert, so a user never exists without a profile.
--
-- security definer: the function runs as its owner, because the signing-up user has no rights on profiles yet.
-- search_path = '': every name below is schema-qualified, so a malicious object on the search path cannot be picked up.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  -- full_name comes from the sign-up form via auth metadata (options.data.full_name). Blank becomes null.
  insert into public.profiles (id, full_name)
  values (new.id, nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''))
  on conflict (id) do nothing;  -- idempotent: a retried or replayed insert never fails sign-up
  return new;
end;
$$;

-- A trigger function cannot be called directly, but keep it off the public API surface anyway.
-- Supabase grants execute on new functions to anon/authenticated by default; plain PostgreSQL has no such roles.
revoke all on function public.handle_new_user() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.handle_new_user() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.handle_new_user() from authenticated;
  end if;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

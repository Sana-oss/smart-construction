-- Plain-PostgreSQL stand-in for Supabase auth. Used ONLY by the local/CI database tests.
create schema auth;
-- Only the columns our migrations read. raw_user_meta_data mirrors Supabase (sign-up options.data), used by 0003/0005.
create table auth.users(id uuid primary key, raw_user_meta_data jsonb not null default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true),'')::uuid $$;

-- Supabase's API roles and their default privileges, so migrations that revoke from them are tested for real
-- (e.g. 0005 limits authenticated to updating profiles.full_name). Created BEFORE the migrations, like on Supabase.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;

-- Plain-PostgreSQL stand-in for Supabase auth. Used ONLY by the local/CI database tests.
create schema auth;
-- Only the columns our migrations read. raw_user_meta_data mirrors Supabase (sign-up options.data), used by 0003.
create table auth.users(id uuid primary key, raw_user_meta_data jsonb not null default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true),'')::uuid $$;

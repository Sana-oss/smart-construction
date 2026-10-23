-- Plain-PostgreSQL stand-in for Supabase auth. Used ONLY by the local/CI database tests.
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true),'')::uuid $$;

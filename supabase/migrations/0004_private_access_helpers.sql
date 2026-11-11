-- Migration 0004 (shared security): move the RLS helpers out of the API schema (NFR-SEC-01).
-- Append-only: 0001–0003 are never edited.
--
-- Problem (Supabase security advisor, lints 0028/0029): is_member() and can_write() are SECURITY DEFINER
-- functions in "public", and Supabase exposes every function in "public" as an RPC endpoint
-- (/rest/v1/rpc/is_member). Low risk (each one only answers about the caller, via auth.uid()), but an
-- API surface we never meant to open.
--
-- Fix: move both to a schema the API does not expose. Policies keep working unchanged, because a policy
-- stores a reference to the function itself, not its name, so moving the schema does not break them.
--
-- Why we still grant usage + execute: every RLS policy runs with the caller's privileges, so the roles
-- that query project tables (anon, authenticated) must be able to execute the helpers. Without the grant,
-- a query would fail with "permission denied" instead of returning only the caller's rows.
-- That is safe, because "private" is not in the API's exposed schemas, so there is no endpoint to call.

create schema if not exists private;
revoke all on schema private from public;

alter function public.is_member(uuid) set schema private;
alter function public.can_write(uuid) set schema private;

-- The helpers reference projects/project_members without a schema; pin their search_path to public explicitly.
alter function private.is_member(uuid) set search_path = public;
alter function private.can_write(uuid) set search_path = public;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant usage on schema private to anon;
    grant execute on function private.is_member(uuid), private.can_write(uuid) to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema private to authenticated;
    grant execute on function private.is_member(uuid), private.can_write(uuid) to authenticated;
  end if;
end $$;

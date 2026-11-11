-- Tests for migration 0004 (RLS helpers moved out of the API schema). Runs after rls_0003.test.sql.
-- The RLS behaviour itself (owner/viewer/stranger) is already re-proven by rls.test.sql and rls_0002.test.sql,
-- which run AFTER all migrations, so they exercise the policies with the helpers already in "private".
reset role;

-- 1. The helpers are gone from "public" and live in "private"
do $$ begin
  if to_regprocedure('public.is_member(uuid)') is not null or to_regprocedure('public.can_write(uuid)') is not null then
    raise exception 'LEAK: RLS helper still in public (exposed as /rest/v1/rpc/...)';
  end if;
  if to_regprocedure('private.is_member(uuid)') is null or to_regprocedure('private.can_write(uuid)') is null then
    raise exception 'FAIL: RLS helper missing from private';
  end if;
  raise notice 'OK: is_member/can_write live in private, not public';
end $$;

-- 2. No SECURITY DEFINER function callable as an API remains in "public"
--    (trigger functions such as handle_new_user cannot be called directly, so they are excluded)
do $$
declare names text;
begin
  select string_agg(p.proname, ', ') into names
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype;
  if names is not null then raise exception 'LEAK: SECURITY DEFINER functions still in public: %', names; end if;
  raise notice 'OK: no callable SECURITY DEFINER function left in public';
end $$;

-- 3. The policies now call the private helpers
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'expenses' and qual like '%private.is_member%') then
    raise exception 'FAIL: expenses read policy does not use private.is_member';
  end if;
  raise notice 'OK: policies reference private helpers';
end $$;

-- 4. The helpers still pin search_path (a SECURITY DEFINER function must not use the caller's search_path)
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'private' and p.prosecdef and p.proconfig is null) then
    raise exception 'FAIL: a private SECURITY DEFINER helper has no fixed search_path';
  end if;
  raise notice 'OK: private helpers have a fixed search_path';
end $$;

-- 5. The owner still sees their project through the moved helpers (smoke check after the move)
set role app_user;
set app.uid='00000000-0000-0000-0000-00000000000a';
do $$ begin
  if (select count(*) from projects) < 1 then raise exception 'FAIL: owner lost access after moving helpers'; end if;
  raise notice 'OK: owner still reads own project';
end $$;
reset role;

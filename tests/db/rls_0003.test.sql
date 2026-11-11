-- Tests for migration 0003 (profile created on sign-up). Runs after rls.test.sql and rls_0002.test.sql.
-- Sign-up is simulated by inserting into auth.users, which is what Supabase Auth does.
reset role;

-- 1. Sign-up with a name creates a profile with that (trimmed) name
insert into auth.users(id, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000d1', '{"full_name":"  Ali  "}');
do $$ begin
  if not exists (select 1 from profiles where id = '00000000-0000-0000-0000-0000000000d1' and full_name = 'Ali') then
    raise exception 'FAIL: sign-up with name did not create profile "Ali"';
  end if;
  raise notice 'OK: sign-up creates profile with trimmed name';
end $$;

-- 2. Sign-up without a name (or a blank one) still creates a profile, with a null name
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000d2');
insert into auth.users(id, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000d3', '{"full_name":"   "}');
do $$ begin
  if (select count(*) from profiles where id in ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000d3') and full_name is null) <> 2 then
    raise exception 'FAIL: sign-up without a name did not create a profile with null name';
  end if;
  raise notice 'OK: sign-up without a name creates profile with null name';
end $$;

-- 3. Every auth user has exactly one profile (no user without a profile)
do $$ begin
  if exists (select 1 from auth.users u left join profiles p on p.id = u.id where p.id is null) then
    raise exception 'FAIL: an auth user has no profile';
  end if;
  raise notice 'OK: every auth user has a profile';
end $$;

-- 4. Deleting the auth user removes the profile (on delete cascade from 0001)
delete from auth.users where id = '00000000-0000-0000-0000-0000000000d3';
do $$ begin
  if exists (select 1 from profiles where id = '00000000-0000-0000-0000-0000000000d3') then
    raise exception 'FAIL: profile survived deletion of its auth user';
  end if;
  raise notice 'OK: deleting the auth user removes the profile';
end $$;

-- 5. RLS on profiles: a user reads and edits only their own profile
set role app_user;
set app.uid='00000000-0000-0000-0000-0000000000d1';
do $$
declare n bigint;
begin
  select count(*) into n from profiles;
  if n <> 1 then raise exception 'LEAK: user sees % profiles, expected only their own', n; end if;
  update profiles set full_name = 'hacked' where id = '00000000-0000-0000-0000-0000000000d2';
  get diagnostics n = row_count;
  if n > 0 then raise exception 'LEAK: user edited another profile'; end if;
  update profiles set full_name = 'Ali B' where id = '00000000-0000-0000-0000-0000000000d1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: user could not edit own profile'; end if;
  raise notice 'OK: profiles are private to their owner';
end $$;
do $$ begin
  insert into profiles(id, full_name) values ('00000000-0000-0000-0000-0000000000e9', 'Fake');
  raise exception 'LEAK: user created a profile for someone else';
exception when others then if sqlerrm like 'LEAK%' then raise; end if; raise notice 'OK: user cannot create a profile for another id'; end $$;

-- 6. Clients cannot call the trigger function directly to create profiles.
-- (The test harness grants app_user execute on every function, so this proves the call fails even then.)
do $$ begin
  perform public.handle_new_user();
  raise exception 'LEAK: handle_new_user callable directly';
exception when others then if sqlerrm like 'LEAK%' then raise; end if; raise notice 'OK: handle_new_user cannot be called directly'; end $$;
reset role;

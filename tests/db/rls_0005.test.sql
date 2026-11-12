-- Tests for migration 0005 (identity document at sign-up, FR-ID-06). Runs last.
-- Sign-up is simulated by inserting into auth.users, which is what Supabase Auth does.
reset role;

-- 1. A Libyan sign-up stores the national number; spaces/dashes are stripped; a stray passport is NOT stored
insert into auth.users(id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', '{"nationality":"libyan","national_id":"1 1990-0000 041","passport_number":"XX999999"}');
do $$ begin
  if not exists (select 1 from profiles where id = '00000000-0000-0000-0000-0000000000f1'
                 and nationality = 'libyan' and national_id = '119900000041' and passport_number is null) then
    raise exception 'FAIL: Libyan sign-up did not store exactly the national number';
  end if;
  raise notice 'OK: Libyan sign-up stores only the national number';
end $$;

-- 2. A foreign sign-up stores the passport number upper-case, and no national number
insert into auth.users(id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f2', '{"nationality":"foreign","passport_number":"ab 123456","national_id":"119900000052"}');
do $$ begin
  if not exists (select 1 from profiles where id = '00000000-0000-0000-0000-0000000000f2'
                 and nationality = 'foreign' and passport_number = 'AB123456' and national_id is null) then
    raise exception 'FAIL: foreign sign-up did not store exactly the passport number';
  end if;
  raise notice 'OK: foreign sign-up stores only the passport number';
end $$;

-- 3. Sign-up is refused without a document, with a malformed number, or with a number already registered.
--    The whole sign-up fails: no auth user is left without a profile.
do $$ begin
  insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000f3');
  raise exception 'LEAK: sign-up without identity document accepted';
exception when check_violation then raise notice 'OK: sign-up without identity document refused'; end $$;
do $$ begin
  insert into auth.users(id, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000f4', '{"nationality":"libyan","national_id":"319900000041"}');
  raise exception 'LEAK: malformed national number accepted';
exception when check_violation then raise notice 'OK: malformed national number refused'; end $$;
do $$ begin
  insert into auth.users(id, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000f5', '{"nationality":"libyan","national_id":"119900000041"}');
  raise exception 'LEAK: duplicate national number accepted';
exception when unique_violation then raise notice 'OK: duplicate national number refused'; end $$;
do $$ begin
  insert into auth.users(id, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000f6', '{"nationality":"foreign","passport_number":"ab123456"}');
  raise exception 'LEAK: duplicate passport number accepted (case-insensitive)';
exception when unique_violation then raise notice 'OK: duplicate passport number refused'; end $$;
do $$ begin
  if exists (select 1 from auth.users where id in ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000f4',
             '00000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-0000000000f6')) then
    raise exception 'FAIL: a refused sign-up left an auth user behind';
  end if;
  raise notice 'OK: refused sign-ups leave no user behind';
end $$;

-- 4. As a real signed-in user (Supabase "authenticated" role): reads own number, may rename, may NOT change the number
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000f1';
do $$
declare n bigint;
begin
  if (select national_id from profiles where id = '00000000-0000-0000-0000-0000000000f1') is distinct from '119900000041' then
    raise exception 'FAIL: user cannot read own national number';
  end if;
  update profiles set full_name = 'Salem' where id = '00000000-0000-0000-0000-0000000000f1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: user cannot change own name'; end if;
  raise notice 'OK: user reads own number and can rename';
end $$;
do $$ begin
  update profiles set national_id = '119900000099' where id = '00000000-0000-0000-0000-0000000000f1';
  raise exception 'LEAK: user changed own national number';
exception when insufficient_privilege then raise notice 'OK: user cannot change own national number'; end $$;
do $$ begin
  update profiles set nationality = 'foreign', national_id = null, passport_number = 'NEWPASS1' where id = '00000000-0000-0000-0000-0000000000f1';
  raise exception 'LEAK: user changed own nationality/passport';
exception when insufficient_privilege then raise notice 'OK: user cannot change nationality or passport'; end $$;

-- 5. Nobody else sees the numbers: not a stranger, and not a member of the same project
--    (b is a viewer on a's project in rls.test.sql)
set app.uid = '00000000-0000-0000-0000-0000000000f2';
do $$ begin
  if exists (select 1 from profiles where national_id is not null or id <> '00000000-0000-0000-0000-0000000000f2') then
    raise exception 'LEAK: user sees another person''s profile or national number';
  end if;
  raise notice 'OK: stranger sees no one else''s identity document';
end $$;
set app.uid = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  if exists (select 1 from profiles where id = '00000000-0000-0000-0000-00000000000a') then
    raise exception 'LEAK: project member reads the owner''s profile (national number)';
  end if;
  raise notice 'OK: project member cannot read the owner''s identity document';
end $$;

-- 6. Anonymous visitors see nothing
set role anon;
set app.uid = '';
do $$ begin
  if (select count(*) from profiles) > 0 then raise exception 'LEAK: anon reads profiles'; end if;
  raise notice 'OK: anon reads no profiles';
end $$;
reset role;

-- Tests for site photos (migration 0013, FR-DOC-02). Uses Owner One (...a1) and Owner Two (...a2) from
-- rls_0006.test.sql. The storage bucket and its policies need Supabase's storage schema; they are tested end to end
-- on staging (tests/e2e). Here: the photos table, its guard, and the path helper.
reset role;

-- 1. The owner records a photo in their project folder, linked to their own phase
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_phase uuid; v_path text;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_phase from phases where project_id = v_project and position = 2;
  v_path := v_project::text || '/photos/a0000000-0000-4000-8000-000000000001.jpg';
  insert into photos (project_id, phase_id, storage_path, taken_on, note, size_bytes)
  values (v_project, v_phase, v_path, private.today_tripoli(), 'تسليح السقف', 240000);
  if not exists (select 1 from photos where storage_path = v_path and created_at is not null and size_bytes = 240000) then
    raise exception 'FAIL: photo not stored';
  end if;
  raise notice 'OK: owner records a photo';
end $$;

-- 2. Wrong paths, another project's phase, a future date and a long note are refused
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_other uuid; v_other_phase uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  reset role;
  select p.id, ph.id into v_other, v_other_phase from projects p join phases ph on ph.project_id = p.id
   where p.owner_id = '00000000-0000-0000-0000-0000000000a2' and ph.position = 1;
  set role authenticated;

  begin
    insert into photos (project_id, storage_path) values (v_project, v_other::text || '/photos/a0000000-0000-4000-8000-000000000002.jpg');
    raise exception 'FAIL: path in another project''s folder accepted';
  exception when check_violation then raise notice 'OK: path outside the project folder refused'; end;

  begin
    insert into photos (project_id, storage_path) values (v_project, v_project::text || '/photos/../x.jpg');
    raise exception 'FAIL: odd path accepted';
  exception when check_violation then raise notice 'OK: malformed path refused'; end;

  begin
    insert into photos (project_id, storage_path) values (v_project, v_project::text || '/photos/a0000000-0000-4000-8000-000000000001.jpg');
    raise exception 'FAIL: same path twice accepted';
  exception when unique_violation then raise notice 'OK: one row per stored file'; end;

  begin
    insert into photos (project_id, phase_id, storage_path)
    values (v_project, v_other_phase, v_project::text || '/photos/a0000000-0000-4000-8000-000000000003.jpg');
    raise exception 'FAIL: another project''s phase accepted';
  exception when foreign_key_violation then raise notice 'OK: phase of another project refused'; end;

  begin
    insert into photos (project_id, storage_path, taken_on)
    values (v_project, v_project::text || '/photos/a0000000-0000-4000-8000-000000000004.jpg', private.today_tripoli() + 1);
    raise exception 'FAIL: photo dated after today accepted';
  exception when check_violation then raise notice 'OK: future date refused'; end;

  begin
    insert into photos (project_id, storage_path, note)
    values (v_project, v_project::text || '/photos/a0000000-0000-4000-8000-000000000005.jpg', repeat('ب', 501));
    raise exception 'FAIL: 501-character note accepted';
  exception when check_violation then raise notice 'OK: long note refused'; end;
end $$;

-- 3. A stranger cannot read, add or delete the owner's photos
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare v_project uuid; n int;
begin
  reset role;
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  set role authenticated;
  if exists (select 1 from photos where project_id = v_project) then raise exception 'LEAK: stranger reads photos'; end if;
  begin
    insert into photos (project_id, storage_path) values (v_project, v_project::text || '/photos/a0000000-0000-4000-8000-000000000006.jpg');
    raise exception 'LEAK: stranger added a photo';
  exception when insufficient_privilege then raise notice 'OK: stranger cannot add a photo'; end;
  delete from photos where project_id = v_project;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'LEAK: stranger deleted photos'; end if;
  raise notice 'OK: stranger cannot read, add or delete photos';
end $$;

-- 4. The path helper used by the storage policies
reset role;
do $$ begin
  if private.project_of_path('11111111-1111-4111-8111-111111111111/photos/x.jpg') <> '11111111-1111-4111-8111-111111111111'::uuid
     or private.project_of_path('not-a-uuid/photos/x.jpg') is not null
     or private.project_of_path('11111111-1111-4111-8111-111111111111') is not null then
    raise exception 'FAIL: project_of_path';
  end if;
  raise notice 'OK: project_of_path reads only a leading uuid folder';
end $$;

-- 5. A member of BOTH projects still cannot link a photo in their own project to the other project's phase
--    (RLS alone would allow it; only the guard refuses).
reset role;
insert into project_members (project_id, user_id, role)
  select id, '00000000-0000-0000-0000-0000000000a2', 'viewer' from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare v_own uuid; v_other_phase uuid;
begin
  select id into v_own from projects where owner_id = '00000000-0000-0000-0000-0000000000a2';
  select ph.id into v_other_phase from phases ph join projects p on p.id = ph.project_id
   where p.owner_id = '00000000-0000-0000-0000-0000000000a1' and ph.position = 1;
  if v_other_phase is null then raise exception 'SETUP: the member should see the other project''s phases'; end if;
  begin
    insert into photos (project_id, phase_id, storage_path)
    values (v_own, v_other_phase, v_own::text || '/photos/a0000000-0000-4000-8000-000000000007.jpg');
    raise exception 'FAIL: photo linked to a visible phase of another project';
  exception when foreign_key_violation then raise notice 'OK: visible phase of another project refused'; end;
end $$;
reset role;
delete from project_members where user_id = '00000000-0000-0000-0000-0000000000a2';

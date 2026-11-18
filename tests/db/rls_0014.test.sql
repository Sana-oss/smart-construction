-- Tests for project documents (migration 0014, FR-DOC-01). Uses Owner One (...a1) and Owner Two (...a2) from
-- rls_0006.test.sql. Storage policies are tested end to end on staging (tests/e2e/documents.spec.ts).
reset role;

-- 1. The owner records a PDF linked to their own phase
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_phase uuid; v_path text;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_phase from phases where project_id = v_project and position = 2;
  v_path := v_project::text || '/documents/d0000000-0000-4000-8000-000000000001.pdf';
  insert into documents (project_id, phase_id, kind, title, version, storage_path, content_type, size_bytes)
  values (v_project, v_phase, 'plan', 'مخطط السقف المعتمد', '03', v_path, 'application/pdf', 812000);
  if not exists (select 1 from documents where storage_path = v_path and title = 'مخطط السقف المعتمد' and version = '03') then
    raise exception 'FAIL: document not stored';
  end if;
  raise notice 'OK: owner records a document';
end $$;

-- 2. Wrong path, extension, kind, type, size, title and another project's phase are refused
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_other uuid; v_other_phase uuid; v_base text;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  reset role;
  select p.id, ph.id into v_other, v_other_phase from projects p join phases ph on ph.project_id = p.id
   where p.owner_id = '00000000-0000-0000-0000-0000000000a2' and ph.position = 1;
  set role authenticated;
  v_base := v_project::text || '/documents/d0000000-0000-4000-8000-0000000000';

  begin
    insert into documents (project_id, kind, title, storage_path, content_type, size_bytes)
    values (v_project, 'plan', 'وثيقة', v_other::text || '/documents/d0000000-0000-4000-8000-000000000002.pdf', 'application/pdf', 10);
    raise exception 'FAIL: path in another project''s folder accepted';
  exception when check_violation then raise notice 'OK: path outside the project folder refused'; end;

  begin
    insert into documents (project_id, kind, title, storage_path, content_type, size_bytes)
    values (v_project, 'plan', 'وثيقة', 'not-a-path.pdf', 'application/pdf', 10);
    raise exception 'FAIL: malformed path accepted';
  exception when check_violation then raise notice 'OK: malformed path refused'; end;

  begin
    insert into documents (project_id, kind, title, storage_path, content_type, size_bytes)
    values (v_project, 'plan', 'وثيقة', v_base || '03.jpg', 'application/pdf', 10);
    raise exception 'FAIL: extension not matching the type accepted';
  exception when check_violation then raise notice 'OK: extension must match the type'; end;

  begin
    insert into documents (project_id, kind, title, storage_path, content_type, size_bytes)
    values (v_project, 'receipt', 'وثيقة', v_base || '04.pdf', 'application/pdf', 10);
    raise exception 'FAIL: unknown kind accepted';
  exception when check_violation then raise notice 'OK: unknown kind refused'; end;

  begin
    insert into documents (project_id, kind, title, storage_path, content_type, size_bytes)
    values (v_project, 'plan', 'وثيقة', v_base || '05.pdf', 'application/msword', 10);
    raise exception 'FAIL: Word file accepted';
  exception when check_violation then raise notice 'OK: other file types refused'; end;

  begin
    insert into documents (project_id, kind, title, storage_path, content_type, size_bytes)
    values (v_project, 'plan', 'وثيقة', v_base || '06.pdf', 'application/pdf', 10485761);
    raise exception 'FAIL: file over 10 MB accepted';
  exception when check_violation then raise notice 'OK: over 10 MB refused'; end;

  begin
    insert into documents (project_id, kind, title, storage_path, content_type, size_bytes)
    values (v_project, 'plan', ' ا ', v_base || '07.pdf', 'application/pdf', 10);
    raise exception 'FAIL: one-letter title accepted';
  exception when check_violation then raise notice 'OK: too short title refused'; end;

  begin
    insert into documents (project_id, phase_id, kind, title, storage_path, content_type, size_bytes)
    values (v_project, v_other_phase, 'plan', 'وثيقة', v_base || '08.pdf', 'application/pdf', 10);
    raise exception 'FAIL: another project''s phase accepted';
  exception when foreign_key_violation then raise notice 'OK: phase of another project refused'; end;
end $$;

-- 3. A stranger cannot read, add or delete the owner's documents
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare v_project uuid; n int;
begin
  reset role;
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  set role authenticated;
  if exists (select 1 from documents where project_id = v_project) then raise exception 'LEAK: stranger reads documents'; end if;
  begin
    insert into documents (project_id, kind, title, storage_path, content_type, size_bytes)
    values (v_project, 'plan', 'وثيقة غريب', v_project::text || '/documents/d0000000-0000-4000-8000-000000000009.pdf', 'application/pdf', 10);
    raise exception 'LEAK: stranger added a document';
  exception when insufficient_privilege then raise notice 'OK: stranger cannot add a document'; end;
  delete from documents where project_id = v_project;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'LEAK: stranger deleted documents'; end if;
  raise notice 'OK: stranger cannot read, add or delete documents';
end $$;

-- 4. A member of BOTH projects cannot link a document to the other project's phase (only the guard refuses)
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
    insert into documents (project_id, phase_id, kind, title, storage_path, content_type, size_bytes)
    values (v_own, v_other_phase, 'plan', 'ربط بمشروع آخر', v_own::text || '/documents/d0000000-0000-4000-8000-000000000010.pdf', 'application/pdf', 10);
    raise exception 'FAIL: document linked to a visible phase of another project';
  exception when foreign_key_violation then raise notice 'OK: visible phase of another project refused'; end;
end $$;
reset role;
delete from project_members where user_id = '00000000-0000-0000-0000-0000000000a2';

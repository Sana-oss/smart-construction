-- Tests for phase tasks (migration 0012, FR-PRJ-04). Uses Owner One (...a1) and Owner Two (...a2) from
-- rls_0006.test.sql, one project each.
reset role;

-- 1. The owner adds a task to a phase of their project; finishing it sets done_at, reopening clears it
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_phase uuid; v_task uuid; v_done timestamptz;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_phase from phases where project_id = v_project and position = 2;

  insert into tasks (project_id, phase_id, title, due_date) values (v_project, v_phase, 'تجهيز الشدة', date '2026-11-25')
  returning id into v_task;
  if not exists (select 1 from tasks where id = v_task and status = 'todo' and done_at is null and created_at is not null) then
    raise exception 'FAIL: new task not stored as expected';
  end if;

  update tasks set status = 'done', done_at = null where id = v_task;
  select done_at into v_done from tasks where id = v_task;
  if v_done is null then raise exception 'FAIL: done_at not set when the task was finished'; end if;

  update tasks set status = 'todo', done_at = now() where id = v_task;
  if (select done_at from tasks where id = v_task) is not null then raise exception 'FAIL: done_at kept after reopening'; end if;

  insert into tasks (project_id, phase_id, title, status, done_at) values (v_project, v_phase, 'طلب الحديد', 'doing', now());
  if exists (select 1 from tasks where title = 'طلب الحديد' and done_at is not null) then
    raise exception 'FAIL: done_at accepted from the client on a task that is not done';
  end if;
  raise notice 'OK: owner adds tasks; done_at follows the status';
end $$;

-- 2. The owner cannot link a task to a phase of another project, nor move a task to another project
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_other_phase uuid; v_other_project uuid; v_task uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  reset role;
  select ph.id, ph.project_id into v_other_phase, v_other_project from phases ph join projects p on p.id = ph.project_id
   where p.owner_id = '00000000-0000-0000-0000-0000000000a2' and ph.position = 1;
  set role authenticated;

  begin
    insert into tasks (project_id, phase_id, title) values (v_project, v_other_phase, 'مرحلة من مشروع آخر');
    raise exception 'FAIL: task linked to another project''s phase';
  exception when foreign_key_violation then raise notice 'OK: phase of another project refused'; end;

  select id into v_task from tasks where project_id = v_project and title = 'تجهيز الشدة';
  begin
    update tasks set project_id = v_other_project where id = v_task;
    raise exception 'FAIL: task moved to another project';
  exception when check_violation or insufficient_privilege then raise notice 'OK: a task cannot move to another project'; end;
end $$;

-- 3. A stranger (Owner Two) cannot read, add, change or delete Owner One's tasks
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare v_project uuid; v_task uuid; n int;
begin
  reset role;
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_task from tasks where project_id = v_project and title = 'تجهيز الشدة';
  set role authenticated;

  if exists (select 1 from tasks where project_id = v_project) then raise exception 'LEAK: stranger reads tasks'; end if;
  begin
    insert into tasks (project_id, title) values (v_project, 'مهمة غريب');
    raise exception 'LEAK: stranger added a task';
  exception when insufficient_privilege then raise notice 'OK: stranger cannot add a task'; end;
  update tasks set status = 'done' where id = v_task;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'LEAK: stranger updated a task'; end if;
  delete from tasks where id = v_task;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'LEAK: stranger deleted a task'; end if;
  reset role;
  if not exists (select 1 from tasks where id = v_task and status = 'todo') then raise exception 'LEAK: the task changed'; end if;
  raise notice 'OK: stranger cannot read, add, change or delete tasks';
end $$;

-- 4. Title rules in the database: 2 to 120 characters after trimming
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  begin
    insert into tasks (project_id, title) values (v_project, '  ا  ');
    raise exception 'FAIL: one-letter title accepted';
  exception when check_violation then raise notice 'OK: too short title refused'; end;
  begin
    insert into tasks (project_id, title) values (v_project, repeat('ب', 121));
    raise exception 'FAIL: 121-letter title accepted';
  exception when check_violation then raise notice 'OK: too long title refused'; end;
end $$;
reset role;

-- 5. Someone who can see BOTH projects (Owner Two, also a member of Owner One's project) still cannot link a task
--    in their own project to a phase of the other one. Here RLS alone would allow it; only the guard refuses.
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
    insert into tasks (project_id, phase_id, title) values (v_own, v_other_phase, 'ربط بمشروع آخر');
    raise exception 'FAIL: task in one project linked to a visible phase of another project';
  exception when foreign_key_violation then raise notice 'OK: visible phase of another project refused'; end;
end $$;
reset role;
delete from project_members where user_id = '00000000-0000-0000-0000-0000000000a2';

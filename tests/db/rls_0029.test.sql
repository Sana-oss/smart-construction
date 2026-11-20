-- Tests for the defects list (migration 0029; FR-QLT-06, FR-QLT-07). Uses Owner One (...a1) and Owner Two (...a2) from
-- rls_0006.test.sql, one project each.
reset role;

-- 1. A defect with its phase, place, priority and due date; the dates of its states come from the database
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_phase uuid; v_id uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_phase from phases where project_id = v_project and position = 2;
  insert into issues (project_id, title, phase_id, location, responsible, severity, due_on, started_at, closed_at)
    values (v_project, 'مراجعة تسليح السقف', v_phase, 'الدور الأرضي · المحور ب', 'مقاول الهيكل', 'critical', '2026-12-01',
            timestamptz '2000-01-01', timestamptz '2000-01-01')
    returning id into v_id;
  if not exists (select 1 from issues where id = v_id and status = 'open' and started_at is null and closed_at is null) then
    raise exception 'FAIL: the dates of the states were taken from the client';
  end if;
  perform set_config('test.d_project', v_project::text, false);
  perform set_config('test.d_phase', v_phase::text, false);
  perform set_config('test.d_issue', v_id::text, false);

  -- In progress, then closed, then reopened.
  update issues set status = 'in_progress' where id = v_id;
  if (select started_at from issues where id = v_id) is null then raise exception 'FAIL: started_at was not set'; end if;
  update issues set status = 'closed', closed_at = null where id = v_id;
  if (select closed_at from issues where id = v_id) is null then raise exception 'FAIL: closed_at was not set'; end if;
  update issues set status = 'open' where id = v_id;
  if exists (select 1 from issues where id = v_id and (closed_at is not null or started_at is null)) then
    raise exception 'FAIL: reopening did not clear closed_at, or lost started_at';
  end if;
  begin
    update issues set status = 'resolved' where id = v_id;
    raise exception 'FAIL: an unknown state was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into issues (project_id, title, severity) values (v_project, 'x', 'minor');
    raise exception 'FAIL: a one-letter title was accepted';
  exception when check_violation then null;
  end;
  raise notice 'OK: a defect is stored; its states are dated by the database; an unknown state is refused';
end $$;

-- 2. The phase, the checklist and the photo belong to this project; a photo is one defect's
reset role;
do $$
declare v_foreign_phase uuid;
begin
  select ph.id into v_foreign_phase from phases ph join projects p on p.id = ph.project_id
    where p.owner_id = '00000000-0000-0000-0000-0000000000a2' limit 1;
  perform set_config('test.d_foreign_phase', v_foreign_phase::text, false);
  -- Past RLS: the guard itself refuses another project's phase.
  begin
    insert into issues (project_id, title, severity, phase_id) values (current_setting('test.d_project')::uuid, 'عيب', 'minor', v_foreign_phase);
    raise exception 'FAIL: a phase of another project was accepted';
  exception when foreign_key_violation then null;
  end;
  raise notice 'OK: a phase of another project is refused';
end $$;
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project text := current_setting('test.d_project'); v_id uuid := current_setting('test.d_issue')::uuid; v_other uuid;
begin
  update issues set photo_path = v_project || '/issues/11111111-1111-4111-8111-111111111111.jpg' where id = v_id;
  begin
    update issues set photo_path = v_project || '/receipts/22222222-2222-4222-8222-222222222222.jpg' where id = v_id;
    raise exception 'FAIL: a receipt path was accepted';
  exception when check_violation then null;
  end;
  begin
    update issues set photo_path = v_project || '/issues/../photos/x.png' where id = v_id;
    raise exception 'FAIL: a badly named file in the issues folder was accepted';
  exception when check_violation then null;
  end;
  begin
    update issues set photo_path = '00000000-0000-0000-0000-0000000000ff/issues/22222222-2222-4222-8222-222222222222.jpg' where id = v_id;
    raise exception 'FAIL: another project''s folder was accepted';
  exception when check_violation then null;
  end;
  insert into issues (project_id, title, severity) values (v_project::uuid, 'شرخ في الجدار', 'minor') returning id into v_other;
  begin
    update issues set photo_path = v_project || '/issues/11111111-1111-4111-8111-111111111111.jpg' where id = v_other;
    raise exception 'FAIL: one photo was used by two defects';
  exception when unique_violation then null;
  end;
  begin
    update issues set project_id = '00000000-0000-0000-0000-0000000000ff' where id = v_other;
    raise exception 'FAIL: a defect moved to another project';
  exception when check_violation or insufficient_privilege then null;
  end;
  delete from issues where id = v_other;
  raise notice 'OK: photos stay in the project''s folder, one defect each; a defect never moves';
end $$;

-- The guard itself refuses moving a defect (past RLS, to another real project)
reset role;
do $$ begin
  update issues set project_id = (select id from projects where owner_id = '00000000-0000-0000-0000-0000000000a2')
    where id = current_setting('test.d_issue')::uuid;
  raise exception 'FAIL: a defect moved to another project';
exception when check_violation then raise notice 'OK: the guard refuses moving a defect';
end $$;

-- 3. Every change and deletion is audited
reset role;
do $$ begin
  if not exists (select 1 from audit_log where table_name = 'issues' and action = 'updated'
                 and detail -> 'before' ->> 'status' = 'open' and detail -> 'after' ->> 'status' = 'in_progress') then
    raise exception 'FAIL: the state change was not audited';
  end if;
  if not exists (select 1 from audit_log where table_name = 'issues' and action = 'deleted'
                 and detail -> 'before' ->> 'title' = 'شرخ في الجدار') then
    raise exception 'FAIL: the deletion was not audited';
  end if;
  raise notice 'OK: changes and deletions are audited';
end $$;

-- 4. Finishing a phase with confirmed open defects is logged in the same transaction; without them nothing extra
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_phase uuid := current_setting('test.d_phase')::uuid; v_other uuid;
begin
  select id into v_other from phases where project_id = current_setting('test.d_project')::uuid and status <> 'done' and id <> v_phase order by position limit 1;
  perform set_config('test.d_other_phase', v_other::text, false);
  perform update_phase_schedule(v_phase, 'done', null, null, null, null, null, '["مراجعة تسليح السقف (مفتوح)"]'::jsonb);
  perform update_phase_schedule(v_other, 'done');
  begin
    perform update_phase_schedule(v_other, 'done', null, null, null, null, null, '[]'::jsonb);
    raise exception 'FAIL: an empty list of open defects was accepted';
  exception when check_violation then null;
  end;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from audit_log where table_name = 'phases' and action = 'close_confirmed_with_open_issues'
                 and detail ->> 'phase_id' = current_setting('test.d_phase')
                 and detail -> 'open_issues' ->> 0 = 'مراجعة تسليح السقف (مفتوح)') then
    raise exception 'FAIL: the confirmed close was not logged with its open defects';
  end if;
  if exists (select 1 from audit_log where table_name = 'phases' and action = 'close_confirmed_with_open_issues'
             and detail ->> 'phase_id' = current_setting('test.d_other_phase')) then
    raise exception 'FAIL: a close without open defects was logged as confirmed';
  end if;
  raise notice 'OK: a close with open defects is confirmed and logged; one without is not';
end $$;

-- 5. A stranger sees and changes nothing; anon cannot call the new function
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare n bigint;
begin
  if exists (select 1 from issues where project_id = current_setting('test.d_project')::uuid) then
    raise exception 'LEAK: stranger read the defects';
  end if;
  update issues set status = 'closed' where id = current_setting('test.d_issue')::uuid;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'LEAK: stranger changed a defect'; end if;
  begin
    insert into issues (project_id, title, severity) values (current_setting('test.d_project')::uuid, 'عيب غريب', 'minor');
    raise exception 'LEAK: stranger added a defect';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK: stranger cannot read or write defects';
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon', 'public.update_phase_schedule(uuid, text, date, date, date, date, jsonb, jsonb)', 'execute') then
    raise exception 'LEAK: anon may execute update_phase_schedule';
  end if;
  raise notice 'OK: anon cannot call update_phase_schedule';
end $$;

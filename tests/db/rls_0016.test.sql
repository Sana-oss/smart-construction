-- Tests for editing and deleting an expense (migration 0016; decision of 19 Nov 2026; FR-SYS-03). Uses Owner One
-- (...a1) and Owner Two (...a2) from rls_0006.test.sql, one project each.
reset role;

-- 1. The owner edits an expense: the change is stored, and ONE audit row (old and new values) and ONE event are
--    written in the same transaction. Saving without a change records nothing.
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_phase uuid; v_id uuid; a record;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_phase from phases where project_id = v_project and position = 2;
  select expense_id into v_id from create_expense(v_project, 500, 'e0000000-0000-4000-8000-000000001601', 'رمل', 'materials');

  update expenses set amount_lyd = 650.25, title = 'رمل مغسول', expense_type = 'services', phase_id = v_phase,
                      payee = 'مورد', paid_on = private.today_tripoli() - 3
  where id = v_id;
  if not exists (select 1 from expenses where id = v_id and amount_lyd = 650.25 and title = 'رمل مغسول' and phase_id = v_phase) then
    raise exception 'FAIL: the edit was not stored';
  end if;

  select * into a from audit_log where table_name = 'expenses' and detail ->> 'expense_id' = v_id::text;
  if a is null or a.action <> 'updated' or a.actor_id <> '00000000-0000-0000-0000-0000000000a1' or a.project_id <> v_project
     or (a.detail -> 'before' ->> 'amount_lyd')::numeric <> 500 or (a.detail -> 'after' ->> 'amount_lyd')::numeric <> 650.25
     or a.detail -> 'before' ->> 'title' <> 'رمل' then
    raise exception 'FAIL: the audit row does not hold who, the old and the new values: %', a;
  end if;

  update expenses set title = 'رمل مغسول' where id = v_id; -- same value
  if (select count(*) from audit_log where detail ->> 'expense_id' = v_id::text) <> 1 then
    raise exception 'FAIL: a save without a change was recorded';
  end if;

  reset role;
  if (select count(*) from outbox_events where event_type = 'expense.updated' and payload ->> 'expense_id' = v_id::text
      and payload ->> 'amount_lyd' = '650.250' and payload ->> 'previous_amount_lyd' = '500.000') <> 1 then
    raise exception 'FAIL: expected one expense.updated event with both amounts as text';
  end if;
  raise notice 'OK: an edit is stored with one audit row and one event';
end $$;

-- 2. An edit keeps the rules of a new expense, and never changes what identifies the expense
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_other uuid; v_other_phase uuid; v_id uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  reset role;
  select id into v_other from projects where owner_id = '00000000-0000-0000-0000-0000000000a2';
  select id into v_other_phase from phases where project_id = v_other limit 1;
  set role authenticated;
  select expense_id into v_id from create_expense(v_project, 10, 'e0000000-0000-4000-8000-000000001602', 'ماء', 'services');

  begin
    update expenses set title = '  ' where id = v_id;
    raise exception 'FAIL: empty name accepted';
  exception when check_violation then raise notice 'OK: name required'; end;
  begin
    update expenses set title = null where id = v_id; -- the table allows null (old rows); an edit may not clear it
    raise exception 'FAIL: name removed by an edit';
  exception when check_violation then raise notice 'OK: name cannot be removed'; end;
  begin
    update expenses set expense_type = null where id = v_id;
    raise exception 'FAIL: missing type accepted';
  exception when check_violation then raise notice 'OK: type required'; end;
  begin
    update expenses set paid_on = private.today_tripoli() + 1 where id = v_id;
    raise exception 'FAIL: future date accepted';
  exception when check_violation then raise notice 'OK: no future date'; end;
  begin
    update expenses set amount_lyd = 0 where id = v_id;
    raise exception 'FAIL: zero amount accepted';
  exception when check_violation then raise notice 'OK: amount must be positive'; end;
  begin
    update expenses set phase_id = v_other_phase where id = v_id;
    raise exception 'FAIL: phase of another project accepted';
  exception when foreign_key_violation then raise notice 'OK: phase of this project only'; end;
  begin
    update expenses set project_id = v_other where id = v_id;
    raise exception 'FAIL: expense moved to another project';
  exception when check_violation then raise notice 'OK: an expense never moves'; end;
  begin
    update expenses set client_op_id = 'e0000000-0000-4000-8000-000000001699' where id = v_id;
    raise exception 'FAIL: client_op_id changed';
  exception when check_violation then raise notice 'OK: client_op_id kept'; end;
  begin
    update expenses set receipt_path = v_project::text || '/receipts/f0000000-0000-4000-8000-000000001601.jpg' where id = v_id;
    raise exception 'FAIL: receipt changed by an edit';
  exception when check_violation then raise notice 'OK: receipt kept'; end;
  begin
    update expenses set created_at = now() - interval '1 year' where id = v_id;
    raise exception 'FAIL: creation time changed';
  exception when check_violation then raise notice 'OK: creation time kept'; end;
end $$;

-- 3. The owner deletes an expense with a receipt: the row is gone; the audit row keeps every old value
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_id uuid; v_path text; a record;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  v_path := v_project::text || '/receipts/f0000000-0000-4000-8000-000000001602.jpg';
  select expense_id into v_id from create_expense(v_project, 1234.5, 'e0000000-0000-4000-8000-000000001603', 'بلوك', 'materials',
                                                  null, 'مصنع', null, v_path);
  delete from expenses where id = v_id;
  if exists (select 1 from expenses where id = v_id) then raise exception 'FAIL: expense not deleted'; end if;

  select * into a from audit_log where table_name = 'expenses' and action = 'deleted' and detail ->> 'expense_id' = v_id::text;
  if a is null or a.actor_id <> '00000000-0000-0000-0000-0000000000a1'
     or (a.detail -> 'before' ->> 'amount_lyd')::numeric <> 1234.5 or a.detail -> 'before' ->> 'title' <> 'بلوك'
     or a.detail -> 'before' ->> 'payee' <> 'مصنع' or a.detail -> 'before' ->> 'receipt_path' <> v_path then
    raise exception 'FAIL: the audit row does not keep the deleted values: %', a;
  end if;

  reset role;
  if (select count(*) from outbox_events where event_type = 'expense.deleted' and payload ->> 'expense_id' = v_id::text
      and payload ->> 'amount_lyd' = '1234.500' and (payload ->> 'had_receipt')::boolean) <> 1 then
    raise exception 'FAIL: expected one expense.deleted event';
  end if;
  raise notice 'OK: a deletion keeps the old values in the audit log and emits one event';
end $$;

-- 4. A stranger cannot edit or delete, and leaves no audit row; a read-only member cannot either
reset role;
insert into project_members (project_id, user_id, role)
  select id, '00000000-0000-0000-0000-0000000000a2', 'viewer' from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_id uuid; v_audit int; n int;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select expense_id into v_id from create_expense(v_project, 77, 'e0000000-0000-4000-8000-000000001604', 'غداء العمال', 'labor');
  select count(*) into v_audit from audit_log;

  set app.uid = '00000000-0000-0000-0000-0000000000a2'; -- a viewer of this project: reads, never writes
  if not exists (select 1 from expenses where id = v_id) then raise exception 'SETUP: the viewer should see the expense'; end if;
  update expenses set amount_lyd = 1 where id = v_id;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a viewer edited an expense'; end if;
  delete from expenses where id = v_id;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a viewer deleted an expense'; end if;

  set app.uid = '00000000-0000-0000-0000-0000000000a1';
  if (select amount_lyd from expenses where id = v_id) <> 77 then raise exception 'FAIL: the expense changed'; end if;
  if (select count(*) from audit_log) <> v_audit then raise exception 'FAIL: a refused change left an audit row'; end if;
  raise notice 'OK: a read-only member cannot edit or delete';
end $$;
reset role;
delete from project_members where user_id = '00000000-0000-0000-0000-0000000000a2';

set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare n int;
begin
  update expenses set amount_lyd = 1 where title = 'غداء العمال';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a stranger edited an expense'; end if;
  delete from expenses where title = 'غداء العمال';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a stranger deleted an expense'; end if;
  raise notice 'OK: a stranger cannot edit or delete';
end $$;

-- 5. Deleting a phase still works: its expenses lose the phase ("on delete set null") without breaking the guard,
--    and the change is recorded like any other
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_phase uuid; v_id uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  insert into phases (project_id, name, position) values (v_project, 'مرحلة مؤقتة', 99) returning id into v_phase;
  select expense_id into v_id from create_expense(v_project, 5, 'e0000000-0000-4000-8000-000000001605', 'مؤقت', 'services', v_phase);
  delete from phases where id = v_phase;
  if (select phase_id from expenses where id = v_id) is not null then raise exception 'FAIL: phase not cleared'; end if;
  if not exists (select 1 from audit_log where action = 'updated' and detail ->> 'expense_id' = v_id::text) then
    raise exception 'FAIL: the cleared phase was not recorded';
  end if;
  raise notice 'OK: deleting a phase clears it from its expenses';
end $$;

-- 6. Deleting a whole account (as the e2e cleanup does, with no signed-in user) still works: the cascade deletes the
--    project's expenses without trying to write audit rows for a project that is going away
reset role;
set app.uid = '';
do $$
declare v_user uuid := '00000000-0000-0000-0000-0000000016c1'; v_project uuid;
begin
  insert into auth.users(id, raw_user_meta_data) values (v_user, '{"full_name":"Temp","nationality":"foreign","passport_number":"TEMP0016"}');
  insert into projects (owner_id, name) values (v_user, 'مشروع مؤقت') returning id into v_project;
  insert into expenses (project_id, amount_lyd, title, expense_type) values (v_project, 9, 'مؤقت', 'labor');
  delete from auth.users where id = v_user;
  if exists (select 1 from projects where id = v_project) then raise exception 'FAIL: project not deleted'; end if;
  raise notice 'OK: deleting an account still deletes its expenses';
end $$;

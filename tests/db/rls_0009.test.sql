-- Tests for create_expense (migrations 0008 and 0009): expense + event in one transaction, idempotent, with
-- the design's fields (name, amount, type, phase, supplier, date). Runs last.
-- Replaces rls_0008.test.sql: all migrations run before all tests, and 0009 changed the function's
-- parameters, so the 0008 tests could no longer call it. Everything they checked is checked here.
-- Uses Owner One (...a1) and Owner Two (...a2) from rls_0006.test.sql, one project each.
-- rls_0007.test.sql left 2 expenses (1000.375 LYD) and 2 events in Owner One's project.
reset role;

-- 1. The owner records an expense with all six fields: one expense row and one event, together
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare
  v_project uuid;
  v_phase uuid;
  r record;
  v_events_before bigint;
  v_events_after bigint;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_phase from phases where project_id = v_project and position = 2;
  reset role; select count(*) into v_events_before from outbox_events; set role authenticated;

  select * into r from create_expense(v_project, 12000.750, 'e0000000-0000-4000-8000-000000000001',
    '  حديد تسليح  ', 'materials', v_phase, ' مورد الحديد ', date '2026-11-09');
  if not r.created or r.expense_id is null then raise exception 'FAIL: first call must create the expense'; end if;
  if not exists (select 1 from expenses where id = r.expense_id and project_id = v_project and amount_lyd = 12000.750
                 and title = 'حديد تسليح' and expense_type = 'materials' and phase_id = v_phase
                 and payee = 'مورد الحديد' and paid_on = date '2026-11-09'
                 and client_op_id = 'e0000000-0000-4000-8000-000000000001') then
    raise exception 'FAIL: expense not stored as given';
  end if;

  reset role;
  select count(*) into v_events_after from outbox_events;
  if v_events_after <> v_events_before + 1 then raise exception 'FAIL: expected exactly one new event'; end if;
  if not exists (select 1 from outbox_events where project_id = v_project and event_type = 'expense.created'
                 and payload ->> 'expense_id' = r.expense_id::text and payload ->> 'amount_lyd' = '12000.750'
                 and jsonb_typeof(payload -> 'amount_lyd') = 'string' and payload ->> 'expense_type' = 'materials'
                 and processed_at is null) then
    raise exception 'FAIL: expense.created event missing or wrong';
  end if;
  raise notice 'OK: expense and its event created together';
end $$;

-- 2. Idempotent: the same client_op_id again gives the ORIGINAL id, no second expense, no second event
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare
  v_project uuid;
  v_first uuid;
  r record;
  v_events bigint;
  v_expenses bigint;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_first from expenses where client_op_id = 'e0000000-0000-4000-8000-000000000001';
  select count(*) into v_expenses from expenses where project_id = v_project;
  reset role; select count(*) into v_events from outbox_events; set role authenticated;

  -- Even with different values: the first request wins, the retry changes nothing.
  select * into r from create_expense(v_project, 9999, 'e0000000-0000-4000-8000-000000000001', 'شيء آخر', 'labor');
  if r.created or r.expense_id <> v_first then raise exception 'FAIL: retry must return the original expense, created = false'; end if;
  if (select count(*) from expenses where project_id = v_project) <> v_expenses then raise exception 'FAIL: retry created a second expense'; end if;
  if not exists (select 1 from expenses where id = v_first and amount_lyd = 12000.750 and title = 'حديد تسليح' and expense_type = 'materials') then
    raise exception 'FAIL: retry changed the stored expense';
  end if;
  reset role;
  if (select count(*) from outbox_events) <> v_events then raise exception 'FAIL: retry emitted a second event'; end if;
  raise notice 'OK: a repeated request creates nothing and returns the original id';
end $$;

-- 3. Only name, amount and type: phase and supplier stay empty, the date defaults to today in Libya
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; r record;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select * into r from create_expense(v_project, 0.001, 'e0000000-0000-4000-8000-000000000002', 'أجور فريق الصب', 'labor');
  if not exists (select 1 from expenses where id = r.expense_id and amount_lyd = 0.001 and expense_type = 'labor'
                 and phase_id is null and payee is null and paid_on = (now() at time zone 'Africa/Tripoli')::date) then
    raise exception 'FAIL: expense with only the required fields not stored correctly';
  end if;
  select * into r from create_expense(v_project, 950, 'e0000000-0000-4000-8000-000000000003', 'نقل مواد', 'services', null, '   ');
  if (select payee from expenses where id = r.expense_id) is not null then raise exception 'FAIL: a blank supplier must be stored as empty'; end if;
  raise notice 'OK: required fields alone are enough; a blank supplier is stored as empty';
end $$;

-- 4. Refused inputs: nothing is stored and no event is emitted (one transaction)
do $$
declare v_project uuid; v_expenses bigint; v_events bigint; v_other_phase uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select count(*) into v_expenses from expenses where project_id = v_project;
  reset role;
  select count(*) into v_events from outbox_events;
  select ph.id into v_other_phase from phases ph join projects p on p.id = ph.project_id
    where p.owner_id = '00000000-0000-0000-0000-0000000000a2' limit 1;
  set role authenticated;

  begin
    perform create_expense(v_project, 0, 'e0000000-0000-4000-8000-000000000010', 'صفر', 'materials');
    raise exception 'LEAK: zero amount accepted';
  exception when check_violation then null; end;
  begin
    perform create_expense(v_project, -5, 'e0000000-0000-4000-8000-000000000011', 'سالب', 'materials');
    raise exception 'LEAK: negative amount accepted';
  exception when check_violation then null; end;
  begin
    perform create_expense(v_project, 10, null, 'بلا معرّف', 'materials');
    raise exception 'LEAK: expense without client_op_id accepted';
  exception when check_violation then null; end;
  begin
    perform create_expense(v_project, 10, 'e0000000-0000-4000-8000-000000000012', '   ', 'materials');
    raise exception 'LEAK: expense without a name accepted';
  exception when check_violation then null; end;
  begin
    perform create_expense(v_project, 10, 'e0000000-0000-4000-8000-000000000013', 'ح', 'materials');
    raise exception 'LEAK: one-letter name accepted';
  exception when check_violation then null; end;
  begin
    perform create_expense(v_project, 10, 'e0000000-0000-4000-8000-000000000014', 'بلا نوع', null);
    raise exception 'LEAK: expense without a type accepted';
  exception when check_violation then null; end;
  begin
    perform create_expense(v_project, 10, 'e0000000-0000-4000-8000-000000000015', 'نوع مجهول', 'other');
    raise exception 'LEAK: unknown expense type accepted';
  exception when check_violation then null; end;
  begin
    perform create_expense(v_project, 10, 'e0000000-0000-4000-8000-000000000016', 'تاريخ قادم', 'materials', null, null,
      ((now() at time zone 'Africa/Tripoli')::date + 1));
    raise exception 'LEAK: future date accepted';
  exception when check_violation then null; end;
  begin
    perform create_expense(v_project, 10, 'e0000000-0000-4000-8000-000000000017', 'مرحلة غريبة', 'materials', v_other_phase);
    raise exception 'LEAK: another project''s phase accepted';
  exception when foreign_key_violation then null; end;

  if (select count(*) from expenses where project_id = v_project) <> v_expenses then
    raise exception 'FAIL: a refused request left an expense behind';
  end if;
  reset role;
  if (select count(*) from outbox_events) <> v_events then raise exception 'FAIL: a refused request left an event behind'; end if;
  raise notice 'OK: bad amount, missing id, name or type, future date and foreign phase are refused, nothing stored';
end $$;

-- 5. A stranger and a viewer cannot record expenses in the project; an editor can
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare other uuid;
begin
  reset role;
  select id into other from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  set role authenticated;
  perform create_expense(other, 10, 'e0000000-0000-4000-8000-000000000020', 'غريب', 'materials');
  raise exception 'LEAK: stranger recorded an expense in another project';
exception when insufficient_privilege then raise notice 'OK: stranger cannot record expenses'; end $$;
reset role;
insert into project_members(project_id, user_id, role)
  select id, '00000000-0000-0000-0000-0000000000a2', 'viewer' from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare other uuid;
begin
  select id into other from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  perform create_expense(other, 10, 'e0000000-0000-4000-8000-000000000021', 'قارئ', 'materials');
  raise exception 'LEAK: viewer recorded an expense';
exception when insufficient_privilege then raise notice 'OK: viewer cannot record expenses'; end $$;
reset role;
update project_members set role = 'editor' where user_id = '00000000-0000-0000-0000-0000000000a2';
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare other uuid; r record;
begin
  select id into other from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select * into r from create_expense(other, 75, 'e0000000-0000-4000-8000-000000000022', 'مستلزمات موقع', 'materials');
  if not r.created then raise exception 'FAIL: editor should be able to record an expense'; end if;
  raise notice 'OK: editor recorded an expense';
end $$;
reset role;
do $$ begin
  if (select count(*) from expenses where client_op_id in ('e0000000-0000-4000-8000-000000000020', 'e0000000-0000-4000-8000-000000000021')) <> 0 then
    raise exception 'LEAK: a refused expense was stored';
  end if;
end $$;
delete from project_members where user_id = '00000000-0000-0000-0000-0000000000a2';

-- 6. The same client_op_id in ANOTHER project is a different expense (the id is unique per project)
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare v_project uuid; r record;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a2';
  select * into r from create_expense(v_project, 40, 'e0000000-0000-4000-8000-000000000001', 'خرسانة جاهزة', 'materials');
  if not r.created then raise exception 'FAIL: same op id in another project must create a new expense'; end if;
  if (select count(*) from expenses) <> 1 then raise exception 'LEAK: Owner Two sees expenses of another project'; end if;
  raise notice 'OK: client_op_id is per project, and owners see only their own expenses';
end $$;

-- 7. Anonymous visitors cannot call it, and the 0008 version of the function is gone
reset role;
set role anon;
set app.uid = '';
do $$
declare other uuid;
begin
  reset role;
  select id into other from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  set role anon;
  perform create_expense(other, 10, 'e0000000-0000-4000-8000-000000000030', 'مجهول', 'materials');
  raise exception 'LEAK: anon recorded an expense';
exception when insufficient_privilege then raise notice 'OK: anon cannot record expenses'; end $$;
reset role;
do $$ begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'create_expense') <> 1 then
    raise exception 'FAIL: there must be exactly one create_expense function';
  end if;
  raise notice 'OK: one create_expense function only';
end $$;

-- 8. Rows recorded before 0009 (no name, no type) are still valid, and the dashboard total is exact
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v numeric; n bigint;
begin
  select count(*) into n from expenses where title is null and expense_type is null;
  if n <> 2 then raise exception 'FAIL: expected the 2 older expenses without name and type, found %', n; end if;
  select recorded_expenses_lyd into v from budget_summary;
  -- 1000.250 + 0.125 (rls_0007) + 12000.750 + 0.001 + 950 + 75 (this file)
  if v <> 14026.126 then raise exception 'FAIL: budget_summary total is %, expected 14026.126', v; end if;
  raise notice 'OK: older rows stay valid and the recorded total is exact to the dirham';
end $$;
reset role;

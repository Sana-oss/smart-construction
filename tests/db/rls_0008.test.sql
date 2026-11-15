-- Tests for migration 0008 (create_expense: expense + event in one transaction, idempotent). Runs last.
-- Uses Owner One (...a1) and Owner Two (...a2) from rls_0006.test.sql, one project each.
-- rls_0007.test.sql left 2 expenses (1000.375 LYD) and 2 events in Owner One's project.
reset role;

-- Seed as the table owner: a category and a second project's category/phase to test cross-project references.
insert into budget_categories(id, project_id, name)
  select 'c1111111-1111-4111-8111-111111111111', id, 'مواد' from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
insert into budget_categories(id, project_id, name)
  select 'c2222222-2222-4222-8222-222222222222', id, 'مواد' from projects where owner_id = '00000000-0000-0000-0000-0000000000a2';

-- 1. The owner records an expense: one expense row and one event, together
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

  select * into r from create_expense(v_project, 2500.750, 'e0000000-0000-4000-8000-000000000001',
    'c1111111-1111-4111-8111-111111111111', v_phase, '  حديد تسليح  ', null);
  if not r.created or r.expense_id is null then raise exception 'FAIL: first call must create the expense'; end if;
  if not exists (select 1 from expenses where id = r.expense_id and project_id = v_project and amount_lyd = 2500.750
                 and category_id = 'c1111111-1111-4111-8111-111111111111' and phase_id = v_phase
                 and note = 'حديد تسليح' and paid_on = (now() at time zone 'Africa/Tripoli')::date
                 and client_op_id = 'e0000000-0000-4000-8000-000000000001') then
    raise exception 'FAIL: expense not stored as given';
  end if;

  reset role;
  select count(*) into v_events_after from outbox_events;
  if v_events_after <> v_events_before + 1 then raise exception 'FAIL: expected exactly one new event'; end if;
  if not exists (select 1 from outbox_events where project_id = v_project and event_type = 'expense.created'
                 and payload ->> 'expense_id' = r.expense_id::text and payload ->> 'amount_lyd' = '2500.750'
                 and jsonb_typeof(payload -> 'amount_lyd') = 'string' and processed_at is null) then
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

  -- Even with a different amount: the first request wins, the retry changes nothing.
  select * into r from create_expense(v_project, 9999, 'e0000000-0000-4000-8000-000000000001');
  if r.created or r.expense_id <> v_first then raise exception 'FAIL: retry must return the original expense, created = false'; end if;
  if (select count(*) from expenses where project_id = v_project) <> v_expenses then raise exception 'FAIL: retry created a second expense'; end if;
  if (select amount_lyd from expenses where id = v_first) <> 2500.750 then raise exception 'FAIL: retry changed the stored amount'; end if;
  reset role;
  if (select count(*) from outbox_events) <> v_events then raise exception 'FAIL: retry emitted a second event'; end if;
  raise notice 'OK: a repeated request creates nothing and returns the original id';
end $$;

-- 3. Amount only (the quick entry): everything else optional, date defaults to today in Libya
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; r record;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select * into r from create_expense(v_project, 0.001, 'e0000000-0000-4000-8000-000000000002');
  if not exists (select 1 from expenses where id = r.expense_id and amount_lyd = 0.001 and category_id is null
                 and phase_id is null and note is null and paid_on = (now() at time zone 'Africa/Tripoli')::date) then
    raise exception 'FAIL: amount-only expense not stored with empty optional fields';
  end if;
  -- A past date is kept as given.
  select * into r from create_expense(v_project, 10, 'e0000000-0000-4000-8000-000000000003', null, null, null, date '2026-01-15');
  if (select paid_on from expenses where id = r.expense_id) <> date '2026-01-15' then raise exception 'FAIL: past date not kept'; end if;
  raise notice 'OK: amount-only expense, and a past date is kept';
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
    perform create_expense(v_project, 0, 'e0000000-0000-4000-8000-000000000010');
    raise exception 'LEAK: zero amount accepted';
  exception when check_violation then null; end;
  begin
    perform create_expense(v_project, -5, 'e0000000-0000-4000-8000-000000000011');
    raise exception 'LEAK: negative amount accepted';
  exception when check_violation then null; end;
  begin
    perform create_expense(v_project, 10, null);
    raise exception 'LEAK: expense without client_op_id accepted';
  exception when check_violation then null; end;
  begin
    perform create_expense(v_project, 10, 'e0000000-0000-4000-8000-000000000012', null, null, null,
      ((now() at time zone 'Africa/Tripoli')::date + 1));
    raise exception 'LEAK: future date accepted';
  exception when check_violation then null; end;
  begin
    perform create_expense(v_project, 10, 'e0000000-0000-4000-8000-000000000013', 'c2222222-2222-4222-8222-222222222222');
    raise exception 'LEAK: another project''s category accepted';
  exception when foreign_key_violation then null; end;
  begin
    perform create_expense(v_project, 10, 'e0000000-0000-4000-8000-000000000014', null, v_other_phase);
    raise exception 'LEAK: another project''s phase accepted';
  exception when foreign_key_violation then null; end;

  if (select count(*) from expenses where project_id = v_project) <> v_expenses then
    raise exception 'FAIL: a refused request left an expense behind';
  end if;
  reset role;
  if (select count(*) from outbox_events) <> v_events then raise exception 'FAIL: a refused request left an event behind'; end if;
  raise notice 'OK: zero, negative, no op id, future date and foreign references are refused, nothing stored';
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
  perform create_expense(other, 10, 'e0000000-0000-4000-8000-000000000020');
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
  perform create_expense(other, 10, 'e0000000-0000-4000-8000-000000000021');
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
  select * into r from create_expense(other, 75, 'e0000000-0000-4000-8000-000000000022');
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
  select * into r from create_expense(v_project, 40, 'e0000000-0000-4000-8000-000000000001');
  if not r.created then raise exception 'FAIL: same op id in another project must create a new expense'; end if;
  if (select count(*) from expenses) <> 1 then raise exception 'LEAK: Owner Two sees expenses of another project'; end if;
  raise notice 'OK: client_op_id is per project, and owners see only their own expenses';
end $$;

-- 7. Anonymous visitors cannot call it
reset role;
set role anon;
set app.uid = '';
do $$
declare other uuid;
begin
  reset role;
  select id into other from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  set role anon;
  perform create_expense(other, 10, 'e0000000-0000-4000-8000-000000000030');
  raise exception 'LEAK: anon recorded an expense';
exception when insufficient_privilege then raise notice 'OK: anon cannot record expenses'; end $$;
reset role;

-- 8. The dashboard total follows: budget_summary adds up what was recorded (1000.375 from 0007's test + this file)
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v numeric;
begin
  select recorded_expenses_lyd into v from budget_summary;
  -- 1000.250 + 0.125 (rls_0007) + 2500.750 + 0.001 + 10 + 75 (this file)
  if v <> 3586.126 then raise exception 'FAIL: budget_summary total is %, expected 3586.126', v; end if;
  raise notice 'OK: the recorded total is exact to the dirham';
end $$;
reset role;

-- Tests for the receipt photo on an expense (migration 0015). Uses Owner One (...a1) and Owner Two (...a2) from
-- rls_0006.test.sql. Storage itself is tested end to end on staging (tests/e2e).
reset role;

-- 1. The owner records an expense with a receipt in their project's receipts folder
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; r record; v_path text; v_with uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  v_path := v_project::text || '/receipts/f0000000-0000-4000-8000-000000000001.jpg';
  select * into r from create_expense(v_project, 120, 'e0000000-0000-4000-8000-000000000101', 'فاتورة إسمنت', 'materials',
                                      null, null, null, v_path);
  if not r.created or not exists (select 1 from expenses where id = r.expense_id and receipt_path = v_path) then
    raise exception 'FAIL: receipt path not stored';
  end if;
  v_with := r.expense_id;
  -- Without a receipt, as before (every older call still works).
  select * into r from create_expense(v_project, 80, 'e0000000-0000-4000-8000-000000000102', 'نقل', 'services');
  if not r.created or exists (select 1 from expenses where id = r.expense_id and receipt_path is not null) then
    raise exception 'FAIL: expense without a receipt';
  end if;
  reset role;
  if not exists (select 1 from outbox_events where event_type = 'expense.created'
                 and payload ->> 'expense_id' = v_with::text and (payload ->> 'has_receipt')::boolean) then
    raise exception 'FAIL: event does not say the expense has a receipt';
  end if;
  raise notice 'OK: expense with and without a receipt';
end $$;

-- 2. A receipt outside the project's receipts folder, a malformed one, or one used twice is refused
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_other uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  reset role;
  select id into v_other from projects where owner_id = '00000000-0000-0000-0000-0000000000a2';
  set role authenticated;

  begin
    perform create_expense(v_project, 1, 'e0000000-0000-4000-8000-000000000103', 'غريب', 'materials', null, null, null,
                           v_other::text || '/receipts/f0000000-0000-4000-8000-000000000002.jpg');
    raise exception 'FAIL: receipt in another project''s folder accepted';
  exception when check_violation then raise notice 'OK: receipt outside the project refused'; end;

  begin
    perform create_expense(v_project, 1, 'e0000000-0000-4000-8000-000000000104', 'مشوه', 'materials', null, null, null, 'x.jpg');
    raise exception 'FAIL: malformed receipt path accepted';
  exception when check_violation then raise notice 'OK: malformed receipt path refused'; end;

  begin
    perform create_expense(v_project, 1, 'e0000000-0000-4000-8000-000000000105', 'صورة صفحة', 'materials', null, null, null,
                           v_project::text || '/photos/f0000000-0000-4000-8000-000000000003.jpg');
    raise exception 'FAIL: a site photo path used as a receipt';
  exception when check_violation then raise notice 'OK: only the receipts folder'; end;

  begin
    perform create_expense(v_project, 1, 'e0000000-0000-4000-8000-000000000106', 'مكرر', 'materials', null, null, null,
                           v_project::text || '/receipts/f0000000-0000-4000-8000-000000000001.jpg');
    raise exception 'FAIL: one receipt on two expenses';
  exception when unique_violation then raise notice 'OK: one expense per receipt'; end;
end $$;

-- 3. Still exactly one create_expense, and anon cannot call it
reset role;
do $$ begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'create_expense') <> 1 then
    raise exception 'FAIL: there must be exactly one create_expense function';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon')
     -- By name, not by parameters: later versions of create_expense (0020) must stay closed to anon too.
     and has_function_privilege('anon', (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                         where n.nspname = 'public' and p.proname = 'create_expense'), 'execute') then
    raise exception 'FAIL: anon can execute create_expense';
  end if;
  raise notice 'OK: one create_expense, not callable by anon';
end $$;

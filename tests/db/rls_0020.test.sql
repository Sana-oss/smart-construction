-- Tests for foreign currency and reference rates (migration 0020; 3.18, FR-FIN-04). Uses Owner One (...a1) and Owner Two
-- (...a2) from rls_0006.test.sql, one project each.
reset role;

-- 1. A foreign expense keeps its original amount, currency and rate, and its LYD equivalent; old calls still work
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; r record;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select * into r from create_expense(v_project, 7250, 'e0000000-0000-4000-8000-000000002001', 'حديد مستورد', 'materials',
                                      null, null, null, null, 1000, 'USD', 7.25);
  if not r.created or not exists (select 1 from expenses where id = r.expense_id and original_amount = 1000
                                  and original_currency = 'USD' and rate_lyd_per_unit = 7.25 and amount_lyd = 7250) then
    raise exception 'FAIL: foreign expense not stored as given';
  end if;
  -- Rounded to the dirham: 0.333 × 1.0005 = 0.3331665 -> 0.333
  select * into r from create_expense(v_project, 0.333, 'e0000000-0000-4000-8000-000000002002', 'مسامير', 'materials',
                                      null, null, null, null, 0.333, 'TRY', 1.0005);
  if not r.created then raise exception 'FAIL: rounded equivalent refused'; end if;
  -- A LYD expense, as every older call makes it.
  select * into r from create_expense(v_project, 80, 'e0000000-0000-4000-8000-000000002003', 'نقل', 'services');
  if not r.created or exists (select 1 from expenses where id = r.expense_id and original_currency is not null) then
    raise exception 'FAIL: LYD expense changed';
  end if;
  reset role;
  if not exists (select 1 from outbox_events where event_type = 'expense.created' and payload ->> 'original_currency' = 'USD') then
    raise exception 'FAIL: the event does not name the currency';
  end if;
  raise notice 'OK: foreign and LYD expenses';
end $$;

-- 2. An inconsistent foreign expense is refused, whoever sends it
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  begin
    perform create_expense(v_project, 7000, 'e0000000-0000-4000-8000-000000002004', 'حديد', 'materials', null, null, null, null, 1000, 'USD', 7.25);
    raise exception 'FAIL: LYD amount that does not match the rate accepted';
  exception when check_violation then raise notice 'OK: LYD = original × rate'; end;
  begin
    perform create_expense(v_project, 1000, 'e0000000-0000-4000-8000-000000002005', 'حديد', 'materials', null, null, null, null, 1000, 'GBP', 1);
    raise exception 'FAIL: unknown currency accepted';
  exception when check_violation then raise notice 'OK: four currencies only'; end;
  begin
    perform create_expense(v_project, 1000, 'e0000000-0000-4000-8000-000000002006', 'حديد', 'materials', null, null, null, null, 1000, 'USD', null);
    raise exception 'FAIL: currency without a rate accepted';
  exception when check_violation then raise notice 'OK: a currency needs its rate'; end;
  begin
    perform create_expense(v_project, 1000, 'e0000000-0000-4000-8000-000000002007', 'حديد', 'materials', null, null, null, null, null, null, 7.25);
    raise exception 'FAIL: rate without a currency accepted';
  exception when check_violation then raise notice 'OK: a rate needs its currency'; end;
  begin
    perform create_expense(v_project, 1, 'e0000000-0000-4000-8000-000000002008', 'حديد', 'materials', null, null, null, null, -1, 'USD', -1);
    raise exception 'FAIL: negative foreign amount accepted';
  exception when check_violation then raise notice 'OK: positive original amount'; end;
  begin
    perform create_expense(v_project, 1, 'e0000000-0000-4000-8000-000000002009', 'حديد', 'materials', null, null, null, null, 1, 'USD', -1);
    raise exception 'FAIL: negative rate accepted';
  exception when check_violation then raise notice 'OK: positive rate'; end;
  -- An edit keeps the rule: changing the rate without the LYD amount is refused.
  begin
    update expenses set rate_lyd_per_unit = 8 where title = 'حديد مستورد';
    raise exception 'FAIL: an edit broke LYD = original × rate';
  exception when check_violation then raise notice 'OK: edits keep the rule'; end;
end $$;

-- 3. anon cannot call the new create_expense
reset role;
do $$ begin
  if has_function_privilege('anon', 'public.create_expense(uuid, numeric, uuid, text, text, uuid, text, date, text, numeric, text, numeric)', 'execute') then
    raise exception 'FAIL: anon may call create_expense';
  end if;
  if exists (select 1 from pg_proc where proname = 'create_expense' and pronamespace = 'public'::regnamespace and pronargs <> 12) then
    raise exception 'FAIL: an older create_expense is still there';
  end if;
  raise notice 'OK: one create_expense, not for anon';
end $$;

-- 4. The reference rates log: four currencies, not in the future, note length, audited, never moves
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_other uuid; v_id uuid; a record;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  reset role;
  select id into v_other from projects where owner_id = '00000000-0000-0000-0000-0000000000a2';
  set role authenticated;
  insert into exchange_rates (project_id, currency, lyd_per_unit, note) values (v_project, 'USD', 7.25, 'السوق') returning id into v_id;
  if not exists (select 1 from exchange_rates where id = v_id and rate_date = private.today_tripoli() and created_at is not null) then
    raise exception 'FAIL: date or created_at not filled';
  end if;
  begin
    insert into exchange_rates (project_id, currency, lyd_per_unit) values (v_project, 'GBP', 9);
    raise exception 'FAIL: unknown currency in the log accepted';
  exception when check_violation then raise notice 'OK: four currencies in the log'; end;
  begin
    insert into exchange_rates (project_id, currency, lyd_per_unit, rate_date) values (v_project, 'EUR', 8, private.today_tripoli() + 1);
    raise exception 'FAIL: future rate accepted';
  exception when check_violation then raise notice 'OK: no future rate'; end;
  begin
    insert into exchange_rates (project_id, currency, lyd_per_unit, note) values (v_project, 'EUR', 8, repeat('ن', 201));
    raise exception 'FAIL: long note accepted';
  exception when check_violation then raise notice 'OK: note length'; end;
  begin
    update exchange_rates set rate_date = private.today_tripoli() + 2 where id = v_id;
    raise exception 'FAIL: rate moved to the future';
  exception when check_violation then raise notice 'OK: no future date on update'; end;

  update exchange_rates set lyd_per_unit = 7.3 where id = v_id;
  delete from exchange_rates where id = v_id;
  if (select count(*) from audit_log where table_name = 'exchange_rates' and detail ->> 'row_id' = v_id::text) <> 2 then
    raise exception 'FAIL: change and deletion of a rate not audited';
  end if;
  insert into exchange_rates (project_id, currency, lyd_per_unit) values (v_project, 'TRY', 0.2);
  raise notice 'OK: the rates log';
end $$;

reset role;
insert into project_members (project_id, user_id, role)
  select id, '00000000-0000-0000-0000-0000000000a2', 'editor' from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare v_mine uuid;
begin
  select id into v_mine from projects where owner_id = '00000000-0000-0000-0000-0000000000a2';
  begin
    update exchange_rates set project_id = v_mine where currency = 'TRY';
    raise exception 'FAIL: an editor of both projects moved a rate';
  exception when check_violation then raise notice 'OK: the guard keeps the rate in its project'; end;
end $$;
reset role;
delete from project_members where user_id = '00000000-0000-0000-0000-0000000000a2';

-- 5. A stranger can neither read nor change the rates
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare n int;
begin
  if (select count(*) from exchange_rates where currency = 'TRY') <> 0 then raise exception 'FAIL: stranger reads rates'; end if;
  update exchange_rates set lyd_per_unit = 1 where currency = 'TRY';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: stranger changed a rate'; end if;
  delete from exchange_rates where currency = 'TRY';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: stranger deleted a rate'; end if;
  raise notice 'OK: a stranger cannot read, change or delete rates';
end $$;

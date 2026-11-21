-- Tests for paying an installment, its expense and releasing the retained part (migration 0032; FR-FIN-09). Uses Owner One
-- (...a1) and Owner Two (...a2) from rls_0006.test.sql, one project each.
reset role;

-- 1. Paying: ONE expense keyed by the payment id, then the payment is marked paid; a normal payment logs no warning
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_phase uuid; v_contract uuid; v_pay uuid; v_exp uuid; r record;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_phase from phases where project_id = v_project and position = 2;
  insert into contracts (project_id, title, contractor, value_lyd) values (v_project, 'عقد التسوية', 'مقاول التسوية', 100000) returning id into v_contract;
  insert into payments (project_id, contract_id, title, amount_lyd, retained_lyd, phase_id)
    values (v_project, v_contract, 'الدفعة الأولى', 30000, 3000, v_phase) returning id into v_pay;

  select * into r from create_expense(v_project, 27000, v_pay, 'الدفعة الأولى · عقد التسوية', 'labor', v_phase, 'مقاول التسوية', private.today_tripoli());
  v_exp := r.expense_id;
  perform confirm_payment_paid(v_pay, private.today_tripoli(), v_exp);
  if not exists (select 1 from payments where id = v_pay and paid_on = private.today_tripoli() and expense_id = v_exp and released_on is null) then
    raise exception 'FAIL: payment not marked paid with its expense';
  end if;
  if exists (select 1 from audit_log where table_name = 'payments' and action = 'payment_confirmed_before_due' and detail ->> 'payment_id' = v_pay::text) then
    raise exception 'FAIL: a normal payment logged a warning';
  end if;
  if not exists (select 1 from audit_log where table_name = 'payments' and action = 'updated' and detail -> 'after' ->> 'expense_id' = v_exp::text) then
    raise exception 'FAIL: the payment was not audited';
  end if;
  -- the same expense again (a retry) is the same expense
  select * into r from create_expense(v_project, 27000, v_pay, 'الدفعة الأولى · عقد التسوية', 'labor', v_phase, 'مقاول التسوية', private.today_tripoli());
  if r.created or r.expense_id <> v_exp then raise exception 'FAIL: a retry made a second expense'; end if;
  raise notice 'OK: payment paid with one expense, audited, retry-safe';
end $$;

-- 2. Paying before it is due: the confirmation and what was missing are logged in the same transaction
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_contract uuid; v_pay uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_contract from contracts where project_id = v_project and title = 'عقد التسوية';
  insert into payments (project_id, contract_id, title, amount_lyd) values (v_project, v_contract, 'دفعة مبكرة', 5000) returning id into v_pay;
  perform confirm_payment_paid(v_pay, private.today_tripoli(), null, '["phase_not_done","phase_without_photo"]'::jsonb);
  if not exists (select 1 from audit_log where table_name = 'payments' and action = 'payment_confirmed_before_due'
                 and detail ->> 'payment_id' = v_pay::text and jsonb_array_length(detail -> 'gaps') = 2) then
    raise exception 'FAIL: the early confirmation was not logged with its gaps';
  end if;
  begin
    perform confirm_payment_paid(v_pay, private.today_tripoli(), null);
    raise exception 'FAIL: a paid payment was paid again';
  exception when insufficient_privilege then raise notice 'OK: a payment is paid once'; end;
  begin
    perform confirm_payment_paid(gen_random_uuid(), private.today_tripoli(), null);
    raise exception 'FAIL: a payment that does not exist was paid';
  exception when insufficient_privilege then raise notice 'OK: unknown payment refused'; end;
  -- created OUTSIDE the begin blocks: a block that ends in an exception rolls its own inserts back
  insert into payments (project_id, contract_id, title, amount_lyd) values (v_project, v_contract, 'دفعة', 10) returning id into v_pay;
  begin
    perform confirm_payment_paid(v_pay, private.today_tripoli(), null, '[]'::jsonb);
    raise exception 'FAIL: an empty gap list accepted';
  exception when check_violation then raise notice 'OK: gaps must not be empty'; end;
  begin
    perform confirm_payment_paid(v_pay, private.today_tripoli() + 1, null);
    raise exception 'FAIL: a future payment date accepted';
  exception when check_violation then raise notice 'OK: no future payment date'; end;
  raise notice 'OK: early payment confirmation logged';
end $$;

-- 3. A paid payment's amount never changes; its expense must belong to the project and to one payment only
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_other_expense uuid; v_exp uuid; r record;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select expense_id into v_exp from payments where title = 'الدفعة الأولى' and project_id = v_project and expense_id is not null limit 1;
  begin
    update payments set amount_lyd = 31000 where title = 'الدفعة الأولى' and project_id = v_project and paid_on is not null;
    raise exception 'FAIL: the amount of a paid payment changed';
  exception when check_violation then raise notice 'OK: a paid amount never changes'; end;
  begin
    update payments set retained_lyd = 0 where title = 'الدفعة الأولى' and project_id = v_project and paid_on is not null;
    raise exception 'FAIL: the retained part of a paid payment changed';
  exception when check_violation then raise notice 'OK: a paid retained part never changes'; end;
  begin
    update payments set expense_id = v_exp where title = 'دفعة مبكرة' and project_id = v_project;
    raise exception 'FAIL: one expense on two payments';
  exception when unique_violation then raise notice 'OK: one expense belongs to one payment'; end;

  -- an expense of another project
  reset role;
  set role authenticated;
  set app.uid = '00000000-0000-0000-0000-0000000000a2';
  select * into r from create_expense((select id from projects where owner_id = '00000000-0000-0000-0000-0000000000a2'), 10, gen_random_uuid(), 'مصروف آخر', 'labor');
  v_other_expense := r.expense_id;
  reset role;
  set role authenticated;
  set app.uid = '00000000-0000-0000-0000-0000000000a1';
  begin
    update payments set expense_id = v_other_expense where title = 'دفعة مبكرة' and project_id = v_project;
    raise exception 'FAIL: an expense of another project accepted';
  exception when foreign_key_violation then raise notice 'OK: the expense must be of this project'; end;
  begin
    update payments set released_on = private.today_tripoli(), release_expense_id = v_other_expense
     where project_id = v_project and title = 'الدفعة الأولى' and paid_on is not null and released_on is null;
    raise exception 'FAIL: a release expense of another project accepted';
  exception when foreign_key_violation then raise notice 'OK: the release expense must be of this project'; end;
end $$;

-- 3b. Only a payment WITH a retained part can be released; one expense per release
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_contract uuid; v_a uuid; v_b uuid; v_exp1 uuid; v_exp2 uuid; r record;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_contract from contracts where project_id = v_project and title = 'عقد التسوية';
  insert into payments (project_id, contract_id, title, amount_lyd) values (v_project, v_contract, 'بلا محتجز', 400) returning id into v_a;
  insert into payments (project_id, contract_id, title, amount_lyd, retained_lyd) values (v_project, v_contract, 'محتجز أ', 400, 40) returning id into v_b;
  perform confirm_payment_paid(v_a, private.today_tripoli(), null);
  perform confirm_payment_paid(v_b, private.today_tripoli(), null);
  begin
    perform release_payment_retained(v_a, private.today_tripoli(), null, false);
    raise exception 'FAIL: a payment with nothing retained was released';
  exception when check_violation then raise notice 'OK: nothing retained, nothing to release'; end;
  select * into r from create_expense(v_project, 40, gen_random_uuid(), 'إفراج أ', 'labor');
  v_exp1 := r.expense_id;
  perform release_payment_retained(v_b, private.today_tripoli(), v_exp1, false);
  insert into payments (project_id, contract_id, title, amount_lyd, retained_lyd) values (v_project, v_contract, 'محتجز ب', 400, 40) returning id into v_a;
  perform confirm_payment_paid(v_a, private.today_tripoli(), null);
  begin
    perform release_payment_retained(v_a, private.today_tripoli(), v_exp1, false);
    raise exception 'FAIL: one release expense on two payments';
  exception when unique_violation then raise notice 'OK: one release expense belongs to one payment'; end;
end $$;

-- 4. Releasing the retained part: a second expense with the payment's own key; the early confirmation is logged
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_pay uuid; v_op uuid; v_exp uuid; r record;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id, release_op_id into v_pay, v_op from payments where project_id = v_project and title = 'الدفعة الأولى' and paid_on is not null;
  select * into r from create_expense(v_project, 3000, v_op, 'إفراج المحتجز · الدفعة الأولى', 'labor', null, 'مقاول التسوية', private.today_tripoli());
  v_exp := r.expense_id;
  perform release_payment_retained(v_pay, private.today_tripoli(), v_exp, true);
  if not exists (select 1 from payments where id = v_pay and released_on = private.today_tripoli() and release_expense_id = v_exp) then
    raise exception 'FAIL: the retained part was not released';
  end if;
  if not exists (select 1 from audit_log where table_name = 'payments' and action = 'release_confirmed_before_phases_done' and detail ->> 'payment_id' = v_pay::text) then
    raise exception 'FAIL: the early release was not logged';
  end if;
  begin
    perform release_payment_retained(v_pay, private.today_tripoli(), null, false);
    raise exception 'FAIL: released twice';
  exception when insufficient_privilege then raise notice 'OK: released once'; end;
  -- a release that is not early logs nothing extra: the other payment (whole amount retained) below
  raise notice 'OK: retained part released with its own expense, early release logged';
end $$;

set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_contract uuid; v_pay uuid; v_op uuid; v_exp uuid; r record;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_contract from contracts where project_id = v_project and title = 'عقد التسوية';
  -- the whole payment is retained: paying makes no expense; the release makes it
  insert into payments (project_id, contract_id, title, amount_lyd, retained_lyd) values (v_project, v_contract, 'دفعة محتجزة كلها', 100, 100) returning id, release_op_id into v_pay, v_op;
  begin
    perform release_payment_retained(v_pay, private.today_tripoli(), null, false);
    raise exception 'FAIL: an unpaid payment was released';
  exception when insufficient_privilege then raise notice 'OK: only a paid payment is released'; end;
  perform confirm_payment_paid(v_pay, private.today_tripoli(), null);
  select * into r from create_expense(v_project, 100, v_op, 'إفراج المحتجز', 'labor');
  perform release_payment_retained(v_pay, private.today_tripoli(), r.expense_id, false);
  if exists (select 1 from audit_log where action = 'release_confirmed_before_phases_done' and detail ->> 'payment_id' = v_pay::text) then
    raise exception 'FAIL: a normal release logged a warning';
  end if;
  begin
    update payments set released_on = private.today_tripoli() - 5 where id = v_pay;
    raise exception 'FAIL: released before it was paid... or a date before the payment accepted';
  exception when check_violation then raise notice 'OK: no release before the payment date'; end;
  begin
    update payments set released_on = private.today_tripoli() + 1 where id = v_pay;
    raise exception 'FAIL: a future release date accepted';
  exception when check_violation then raise notice 'OK: no future release date'; end;
end $$;

-- 5. Undoing: an unpaid payment has no expense; the release is undone before the payment
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_pay uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_pay from payments where project_id = v_project and title = 'الدفعة الأولى' and paid_on is not null;
  begin
    update payments set paid_on = null, expense_id = null where id = v_pay;
    raise exception 'FAIL: a payment with a release was marked unpaid';
  exception when check_violation then raise notice 'OK: undo the release before the payment'; end;
  begin
    update payments set released_on = null where id = v_pay;
    raise exception 'FAIL: a release date removed but its expense left';
  exception when check_violation then raise notice 'OK: no release expense without a release'; end;
  update payments set released_on = null, release_expense_id = null where id = v_pay;
  begin
    update payments set paid_on = null where id = v_pay;
    raise exception 'FAIL: a payment marked unpaid but its expense left';
  exception when check_violation then raise notice 'OK: an unpaid payment has no expense'; end;
  update payments set paid_on = null, expense_id = null where id = v_pay;
  if not exists (select 1 from payments where id = v_pay and paid_on is null and expense_id is null and released_on is null) then
    raise exception 'FAIL: the payment was not undone';
  end if;
  if not exists (select 1 from audit_log where table_name = 'payments' and action = 'updated'
                 and detail -> 'before' ->> 'paid_on' is not null and detail -> 'after' ->> 'paid_on' is null) then
    raise exception 'FAIL: the undo was not audited';
  end if;
  raise notice 'OK: undo release, then undo payment, audited';
end $$;

-- 6. Deleting the expense from the expenses list leaves the payment, without an expense
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_contract uuid; v_pay uuid; r record;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_contract from contracts where project_id = v_project and title = 'عقد التسوية';
  insert into payments (project_id, contract_id, title, amount_lyd) values (v_project, v_contract, 'دفعة ومصروف محذوف', 700) returning id into v_pay;
  select * into r from create_expense(v_project, 700, v_pay, 'دفعة ومصروف محذوف', 'labor');
  perform confirm_payment_paid(v_pay, private.today_tripoli(), r.expense_id);
  delete from expenses where id = r.expense_id;
  if not exists (select 1 from payments where id = v_pay and paid_on is not null and expense_id is null) then
    raise exception 'FAIL: deleting the expense did not leave a paid payment without an expense';
  end if;
  raise notice 'OK: deleting the expense leaves the payment, without an expense';
end $$;

-- 7. A stranger can neither pay nor release another project's payment; anon cannot call the functions
reset role;
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare v_pay uuid;
begin
  reset role;
  select id into v_pay from payments where title = 'دفعة محتجزة كلها' limit 1;
  set role authenticated;
  set app.uid = '00000000-0000-0000-0000-0000000000a2';
  begin
    perform confirm_payment_paid(v_pay, private.today_tripoli(), null);
    raise exception 'FAIL: a stranger paid a payment';
  exception when insufficient_privilege then raise notice 'OK: a stranger cannot pay'; end;
  begin
    perform release_payment_retained(v_pay, private.today_tripoli(), null, false);
    raise exception 'FAIL: a stranger released a payment';
  exception when insufficient_privilege then raise notice 'OK: a stranger cannot release'; end;
  if has_function_privilege('anon', 'public.confirm_payment_paid(uuid, date, uuid, jsonb)', 'execute') then
    raise exception 'LEAK: anon may execute confirm_payment_paid';
  end if;
  if has_function_privilege('anon', 'public.release_payment_retained(uuid, date, uuid, boolean)', 'execute') then
    raise exception 'LEAK: anon may execute release_payment_retained';
  end if;
  raise notice 'OK: anon cannot call the new functions';
end $$;
reset role;

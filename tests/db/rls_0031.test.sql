-- Tests for contracts and the payment schedule (migration 0031; FR-FIN-08, FR-FIN-09). Uses Owner One (...a1) and Owner
-- Two (...a2) from rls_0006.test.sql, one project each.
reset role;

-- 1. The owner records a contract and its installments; a change is stamped and audited
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_phase uuid; v_contract uuid; v_payment uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_phase from phases where project_id = v_project and position = 2;
  insert into contracts (project_id, title, contractor, value_lyd, scope, cleanup_clause)
    values (v_project, 'عقد الهيكل الخرساني', 'شركة البناء', 90000, 'أعمال الهيكل', 'المقاول يزيل المخلفات')
    returning id into v_contract;
  insert into payments (project_id, contract_id, title, amount_lyd, phase_id, retained_lyd)
    values (v_project, v_contract, 'الدفعة الأولى', 30000, v_phase, 3000)
    returning id into v_payment;
  if not exists (select 1 from payments where id = v_payment and paid_on is null and retained_lyd = 3000 and created_at is not null) then
    raise exception 'FAIL: payment not stored as expected';
  end if;
  update contracts set value_lyd = 95000, updated_at = timestamptz '2000-01-01' where id = v_contract;
  if (select updated_at from contracts where id = v_contract) < timestamptz '2020-01-01' then
    raise exception 'FAIL: contract updated_at taken from the client';
  end if;
  update payments set amount_lyd = 31000, updated_at = timestamptz '2000-01-01' where id = v_payment;
  if (select updated_at from payments where id = v_payment) < timestamptz '2020-01-01' then
    raise exception 'FAIL: payment updated_at taken from the client';
  end if;
  if not exists (select 1 from audit_log where table_name = 'contracts' and action = 'updated'
                 and (detail -> 'before' ->> 'value_lyd')::numeric = 90000 and (detail -> 'after' ->> 'value_lyd')::numeric = 95000) then
    raise exception 'FAIL: the contract change was not audited';
  end if;
  if not exists (select 1 from audit_log where table_name = 'payments' and action = 'updated'
                 and (detail -> 'before' ->> 'amount_lyd')::numeric = 30000 and (detail -> 'after' ->> 'amount_lyd')::numeric = 31000) then
    raise exception 'FAIL: the payment change was not audited';
  end if;
  raise notice 'OK: contract and payment stored, stamped, audited';
end $$;

-- 2. The rules on a contract
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  begin
    insert into contracts (project_id, contractor, value_lyd) values (v_project, 'مقاول', 10);
    raise exception 'FAIL: contract without a title accepted';
  exception when not_null_violation then raise notice 'OK: contract title required'; end;
  begin
    insert into contracts (project_id, title, contractor, value_lyd) values (v_project, 'x', 'مقاول', 10);
    raise exception 'FAIL: one-letter title accepted';
  exception when check_violation then raise notice 'OK: contract title length'; end;
  begin
    insert into contracts (project_id, title, contractor, value_lyd) values (v_project, 'عقد', 'م', 10);
    raise exception 'FAIL: one-letter contractor accepted';
  exception when check_violation then raise notice 'OK: contractor length'; end;
  begin
    insert into contracts (project_id, title, contractor, value_lyd) values (v_project, 'عقد', 'مقاول', 0);
    raise exception 'FAIL: zero contract value accepted';
  exception when check_violation then raise notice 'OK: contract value positive'; end;
  begin
    insert into contracts (project_id, title, contractor, value_lyd, scope) values (v_project, 'عقد', 'مقاول', 10, repeat('ن', 301));
    raise exception 'FAIL: long scope accepted';
  exception when check_violation then raise notice 'OK: scope length'; end;
  begin
    insert into contracts (project_id, title, contractor, value_lyd, cleanup_clause) values (v_project, 'عقد', 'مقاول', 10, repeat('ن', 201));
    raise exception 'FAIL: long cleanup clause accepted';
  exception when check_violation then raise notice 'OK: cleanup clause length'; end;
end $$;

-- 3. The rules on a payment
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_contract uuid; v_other_phase uuid; v_other_contract uuid; v_same_project_contract uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_contract from contracts where project_id = v_project and title = 'عقد الهيكل الخرساني';
  reset role;
  select ph.id into v_other_phase from phases ph join projects p on p.id = ph.project_id where p.owner_id = '00000000-0000-0000-0000-0000000000a2' limit 1;
  insert into contracts (project_id, title, contractor, value_lyd)
    select id, 'عقد آخر', 'مقاول آخر', 1 from projects where owner_id = '00000000-0000-0000-0000-0000000000a2' returning id into v_other_contract;
  set role authenticated;
  begin
    insert into payments (project_id, contract_id, amount_lyd) values (v_project, v_contract, 10);
    raise exception 'FAIL: payment without a title accepted';
  exception when not_null_violation then raise notice 'OK: payment title required'; end;
  begin
    insert into payments (project_id, contract_id, title, amount_lyd) values (v_project, v_contract, 'x', 10);
    raise exception 'FAIL: one-letter payment title accepted';
  exception when check_violation then raise notice 'OK: payment title length'; end;
  begin
    insert into payments (project_id, contract_id, title, amount_lyd) values (v_project, v_contract, 'دفعة', 0);
    raise exception 'FAIL: zero payment accepted';
  exception when check_violation then raise notice 'OK: payment amount positive'; end;
  begin
    insert into payments (project_id, contract_id, title, amount_lyd, retained_lyd) values (v_project, v_contract, 'دفعة', 100, -1);
    raise exception 'FAIL: negative retained part accepted';
  exception when check_violation then raise notice 'OK: retained part not negative'; end;
  begin
    insert into payments (project_id, contract_id, title, amount_lyd, retained_lyd) values (v_project, v_contract, 'دفعة', 100, 100.001);
    raise exception 'FAIL: retained part above the amount accepted';
  exception when check_violation then raise notice 'OK: retained part within the amount'; end;
  -- the whole payment may be retained
  insert into payments (project_id, contract_id, title, amount_lyd, retained_lyd) values (v_project, v_contract, 'دفعة محتجزة', 100, 100);
  begin
    insert into payments (project_id, contract_id, title, amount_lyd, phase_id) values (v_project, v_contract, 'دفعة', 10, v_other_phase);
    raise exception 'FAIL: phase of another project accepted';
  exception when foreign_key_violation then raise notice 'OK: phase of this project only'; end;
  begin
    insert into payments (project_id, contract_id, title, amount_lyd) values (v_project, v_other_contract, 'دفعة', 10);
    raise exception 'FAIL: contract of another project accepted';
  exception when foreign_key_violation then raise notice 'OK: contract of this project only'; end;
  begin
    insert into payments (project_id, contract_id, title, amount_lyd, paid_on) values (v_project, v_contract, 'دفعة', 10, private.today_tripoli() + 1);
    raise exception 'FAIL: future paid date accepted';
  exception when check_violation then raise notice 'OK: no future paid date'; end;
  -- another contract of the SAME project: only the "keeps its contract" rule can refuse this move
  insert into contracts (project_id, title, contractor, value_lyd) values (v_project, 'عقد ثانٍ', 'مقاول ثانٍ', 20000) returning id into v_same_project_contract;
  begin
    update payments set contract_id = v_same_project_contract where title = 'الدفعة الأولى';
    raise exception 'FAIL: payment moved to another contract of its project';
  exception when check_violation then raise notice 'OK: a payment keeps its contract'; end;
  -- D2: a schedule above the contract value is NOT refused (the app warns)
  insert into payments (project_id, contract_id, title, amount_lyd) values (v_project, v_contract, 'دفعة تتجاوز العقد', 500000);
  raise notice 'OK: a schedule above the contract value is stored (warn, never block)';
end $$;

-- 4. Deleting is audited with the old values; deleting a contract deletes its payments
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_contract uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  insert into contracts (project_id, title, contractor, value_lyd) values (v_project, 'عقد مؤقت', 'مقاول', 500) returning id into v_contract;
  insert into payments (project_id, contract_id, title, amount_lyd) values (v_project, v_contract, 'دفعة مؤقتة', 100);
  delete from payments where title = 'دفعة مؤقتة';
  if not exists (select 1 from audit_log where table_name = 'payments' and action = 'deleted' and detail -> 'before' ->> 'title' = 'دفعة مؤقتة') then
    raise exception 'FAIL: the payment deletion was not audited';
  end if;
  insert into payments (project_id, contract_id, title, amount_lyd) values (v_project, v_contract, 'دفعة ثانية', 100);
  delete from contracts where id = v_contract;
  if not exists (select 1 from audit_log where table_name = 'contracts' and action = 'deleted' and detail -> 'before' ->> 'title' = 'عقد مؤقت') then
    raise exception 'FAIL: the contract deletion was not audited';
  end if;
  if exists (select 1 from payments where contract_id = v_contract) then
    raise exception 'FAIL: a deleted contract left payments behind';
  end if;
  raise notice 'OK: deletions audited; payments go with their contract';
end $$;

-- 5. An editor of BOTH projects cannot move a contract or a payment; a stranger can neither read nor change them
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
    update contracts set project_id = v_mine where title = 'عقد الهيكل الخرساني';
    raise exception 'FAIL: an editor of both projects moved a contract';
  exception when check_violation then raise notice 'OK: the guard keeps a contract in its project'; end;
  begin
    update payments set project_id = v_mine where title = 'الدفعة الأولى';
    raise exception 'FAIL: an editor of both projects moved a payment';
  exception when check_violation then raise notice 'OK: the guard keeps a payment in its project'; end;
end $$;
reset role;
delete from project_members where user_id = '00000000-0000-0000-0000-0000000000a2';

set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare n int; v_theirs uuid;
begin
  if (select count(*) from contracts where title = 'عقد الهيكل الخرساني') <> 0 then raise exception 'FAIL: stranger reads contracts'; end if;
  if (select count(*) from payments where title = 'الدفعة الأولى') <> 0 then raise exception 'FAIL: stranger reads payments'; end if;
  update contracts set value_lyd = 1 where title = 'عقد الهيكل الخرساني';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: stranger changed a contract'; end if;
  update payments set amount_lyd = 1 where title = 'الدفعة الأولى';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: stranger changed a payment'; end if;
  delete from contracts where title = 'عقد الهيكل الخرساني';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: stranger deleted a contract'; end if;
  select id into v_theirs from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  begin
    insert into contracts (project_id, title, contractor, value_lyd) values (v_theirs, 'عقد دخيل', 'مقاول', 10);
    raise exception 'FAIL: stranger created a contract in another project';
  exception when insufficient_privilege then raise notice 'OK: a stranger cannot create a contract'; end;
  raise notice 'OK: a stranger cannot read, change or delete contracts and payments';
end $$;
reset role;

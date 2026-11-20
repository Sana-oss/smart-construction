-- Tests for extra works without a contract (migration 0022; FR-FIN-10). Uses Owner One (...a1) and Owner Two (...a2)
-- from rls_0006.test.sql, one project each.
reset role;

-- 1. The owner records an extra work without a contract; approving it is a change, dated and audited
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_phase uuid; v_id uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_phase from phases where project_id = v_project and position = 2;
  insert into change_orders (project_id, title, cost_lyd, phase_id, note) values (v_project, 'توسيع الشرفة', 12500, v_phase, 'طلب المالك')
    returning id into v_id;
  if not exists (select 1 from change_orders where id = v_id and status = 'proposed' and contract_id is null
                 and occurred_on = private.today_tripoli() and updated_at is not null) then
    raise exception 'FAIL: extra work not stored as expected';
  end if;
  update change_orders set status = 'approved', updated_at = timestamptz '2000-01-01' where id = v_id;
  if (select updated_at from change_orders where id = v_id) < timestamptz '2020-01-01' then
    raise exception 'FAIL: updated_at taken from the client';
  end if;
  if not exists (select 1 from audit_log where table_name = 'change_orders' and action = 'updated'
                 and detail -> 'before' ->> 'status' = 'proposed' and detail -> 'after' ->> 'status' = 'approved') then
    raise exception 'FAIL: the approval was not audited';
  end if;
  raise notice 'OK: extra work stored, approved, audited';
end $$;

-- 2. The rules
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_other_phase uuid; v_other_contract uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  reset role;
  select ph.id into v_other_phase from phases ph join projects p on p.id = ph.project_id where p.owner_id = '00000000-0000-0000-0000-0000000000a2' limit 1;
  insert into contracts (project_id, contractor, value_lyd)
    select id, 'مقاول آخر', 1 from projects where owner_id = '00000000-0000-0000-0000-0000000000a2' returning id into v_other_contract;
  set role authenticated;
  begin
    insert into change_orders (project_id, cost_lyd) values (v_project, 10);
    raise exception 'FAIL: extra work without a title accepted';
  exception when not_null_violation then raise notice 'OK: title required'; end;
  begin
    insert into change_orders (project_id, title, cost_lyd) values (v_project, 'x', 10);
    raise exception 'FAIL: one-letter title accepted';
  exception when check_violation then raise notice 'OK: title length'; end;
  begin
    insert into change_orders (project_id, title, cost_lyd) values (v_project, 'باب', 0);
    raise exception 'FAIL: zero cost accepted';
  exception when check_violation then raise notice 'OK: cost positive'; end;
  begin
    insert into change_orders (project_id, title, cost_lyd, status) values (v_project, 'باب', 10, 'paid');
    raise exception 'FAIL: unknown status accepted';
  exception when check_violation then raise notice 'OK: three statuses'; end;
  begin
    insert into change_orders (project_id, title, cost_lyd, occurred_on) values (v_project, 'باب', 10, private.today_tripoli() + 1);
    raise exception 'FAIL: future date accepted';
  exception when check_violation then raise notice 'OK: no future date'; end;
  begin
    insert into change_orders (project_id, title, cost_lyd, note) values (v_project, 'باب', 10, repeat('ن', 201));
    raise exception 'FAIL: long note accepted';
  exception when check_violation then raise notice 'OK: note length'; end;
  begin
    insert into change_orders (project_id, title, cost_lyd, phase_id) values (v_project, 'باب', 10, v_other_phase);
    raise exception 'FAIL: phase of another project accepted';
  exception when foreign_key_violation then raise notice 'OK: phase of this project only'; end;
  begin
    insert into change_orders (project_id, title, cost_lyd, contract_id) values (v_project, 'باب', 10, v_other_contract);
    raise exception 'FAIL: contract of another project accepted';
  exception when foreign_key_violation then raise notice 'OK: contract of this project only'; end;
  begin
    update change_orders set occurred_on = private.today_tripoli() + 2 where title = 'توسيع الشرفة';
    raise exception 'FAIL: date moved to the future';
  exception when check_violation then raise notice 'OK: no future date on update'; end;
end $$;

-- 3. Deleting is audited with the old values
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_id uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  insert into change_orders (project_id, title, cost_lyd) values (v_project, 'نافذة', 800) returning id into v_id;
  delete from change_orders where id = v_id;
  if not exists (select 1 from audit_log where table_name = 'change_orders' and action = 'deleted' and detail -> 'before' ->> 'title' = 'نافذة') then
    raise exception 'FAIL: the deletion was not audited';
  end if;
  raise notice 'OK: deletion audited';
end $$;

-- 4. An editor of BOTH projects cannot move an extra work; a stranger can neither read nor change one
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
    update change_orders set project_id = v_mine, phase_id = null where title = 'توسيع الشرفة';
    raise exception 'FAIL: an editor of both projects moved an extra work';
  exception when check_violation then raise notice 'OK: the guard keeps it in its project'; end;
end $$;
reset role;
delete from project_members where user_id = '00000000-0000-0000-0000-0000000000a2';

set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare n int;
begin
  if (select count(*) from change_orders where title = 'توسيع الشرفة') <> 0 then raise exception 'FAIL: stranger reads extra works'; end if;
  update change_orders set status = 'rejected' where title = 'توسيع الشرفة';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: stranger changed an extra work'; end if;
  raise notice 'OK: a stranger cannot read or change extra works';
end $$;

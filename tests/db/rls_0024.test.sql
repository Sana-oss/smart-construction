-- Tests for the quantity table and purchases (migration 0024; FR-MAT-01, FR-MAT-02, FR-MAT-03, FR-FIN-03). Uses Owner One
-- (...a1) and Owner Two (...a2) from rls_0006.test.sql, one project each.
reset role;

-- 1. The owner adds a line; the same (material, unit, phase) twice is refused, also with no phase
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_phase uuid; v_other_phase uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_phase from phases where project_id = v_project and position = 2;
  insert into quantity_items (project_id, material, unit, planned_qty, waste_pct, phase_id, source)
    values (v_project, 'حديد تسليح', 'طن', 12, 10, v_phase, 'جدول كميات المهندس');
  insert into quantity_items (project_id, material, unit, planned_qty) values (v_project, 'أسمنت', 'كيس', 300);
  begin
    insert into quantity_items (project_id, material, unit, planned_qty) values (v_project, 'أسمنت', 'كيس', 10);
    raise exception 'FAIL: a duplicate line without a phase was accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into quantity_items (project_id, material, unit, planned_qty) values (v_project, 'x', 'كيس', 10);
    raise exception 'FAIL: a one-letter material was accepted';
  exception when check_violation then null;
  end;
  raise notice 'OK: lines stored; duplicates and bad text refused';
end $$;

-- 2. A phase of another project is refused (looked up as Owner One, who can see only their own phases)
reset role;
do $$
declare v_project uuid; v_foreign_phase uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select ph.id into v_foreign_phase from phases ph join projects p on p.id = ph.project_id
    where p.owner_id = '00000000-0000-0000-0000-0000000000a2' limit 1;
  perform set_config('test.foreign_phase', v_foreign_phase::text, false);
  perform set_config('test.project', v_project::text, false);
end $$;
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  insert into quantity_items (project_id, material, unit, planned_qty, phase_id)
    values (current_setting('test.project')::uuid, 'رمل', 'م³', 20, current_setting('test.foreign_phase')::uuid);
  raise exception 'FAIL: a phase of another project was accepted';
exception when foreign_key_violation then raise notice 'OK: a phase of another project is refused';
end $$;

-- 3. record_purchase: one purchase and one event; a retry creates nothing; the rules
do $$
declare v_project uuid := current_setting('test.project')::uuid; v_item uuid; v_op uuid := gen_random_uuid(); r record; r2 record;
begin
  select id into v_item from quantity_items where project_id = v_project and material = 'حديد تسليح';
  select * into r from record_purchase(v_project, v_item, 3, 4000, v_op, ' مورد الحديد ', null, false);
  if not r.created then raise exception 'FAIL: the purchase was not created'; end if;
  select * into r2 from record_purchase(v_project, v_item, 3, 4000, v_op, 'مورد الحديد', null, false);
  if r2.created or r2.purchase_id <> r.purchase_id then raise exception 'FAIL: a retry created a second purchase'; end if;
  if not exists (select 1 from purchases where id = r.purchase_id and supplier = 'مورد الحديد'
                 and purchased_on = private.today_tripoli() and expense_ref is null) then
    raise exception 'FAIL: purchase not stored as expected';
  end if;
  perform set_config('test.purchase', r.purchase_id::text, false);
  perform set_config('test.item', v_item::text, false);

  begin
    perform record_purchase(v_project, v_item, 1, 0, gen_random_uuid());
    raise exception 'FAIL: a free purchase was accepted';
  exception when check_violation then null;
  end;
  begin
    perform record_purchase(v_project, v_item, 1, 10, gen_random_uuid(), null, private.today_tripoli() + 1);
    raise exception 'FAIL: a future purchase was accepted';
  exception when check_violation then null;
  end;
  begin
    perform record_purchase(v_project, v_item, 0, 10, gen_random_uuid());
    raise exception 'FAIL: a zero quantity was accepted';
  exception when check_violation then null;
  end;
  begin
    perform record_purchase(v_project, v_item, 1, 10, null);
    raise exception 'FAIL: a purchase without client_op_id was accepted';
  exception when check_violation then null;
  end;
  raise notice 'OK: purchase recorded once; free, future, zero and anonymous-request purchases refused';
end $$;

-- The event and the over-allowance confirmation (read as the migration owner: the outbox and the audit log are closed)
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid := current_setting('test.project')::uuid; r record;
begin
  select * into r from record_purchase(v_project, current_setting('test.item')::uuid, 12, 4000, gen_random_uuid(), null, null, true);
  perform set_config('test.over_purchase', r.purchase_id::text, false);
end $$;
reset role;
do $$ begin
  if (select count(*) from outbox_events where event_type = 'purchase.recorded'
        and payload ->> 'purchase_id' = current_setting('test.purchase')) <> 1 then
    raise exception 'FAIL: expected exactly one purchase.recorded event for the purchase';
  end if;
  if not exists (select 1 from outbox_events where event_type = 'purchase.recorded'
                 and payload ->> 'purchase_id' = current_setting('test.purchase')
                 and payload ->> 'qty' = '3' and payload ->> 'unit_price_lyd' = '4000'
                 and payload ->> 'material' = 'حديد تسليح' and payload ->> 'unit' = 'طن'
                 and payload ->> 'phase_id' is not null and payload ->> 'supplier' = 'مورد الحديد') then
    raise exception 'FAIL: the event does not carry the purchase';
  end if;
  if not exists (select 1 from audit_log where table_name = 'purchases' and action = 'over_allowance_confirmed'
                 and detail ->> 'row_id' = current_setting('test.over_purchase')) then
    raise exception 'FAIL: the over-allowance confirmation was not logged';
  end if;
  if exists (select 1 from audit_log where table_name = 'purchases' and action = 'over_allowance_confirmed'
             and detail ->> 'row_id' = current_setting('test.purchase')) then
    raise exception 'FAIL: a normal purchase was logged as over the allowance';
  end if;
  raise notice 'OK: one event per purchase; the confirmed over-allowance purchase is logged';
end $$;

-- 4. The expense reference is set once; a purchase never moves; a line with purchases is not deleted
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_purchase uuid := current_setting('test.purchase')::uuid; v_project uuid := current_setting('test.project')::uuid; v_other uuid;
begin
  update purchases set expense_ref = '11111111-1111-1111-1111-111111111111' where id = v_purchase;
  begin
    update purchases set expense_ref = '22222222-2222-2222-2222-222222222222' where id = v_purchase;
    raise exception 'FAIL: the expense reference was changed';
  exception when check_violation then null;
  end;
  select id into v_other from quantity_items where project_id = v_project and material = 'أسمنت';
  begin
    update purchases set quantity_item_id = v_other where id = v_purchase;
    raise exception 'FAIL: a purchase moved to another line';
  exception when check_violation then null;
  end;
  begin
    delete from quantity_items where id = current_setting('test.item')::uuid;
    raise exception 'FAIL: a line with purchases was deleted';
  exception when check_violation then null;
  end;
  delete from quantity_items where id = v_other;
  raise notice 'OK: expense set once; no move; a line with purchases stays; an unused line is deleted';
end $$;
reset role;
do $$ begin
  if not exists (select 1 from audit_log where table_name = 'quantity_items' and action = 'deleted'
                 and detail -> 'before' ->> 'material' = 'أسمنت') then
    raise exception 'FAIL: the deleted line was not audited';
  end if;
  if not exists (select 1 from audit_log where table_name = 'purchases' and action = 'updated'
                 and detail -> 'after' ->> 'expense_ref' = '11111111-1111-1111-1111-111111111111') then
    raise exception 'FAIL: linking the expense was not audited';
  end if;
  raise notice 'OK: deletion and changes are audited';
end $$;

-- 5. A stranger (Owner Two) sees nothing and cannot buy on Owner One's line
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare n bigint;
begin
  if exists (select 1 from quantity_items where project_id = current_setting('test.project')::uuid)
     or exists (select 1 from purchases where project_id = current_setting('test.project')::uuid) then
    raise exception 'LEAK: stranger read the quantity table';
  end if;
  begin
    perform record_purchase(current_setting('test.project')::uuid, current_setting('test.item')::uuid, 1, 10, gen_random_uuid());
    raise exception 'LEAK: stranger recorded a purchase';
  exception when foreign_key_violation or insufficient_privilege then null;
  end;
  update purchases set supplier = 'x' where project_id = current_setting('test.project')::uuid;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'LEAK: stranger changed a purchase'; end if;
  raise notice 'OK: stranger cannot read or write the quantity table';
end $$;

-- 6. Anonymous visitors cannot call record_purchase (checked on the privilege itself: the function also refuses
--    a caller without a session, which would hide a wrong grant)
reset role;
do $$ begin
  if has_function_privilege('anon', 'public.record_purchase(uuid, uuid, numeric, numeric, uuid, text, date, boolean)', 'execute') then
    raise exception 'LEAK: anon may execute record_purchase';
  end if;
  if not has_function_privilege('authenticated', 'public.record_purchase(uuid, uuid, numeric, numeric, uuid, text, date, boolean)', 'execute') then
    raise exception 'FAIL: signed-in users may not execute record_purchase';
  end if;
  raise notice 'OK: only signed-in users may call record_purchase';
end $$;

-- 7. The purchases guard itself: a purchase cannot point at another project's line (as the migration owner, past RLS)
do $$
declare v_other_project uuid;
begin
  select id into v_other_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a2';
  insert into purchases (project_id, quantity_item_id, qty, unit_price_lyd)
    values (v_other_project, current_setting('test.item')::uuid, 1, 10);
  raise exception 'FAIL: a purchase pointed at another project''s line';
exception when foreign_key_violation then raise notice 'OK: a purchase stays on its own project''s lines';
end $$;

set role anon;
set app.uid = '';
do $$ begin
  perform record_purchase(current_setting('test.project')::uuid, current_setting('test.item')::uuid, 1, 10, gen_random_uuid());
  raise exception 'LEAK: anonymous visitor recorded a purchase';
exception when insufficient_privilege then raise notice 'OK: anonymous visitor cannot record a purchase';
end $$;
reset role;

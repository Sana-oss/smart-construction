-- Tests for the stop plan (migration 0028; FR-DEC-04). Uses Owner One (...a1) and Owner Two (...a2) from rls_0006.test.sql.
reset role;

-- 1. The template: unreviewed; the four protection measures take a cost, the other items do not
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  if not exists (select 1 from checklist_templates where kind = 'safe_stop' and status = 'unreviewed'
                 and jsonb_array_length(items) = 8
                 and (select count(*) from jsonb_array_elements(items) e where (e ->> 'takes_cost')::boolean) = 4
                 and items -> 1 ->> 'text' = 'حماية الحديد المكشوف') then
    raise exception 'FAIL: expected the unreviewed stop-plan template with eight items, four taking a cost';
  end if;
  raise notice 'OK: the stop-plan template is in place and unreviewed';
end $$;

-- 2. One plan per phase, a copy of the template with its cost flags
do $$
declare v_project uuid; v_phase uuid; v_id uuid; v_again uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_phase from phases where project_id = v_project and position = 2;
  v_id := create_stop_plan(v_project, v_phase);
  v_again := create_stop_plan(v_project, v_phase);
  if v_again <> v_id then raise exception 'FAIL: a second stop plan was created for the phase'; end if;
  if not exists (select 1 from checklists where id = v_id and kind = 'safe_stop' and phase_id = v_phase
                 and template_status = 'unreviewed' and status = 'open') then
    raise exception 'FAIL: stop plan not stored as expected';
  end if;
  if (select count(*) from checklist_items where checklist_id = v_id) <> 8
     or (select count(*) from checklist_items where checklist_id = v_id and takes_cost) <> 4
     or not (select takes_cost from checklist_items where checklist_id = v_id and position = 2) then
    raise exception 'FAIL: the items or their cost flags were not copied';
  end if;
  perform set_config('test.s_project', v_project::text, false);
  perform set_config('test.s_phase', v_phase::text, false);
  perform set_config('test.s_plan', v_id::text, false);
  raise notice 'OK: one stop plan per phase, a copy of the template';
end $$;

-- The unique index and the phase rule themselves (as the migration owner, past RLS and the function's reuse)
reset role;
do $$ begin
  perform set_config('app.creating_checklist', 'yes', true);
  begin
    insert into checklists (project_id, phase_id, kind, title, template_status)
      values (current_setting('test.s_project')::uuid, current_setting('test.s_phase')::uuid, 'safe_stop', 'خطة ثانية', 'unreviewed');
    raise exception 'FAIL: a second stop plan for the phase was accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into checklists (project_id, kind, title, template_status) values (current_setting('test.s_project')::uuid, 'safe_stop', 'خطة بلا مرحلة', 'unreviewed');
    raise exception 'FAIL: a stop plan without a phase was accepted';
  exception when check_violation then null;
  end;
  raise notice 'OK: one stop plan per phase, always with a phase';
end $$;

-- The function itself checks the phase's project (past RLS: RLS alone would hide another project's phase)
do $$
declare v_foreign uuid;
begin
  select ph.id into v_foreign from phases ph join projects p on p.id = ph.project_id
    where p.owner_id = '00000000-0000-0000-0000-0000000000a2' limit 1;
  perform set_config('app.uid', '00000000-0000-0000-0000-0000000000a1', false);
  begin
    perform create_stop_plan(current_setting('test.s_project')::uuid, v_foreign);
    raise exception 'FAIL: create_stop_plan accepted a phase of another project';
  exception when foreign_key_violation then null;
  end;
  raise notice 'OK: create_stop_plan checks the phase itself';
end $$;

-- 3. Costs: only on a measure that takes one, never negative; a changed cost is audited
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_plan uuid := current_setting('test.s_plan')::uuid; v_rebar uuid; v_limits uuid;
begin
  select id into v_rebar from checklist_items where checklist_id = v_plan and position = 2;
  select id into v_limits from checklist_items where checklist_id = v_plan and position = 1;
  update checklist_items set result = 'ok', cost_lyd = 1200 where id = v_rebar;
  update checklist_items set cost_lyd = 1500 where id = v_rebar;
  begin
    update checklist_items set result = 'ok', cost_lyd = 300 where id = v_limits;
    raise exception 'FAIL: a cost was put on an item that takes none';
  exception when check_violation then null;
  end;
  begin
    update checklist_items set cost_lyd = -1 where id = v_rebar;
    raise exception 'FAIL: a negative cost was accepted';
  exception when check_violation then null;
  end;
  begin
    -- A measure with no cost yet: only the rule «the flag never changes» can refuse this.
    update checklist_items set takes_cost = false where checklist_id = v_plan and position = 3;
    raise exception 'FAIL: the cost flag of a copied item was changed';
  exception when check_violation then null;
  end;
  perform set_config('test.s_rebar', v_rebar::text, false);
  raise notice 'OK: costs only on measures, never negative; the flag never changes';
end $$;
reset role;
do $$ begin
  if not exists (select 1 from audit_log where table_name = 'checklist_items'
                 and detail ->> 'row_id' = current_setting('test.s_rebar')
                 and detail -> 'before' ->> 'cost_lyd' = '1200.000' and detail -> 'after' ->> 'cost_lyd' = '1500.000') then
    raise exception 'FAIL: the changed cost was not audited with its old value';
  end if;
  raise notice 'OK: a changed cost is audited';
end $$;

-- A cost typed on insert is dropped (an item is created only by copying the template)
do $$
declare v_id uuid;
begin
  perform set_config('app.creating_checklist', 'yes', true);
  insert into checklist_items (checklist_id, position, text, takes_cost, cost_lyd)
    values (current_setting('test.s_plan')::uuid, 99, 'بند تجريبي', true, 999) returning id into v_id;
  if (select cost_lyd from checklist_items where id = v_id) is not null then
    raise exception 'FAIL: a cost was kept on a new item';
  end if;
  delete from checklist_items where id = v_id;
  perform set_config('app.creating_checklist', '', true);
  raise notice 'OK: a new item starts without a cost';
end $$;

-- 4. A stranger cannot reach the owner's plan; anon cannot call the function
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare n bigint;
begin
  if exists (select 1 from checklists where id = current_setting('test.s_plan')::uuid) then
    raise exception 'LEAK: stranger read the stop plan';
  end if;
  update checklist_items set cost_lyd = 1 where id = current_setting('test.s_rebar')::uuid;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'LEAK: stranger changed a cost'; end if;
  begin
    perform create_stop_plan(current_setting('test.s_project')::uuid, current_setting('test.s_phase')::uuid);
    raise exception 'LEAK: stranger reached the owner''s stop plan';
  exception when foreign_key_violation or insufficient_privilege then null;
  end;
  raise notice 'OK: stranger cannot read or change the stop plan';
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon', 'public.create_stop_plan(uuid, uuid)', 'execute') then
    raise exception 'LEAK: anon may execute create_stop_plan';
  end if;
  raise notice 'OK: anon cannot call create_stop_plan';
end $$;

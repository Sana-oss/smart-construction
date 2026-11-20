-- Tests for the concrete log (migration 0030; FR-QLT-04, FR-QLT-05). Uses Owner One (...a1) and Owner Two (...a2) from
-- rls_0006.test.sql, one project each.
reset role;

-- 1. A pour with the design's fields and the engineer's dates; «تمّ» is stamped by the database
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_phase uuid; v_id uuid; v_op uuid := gen_random_uuid();
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_phase from phases where project_id = v_project and position = 2;
  insert into concrete_pours (project_id, phase_id, poured_on, location, qty_m3, supplier, cube_samples, mix_ref, delivery_ref,
                              curing_until, formwork_on, client_op_id, curing_done_at)
    values (v_project, v_phase, private.today_tripoli() - 8, 'سقف الدور الأرضي', 30, 'الخرسانة الحديثة', 6, 'حسب مستند المشروع', 'DN-024',
            private.today_tripoli() - 1, private.today_tripoli() + 13, v_op, timestamptz '2000-01-01')
    returning id into v_id;
  if not exists (select 1 from concrete_pours where id = v_id and curing_done_at is null and delivery_ref = 'DN-024') then
    raise exception 'FAIL: pour not stored as expected, or «تمّ» taken from the client';
  end if;
  begin
    insert into concrete_pours (project_id, poured_on, location, qty_m3, supplier, client_op_id)
      values (v_project, private.today_tripoli(), 'قواعد', 5, 'مورد', v_op);
    raise exception 'FAIL: a retried pour was stored twice';
  exception when unique_violation then null;
  end;
  perform set_config('test.c_project', v_project::text, false);
  perform set_config('test.c_pour', v_id::text, false);

  -- Marking done: the moment is the database's; marking again keeps it; unmarking clears it.
  update concrete_pours set curing_done_at = timestamptz '2000-01-01' where id = v_id;
  if (select curing_done_at from concrete_pours where id = v_id) < timestamptz '2020-01-01' then
    raise exception 'FAIL: the done moment was taken from the client';
  end if;
  update concrete_pours set formwork_done_at = now() where id = v_id;
  update concrete_pours set formwork_done_at = null where id = v_id;
  if (select formwork_done_at from concrete_pours where id = v_id) is not null then
    raise exception 'FAIL: unmarking did not clear the done moment';
  end if;
  raise notice 'OK: a pour is stored once; «تمّ» is stamped and can be undone';
end $$;

-- 2. The rules: no future pour, the dates never before it, lengths, a phase of the project
do $$
declare v_project uuid := current_setting('test.c_project')::uuid; v_pour uuid := current_setting('test.c_pour')::uuid;
begin
  begin
    insert into concrete_pours (project_id, poured_on, location, qty_m3, supplier) values (v_project, private.today_tripoli() + 1, 'قواعد', 5, 'مورد');
    raise exception 'FAIL: a future pour was accepted';
  exception when check_violation then null;
  end;
  begin
    update concrete_pours set formwork_on = poured_on - 1 where id = v_pour;
    raise exception 'FAIL: a formwork date before the pour was accepted';
  exception when check_violation then null;
  end;
  begin
    update concrete_pours set curing_until = poured_on - 1 where id = v_pour;
    raise exception 'FAIL: a curing date before the pour was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into concrete_pours (project_id, poured_on, location, qty_m3, supplier) values (v_project, private.today_tripoli(), 'x', 5, 'مورد');
    raise exception 'FAIL: a one-letter element was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into concrete_pours (project_id, poured_on, location, qty_m3, supplier, cube_samples) values (v_project, private.today_tripoli(), 'قواعد', 5, 'مورد', 1001);
    raise exception 'FAIL: too many cube samples were accepted';
  exception when check_violation then null;
  end;
  raise notice 'OK: future pours, dates before the pour and bad values are refused';
end $$;

-- The guard itself, past RLS: another project's phase, and a move
reset role;
do $$
declare v_foreign_phase uuid; v_other_project uuid;
begin
  select ph.id, p.id into v_foreign_phase, v_other_project from phases ph join projects p on p.id = ph.project_id
    where p.owner_id = '00000000-0000-0000-0000-0000000000a2' limit 1;
  begin
    insert into concrete_pours (project_id, phase_id, poured_on, location, qty_m3, supplier)
      values (current_setting('test.c_project')::uuid, v_foreign_phase, private.today_tripoli(), 'قواعد', 5, 'مورد');
    raise exception 'FAIL: a phase of another project was accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    update concrete_pours set project_id = v_other_project, phase_id = null where id = current_setting('test.c_pour')::uuid;
    raise exception 'FAIL: a pour moved to another project';
  exception when check_violation then null;
  end;
  raise notice 'OK: the guard refuses another project''s phase and a move';
end $$;

-- 3. Changes and deletions are audited
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_id uuid;
begin
  insert into concrete_pours (project_id, poured_on, location, qty_m3, supplier)
    values (current_setting('test.c_project')::uuid, private.today_tripoli(), 'درج', 2, 'مورد') returning id into v_id;
  delete from concrete_pours where id = v_id;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from audit_log where table_name = 'concrete_pours' and action = 'updated'
                 and detail ->> 'row_id' = current_setting('test.c_pour') and detail -> 'after' ->> 'curing_done_at' is not null) then
    raise exception 'FAIL: marking done was not audited';
  end if;
  if not exists (select 1 from audit_log where table_name = 'concrete_pours' and action = 'deleted' and detail -> 'before' ->> 'location' = 'درج') then
    raise exception 'FAIL: the deletion was not audited';
  end if;
  raise notice 'OK: changes and deletions are audited';
end $$;

-- 4. A stranger sees and changes nothing
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare n bigint;
begin
  if exists (select 1 from concrete_pours where project_id = current_setting('test.c_project')::uuid) then
    raise exception 'LEAK: stranger read the concrete log';
  end if;
  update concrete_pours set formwork_done_at = now() where id = current_setting('test.c_pour')::uuid;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'LEAK: stranger changed a pour'; end if;
  raise notice 'OK: stranger cannot read or change the concrete log';
end $$;
reset role;

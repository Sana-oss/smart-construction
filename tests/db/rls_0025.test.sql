-- Tests for pre-pour checkpoints (migration 0025; FR-QLT-01, FR-QLT-02). Uses Owner One (...a1) and Owner Two (...a2)
-- from rls_0006.test.sql, one project each.
reset role;

-- 1. The template: one unreviewed hold-point template with the design's four items, read-only for users
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  -- Which items require a photo changed in 0026 (rls_0026 tests it); 0025 seeded four unreviewed items.
  if not exists (select 1 from checklist_templates where kind = 'hold_point' and status = 'unreviewed'
                 and jsonb_array_length(items) = 4 and items -> 2 ->> 'text' = 'فحص التسليح') then
    raise exception 'FAIL: expected the unreviewed pre-pour template with four items';
  end if;
  begin
    update checklist_templates set status = 'approved', reviewed_by = 'me', reviewed_on = current_date;
    raise exception 'LEAK: user approved the template';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK: the template is readable, unreviewed and read-only';
end $$;

-- 2. create_checklist copies the template; a checklist or an item made any other way is refused
do $$
declare v_project uuid; v_phase uuid; v_template uuid; v_id uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_phase from phases where project_id = v_project and position = 2;
  select id into v_template from checklist_templates where kind = 'hold_point';
  v_id := create_checklist(v_project, v_phase, ' صب سقف الدور الأرضي ', v_template);
  if not exists (select 1 from checklists where id = v_id and title = 'صب سقف الدور الأرضي' and status = 'open'
                 and template_status = 'unreviewed' and kind = 'hold_point' and phase_id = v_phase) then
    raise exception 'FAIL: checklist not stored as expected';
  end if;
  if (select count(*) from checklist_items where checklist_id = v_id and result is null) <> 4
     or (select text from checklist_items where checklist_id = v_id and position = 1) <> 'مراجعة المخطط المعتمد' then
    raise exception 'FAIL: the items were not copied in order';
  end if;
  perform set_config('test.list', v_id::text, false);
  perform set_config('test.project', v_project::text, false);
  perform set_config('test.template', v_template::text, false);

  begin
    insert into checklists (project_id, phase_id, kind, title, template_status) values (v_project, v_phase, 'hold_point', 'يدوية', 'approved');
    raise exception 'FAIL: a checklist was created without a template';
  exception when check_violation then null;
  end;
  begin
    insert into checklist_items (checklist_id, position, text) values (v_id, 9, 'بند مضاف');
    raise exception 'FAIL: an item was added outside the template';
  exception when check_violation then null;
  end;
  begin
    perform create_checklist(v_project, v_phase, 'x', v_template);
    raise exception 'FAIL: a one-letter title was accepted';
  exception when check_violation then null;
  end;
  raise notice 'OK: a checklist is a copy of a template; nothing else gets in';
end $$;

-- A phase of another project is refused
reset role;
do $$
declare v_foreign_phase uuid;
begin
  select ph.id into v_foreign_phase from phases ph join projects p on p.id = ph.project_id
    where p.owner_id = '00000000-0000-0000-0000-0000000000a2' limit 1;
  perform set_config('test.foreign_phase', v_foreign_phase::text, false);
end $$;
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  perform create_checklist(current_setting('test.project')::uuid, current_setting('test.foreign_phase')::uuid, 'صبة', current_setting('test.template')::uuid);
  raise exception 'FAIL: a phase of another project was accepted';
exception when foreign_key_violation then raise notice 'OK: a phase of another project is refused';
end $$;

-- The function itself checks the phase's project (as the migration owner, past RLS: RLS alone would hide the phase)
reset role;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  perform create_checklist(current_setting('test.project')::uuid, current_setting('test.foreign_phase')::uuid, 'صبة', current_setting('test.template')::uuid);
  raise exception 'FAIL: create_checklist accepted a phase of another project';
exception when foreign_key_violation then raise notice 'OK: create_checklist checks the phase itself';
end $$;
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';

-- 3. Checking items: who and when come from the database; nothing copied changes; a result stays
do $$
declare v_list uuid := current_setting('test.list')::uuid; v_item uuid;
begin
  select id into v_item from checklist_items where checklist_id = v_list and position = 3;
  update checklist_items set result = 'issue', note = 'تباعد الكانات', responsible = 'مقاول الهيكل', recheck_on = '2026-12-01',
    checked_by = '00000000-0000-0000-0000-0000000000a2', checked_at = timestamptz '2000-01-01' where id = v_item;
  if not exists (select 1 from checklist_items where id = v_item and checked_by = '00000000-0000-0000-0000-0000000000a1'
                 and checked_at > timestamptz '2020-01-01' and responsible = 'مقاول الهيكل') then
    raise exception 'FAIL: who checked and when were taken from the client';
  end if;
  begin
    update checklist_items set text = 'نص آخر' where id = v_item;
    raise exception 'FAIL: an item text was changed';
  exception when check_violation then null;
  end;
  begin
    update checklist_items set requires_photo = not requires_photo where id = v_item;
    raise exception 'FAIL: the photo rule of a copied item was changed';
  exception when check_violation then null;
  end;
  begin
    update checklist_items set result = null where id = v_item;
    raise exception 'FAIL: a result was removed';
  exception when check_violation then null;
  end;
  begin
    update checklist_items set result = 'approved' where id = v_item;
    raise exception 'FAIL: an unknown result was accepted';
  exception when check_violation then null;
  end;
  begin
    update checklists set status = 'completed', completed_at = now() where id = v_list;
    raise exception 'FAIL: a checklist was completed without its items';
  exception when check_violation then null;
  end;
  begin
    update checklists set phase_id = null where id = v_list;
    raise exception 'FAIL: a checklist left its phase';
  exception when check_violation then null;
  end;
  update checklists set title = 'صب سقف الدور الأرضي (الجزء الشمالي)' where id = v_list;
  raise notice 'OK: checks are stamped by the database; copied content and status are protected; the title may change';
end $$;

-- 4. The last result completes the checklist and emits checklist.completed once, problems included (D2)
do $$
declare v_list uuid := current_setting('test.list')::uuid;
begin
  update checklist_items set result = 'ok' where checklist_id = v_list and position in (1, 2);
  if (select status from checklists where id = v_list) <> 'open' then raise exception 'FAIL: completed too early'; end if;
  update checklist_items set result = 'na' where checklist_id = v_list and position = 4;
  if not exists (select 1 from checklists where id = v_list and status = 'completed' and completed_at is not null) then
    raise exception 'FAIL: the checklist was not completed';
  end if;
  -- Position 3 («فحص التسليح») requires a photo since 0026, so it is changed to «لا ينطبق», not «سليم».
  update checklist_items set result = 'na', note = 'عولجت' where checklist_id = v_list and position = 3;
  if (select status from checklists where id = v_list) <> 'completed' then raise exception 'FAIL: completion was undone'; end if;
  raise notice 'OK: the checklist completes with its last result';
end $$;
reset role;
do $$ begin
  if (select count(*) from outbox_events where event_type = 'checklist.completed'
        and payload ->> 'checklist_id' = current_setting('test.list')) <> 1 then
    raise exception 'FAIL: expected exactly one checklist.completed event';
  end if;
  if not exists (select 1 from outbox_events where event_type = 'checklist.completed'
                 and payload ->> 'checklist_id' = current_setting('test.list') and payload ->> 'issues' = '1') then
    raise exception 'FAIL: the event does not count the problem';
  end if;
  if (select count(*) from audit_log where table_name = 'checklist_items' and action = 'updated'
        and detail ->> 'checklist_id' = current_setting('test.list')) < 5 then
    raise exception 'FAIL: the checks were not audited';
  end if;
  if not exists (select 1 from audit_log where table_name = 'checklist_items'
                 and detail -> 'before' ->> 'result' = 'issue' and detail -> 'after' ->> 'result' = 'na') then
    raise exception 'FAIL: the audit does not keep the old result';
  end if;
  raise notice 'OK: one completion event; every check audited with its old values';
end $$;

-- 5. Deleting is closed for users; a stranger sees and changes nothing
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  delete from checklists where id = current_setting('test.list')::uuid;
  raise exception 'FAIL: a checklist was deleted';
exception when insufficient_privilege then raise notice 'OK: checklists are not deleted by users';
end $$;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare n bigint;
begin
  if exists (select 1 from checklists where id = current_setting('test.list')::uuid)
     or exists (select 1 from checklist_items where checklist_id = current_setting('test.list')::uuid) then
    raise exception 'LEAK: stranger read the checklist';
  end if;
  update checklist_items set result = 'issue' where checklist_id = current_setting('test.list')::uuid;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'LEAK: stranger changed an item'; end if;
  begin
    perform create_checklist(current_setting('test.project')::uuid, current_setting('test.foreign_phase')::uuid, 'صبة', current_setting('test.template')::uuid);
    raise exception 'LEAK: stranger created a checklist in the owner''s project';
  exception when foreign_key_violation or insufficient_privilege then null;
  end;
  raise notice 'OK: stranger cannot read or write checklists';
end $$;

-- 6. Only signed-in users may call create_checklist
reset role;
do $$ begin
  if has_function_privilege('anon', 'public.create_checklist(uuid, uuid, text, uuid)', 'execute') then
    raise exception 'LEAK: anon may execute create_checklist';
  end if;
  raise notice 'OK: anon cannot call create_checklist';
end $$;

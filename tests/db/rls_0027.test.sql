-- Tests for the readiness gate (migration 0027; FR-PRJ-05). Uses Owner One (...a1, a new-build project) and Owner Two
-- (...a2) from rls_0006.test.sql.
reset role;

-- 1. The readiness template: unreviewed, the FR-PRJ-05 items, the structural assessment for adding a floor only
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  if not exists (select 1 from checklist_templates where kind = 'readiness' and status = 'unreviewed'
                 and jsonb_array_length(items) = 6 and items -> 0 ->> 'text' = 'فحص التربة'
                 and items -> 5 ->> 'only_for' = 'add_floor') then
    raise exception 'FAIL: expected the unreviewed readiness template with six items, the last for adding a floor';
  end if;
  raise notice 'OK: the readiness template is in place and unreviewed';
end $$;

-- 2. One list per project, without a phase; the add-floor item is left out of a new-build project
do $$
declare v_project uuid; v_id uuid; v_again uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  v_id := create_readiness_checklist(v_project);
  v_again := create_readiness_checklist(v_project);
  if v_again <> v_id then raise exception 'FAIL: a second readiness list was created'; end if;
  if not exists (select 1 from checklists where id = v_id and kind = 'readiness' and phase_id is null
                 and title = 'جاهزية المشروع' and template_status = 'unreviewed' and status = 'open') then
    raise exception 'FAIL: readiness list not stored as expected';
  end if;
  if (select count(*) from checklist_items where checklist_id = v_id) <> 5
     or exists (select 1 from checklist_items where checklist_id = v_id and text like 'تقييم إنشائي%')
     or (select max(position) from checklist_items where checklist_id = v_id) <> 5 then
    raise exception 'FAIL: a new-build project got the add-floor item, or positions have a gap';
  end if;
  perform set_config('test.r_project', v_project::text, false);
  perform set_config('test.r_list', v_id::text, false);
  raise notice 'OK: one readiness list per project, items for its type';
end $$;

-- The unique index itself (as the migration owner, past the function's reuse): a second readiness list is refused
reset role;
do $$ begin
  perform set_config('app.creating_checklist', 'yes', true);
  insert into checklists (project_id, kind, title, template_status) values (current_setting('test.r_project')::uuid, 'readiness', 'جاهزية ثانية', 'unreviewed');
  raise exception 'FAIL: a second readiness list was accepted';
exception when unique_violation then raise notice 'OK: one readiness list per project, by the index';
end $$;

-- An add-floor project gets the structural assessment (as the migration owner: switch Owner Two's project type)
reset role;
update projects set project_type = 'add_floor' where owner_id = '00000000-0000-0000-0000-0000000000a2';
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare v_id uuid;
begin
  v_id := create_readiness_checklist((select id from projects where owner_id = '00000000-0000-0000-0000-0000000000a2'));
  if (select count(*) from checklist_items where checklist_id = v_id) <> 6
     or (select text from checklist_items where checklist_id = v_id and position = 6) <> 'تقييم إنشائي للأساسات والأعمدة والجدران الحالية' then
    raise exception 'FAIL: the add-floor project did not get the structural assessment';
  end if;
  raise notice 'OK: an add-floor project gets the structural assessment item';
end $$;

-- 3. The kind and the phase go together
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid := current_setting('test.r_project')::uuid; v_phase uuid;
begin
  select id into v_phase from phases where project_id = v_project and position = 1;
  begin
    perform create_checklist(v_project, v_phase, 'جاهزية مرحلة', (select id from checklist_templates where kind = 'readiness'));
    raise exception 'FAIL: a readiness list was attached to a phase';
  exception when check_violation then null;
  end;
  begin
    perform set_config('app.creating_checklist', 'yes', true);
    insert into checklists (project_id, kind, title, template_status) values (v_project, 'hold_point', 'صبة بلا مرحلة', 'unreviewed');
    raise exception 'FAIL: a pre-pour list without a phase was accepted';
  exception when check_violation then null;
  end;
  perform set_config('app.creating_checklist', '', true);
  raise notice 'OK: readiness has no phase; a pre-pour list has one';
end $$;

-- 4. Starting a phase with confirmed gaps: logged in the same transaction; without gaps nothing extra is logged
do $$
declare v_project uuid := current_setting('test.r_project')::uuid; v_phase uuid; v_other uuid;
begin
  select id into v_phase from phases where project_id = v_project and status = 'not_started' order by position limit 1;
  select id into v_other from phases where project_id = v_project and status = 'not_started' and id <> v_phase order by position limit 1;
  perform set_config('test.r_phase', v_phase::text, false);
  perform set_config('test.r_other', v_other::text, false);
  perform update_phase_schedule(v_phase, 'in_progress', null, null, null, null, '["فحص التربة (لم يُراجَع)", "ترخيص البناء (ناقص)"]'::jsonb);
  perform update_phase_schedule(v_other, 'in_progress');
  begin
    perform update_phase_schedule(v_other, 'in_progress', null, null, null, null, '[]'::jsonb);
    raise exception 'FAIL: an empty gap list was accepted';
  exception when check_violation then null;
  end;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from audit_log where table_name = 'phases' and action = 'start_confirmed_with_gaps'
                 and detail ->> 'phase_id' = current_setting('test.r_phase')
                 and detail -> 'gaps' ->> 1 = 'ترخيص البناء (ناقص)') then
    raise exception 'FAIL: the confirmed start was not logged with its gaps';
  end if;
  if exists (select 1 from audit_log where table_name = 'phases' and action = 'start_confirmed_with_gaps'
             and detail ->> 'phase_id' = current_setting('test.r_other')) then
    raise exception 'FAIL: a start without gaps was logged as confirmed with gaps';
  end if;
  if (select status from phases where id = current_setting('test.r_phase')::uuid) <> 'in_progress' then
    raise exception 'FAIL: the phase did not start';
  end if;
  raise notice 'OK: a start with gaps is confirmed and logged; one without gaps is not';
end $$;

-- 5. A stranger sees and creates nothing in Owner One's project; anon cannot call the new function
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$ begin
  if exists (select 1 from checklists where id = current_setting('test.r_list')::uuid) then
    raise exception 'LEAK: stranger read the readiness list';
  end if;
  begin
    perform create_readiness_checklist(current_setting('test.r_project')::uuid);
    raise exception 'LEAK: stranger reached the owner''s readiness list';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK: stranger cannot read or create the owner''s readiness list';
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon', 'public.create_readiness_checklist(uuid)', 'execute') then
    raise exception 'LEAK: anon may execute create_readiness_checklist';
  end if;
  if has_function_privilege('anon', 'public.update_phase_schedule(uuid, text, date, date, date, date, jsonb, jsonb)', 'execute') then
    raise exception 'LEAK: anon may execute update_phase_schedule';
  end if;
  raise notice 'OK: anon cannot call either function';
end $$;
update projects set project_type = 'new' where owner_id = '00000000-0000-0000-0000-0000000000a2';

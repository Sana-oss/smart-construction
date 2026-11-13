-- Tests for migration 0006 (first-project wizard, audit writer, phase template). Runs last.
reset role;

-- Two new owners (sign-up goes through the 0005 trigger, so they need an identity document).
insert into auth.users(id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', '{"full_name":"Owner One","nationality":"libyan","national_id":"119950000061"}'),
  ('00000000-0000-0000-0000-0000000000a2', '{"full_name":"Owner Two","nationality":"foreign","passport_number":"OWNTWO01"}');

-- 1. Phase template: 4 unreviewed rows, readable by signed-in users, not writable by them
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  if (select count(*) from phase_templates where status = 'unreviewed') <> 4 then
    raise exception 'FAIL: expected 4 unreviewed template phases';
  end if;
  raise notice 'OK: phase template has 4 unreviewed phases, readable';
end $$;
do $$ begin
  insert into phase_templates(position, name) values (9, 'Fake');
  raise exception 'LEAK: user inserted into the phase template';
exception when others then if sqlerrm like 'LEAK%' then raise; end if; raise notice 'OK: user cannot add template phases'; end $$;
do $$
declare n bigint;
begin
  update phase_templates set status = 'approved', reviewed_by = 'me', reviewed_on = current_date;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'LEAK: user approved the phase template'; end if;
  raise notice 'OK: user cannot approve the template';
end $$;

-- 2. Owner One creates the project in one call; over-budget confirmed
do $$
declare v uuid;
begin
  v := create_first_project('فيلا النخيل', 'طرابلس', 'new', 240.5, 450000, 180000, 460000, 10,
    '[{"position":1,"name":"الحفر والأساسات","status":"done"},
      {"position":2,"name":"الهيكل الخرساني","status":"in_progress"},
      {"position":3,"name":"المباني والتأسيسات","status":"not_started"},
      {"position":4,"name":"التشطيب والتسليم","status":"not_started"}]'::jsonb, true);
  if not exists (select 1 from projects where id = v and owner_id = '00000000-0000-0000-0000-0000000000a1'
                 and building_area_m2 = 240.5 and spent_before_lyd = 460000 and available_now_lyd = 180000
                 and available_as_of is not null and contingency_pct = 10) then
    raise exception 'FAIL: project not stored as given';
  end if;
  if (select string_agg(status, ',' order by position) from phases where project_id = v) <> 'done,in_progress,not_started,not_started' then
    raise exception 'FAIL: phases not stored with their statuses';
  end if;
  if not exists (select 1 from audit_log where project_id = v and action = 'over_budget_confirmed'
                 and actor_id = '00000000-0000-0000-0000-0000000000a1' and (detail ->> 'spent_before_lyd')::numeric = 460000) then
    raise exception 'FAIL: over-budget confirmation not logged with the owner as actor';
  end if;
  raise notice 'OK: project, phases and audit row created together';
end $$;

-- 3. One project per owner
do $$ begin
  perform create_first_project('ثاني', 'طرابلس', 'new', 100, 1000, 0, 0, 10, '[{"position":1,"name":"x","status":"in_progress"}]'::jsonb, false);
  raise exception 'LEAK: second project allowed';
exception when unique_violation then raise notice 'OK: second project refused'; end $$;

-- 4. Without confirmation nothing is logged; a failing phase row rolls back the whole project
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$ begin
  perform create_first_project('بيت', 'other-city', 'add_floor', 120, 200000, 0, 0, 10,
    '[{"position":1,"name":"x","status":"bogus"}]'::jsonb, false);
  raise exception 'LEAK: invalid phase status accepted';
exception when check_violation then raise notice 'OK: invalid phase refused'; end $$;
do $$ begin
  if exists (select 1 from projects where owner_id = '00000000-0000-0000-0000-0000000000a2') then
    raise exception 'FAIL: project left behind after a failed phase insert';
  end if;
  raise notice 'OK: failed creation leaves no project (one transaction)';
end $$;
do $$
declare v uuid;
begin
  v := create_first_project('بيت', 'سبها', 'add_floor', 120, 200000, 50000, 0, 10,
    '[{"position":1,"name":"الحفر والأساسات","status":"in_progress"}]'::jsonb, false);
  if exists (select 1 from audit_log where project_id = v) then raise exception 'FAIL: audit row without confirmation'; end if;
  raise notice 'OK: no audit row without a confirmation';
end $$;

-- 5. Isolation: Owner Two cannot see Owner One's project, phases or audit, nor write into Owner One's audit log
do $$ begin
  if exists (select 1 from projects where owner_id = '00000000-0000-0000-0000-0000000000a1')
     or exists (select 1 from audit_log where actor_id = '00000000-0000-0000-0000-0000000000a1') then
    raise exception 'LEAK: another owner sees the project or its audit log';
  end if;
  raise notice 'OK: owners cannot see each other''s projects or audit rows';
end $$;
do $$
declare other uuid;
begin
  reset role;
  select id into other from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  set role authenticated;
  perform private.log_audit(other, 'projects', 'forged', '{}'::jsonb);
  raise exception 'LEAK: wrote into another owner''s audit log';
exception when insufficient_privilege then raise notice 'OK: cannot write another project''s audit log'; end $$;
do $$ begin
  insert into audit_log(actor_id, table_name, action) values ('00000000-0000-0000-0000-0000000000a2', 'x', 'direct');
  raise exception 'LEAK: direct insert into audit_log';
exception when others then if sqlerrm like 'LEAK%' then raise; end if; raise notice 'OK: no direct audit inserts'; end $$;

-- 6. Anonymous visitors cannot create projects
reset role;
set role anon;
set app.uid = '';
do $$ begin
  perform create_first_project('x', 'طرابلس', 'new', 1, 1, 0, 0, 10, '[{"position":1,"name":"x","status":"in_progress"}]'::jsonb, false);
  raise exception 'LEAK: anon created a project';
exception when insufficient_privilege then raise notice 'OK: anon cannot create projects'; end $$;
reset role;

-- 7. Feature flags for 3.20 and 3.23 exist
do $$ begin
  if (select count(*) from feature_flags where module in ('offline', 'handover')) <> 2 then
    raise exception 'FAIL: offline/handover feature flags missing';
  end if;
  raise notice 'OK: offline and handover flags exist';
end $$;

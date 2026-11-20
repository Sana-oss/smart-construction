-- Tests for update_phase_schedule and the phase date-order checks (migration 0010, FR-PRJ-03).
-- Uses Owner One (...a1) and Owner Two (...a2) from rls_0006.test.sql, one project each.
reset role;

-- 1. The owner sets the status and dates of a phase: stored as given, with one audit row (old and new values)
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_phase uuid; v_audit_before bigint; v_audit_after bigint;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_phase from phases where project_id = v_project and position = 1;
  select count(*) into v_audit_before from audit_log where project_id = v_project;

  perform update_phase_schedule(v_phase, 'in_progress', date '2026-10-01', date '2026-11-10', date '2026-10-03', null);

  if not exists (select 1 from phases where id = v_phase and status = 'in_progress'
                 and planned_start = date '2026-10-01' and planned_end = date '2026-11-10'
                 and actual_start = date '2026-10-03' and actual_end is null) then
    raise exception 'FAIL: phase schedule not stored as given';
  end if;
  select count(*) into v_audit_after from audit_log where project_id = v_project;
  if v_audit_after <> v_audit_before + 1 then raise exception 'FAIL: expected exactly one new audit row'; end if;
  if not exists (select 1 from audit_log where project_id = v_project and table_name = 'phases' and action = 'schedule_updated'
                 and detail ->> 'phase_id' = v_phase::text and detail -> 'new' ->> 'status' = 'in_progress'
                 and detail -> 'new' ->> 'planned_end' = '2026-11-10'
                 and actor_id = '00000000-0000-0000-0000-0000000000a1') then
    raise exception 'FAIL: audit row missing or wrong';
  end if;
  raise notice 'OK: owner updates a phase schedule, audited';
end $$;

-- 2. A stranger (Owner Two) cannot change Owner One's phase, through the function or directly
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare v_phase uuid; n int;
begin
  reset role;
  select ph.id into v_phase from phases ph join projects p on p.id = ph.project_id
   where p.owner_id = '00000000-0000-0000-0000-0000000000a1' and ph.position = 1;
  set role authenticated;
  begin
    perform update_phase_schedule(v_phase, 'done', null, null, null, null);
    raise exception 'LEAK: stranger changed a phase through update_phase_schedule';
  exception when insufficient_privilege then raise notice 'OK: stranger refused by update_phase_schedule';
  end;
  update phases set status = 'blocked' where id = v_phase;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'LEAK: stranger updated % phase row(s) directly', n; end if;
  reset role;
  if not exists (select 1 from phases where id = v_phase and status = 'in_progress' and planned_end = date '2026-11-10') then
    raise exception 'LEAK: the phase changed';
  end if;
  raise notice 'OK: stranger cannot change the phase directly either';
end $$;

-- 3. The database refuses an end before its start, actual dates after today, and an unknown status
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_phase uuid;
begin
  select ph.id into v_phase from phases ph join projects p on p.id = ph.project_id
   where p.owner_id = '00000000-0000-0000-0000-0000000000a1' and ph.position = 1;

  begin
    perform update_phase_schedule(v_phase, 'in_progress', date '2026-11-10', date '2026-11-01', null, null);
    raise exception 'FAIL: planned end before planned start accepted';
  exception when check_violation then raise notice 'OK: planned end before start refused'; end;

  begin
    perform update_phase_schedule(v_phase, 'done', null, null, date '2026-11-10', date '2026-11-05');
    raise exception 'FAIL: actual end before actual start accepted';
  exception when check_violation then raise notice 'OK: actual end before start refused'; end;

  begin
    perform update_phase_schedule(v_phase, 'in_progress', null, null, private.today_tripoli() + 1, null);
    raise exception 'FAIL: actual start after today accepted';
  exception when check_violation then raise notice 'OK: actual date after today refused'; end;

  begin
    perform update_phase_schedule(v_phase, 'finished', null, null, null, null);
    raise exception 'FAIL: unknown status accepted';
  exception when check_violation then raise notice 'OK: unknown status refused'; end;

  -- Planned dates in the future are fine.
  perform update_phase_schedule(v_phase, 'in_progress', date '2026-10-01', private.today_tripoli() + 60, date '2026-10-03', null);
  raise notice 'OK: planned dates may be in the future';
end $$;

-- 4. Not signed in: refused
reset role;
do $$
declare v_phase uuid;
begin
  select ph.id into v_phase from phases ph join projects p on p.id = ph.project_id
   where p.owner_id = '00000000-0000-0000-0000-0000000000a1' and ph.position = 1;
  set role anon;
  perform update_phase_schedule(v_phase, 'done', null, null, null, null);
  raise exception 'LEAK: anon changed a phase';
exception when insufficient_privilege then raise notice 'OK: anon cannot change phases'; end $$;
reset role;

-- 5. anon has no execute right on the function at all (0011; Supabase grants it to anon by default). Since 0027 the
--    function has a seventh parameter (p_start_gaps), so the check names the current signature.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon')
     and has_function_privilege('anon', 'public.update_phase_schedule(uuid, text, date, date, date, date, jsonb)', 'execute') then
    raise exception 'FAIL: anon can execute update_phase_schedule';
  end if;
  raise notice 'OK: anon cannot execute update_phase_schedule';
end $$;

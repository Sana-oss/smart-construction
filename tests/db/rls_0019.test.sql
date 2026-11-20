-- Tests for the continue-or-pause comparison (migration 0019; design S18; FR-DEC-01, FR-DEC-02). Uses Owner One (...a1)
-- and Owner Two (...a2) from rls_0006.test.sql, one project each.
reset role;

-- 1. The owner saves the figures and the review; one row per project; a second insert is refused, an update works
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_phase uuid; v_first timestamptz;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_phase from phases where project_id = v_project and position = 2;
  insert into decision_scenarios (project_id, remaining_works_lyd, materials_on_hand_lyd, phase_id, phase_cost_lyd, protection_lyd, price_change_pct)
    values (v_project, 200000, 20000, v_phase, 50000, 3000, 10);
  select updated_at into v_first from decision_scenarios where project_id = v_project;
  if v_first is null then raise exception 'FAIL: updated_at not set'; end if;

  begin
    insert into decision_scenarios (project_id) values (v_project);
    raise exception 'FAIL: a second comparison for the same project accepted';
  exception when unique_violation then raise notice 'OK: one comparison per project'; end;

  update decision_scenarios set choice = 'finish_phase', funding_confirmed = true, review_note = 'بانتظار المهندس' where project_id = v_project;
  if not exists (select 1 from decision_scenarios where project_id = v_project and choice = 'finish_phase' and funding_confirmed) then
    raise exception 'FAIL: review not stored';
  end if;
  -- updated_at is set by the database on every change, whatever the client sends.
  update decision_scenarios set updated_at = timestamptz '2000-01-01' where project_id = v_project;
  if (select updated_at from decision_scenarios where project_id = v_project) < timestamptz '2020-01-01' then
    raise exception 'FAIL: updated_at taken from the client';
  end if;
  raise notice 'OK: figures and review stored';
end $$;

-- 2. The rules: amounts, the % range, the choice, and the phase (of this project, with its cost within the works)
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_other_phase uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  reset role;
  select ph.id into v_other_phase from phases ph join projects p on p.id = ph.project_id
    where p.owner_id = '00000000-0000-0000-0000-0000000000a2' limit 1;
  set role authenticated;

  begin update decision_scenarios set price_change_pct = 100.01 where project_id = v_project;
    raise exception 'FAIL: percent above 100 accepted';
  exception when check_violation then raise notice 'OK: percent at most 100'; end;
  begin update decision_scenarios set price_change_pct = -50.01 where project_id = v_project;
    raise exception 'FAIL: percent below -50 accepted';
  exception when check_violation then raise notice 'OK: percent at least -50'; end;
  -- Without a phase cost, so only the "works positive" rule can refuse it.
  begin update decision_scenarios set remaining_works_lyd = 0, phase_cost_lyd = null where project_id = v_project;
    raise exception 'FAIL: zero remaining works accepted';
  exception when check_violation then raise notice 'OK: remaining works positive'; end;
  begin update decision_scenarios set protection_lyd = -1 where project_id = v_project;
    raise exception 'FAIL: negative cost accepted';
  exception when check_violation then raise notice 'OK: costs not negative'; end;
  begin update decision_scenarios set choice = 'sell' where project_id = v_project;
    raise exception 'FAIL: unknown choice accepted';
  exception when check_violation then raise notice 'OK: known choices only'; end;
  begin update decision_scenarios set phase_cost_lyd = 250000 where project_id = v_project;
    raise exception 'FAIL: phase cost above the remaining works accepted';
  exception when check_violation then raise notice 'OK: phase within the works'; end;
  begin update decision_scenarios set phase_id = null where project_id = v_project;
    raise exception 'FAIL: phase cost without a phase accepted';
  exception when check_violation then raise notice 'OK: a phase cost needs its phase'; end;
  begin update decision_scenarios set phase_id = v_other_phase where project_id = v_project;
    raise exception 'FAIL: phase of another project accepted';
  exception when foreign_key_violation then raise notice 'OK: phase of this project only'; end;
  begin update decision_scenarios set review_note = repeat('ن', 501) where project_id = v_project;
    raise exception 'FAIL: long note accepted';
  exception when check_violation then raise notice 'OK: note length'; end;
end $$;

-- 3. Every change is audited with the old values
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; a record;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  if not exists (select 1 from audit_log where table_name = 'decision_scenarios' and action = 'updated'
                 and (detail -> 'before' ->> 'funding_confirmed')::boolean = false and (detail -> 'after' ->> 'funding_confirmed')::boolean) then
    raise exception 'FAIL: the review change was not audited';
  end if;
  raise notice 'OK: changes are audited';
end $$;

-- 4. An editor of BOTH projects cannot move the comparison; a stranger can neither read nor change it
reset role;
insert into project_members (project_id, user_id, role)
  select id, '00000000-0000-0000-0000-0000000000a2', 'editor' from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare v_mine uuid; v_theirs uuid;
begin
  select id into v_mine from projects where owner_id = '00000000-0000-0000-0000-0000000000a2';
  select id into v_theirs from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  begin
    update decision_scenarios set project_id = v_mine, phase_id = null, phase_cost_lyd = null where project_id = v_theirs;
    raise exception 'FAIL: an editor of both projects moved the comparison';
  exception when check_violation then raise notice 'OK: the guard keeps it in its project'; end;
end $$;
reset role;
delete from project_members where user_id = '00000000-0000-0000-0000-0000000000a2';

set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare n int;
begin
  if (select count(*) from decision_scenarios) <> 0 then raise exception 'FAIL: stranger reads the comparison'; end if;
  update decision_scenarios set price_change_pct = 0;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: stranger changed the comparison'; end if;
  raise notice 'OK: a stranger cannot read or change it';
end $$;

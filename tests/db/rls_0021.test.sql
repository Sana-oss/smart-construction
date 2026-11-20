-- Tests for the phase allocations (migration 0021; design S15.2; FR-FIN-11). Uses Owner One (...a1) and Owner Two
-- (...a2) from rls_0006.test.sql, one project each.
reset role;

-- 1. The owner allocates an amount to a phase; one allocation per phase; an update keeps it audited and dated
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_phase uuid; v_id uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_phase from phases where project_id = v_project and position = 1;
  insert into budget_categories (project_id, phase_id, planned_lyd) values (v_project, v_phase, 60000) returning id into v_id;
  begin
    insert into budget_categories (project_id, phase_id, planned_lyd) values (v_project, v_phase, 1);
    raise exception 'FAIL: two allocations for one phase accepted';
  exception when unique_violation then raise notice 'OK: one allocation per phase'; end;

  update budget_categories set planned_lyd = 65000, updated_at = timestamptz '2000-01-01' where id = v_id;
  if (select updated_at from budget_categories where id = v_id) < timestamptz '2020-01-01' then
    raise exception 'FAIL: updated_at taken from the client';
  end if;
  if not exists (select 1 from audit_log where table_name = 'budget_categories' and action = 'updated'
                 and (detail -> 'before' ->> 'planned_lyd')::numeric = 60000 and (detail -> 'after' ->> 'planned_lyd')::numeric = 65000) then
    raise exception 'FAIL: the change was not audited';
  end if;
  raise notice 'OK: allocation stored, unique, audited';
end $$;

-- 2. The rules: a row needs a name or a phase; the name length; no negative amount; a phase of this project only
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
  begin
    insert into budget_categories (project_id, planned_lyd) values (v_project, 1);
    raise exception 'FAIL: a row with neither name nor phase accepted';
  exception when check_violation then raise notice 'OK: a name or a phase'; end;
  begin
    insert into budget_categories (project_id, name, planned_lyd) values (v_project, 'x', 1);
    raise exception 'FAIL: one-letter name accepted';
  exception when check_violation then raise notice 'OK: name length'; end;
  begin
    insert into budget_categories (project_id, phase_id, planned_lyd) values (v_project, v_other_phase, 1);
    raise exception 'FAIL: phase of another project accepted';
  exception when foreign_key_violation then raise notice 'OK: phase of this project only'; end;
  begin
    update budget_categories set planned_lyd = -1 where project_id = v_project;
    raise exception 'FAIL: negative allocation accepted';
  exception when check_violation then raise notice 'OK: not negative'; end;
  insert into budget_categories (project_id, name, planned_lyd) values (v_project, 'بند عام', 10); -- a named row still works
end $$;

-- 3. Deleting the phase deletes its allocation (audited); deleting a whole account still works
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_phase uuid; v_id uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  insert into phases (project_id, name, position) values (v_project, 'مرحلة مؤقتة', 98) returning id into v_phase;
  insert into budget_categories (project_id, phase_id, planned_lyd) values (v_project, v_phase, 5) returning id into v_id;
  delete from phases where id = v_phase;
  if exists (select 1 from budget_categories where id = v_id) then raise exception 'FAIL: allocation outlived its phase'; end if;
  if not exists (select 1 from audit_log where table_name = 'budget_categories' and action = 'deleted' and detail ->> 'row_id' = v_id::text) then
    raise exception 'FAIL: the deletion was not audited';
  end if;
  raise notice 'OK: the allocation goes with its phase';
end $$;

reset role;
set app.uid = '';
do $$
declare v_user uuid := '00000000-0000-0000-0000-0000000021c1'; v_project uuid; v_phase uuid;
begin
  insert into auth.users(id, raw_user_meta_data) values (v_user, '{"full_name":"Temp","nationality":"foreign","passport_number":"TEMP0021"}');
  insert into projects (owner_id, name) values (v_user, 'مشروع مؤقت') returning id into v_project;
  insert into phases (project_id, name, position) values (v_project, 'مؤقتة', 1) returning id into v_phase;
  insert into budget_categories (project_id, phase_id, planned_lyd) values (v_project, v_phase, 9);
  delete from auth.users where id = v_user;
  if exists (select 1 from projects where id = v_project) then raise exception 'FAIL: project not deleted'; end if;
  raise notice 'OK: deleting an account still deletes its allocations';
end $$;

-- 4. An editor of BOTH projects cannot move an allocation; a stranger can neither read nor change one
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
    update budget_categories set project_id = v_mine, phase_id = null where name = 'بند عام';
    raise exception 'FAIL: an editor of both projects moved an allocation';
  exception when check_violation then raise notice 'OK: the guard keeps it in its project'; end;
end $$;
reset role;
delete from project_members where user_id = '00000000-0000-0000-0000-0000000000a2';

set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare n int;
begin
  if (select count(*) from budget_categories where name = 'بند عام') <> 0 then raise exception 'FAIL: stranger reads allocations'; end if;
  update budget_categories set planned_lyd = 0 where name = 'بند عام';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: stranger changed an allocation'; end if;
  raise notice 'OK: a stranger cannot read or change allocations';
end $$;

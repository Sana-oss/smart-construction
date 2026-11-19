-- Tests for obligations and expected income (migration 0017; design S16; FR-FIN-06, FR-FIN-07, FR-SYS-03). Uses Owner One
-- (...a1) and Owner Two (...a2) from rls_0006.test.sql, one project each.
reset role;

-- 1. The owner adds an obligation and an expected income with the S16.2 fields; a missing or short title is refused
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  insert into obligations (project_id, title, creditor, amount_lyd, due_on) values (v_project, 'دفعة مقاول الهيكل', 'المقاول', 15000, current_date + 5);
  insert into expected_income (project_id, title, source, amount_lyd, expected_on) values (v_project, 'تمويل من المالك', 'مالك المشروع', 40000, current_date + 10);
  if (select count(*) from obligations where project_id = v_project) <> 1 or (select count(*) from expected_income where project_id = v_project) <> 1 then
    raise exception 'FAIL: rows not stored';
  end if;

  begin
    insert into obligations (project_id, creditor, amount_lyd, due_on) values (v_project, 'المقاول', 10, current_date);
    raise exception 'FAIL: obligation without a title accepted';
  exception when not_null_violation then raise notice 'OK: title required'; end;
  begin
    insert into expected_income (project_id, title, source, amount_lyd, expected_on) values (v_project, ' x ', 'مالك', 10, current_date);
    raise exception 'FAIL: one-letter title accepted';
  exception when check_violation then raise notice 'OK: title length'; end;
  begin
    insert into obligations (project_id, title, creditor, amount_lyd, due_on) values (v_project, 'توريد', ' ', 10, current_date);
    raise exception 'FAIL: empty creditor accepted';
  exception when check_violation then raise notice 'OK: creditor length'; end;
  raise notice 'OK: S16.2 fields stored';
end $$;

-- 2. Every change and deletion is audited with the old values; a row never moves; a save without a change records nothing
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_other uuid; v_ob uuid; v_in uuid; a record;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  reset role;
  select id into v_other from projects where owner_id = '00000000-0000-0000-0000-0000000000a2';
  set role authenticated;
  select id into v_ob from obligations where project_id = v_project;
  select id into v_in from expected_income where project_id = v_project;

  update obligations set amount_lyd = 16000 where id = v_ob;
  select * into a from audit_log where table_name = 'obligations' and action = 'updated' and detail ->> 'row_id' = v_ob::text;
  if a is null or a.actor_id <> '00000000-0000-0000-0000-0000000000a1'
     or (a.detail -> 'before' ->> 'amount_lyd')::numeric <> 15000 or (a.detail -> 'after' ->> 'amount_lyd')::numeric <> 16000 then
    raise exception 'FAIL: the change was not audited with both values: %', a;
  end if;

  update obligations set amount_lyd = 16000 where id = v_ob;
  if (select count(*) from audit_log where detail ->> 'row_id' = v_ob::text) <> 1 then
    raise exception 'FAIL: a save without a change was recorded';
  end if;

  begin
    update expected_income set project_id = v_other where id = v_in;
    raise exception 'FAIL: income moved to another project';
  exception when check_violation then raise notice 'OK: a row never moves'; end;

  delete from expected_income where id = v_in;
  select * into a from audit_log where table_name = 'expected_income' and action = 'deleted' and detail ->> 'row_id' = v_in::text;
  if a is null or a.detail -> 'before' ->> 'title' <> 'تمويل من المالك' or (a.detail -> 'before' ->> 'amount_lyd')::numeric <> 40000 then
    raise exception 'FAIL: the deletion did not keep the old values: %', a;
  end if;
  raise notice 'OK: changes and deletions are audited';
end $$;

-- 3. A stranger cannot read, change or delete the owner's rows, and leaves no audit row
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare n int; v_audit int;
begin
  reset role;
  select count(*) into v_audit from audit_log;
  set role authenticated;
  if (select count(*) from obligations where title = 'دفعة مقاول الهيكل') <> 0 then raise exception 'FAIL: stranger reads obligations'; end if;
  update obligations set amount_lyd = 1 where title = 'دفعة مقاول الهيكل';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: stranger changed an obligation'; end if;
  delete from obligations where title = 'دفعة مقاول الهيكل';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: stranger deleted an obligation'; end if;
  reset role;
  if (select count(*) from audit_log) <> v_audit then raise exception 'FAIL: a refused change left an audit row'; end if;
  if (select amount_lyd from obligations where title = 'دفعة مقاول الهيكل') <> 16000 then raise exception 'FAIL: the obligation changed'; end if;
  raise notice 'OK: a stranger cannot read, change or delete';
end $$;

-- 4. Deleting a whole account (as the e2e cleanup does, no signed-in user) still deletes its rows
reset role;
set app.uid = '';
do $$
declare v_user uuid := '00000000-0000-0000-0000-0000000017c1'; v_project uuid;
begin
  insert into auth.users(id, raw_user_meta_data) values (v_user, '{"full_name":"Temp","nationality":"foreign","passport_number":"TEMP0017"}');
  insert into projects (owner_id, name) values (v_user, 'مشروع مؤقت') returning id into v_project;
  insert into obligations (project_id, title, creditor, amount_lyd, due_on) values (v_project, 'مؤقت', 'مؤقت', 9, current_date);
  insert into expected_income (project_id, title, source, amount_lyd, expected_on) values (v_project, 'مؤقت', 'مؤقت', 9, current_date);
  delete from auth.users where id = v_user;
  if exists (select 1 from projects where id = v_project) then raise exception 'FAIL: project not deleted'; end if;
  raise notice 'OK: deleting an account still deletes its movements';
end $$;

-- 5. Someone who may write to BOTH projects (Owner Two, also an editor of Owner One's) still cannot move a row
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
    update obligations set project_id = v_mine where title = 'دفعة مقاول الهيكل';
    raise exception 'FAIL: an editor of both projects moved an obligation';
  exception when check_violation then raise notice 'OK: the guard keeps the row in its project'; end;
end $$;
reset role;
delete from project_members where user_id = '00000000-0000-0000-0000-0000000000a2';

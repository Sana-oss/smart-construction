-- Tests for migration 0007 (outbox writer, one project per owner, raw budget view, Tripoli dates). Runs last.
-- Uses the two owners created by rls_0006.test.sql: Owner One (...a1) and Owner Two (...a2), one project each.
reset role;

-- 1. Outbox writer: the owner emits an event for their own project
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare
  v_project uuid;
  v_event uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  v_event := private.emit_event(v_project, 'expense.created', '{"expense_id":"e1"}'::jsonb);
  reset role; -- only the table owner / service role can read the outbox
  if not exists (select 1 from outbox_events where id = v_event and project_id = v_project
                 and event_type = 'expense.created' and payload ->> 'expense_id' = 'e1' and processed_at is null) then
    raise exception 'FAIL: event not stored as given';
  end if;
  raise notice 'OK: owner emitted an event for their project';
end $$;

-- 2. Signed-in users cannot read, insert, change or delete events directly
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare n bigint;
begin
  select count(*) into n from outbox_events;
  if n > 0 then raise exception 'LEAK: user reads the outbox (% rows)', n; end if;
  update outbox_events set processed_at = now();
  get diagnostics n = row_count;
  if n > 0 then raise exception 'LEAK: user marked events as processed'; end if;
  delete from outbox_events;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'LEAK: user deleted events'; end if;
  raise notice 'OK: user cannot read, change or delete events';
end $$;
do $$
declare v_project uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  insert into outbox_events(project_id, event_type, payload) values (v_project, 'expense.created', '{}'::jsonb);
  raise exception 'LEAK: direct insert into outbox_events';
exception when others then if sqlerrm like 'LEAK%' then raise; end if; raise notice 'OK: no direct outbox inserts'; end $$;

-- 3. Another owner (a stranger to the project) cannot emit events for it
do $$
declare other uuid;
begin
  reset role;
  select id into other from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  set role authenticated;
  set app.uid = '00000000-0000-0000-0000-0000000000a2';
  perform private.emit_event(other, 'expense.created', '{}'::jsonb);
  raise exception 'LEAK: stranger emitted an event for another project';
exception when insufficient_privilege then raise notice 'OK: stranger cannot emit events'; end $$;

-- 4. A viewer of the project cannot emit events either (emitting = writing), an editor can
reset role;
insert into project_members(project_id, user_id, role)
  select id, '00000000-0000-0000-0000-0000000000a2', 'viewer' from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare other uuid;
begin
  select id into other from projects where owner_id = '00000000-0000-0000-0000-0000000000a1'; -- visible now: member
  if other is null then raise exception 'FAIL: viewer should see the project'; end if;
  perform private.emit_event(other, 'expense.created', '{}'::jsonb);
  raise exception 'LEAK: viewer emitted an event';
exception when insufficient_privilege then raise notice 'OK: viewer cannot emit events'; end $$;
reset role;
update project_members set role = 'editor' where user_id = '00000000-0000-0000-0000-0000000000a2';
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare other uuid;
begin
  select id into other from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  perform private.emit_event(other, 'purchase.recorded', null);
  raise notice 'OK: editor emitted an event (null payload becomes {})';
end $$;
reset role;
do $$ begin
  if not exists (select 1 from outbox_events where event_type = 'purchase.recorded' and payload = '{}'::jsonb) then
    raise exception 'FAIL: editor event missing or payload not defaulted';
  end if;
end $$;
delete from project_members where user_id = '00000000-0000-0000-0000-0000000000a2';

-- 5. Event type must look like "thing.happened"; anonymous visitors cannot emit
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  perform private.emit_event(v_project, 'Not An Event', '{}'::jsonb);
  raise exception 'LEAK: malformed event type accepted';
exception when check_violation then raise notice 'OK: malformed event type refused'; end $$;
reset role;
set role anon;
set app.uid = '';
do $$
declare other uuid;
begin
  reset role;
  select id into other from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  set role anon;
  perform private.emit_event(other, 'expense.created', '{}'::jsonb);
  raise exception 'LEAK: anon emitted an event';
exception when insufficient_privilege then raise notice 'OK: anon cannot emit events'; end $$;
reset role;

-- 6. An event is deleted with its project (no orphans), checked inside a rolled-back block
do $$
declare v_project uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  begin
    delete from projects where id = v_project;
    if exists (select 1 from outbox_events where project_id = v_project) then
      raise exception 'FAIL: events left behind after deleting the project';
    end if;
    raise exception 'ROLLBACK_ON_PURPOSE';
  exception when others then
    if sqlerrm <> 'ROLLBACK_ON_PURPOSE' then raise; end if;
  end;
  raise notice 'OK: events are deleted with their project';
end $$;

-- 7. One project per owner, even with a direct insert that skips create_first_project
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  insert into projects(owner_id, name) values ('00000000-0000-0000-0000-0000000000a1', 'Second, inserted directly');
  raise exception 'LEAK: second project for the same owner';
exception when unique_violation then raise notice 'OK: direct second project refused by the unique index'; end $$;

-- 8. budget_summary: raw numbers only; the database adds the expenses up; owners see only their own row
do $$
declare
  v_project uuid;
  r record;
  n bigint;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  insert into expenses(project_id, amount_lyd) values (v_project, 1000.250), (v_project, 0.125);
  select * into r from budget_summary where project_id = v_project;
  if r.total_budget_lyd <> 450000 or r.contingency_pct <> 10 or r.spent_before_lyd <> 460000
     or r.recorded_expenses_lyd <> 1000.375 then
    raise exception 'FAIL: budget_summary numbers wrong: %', r;
  end if;
  select count(*) into n from budget_summary;
  if n <> 1 then raise exception 'LEAK: owner sees % budget rows, expected only their own', n; end if;
  raise notice 'OK: budget_summary gives raw numbers for the owner''s project only';
end $$;
do $$ begin
  perform spent_lyd from budget_summary;
  raise exception 'FAIL: derived column spent_lyd still exists';
exception when undefined_column then raise notice 'OK: derived columns removed from budget_summary'; end $$;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare r record;
begin
  select * into r from budget_summary; -- Owner Two: one project, no expenses
  if r.recorded_expenses_lyd <> 0 or r.spent_before_lyd <> 0 then
    raise exception 'FAIL: a project without expenses must show 0, got %', r;
  end if;
  raise notice 'OK: no expenses gives 0, not null';
end $$;

-- 9. Dates default to today in Libya, not today in UTC
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare
  v_today date := (now() at time zone 'Africa/Tripoli')::date;
  v_project uuid;
begin
  if private.today_tripoli() <> v_today then raise exception 'FAIL: today_tripoli is not the Tripoli date'; end if;
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  if exists (select 1 from expenses where project_id = v_project and paid_on <> v_today) then
    raise exception 'FAIL: expenses.paid_on default is not the Tripoli date';
  end if;
  raise notice 'OK: paid_on defaults to the date in Africa/Tripoli';
end $$;
reset role;
-- 01:00 in Tripoli on 2 January is still 1 January in UTC: the helper must say 2 January.
set time zone 'UTC';
do $$ begin
  if (timestamptz '2027-01-01 23:00:00+00' at time zone 'Africa/Tripoli')::date <> date '2027-01-02' then
    raise exception 'FAIL: Africa/Tripoli is not UTC+2 in this database';
  end if;
  if (select column_default from information_schema.columns
      where table_schema = 'public' and table_name = 'expenses' and column_name = 'paid_on') not like '%today_tripoli%' then
    raise exception 'FAIL: expenses.paid_on does not use today_tripoli()';
  end if;
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and column_default like '%today_tripoli%') <> 5 then
    raise exception 'FAIL: expected 5 date columns to default to today_tripoli()';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and upper(column_default) like '%CURRENT_DATE%') then
    raise exception 'FAIL: a column still defaults to current_date (UTC)';
  end if;
  if exists (select 1 from pg_views where schemaname = 'public' and upper(definition) like '%CURRENT_DATE%') then
    raise exception 'FAIL: a view still uses current_date (UTC)';
  end if;
  raise notice 'OK: no column default or view uses the UTC date any more';
end $$;
reset time zone;

-- 10. The weekly report still works for n8n's role and still hides from app users
set role reporting_reader;
do $$
declare n bigint;
begin
  select count(*) into n from weekly_report_v;
  raise notice 'OK: reporting_reader reads the weekly view (% rows)', n;
end $$;
reset role;
do $$ begin
  if has_table_privilege('authenticated', 'public.weekly_report_v', 'select') then
    raise exception 'LEAK: authenticated can read weekly_report_v after 0007';
  end if;
  raise notice 'OK: authenticated still cannot read the weekly view';
end $$;

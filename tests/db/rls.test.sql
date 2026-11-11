-- RLS, views, constraints and role tests. Run through scripts/test-db.sh against a THROWAWAY database.
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b'),('00000000-0000-0000-0000-00000000000c');
-- Since 0003 the sign-up trigger already created these profiles; the seed only sets their names.
insert into profiles(id,full_name) values ('00000000-0000-0000-0000-00000000000a','Owner'),('00000000-0000-0000-0000-00000000000b','Viewer'),('00000000-0000-0000-0000-00000000000c','Stranger')
  on conflict (id) do update set full_name = excluded.full_name;
grant usage on schema public, auth to reporting_reader;
grant usage on schema public to postgres;
do $$ begin if not exists (select 1 from pg_roles where rolname=$q$app_user$q$) then create role app_user nologin; end if; end $$;
grant usage on schema public, auth to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
select 'app_user can read weekly view (must be false in schema)', has_table_privilege('app_user','weekly_report_v','select') as allowed;
grant select on all tables in schema public to app_user;
grant execute on all functions in schema public to app_user;
-- app_user plays Supabase's "authenticated" role, which 0004 lets use the RLS helpers in "private".
grant usage on schema private to app_user;
grant execute on all functions in schema private to app_user;
-- owner creates project as the table owner bypassing RLS for seed
set app.uid='00000000-0000-0000-0000-00000000000a';
insert into projects(id,owner_id,name,total_budget_lyd,weekly_report_enabled) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','House A',100000,true);
insert into project_members(project_id,user_id,role) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','viewer');
insert into quantity_items(id,project_id,material,unit,planned_qty,waste_pct) values ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','Rebar 12mm','ton',5,10);
insert into purchases(project_id,quantity_item_id,qty,unit_price_lyd) values ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',5.3,4000),('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',0.5,4100);
insert into expenses(project_id,amount_lyd,client_op_id) values ('11111111-1111-1111-1111-111111111111',2500,'33333333-3333-3333-3333-333333333333');
insert into phases(id,project_id,name,position,status) values ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111','Foundation',1,'closing');
select 'owner sees project', count(*) from projects;
select 'owner quantity over allowance', material, is_over from quantity_progress;
select 'weekly view', project_id, expenses_this_week, phases_pending_closing, materials_over_allowance from weekly_report_v;

-- viewer: can read, cannot write
set role app_user;
set app.uid='00000000-0000-0000-0000-00000000000b';
select 'viewer sees project', count(*) from projects;
select 'viewer sees expenses', count(*) from expenses;
do $$ begin
  insert into expenses(project_id,amount_lyd) values ('11111111-1111-1111-1111-111111111111',1);
  raise exception 'LEAK: viewer wrote';
exception when insufficient_privilege or others then
  if sqlerrm like 'LEAK%' then raise; end if; raise notice 'OK: viewer write blocked';
end $$;

-- stranger: cannot read or write anything. Every check RAISES on a leak so CI fails (a printed count proves nothing).
set app.uid='00000000-0000-0000-0000-00000000000c';
do $$
declare
  t text;
  n bigint;
  -- every project-scoped table in 0001 (checklist_items is covered through checklists below)
  tbls text[] := array['projects','project_members','shared_reports','phases','phase_closing_checks','tasks',
    'budget_categories','exchange_rates','expenses','contracts','payments','change_orders','quantity_items',
    'purchases','stock_counts','price_records','photos','documents','checklists','checklist_items','issues',
    'decision_scenarios','notification_settings','notification_log',
    'quantity_progress','budget_summary','expiring_quotes'];
begin
  foreach t in array tbls loop
    execute format('select count(*) from %I', t) into n;
    if n > 0 then raise exception 'LEAK: stranger reads % (% rows)', t, n; end if;
  end loop;
  raise notice 'OK: stranger reads nothing in % tables/views', array_length(tbls, 1);
end $$;

-- stranger cannot insert into the owner's project
do $$ begin
  insert into expenses(project_id,amount_lyd) values ('11111111-1111-1111-1111-111111111111',1);
  raise exception 'LEAK: stranger inserted expense';
exception when others then if sqlerrm like 'LEAK%' then raise; end if; raise notice 'OK: stranger expense insert blocked'; end $$;
do $$ begin
  insert into project_members(project_id,user_id,role) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000c','editor');
  raise exception 'LEAK: stranger added self as member';
exception when others then if sqlerrm like 'LEAK%' then raise; end if; raise notice 'OK: stranger self-join blocked'; end $$;
do $$ begin
  insert into projects(owner_id,name) values ('00000000-0000-0000-0000-00000000000a','Fake for owner');
  raise exception 'LEAK: stranger created project for another owner';
exception when others then if sqlerrm like 'LEAK%' then raise; end if; raise notice 'OK: stranger cannot create project for another owner'; end $$;

-- stranger cannot update or delete the seeded rows (RLS hides them, so 0 rows must be affected)
do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array['phases','quantity_items','purchases','expenses','project_members'] loop
    execute format('update %I set project_id = project_id', t);
    get diagnostics n = row_count;
    if n > 0 then raise exception 'LEAK: stranger updated % rows in %', n, t; end if;
    execute format('delete from %I', t);
    get diagnostics n = row_count;
    if n > 0 then raise exception 'LEAK: stranger deleted % rows in %', n, t; end if;
  end loop;
  update projects set name = 'hacked';
  get diagnostics n = row_count;
  if n > 0 then raise exception 'LEAK: stranger updated projects'; end if;
  delete from projects;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'LEAK: stranger deleted projects'; end if;
  raise notice 'OK: stranger update/delete affected 0 rows';
end $$;

-- idempotency: same client_op_id twice must fail
set role app_user;
set app.uid='00000000-0000-0000-0000-00000000000a';
do $$ begin
  insert into expenses(project_id,amount_lyd,client_op_id) values ('11111111-1111-1111-1111-111111111111',10,'33333333-3333-3333-3333-333333333333');
  raise exception 'DUP allowed';
exception when unique_violation then raise notice 'OK: duplicate client_op_id rejected'; end $$;

-- invalid phase status rejected
do $$ begin
  update phases set status='bogus' where id='44444444-4444-4444-4444-444444444444';
  raise exception 'bad status allowed';
exception when check_violation then raise notice 'OK: invalid phase status rejected'; end $$;

-- reporting_reader: only weekly view
set role reporting_reader;
select 'reporting sees weekly', count(*) from weekly_report_v;
reset role;
set role reporting_reader;
do $$ begin
  perform 1 from expenses limit 1;
  raise exception 'reporting read expenses';
exception when insufficient_privilege then raise notice 'OK: reporting_reader blocked from expenses'; end $$;
reset role;

-- Tests for migration 0002. Runs after tests/db/rls.test.sql (same seed project, owner a, viewer b, stranger c).
set role app_user;
set app.uid='00000000-0000-0000-0000-00000000000a';
insert into obligations(project_id,creditor,amount_lyd,due_on) values ('11111111-1111-1111-1111-111111111111','Supplier',5000,current_date+10);
insert into expected_income(project_id,source,amount_lyd,expected_on) values ('11111111-1111-1111-1111-111111111111','Salary',3000,current_date+20);
insert into concrete_pours(project_id,poured_on,location,qty_m3,supplier,client_op_id) values ('11111111-1111-1111-1111-111111111111',current_date,'Foundation',12.5,'Supplier A','55555555-5555-5555-5555-555555555555');
insert into issues(project_id,status) values ('11111111-1111-1111-1111-111111111111','in_progress');
insert into checklists(project_id,kind) values ('11111111-1111-1111-1111-111111111111','readiness');
insert into price_records(project_id,material,unit,price_lyd,transport_cost_lyd) values ('11111111-1111-1111-1111-111111111111','Cement','bag',95,3.5);

do $$ begin
  insert into issues(project_id,status) values ('11111111-1111-1111-1111-111111111111','resolved');
  raise exception 'LEAK: old issue status allowed';
exception when check_violation then raise notice 'OK: old issue status rejected'; end $$;
do $$ begin
  insert into concrete_pours(project_id,poured_on,location,qty_m3,supplier,client_op_id) values ('11111111-1111-1111-1111-111111111111',current_date,'Foundation',1,'S','55555555-5555-5555-5555-555555555555');
  raise exception 'LEAK: duplicate pour allowed';
exception when unique_violation then raise notice 'OK: duplicate concrete pour rejected'; end $$;
do $$ begin
  insert into obligations(project_id,creditor,amount_lyd,due_on) values ('11111111-1111-1111-1111-111111111111','X',0,current_date);
  raise exception 'LEAK: zero obligation allowed';
exception when check_violation then raise notice 'OK: zero obligation rejected'; end $$;

-- viewer reads but cannot write
set app.uid='00000000-0000-0000-0000-00000000000b';
select 'viewer obligations', count(*) from obligations;
select 'viewer concrete_pours', count(*) from concrete_pours;
do $$ begin
  insert into obligations(project_id,creditor,amount_lyd,due_on) values ('11111111-1111-1111-1111-111111111111','Y',10,current_date);
  raise exception 'LEAK: viewer wrote obligation';
exception when others then if sqlerrm like 'LEAK%' then raise; end if; raise notice 'OK: viewer obligation write blocked'; end $$;
do $$ begin
  insert into concrete_pours(project_id,poured_on,location,qty_m3,supplier) values ('11111111-1111-1111-1111-111111111111',current_date,'X',1,'S');
  raise exception 'LEAK: viewer wrote pour';
exception when others then if sqlerrm like 'LEAK%' then raise; end if; raise notice 'OK: viewer pour write blocked'; end $$;

-- stranger sees nothing
set app.uid='00000000-0000-0000-0000-00000000000c';
select 'stranger obligations', count(*) from obligations;
select 'stranger expected_income', count(*) from expected_income;
select 'stranger concrete_pours', count(*) from concrete_pours;
do $$ begin
  if (select count(*) from obligations) + (select count(*) from expected_income) + (select count(*) from concrete_pours) > 0 then
    raise exception 'LEAK: stranger sees new tables';
  end if;
  raise notice 'OK: stranger sees nothing in new tables';
end $$;
do $$ begin
  insert into obligations(project_id,creditor,amount_lyd,due_on) values ('11111111-1111-1111-1111-111111111111','Z',10,current_date);
  raise exception 'LEAK: stranger wrote obligation';
exception when others then if sqlerrm like 'LEAK%' then raise; end if; raise notice 'OK: stranger obligation write blocked'; end $$;
do $$ begin
  insert into expected_income(project_id,source,amount_lyd,expected_on) values ('11111111-1111-1111-1111-111111111111','Z',10,current_date);
  raise exception 'LEAK: stranger wrote expected_income';
exception when others then if sqlerrm like 'LEAK%' then raise; end if; raise notice 'OK: stranger expected_income write blocked'; end $$;
do $$ begin
  insert into concrete_pours(project_id,poured_on,location,qty_m3,supplier) values ('11111111-1111-1111-1111-111111111111',current_date,'Z',1,'S');
  raise exception 'LEAK: stranger wrote pour';
exception when others then if sqlerrm like 'LEAK%' then raise; end if; raise notice 'OK: stranger pour write blocked'; end $$;
do $$
declare n bigint;
begin
  update obligations set paid = true;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'LEAK: stranger updated obligations'; end if;
  delete from concrete_pours;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'LEAK: stranger deleted concrete_pours'; end if;
  raise notice 'OK: stranger update/delete on new tables affected 0 rows';
end $$;
reset role;

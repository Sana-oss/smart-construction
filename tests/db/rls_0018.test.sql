-- Tests for the price log and quotes (migration 0018; design S24; FR-MAT-08). Uses Owner One (...a1) and Owner Two
-- (...a2) from rls_0006.test.sql, one project each.
reset role;

-- 1. The owner records a paid price and a quote; the database fills today's date and created_at
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_id uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  insert into price_records (project_id, material, unit, price_lyd, supplier)
    values (v_project, 'حديد التسليح', 'طن', 4000, 'مورد الحديد') returning id into v_id;
  if not exists (select 1 from price_records where id = v_id and recorded_on = private.today_tripoli() and created_at is not null) then
    raise exception 'FAIL: date or created_at not filled';
  end if;
  insert into price_records (project_id, material, unit, price_lyd, is_quote, quote_expires_on, transport_cost_lyd, recorded_on)
    values (v_project, 'أسمنت', 'كيس', 42, true, private.today_tripoli() + 10, 150, private.today_tripoli() - 2);
  insert into price_records (project_id, material, unit, price_lyd) values (v_project, 'رمل', 'م3', 0); -- free: allowed
  raise notice 'OK: paid price, quote and a zero price stored';
end $$;

-- 2. The rules of S24.3 and FR-MAT-08
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  begin
    insert into price_records (project_id, material, unit, price_lyd, recorded_on) values (v_project, 'بلوك', 'قطعة', 2, private.today_tripoli() + 1);
    raise exception 'FAIL: future date accepted';
  exception when check_violation then raise notice 'OK: no future date'; end;
  begin
    insert into price_records (project_id, material, unit, price_lyd) values (v_project, 'ب', 'قطعة', 2);
    raise exception 'FAIL: one-letter material accepted';
  exception when check_violation then raise notice 'OK: material length'; end;
  begin
    insert into price_records (project_id, material, unit, price_lyd) values (v_project, 'بلوك', ' ', 2);
    raise exception 'FAIL: empty unit accepted';
  exception when check_violation then raise notice 'OK: unit length'; end;
  begin
    insert into price_records (project_id, material, unit, price_lyd, supplier) values (v_project, 'بلوك', 'قطعة', 2, repeat('م', 81));
    raise exception 'FAIL: long supplier accepted';
  exception when check_violation then raise notice 'OK: supplier length'; end;
  begin
    insert into price_records (project_id, material, unit, price_lyd, note) values (v_project, 'بلوك', 'قطعة', 2, repeat('ن', 201));
    raise exception 'FAIL: long note accepted';
  exception when check_violation then raise notice 'OK: note length'; end;
  begin
    insert into price_records (project_id, material, unit, price_lyd, is_quote, quote_expires_on, recorded_on)
      values (v_project, 'بلوك', 'قطعة', 2, true, private.today_tripoli() - 5, private.today_tripoli() - 1);
    raise exception 'FAIL: quote expiring before its date accepted';
  exception when check_violation then raise notice 'OK: expiry after the date'; end;
  begin
    insert into price_records (project_id, material, unit, price_lyd) values (v_project, 'بلوك', 'قطعة', -1);
    raise exception 'FAIL: negative price accepted';
  exception when check_violation then raise notice 'OK: price not negative'; end;
end $$;

-- 3. Changes and deletions are audited with the old values; a price never moves; the date never moves to the future
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_project uuid; v_other uuid; v_id uuid; a record;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  reset role;
  select id into v_other from projects where owner_id = '00000000-0000-0000-0000-0000000000a2';
  set role authenticated;
  select id into v_id from price_records where project_id = v_project and material = 'حديد التسليح';

  update price_records set price_lyd = 4100 where id = v_id;
  select * into a from audit_log where table_name = 'price_records' and action = 'updated' and detail ->> 'row_id' = v_id::text;
  if a is null or (a.detail -> 'before' ->> 'price_lyd')::numeric <> 4000 or (a.detail -> 'after' ->> 'price_lyd')::numeric <> 4100 then
    raise exception 'FAIL: the change was not audited: %', a;
  end if;
  begin
    update price_records set recorded_on = private.today_tripoli() + 3 where id = v_id;
    raise exception 'FAIL: date moved to the future';
  exception when check_violation then raise notice 'OK: no future date on update'; end;

  delete from price_records where id = v_id;
  select * into a from audit_log where table_name = 'price_records' and action = 'deleted' and detail ->> 'row_id' = v_id::text;
  if a is null or a.detail -> 'before' ->> 'material' <> 'حديد التسليح' or a.detail -> 'before' ->> 'supplier' <> 'مورد الحديد' then
    raise exception 'FAIL: the deletion did not keep the old values: %', a;
  end if;
  raise notice 'OK: changes and deletions are audited';
end $$;

-- 4. An editor of BOTH projects still cannot move a price; a stranger can neither read, change nor delete one
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
    update price_records set project_id = v_mine where material = 'أسمنت';
    raise exception 'FAIL: an editor of both projects moved a price';
  exception when check_violation then raise notice 'OK: the guard keeps the price in its project'; end;
end $$;
reset role;
delete from project_members where user_id = '00000000-0000-0000-0000-0000000000a2';

set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare n int;
begin
  if (select count(*) from price_records where material = 'أسمنت') <> 0 then raise exception 'FAIL: stranger reads prices'; end if;
  update price_records set price_lyd = 1 where material = 'أسمنت';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: stranger changed a price'; end if;
  delete from price_records where material = 'أسمنت';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: stranger deleted a price'; end if;
  raise notice 'OK: a stranger cannot read, change or delete prices';
end $$;
reset role;
do $$ begin
  if (select price_lyd from price_records where material = 'أسمنت' and project_id = (select id from projects where owner_id = '00000000-0000-0000-0000-0000000000a1')) <> 42 then
    raise exception 'FAIL: the quote changed';
  end if;
end $$;

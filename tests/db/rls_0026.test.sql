-- Tests for the checklist item photo (migration 0026; FR-QLT-01). Uses Owner One (...a1) and Owner Two (...a2) from
-- rls_0006.test.sql, and the template of 0025.
reset role;

-- 1. The template: «فحص التسليح» requires a photo, the others do not; still unreviewed, and the source says why
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  if not exists (select 1 from checklist_templates where kind = 'hold_point' and status = 'unreviewed'
                 and (items -> 2 ->> 'requires_photo')::boolean and items -> 2 ->> 'text' = 'فحص التسليح'
                 and (select count(*) from jsonb_array_elements(items) e where (e ->> 'requires_photo')::boolean) = 1
                 and source like '%قرار المالك 20 نوفمبر 2026، لا اعتماد هندسي%') then
    raise exception 'FAIL: expected only «فحص التسليح» to require a photo, unreviewed, with the owner''s decision in the source';
  end if;
  raise notice 'OK: the rebar item requires a photo; the template stays unreviewed';
end $$;

-- 2. A new checklist copies the rule; «سليم» needs the photo, a problem or «لا ينطبق» does not
do $$
declare v_project uuid; v_phase uuid; v_list uuid; v_item uuid; v_other uuid;
begin
  select id into v_project from projects where owner_id = '00000000-0000-0000-0000-0000000000a1';
  select id into v_phase from phases where project_id = v_project and position = 2;
  v_list := create_checklist(v_project, v_phase, 'صب سقف الدور الأول', (select id from checklist_templates where kind = 'hold_point'));
  select id into v_item from checklist_items where checklist_id = v_list and position = 3 and requires_photo;
  select id into v_other from checklist_items where checklist_id = v_list and position = 1 and not requires_photo;
  if v_item is null or v_other is null then raise exception 'FAIL: the photo rule was not copied'; end if;
  perform set_config('test.p_project', v_project::text, false);
  perform set_config('test.p_item', v_item::text, false);

  begin
    update checklist_items set result = 'ok' where id = v_item;
    raise exception 'FAIL: an item that requires a photo was marked sound without one';
  exception when check_violation then null;
  end;
  update checklist_items set result = 'issue', note = 'نقص كانات' where id = v_item;
  update checklist_items set result = 'ok' where id = v_other;

  update checklist_items set result = 'ok', photo_path = v_project::text || '/checklists/11111111-1111-4111-8111-111111111111.jpg' where id = v_item;
  if not exists (select 1 from checklist_items where id = v_item and result = 'ok' and photo_path is not null) then
    raise exception 'FAIL: the photo was not stored';
  end if;
  begin
    update checklist_items set photo_path = null where id = v_item;
    raise exception 'FAIL: the photo of a sound item that requires one was removed';
  exception when check_violation then null;
  end;
  raise notice 'OK: «سليم» needs the photo; a problem does not; the photo stays while the item is sound';
end $$;

-- 3. A photo path must be this project's checklists folder, and one item's only
do $$
declare v_item uuid := current_setting('test.p_item')::uuid; v_project text := current_setting('test.p_project');
begin
  begin
    update checklist_items set photo_path = v_project || '/receipts/22222222-2222-4222-8222-222222222222.jpg' where id = v_item;
    raise exception 'FAIL: a receipt path was accepted';
  exception when check_violation then null;
  end;
  begin
    update checklist_items set photo_path = v_project || '/checklists/../photos/x.png' where id = v_item;
    raise exception 'FAIL: a badly named file in the checklists folder was accepted';
  exception when check_violation then null;
  end;
  begin
    update checklist_items set photo_path = '00000000-0000-0000-0000-0000000000ff/checklists/22222222-2222-4222-8222-222222222222.jpg' where id = v_item;
    raise exception 'FAIL: another project''s folder was accepted';
  exception when check_violation then null;
  end;
  begin
    update checklist_items set photo_path = v_project || '/checklists/11111111-1111-4111-8111-111111111111.jpg'
      where id = (select id from checklist_items where checklist_id = (select checklist_id from checklist_items where id = v_item) and position = 1);
    raise exception 'FAIL: one photo was used by two items';
  exception when unique_violation then null;
  end;
  raise notice 'OK: photo paths stay in the project''s checklists folder, one item each';
end $$;

-- 4. Replacing the photo restamps the check; the audit log keeps the old path.
--    The file runs in one transaction (now() does not move), so the stamp is first aged with the triggers off.
reset role;
set session_replication_role = replica;
update checklist_items set checked_at = timestamptz '2000-01-01' where id = current_setting('test.p_item')::uuid;
set session_replication_role = origin;
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a1';
do $$
declare v_item uuid := current_setting('test.p_item')::uuid;
begin
  update checklist_items set photo_path = current_setting('test.p_project') || '/checklists/33333333-3333-4333-8333-333333333333.jpg' where id = v_item;
  if (select checked_at from checklist_items where id = v_item) < timestamptz '2020-01-01' then
    raise exception 'FAIL: a new photo did not restamp the check';
  end if;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from audit_log where table_name = 'checklist_items'
                 and detail -> 'before' ->> 'photo_path' like '%/checklists/11111111-1111-4111-8111-111111111111.jpg'
                 and detail -> 'after' ->> 'photo_path' like '%/checklists/33333333-3333-4333-8333-333333333333.jpg') then
    raise exception 'FAIL: the replaced photo is not in the audit log';
  end if;
  raise notice 'OK: a new photo restamps the check and the old path is audited';
end $$;

-- 5. A stranger cannot attach a photo to Owner One's item
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare n bigint;
begin
  update checklist_items set photo_path = current_setting('test.p_project') || '/checklists/44444444-4444-4444-8444-444444444444.jpg'
    where id = current_setting('test.p_item')::uuid;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'LEAK: stranger attached a photo'; end if;
  raise notice 'OK: stranger cannot attach a photo';
end $$;
reset role;

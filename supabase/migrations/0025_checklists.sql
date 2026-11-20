-- 0025: pre-pour and pre-cover checkpoints, slice 1 (3.12; FR-QLT-01, FR-QLT-02; UC-18; design S26.1, S26.2; owner's
-- decisions of 20 Nov 2026, change register).
--
-- checklists and checklist_items exist since 0001 (quality's tables; RLS: members read, writers write) and are empty.
--
-- 1. public.checklist_templates: GLOBAL reference data (no project_id), the same pattern and stated exception as
--    phase_templates (0006) and calc_coefficients (0023). Engineering content: 'unreviewed' until a named engineer
--    approves it. Seed: ONE template, «فحص ما قبل الصب», with the four items the teammate's design S26.1 shows (its
--    source says so; decision D4 is open). No item requires a photo until the engineer says so (slice 2 adds photos).
-- 2. checklists gets a title (one phase has several pours), timestamps, and the review status of the template it was
--    copied from (a snapshot: an approval later does not make an old copy reviewed). checklist_items gets its order,
--    the check (note, who fixes it, when it is checked again) and who checked it and when.
-- 3. public.create_checklist (SECURITY INVOKER, rule of 0004/0006): the checklist and a copy of the template's items in
--    ONE transaction. It raises a transaction-local flag; the guards refuse a checklist or an item created any other
--    way, so every checklist really is a copy of a template.
-- 4. Guards: what was copied never changes (text, photo rule, phase, template); a result is never removed; who checked
--    and when are set by the database. The checklist's status is the items' business: only the item trigger changes
--    it (it sets another flag), so a client cannot mark a checklist complete without checking its items.
-- 5. When the last item gets a result, the checklist becomes 'completed' and checklist.completed is emitted in the
--    same transaction (architecture §6). Problems do not stop completion (decision D2: warn, never block).
-- 6. Audit: every check of an item, with the old and new values (checklist_items has no project_id, so the trigger
--    finds it through its checklist). Deleting checklists or items is closed for the API roles (not in this slice);
--    deleting the project still removes them (the cascade runs as the table owner).

-- 1. -------------------------------------------------------------------------------------------------------------
create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('hold_point')),
  title text not null check (char_length(btrim(title)) between 2 and 80),
  -- [{"text": "...", "requires_photo": false}, ...]
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  source text not null check (char_length(btrim(source)) > 0),
  status text not null default 'unreviewed' check (status in ('unreviewed', 'approved')),
  reviewed_by text,
  reviewed_on date,
  check ((status = 'approved') = (reviewed_by is not null and reviewed_on is not null))
);

alter table public.checklist_templates enable row level security;
create policy read_checklist_templates on public.checklist_templates for select using (auth.uid() is not null);
revoke insert, update, delete, truncate on public.checklist_templates from anon, authenticated;

insert into public.checklist_templates (kind, title, items, source) values
  ('hold_point', 'فحص ما قبل الصب',
   '[{"text": "مراجعة المخطط المعتمد", "requires_photo": false},
     {"text": "فحص الشدة والدعامات", "requires_photo": false},
     {"text": "فحص التسليح", "requires_photo": false},
     {"text": "مراجعة الفتحات والتمديدات", "requires_photo": false}]'::jsonb,
   'بنود تصميم الزميل S26.1، بانتظار مراجعة المهندس (القرار D4)');

-- 2. -------------------------------------------------------------------------------------------------------------
alter table public.checklists
  add column title text not null check (char_length(btrim(title)) between 2 and 80),
  add column template_status text not null check (template_status in ('unreviewed', 'approved')),
  add column created_at timestamptz not null default now();

create index checklists_project_idx on public.checklists (project_id, phase_id);

alter table public.checklist_items
  add column position int not null check (position > 0),
  add column note text check (note is null or char_length(note) <= 200),
  add column responsible text check (responsible is null or char_length(responsible) <= 80),
  add column recheck_on date,
  add column checked_at timestamptz,
  add column checked_by uuid,
  add constraint checklist_items_position_unique unique (checklist_id, position),
  add constraint checklist_items_checked check ((result is null) = (checked_at is null));

-- 3. -------------------------------------------------------------------------------------------------------------
create function public.create_checklist(p_project_id uuid, p_phase_id uuid, p_title text, p_template_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_template public.checklist_templates%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  select * into v_template from public.checklist_templates t where t.id = p_template_id;
  if not found then
    raise exception 'unknown template' using errcode = 'foreign_key_violation';
  end if;
  if p_phase_id is null or not exists (
    select 1 from public.phases ph where ph.id = p_phase_id and ph.project_id = p_project_id
  ) then
    raise exception 'the phase does not belong to this project' using errcode = 'foreign_key_violation';
  end if;

  perform set_config('app.creating_checklist', 'yes', true);
  insert into public.checklists (project_id, phase_id, template_id, kind, title, template_status)
  values (p_project_id, p_phase_id, v_template.id, v_template.kind, btrim(p_title), v_template.status)
  returning id into v_id;
  insert into public.checklist_items (checklist_id, position, text, requires_photo)
  select v_id, e.ordinality, e.value ->> 'text', coalesce((e.value ->> 'requires_photo')::boolean, false)
  from jsonb_array_elements(v_template.items) with ordinality as e;
  perform set_config('app.creating_checklist', '', true);
  return v_id;
end;
$$;

revoke all on function public.create_checklist(uuid, uuid, text, uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.create_checklist(uuid, uuid, text, uuid) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.create_checklist(uuid, uuid, text, uuid) to authenticated;
  end if;
end $$;

-- 4. -------------------------------------------------------------------------------------------------------------
create function private.checklists_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('app.creating_checklist', true), '') <> 'yes' then
      raise exception 'a checklist is created from a template (create_checklist)' using errcode = 'check_violation';
    end if;
    new.status := 'open';
    new.completed_at := null;
    return new;
  end if;
  if new.project_id is distinct from old.project_id or new.phase_id is distinct from old.phase_id
     or new.template_id is distinct from old.template_id or new.kind is distinct from old.kind
     or new.template_status is distinct from old.template_status or new.created_at is distinct from old.created_at then
    raise exception 'a checklist keeps its project, phase and template' using errcode = 'check_violation';
  end if;
  if (new.status is distinct from old.status or new.completed_at is distinct from old.completed_at)
     and coalesce(current_setting('app.checklist_sync', true), '') <> new.id::text then
    raise exception 'a checklist is completed by checking its items' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.checklists_guard() from public;

create trigger checklists_guard before insert or update on public.checklists
  for each row execute function private.checklists_guard();

create function private.checklist_items_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('app.creating_checklist', true), '') <> 'yes' then
      raise exception 'items are copied from the template' using errcode = 'check_violation';
    end if;
    new.result := null;
    new.checked_at := null;
    new.checked_by := null;
    return new;
  end if;
  if new.checklist_id is distinct from old.checklist_id or new.text is distinct from old.text
     or new.requires_photo is distinct from old.requires_photo or new.position is distinct from old.position then
    raise exception 'a checklist item keeps its text and place' using errcode = 'check_violation';
  end if;
  if old.result is not null and new.result is null then
    raise exception 'a checked item keeps a result' using errcode = 'check_violation';
  end if;
  -- Who checked and when: set here, never taken from the client.
  if new.result is not null and (new.result is distinct from old.result or new.note is distinct from old.note
     or new.responsible is distinct from old.responsible or new.recheck_on is distinct from old.recheck_on) then
    new.checked_at := now();
    new.checked_by := auth.uid();
  else
    new.checked_at := old.checked_at;
    new.checked_by := old.checked_by;
  end if;
  return new;
end;
$$;
revoke all on function private.checklist_items_guard() from public;

create trigger checklist_items_guard before insert or update on public.checklist_items
  for each row execute function private.checklist_items_guard();

revoke delete, truncate on public.checklists, public.checklist_items from anon, authenticated;

-- 5 and 6. -------------------------------------------------------------------------------------------------------
create function private.checklist_items_after()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_list public.checklists%rowtype;
begin
  if old is not distinct from new then
    return null; -- saved without a change: nothing to record
  end if;
  select * into v_list from public.checklists c where c.id = new.checklist_id;

  perform private.log_audit(v_list.project_id, 'checklist_items', 'updated', jsonb_build_object(
    'row_id', old.id, 'checklist_id', old.checklist_id, 'before', to_jsonb(old), 'after', to_jsonb(new)
  ));

  if v_list.status = 'open' and not exists (
    select 1 from public.checklist_items i where i.checklist_id = v_list.id and i.result is null
  ) then
    perform set_config('app.checklist_sync', v_list.id::text, true);
    update public.checklists set status = 'completed', completed_at = now() where id = v_list.id;
    perform set_config('app.checklist_sync', '', true);
    perform private.emit_event(v_list.project_id, 'checklist.completed', jsonb_build_object(
      'checklist_id', v_list.id,
      'phase_id', v_list.phase_id,
      'issues', (select count(*) from public.checklist_items i where i.checklist_id = v_list.id and i.result = 'issue')
    ));
  end if;
  return null;
end;
$$;
revoke all on function private.checklist_items_after() from public;

create trigger checklist_items_after after update on public.checklist_items
  for each row execute function private.checklist_items_after();

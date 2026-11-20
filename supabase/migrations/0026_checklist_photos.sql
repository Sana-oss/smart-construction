-- 0026: the checklist item photo, slice 2 of 3.12 (FR-QLT-01; design S26.2; owner's decisions of 20 Nov 2026, change
-- register).
--
-- 1. checklist_items.photo_path: one photo per item, replaceable: "<this project's id>/checklists/<uuid>.jpg" in the
--    private bucket of 0013 (whose policies already let a member read and a writer upload under the project's folder).
--    A path is used by one item only.
-- 2. private.checklist_items_guard is replaced (same rules as 0025, plus): a photo path must be in THIS project's
--    checklists folder; an item that requires a photo cannot be «سليم» (ok) without one (FR-QLT-01). A problem or «لا
--    ينطبق» needs no photo (decision D2: the system never blocks recording a problem). Changing the photo is a change
--    of the check: who and when are stamped again, and the audit trigger of 0025 keeps the old path.
-- 3. The pre-pour template: «فحص التسليح» now requires a photo. This is the OWNER's decision of 20 Nov 2026 (offered
--    against the recommendation to wait for the engineer), not an engineering approval: the template stays
--    'unreviewed', and its source says so. Checklists copied before keep their copy (0025: a copy never changes).

-- 1. -------------------------------------------------------------------------------------------------------------
alter table public.checklist_items
  add column photo_path text check (photo_path is null or photo_path ~ '^[0-9a-f-]{36}/checklists/[0-9a-f-]{36}\.jpg$');

create unique index checklist_items_photo_unique on public.checklist_items (photo_path) where photo_path is not null;

-- 2. -------------------------------------------------------------------------------------------------------------
create or replace function private.checklist_items_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project uuid;
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('app.creating_checklist', true), '') <> 'yes' then
      raise exception 'items are copied from the template' using errcode = 'check_violation';
    end if;
    new.result := null;
    new.checked_at := null;
    new.checked_by := null;
    new.photo_path := null;
    return new;
  end if;
  if new.checklist_id is distinct from old.checklist_id or new.text is distinct from old.text
     or new.requires_photo is distinct from old.requires_photo or new.position is distinct from old.position then
    raise exception 'a checklist item keeps its text and place' using errcode = 'check_violation';
  end if;
  if old.result is not null and new.result is null then
    raise exception 'a checked item keeps a result' using errcode = 'check_violation';
  end if;
  if new.photo_path is not null and new.photo_path is distinct from old.photo_path then
    select c.project_id into v_project from public.checklists c where c.id = new.checklist_id;
    if v_project is null or new.photo_path not like v_project::text || '/checklists/%' then
      raise exception 'the photo is not in this project''s checklists folder' using errcode = 'check_violation';
    end if;
  end if;
  if new.requires_photo and new.result = 'ok' and new.photo_path is null then
    raise exception 'this item requires a photo to be marked sound' using errcode = 'check_violation';
  end if;
  -- Who checked and when: set here, never taken from the client.
  if new.result is not null and (new.result is distinct from old.result or new.note is distinct from old.note
     or new.responsible is distinct from old.responsible or new.recheck_on is distinct from old.recheck_on
     or new.photo_path is distinct from old.photo_path) then
    new.checked_at := now();
    new.checked_by := auth.uid();
  else
    new.checked_at := old.checked_at;
    new.checked_by := old.checked_by;
  end if;
  return new;
end;
$$;

-- 3. -------------------------------------------------------------------------------------------------------------
update public.checklist_templates
set items = jsonb_set(items, '{2,requires_photo}', 'true'::jsonb),
    source = source || '؛ واشتراط صورة لبند «فحص التسليح» قرار المالك 20 نوفمبر 2026، لا اعتماد هندسي'
where kind = 'hold_point' and status = 'unreviewed' and items -> 2 ->> 'text' = 'فحص التسليح';

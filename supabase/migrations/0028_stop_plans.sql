-- 0028: a phase's stop plan, the safe stop points of 3.14 (FR-DEC-04; UC-23; design S19.1; owner's decisions of 20 Nov
-- 2026, change register). Reuses the checklist engine of 0025–0027.
--
-- 1. checklist_templates may hold a 'safe_stop' template; an item may take a cost ("takes_cost"). Seed: ONE template,
--    «خطة التوقف», with the design's S19.1 items (completed-work limits, protection plan, site documentation, restart
--    plan) and the four protection measures named in master reference 3.14 (exposed rebar, roof waterproofing against
--    rain, temporary shoring, water drainage); the measures take a cost. Engineering content: 'unreviewed' until the
--    engineer approves it. The app never decides where to stop: the screen says the engineer does (design S19.1).
-- 2. checklist_items.takes_cost (copied from the template, never changed) and cost_lyd: the owner's estimate for a
--    measure, 0 or more, only on an item that takes a cost. A changed cost restamps the check and is audited (0025).
--    The sum fills the stop scenario's protection cost (3.7) in the app (rule R5: computed in TypeScript).
-- 3. One stop plan per phase; a stop plan always has a phase. public.create_stop_plan (SECURITY INVOKER) creates it, or
--    returns the existing one. Both guards are replaced with these rules added (bodies otherwise as in 0026 and 0027).

-- 1. -------------------------------------------------------------------------------------------------------------
alter table public.checklist_templates drop constraint checklist_templates_kind_check;
alter table public.checklist_templates add constraint checklist_templates_kind_check
  check (kind in ('hold_point', 'readiness', 'safe_stop'));

insert into public.checklist_templates (kind, title, items, source) values
  ('safe_stop', 'خطة التوقف',
   '[{"text": "تحديد حدود الأعمال المنجزة", "requires_photo": false},
     {"text": "حماية الحديد المكشوف", "requires_photo": false, "takes_cost": true},
     {"text": "عزل الأسطح من المطر", "requires_photo": false, "takes_cost": true},
     {"text": "التدعيم المؤقت", "requires_photo": false, "takes_cost": true},
     {"text": "تصريف المياه", "requires_photo": false, "takes_cost": true},
     {"text": "خطة حماية الأعمال والمواد", "requires_photo": false},
     {"text": "توثيق حالة الموقع", "requires_photo": false},
     {"text": "خطة استئناف الأعمال", "requires_photo": false}]'::jsonb,
   'بنود تصميم الزميل S19.1 وإجراءات الحماية في المرجع الرئيسي 3.14، بانتظار مراجعة المهندس');

-- 2. -------------------------------------------------------------------------------------------------------------
alter table public.checklist_items
  add column takes_cost boolean not null default false,
  add column cost_lyd numeric(14,3) check (cost_lyd is null or cost_lyd >= 0);

-- 3. -------------------------------------------------------------------------------------------------------------
create unique index checklists_one_stop_plan on public.checklists (project_id, phase_id) where kind = 'safe_stop';

create or replace function private.checklists_guard()
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
    if new.kind = 'readiness' and new.phase_id is not null then
      raise exception 'the readiness list belongs to the project, not a phase' using errcode = 'check_violation';
    end if;
    if new.kind in ('hold_point', 'safe_stop') and new.phase_id is null then
      raise exception 'a pre-pour checklist or a stop plan belongs to a phase' using errcode = 'check_violation';
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
    new.cost_lyd := null;
    return new;
  end if;
  if new.checklist_id is distinct from old.checklist_id or new.text is distinct from old.text
     or new.requires_photo is distinct from old.requires_photo or new.position is distinct from old.position
     or new.takes_cost is distinct from old.takes_cost then
    raise exception 'a checklist item keeps its text and place' using errcode = 'check_violation';
  end if;
  if old.result is not null and new.result is null then
    raise exception 'a checked item keeps a result' using errcode = 'check_violation';
  end if;
  if new.cost_lyd is not null and not new.takes_cost then
    raise exception 'this item takes no cost' using errcode = 'check_violation';
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
     or new.photo_path is distinct from old.photo_path or new.cost_lyd is distinct from old.cost_lyd) then
    new.checked_at := now();
    new.checked_by := auth.uid();
  else
    new.checked_at := old.checked_at;
    new.checked_by := old.checked_by;
  end if;
  return new;
end;
$$;

create function public.create_stop_plan(p_project_id uuid, p_phase_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_template public.checklist_templates%rowtype;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  if p_phase_id is null or not exists (
    select 1 from public.phases ph where ph.id = p_phase_id and ph.project_id = p_project_id
  ) then
    raise exception 'the phase does not belong to this project' using errcode = 'foreign_key_violation';
  end if;
  select c.id into v_id from public.checklists c
   where c.project_id = p_project_id and c.phase_id = p_phase_id and c.kind = 'safe_stop';
  if found then
    return v_id;
  end if;
  select * into v_template from public.checklist_templates t where t.kind = 'safe_stop' order by t.id limit 1;
  if not found then
    raise exception 'no stop-plan template' using errcode = 'foreign_key_violation';
  end if;

  perform set_config('app.creating_checklist', 'yes', true);
  insert into public.checklists (project_id, phase_id, template_id, kind, title, template_status)
  values (p_project_id, p_phase_id, v_template.id, 'safe_stop', v_template.title, v_template.status)
  returning id into v_id;
  insert into public.checklist_items (checklist_id, position, text, requires_photo, takes_cost)
  select v_id, e.ordinality, e.value ->> 'text', coalesce((e.value ->> 'requires_photo')::boolean, false),
         coalesce((e.value ->> 'takes_cost')::boolean, false)
  from jsonb_array_elements(v_template.items) with ordinality as e;
  perform set_config('app.creating_checklist', '', true);
  return v_id;
end;
$$;

revoke all on function public.create_stop_plan(uuid, uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.create_stop_plan(uuid, uuid) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.create_stop_plan(uuid, uuid) to authenticated;
  end if;
end $$;

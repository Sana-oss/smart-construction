-- 0027: the readiness gate before starting (3.15; FR-PRJ-05, FR-PRJ-02; UC-22; owner's decisions of 20 Nov 2026, change
-- register). Reuses the checklist engine of 0025/0026.
--
-- 1. checklist_templates may hold a 'readiness' template; an item may apply to one project type only ("only_for").
--    Seed: ONE readiness template with the items of FR-PRJ-05 and master reference 3.15 (soil test, approved drawings,
--    building permit, supervising engineer, contractor contract; and, for adding a floor, the structural assessment of
--    the existing building). Requirements text, not engineering numbers, but still advice on construction: 'unreviewed'
--    until the engineer approves it, like the pre-pour template.
-- 2. One readiness list per project, with no phase; a pre-pour list always has a phase (the guard of 0025 is replaced
--    with these two rules added).
-- 3. public.create_readiness_checklist (SECURITY INVOKER): the project's list, copied from the template with only the
--    items for its type; called again, it returns the same list.
-- 4. public.update_phase_schedule gains p_start_gaps: when the owner starts a phase («لم تبدأ» -> «قيد التنفيذ») while
--    the readiness list has gaps, the app shows them and asks; the owner's confirmation and the gaps are written to the
--    audit log in the SAME transaction as the start (FR-PRJ-05: «تأكيد صريح يُسجَّل في audit_log؛ لا منع آلي» — D2).
--    Which items are gaps is computed by the app from the quality module (rule R5); the database records what was
--    confirmed. The function is dropped and created again (a second version with a default parameter would make the
--    API call ambiguous); its body is unchanged otherwise.

-- 1. -------------------------------------------------------------------------------------------------------------
alter table public.checklist_templates drop constraint checklist_templates_kind_check;
alter table public.checklist_templates add constraint checklist_templates_kind_check check (kind in ('hold_point', 'readiness'));

insert into public.checklist_templates (kind, title, items, source) values
  ('readiness', 'جاهزية المشروع',
   '[{"text": "فحص التربة", "requires_photo": false},
     {"text": "مخططات إنشائية ومعمارية معتمدة", "requires_photo": false},
     {"text": "ترخيص البناء", "requires_photo": false},
     {"text": "مهندس مشرف", "requires_photo": false},
     {"text": "عقد مقاول", "requires_photo": false},
     {"text": "تقييم إنشائي للأساسات والأعمدة والجدران الحالية", "requires_photo": false, "only_for": "add_floor"}]'::jsonb,
   'بنود FR-PRJ-05 والمرجع الرئيسي 3.15، بانتظار مراجعة المهندس');

-- 2. -------------------------------------------------------------------------------------------------------------
create unique index checklists_one_readiness on public.checklists (project_id) where kind = 'readiness';

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
    if new.kind = 'hold_point' and new.phase_id is null then
      raise exception 'a pre-pour checklist belongs to a phase' using errcode = 'check_violation';
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

-- 3. -------------------------------------------------------------------------------------------------------------
create function public.create_readiness_checklist(p_project_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_type text;
  v_template public.checklist_templates%rowtype;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  select c.id into v_id from public.checklists c where c.project_id = p_project_id and c.kind = 'readiness';
  if found then
    return v_id;
  end if;
  -- RLS: a project the caller cannot see is not found.
  select p.project_type into v_type from public.projects p where p.id = p_project_id;
  if not found then
    raise exception 'project not found or not allowed' using errcode = 'insufficient_privilege';
  end if;
  select * into v_template from public.checklist_templates t where t.kind = 'readiness' order by t.id limit 1;
  if not found then
    raise exception 'no readiness template' using errcode = 'foreign_key_violation';
  end if;

  perform set_config('app.creating_checklist', 'yes', true);
  insert into public.checklists (project_id, phase_id, template_id, kind, title, template_status)
  values (p_project_id, null, v_template.id, 'readiness', v_template.title, v_template.status)
  returning id into v_id;
  insert into public.checklist_items (checklist_id, position, text, requires_photo)
  select v_id, row_number() over (order by e.ordinality), e.value ->> 'text', coalesce((e.value ->> 'requires_photo')::boolean, false)
  from jsonb_array_elements(v_template.items) with ordinality as e
  where e.value ->> 'only_for' is null or e.value ->> 'only_for' = v_type;
  perform set_config('app.creating_checklist', '', true);
  return v_id;
end;
$$;

revoke all on function public.create_readiness_checklist(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.create_readiness_checklist(uuid) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.create_readiness_checklist(uuid) to authenticated;
  end if;
end $$;

-- 4. -------------------------------------------------------------------------------------------------------------
drop function public.update_phase_schedule(uuid, text, date, date, date, date);

create function public.update_phase_schedule(
  p_phase_id uuid,
  p_status text,
  p_planned_start date default null,
  p_planned_end date default null,
  p_actual_start date default null,
  p_actual_end date default null,
  p_start_gaps jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project uuid;
  v_old record;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;
  if p_actual_start > private.today_tripoli() or p_actual_end > private.today_tripoli() then
    raise exception 'actual dates cannot be after today' using errcode = 'check_violation';
  end if;
  if p_start_gaps is not null and (jsonb_typeof(p_start_gaps) <> 'array' or jsonb_array_length(p_start_gaps) = 0) then
    raise exception 'start gaps must be a non-empty list' using errcode = 'check_violation';
  end if;

  -- Read the old values first (only visible rows: RLS), for the audit row.
  select project_id, status, planned_start, planned_end, actual_start, actual_end
    into v_old
    from public.phases where id = p_phase_id;

  update public.phases
     set status = p_status,
         planned_start = p_planned_start,
         planned_end = p_planned_end,
         actual_start = p_actual_start,
         actual_end = p_actual_end
   where id = p_phase_id
  returning project_id into v_project;

  -- No row updated: the phase does not exist, or RLS hid it (not a member, or a member who cannot write).
  if v_project is null then
    raise exception 'phase not found or not allowed' using errcode = 'insufficient_privilege';
  end if;

  perform private.log_audit(v_project, 'phases', 'schedule_updated', jsonb_build_object(
    'phase_id', p_phase_id,
    'old', jsonb_build_object('status', v_old.status, 'planned_start', v_old.planned_start, 'planned_end', v_old.planned_end,
                              'actual_start', v_old.actual_start, 'actual_end', v_old.actual_end),
    'new', jsonb_build_object('status', p_status, 'planned_start', p_planned_start, 'planned_end', p_planned_end,
                              'actual_start', p_actual_start, 'actual_end', p_actual_end)
  ));

  -- FR-PRJ-05 / D2: the owner started the phase knowing these gaps.
  if p_start_gaps is not null and v_old.status = 'not_started' and p_status = 'in_progress' then
    perform private.log_audit(v_project, 'phases', 'start_confirmed_with_gaps', jsonb_build_object(
      'phase_id', p_phase_id, 'gaps', p_start_gaps
    ));
  end if;
end;
$$;

revoke all on function public.update_phase_schedule(uuid, text, date, date, date, date, jsonb) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.update_phase_schedule(uuid, text, date, date, date, date, jsonb) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.update_phase_schedule(uuid, text, date, date, date, date, jsonb) to authenticated;
  end if;
end $$;

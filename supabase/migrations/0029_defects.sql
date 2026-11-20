-- 0029: the defects list, the snag list of 3.17 (FR-QLT-06, FR-QLT-07; UC-20; design S28.1, S28.2, S28.3; owner's decisions
-- of 20 Nov 2026, change register).
--
-- issues exists since 0001 (quality's table; RLS: members read, writers write), with the three states of 0002, and is
-- empty.
--
-- 1. issues gets what the design records: a title, a phase, a due date, one optional photo (in the project's «issues»
--    folder of the private bucket of 0013; a path used by one defect only), when fixing started and when it was closed,
--    and text lengths. The 0001 severity stays the priority (the owner's label; the screen says the engineer decides).
-- 2. private.issues_guard: the phase and the checklist (S26.2 «تسجيل عيب مرتبط») belong to this project; the photo is
--    in this project's folder; the row never moves; the dates of the states are set here, never by the client
--    (started_at the first time it is «قيد المعالجة»; closed_at while «مغلق», cleared when reopened).
-- 3. Audit: every change and deletion, with the old values (private.cashflow_audit, 0017).
-- 4. public.update_phase_schedule gains p_close_open_issues: finishing a phase («مكتملة») while it has open defects is
--    allowed (decision D2), after the owner confirms; the confirmation and the defects are logged in the SAME
--    transaction (FR-QLT-07). Which defects are open is the app's (quality module); the database records what was
--    confirmed. Dropped and created again with the new parameter (body unchanged otherwise), like 0027.

-- 1. -------------------------------------------------------------------------------------------------------------
alter table public.issues
  add column title text not null check (char_length(btrim(title)) between 2 and 80),
  add column phase_id uuid references public.phases(id) on delete set null,
  add column due_on date,
  add column photo_path text check (photo_path is null or photo_path ~ '^[0-9a-f-]{36}/issues/[0-9a-f-]{36}\.jpg$'),
  add column started_at timestamptz,
  add column closed_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add constraint issues_location_len check (location is null or char_length(location) <= 80),
  add constraint issues_responsible_len check (responsible is null or char_length(responsible) <= 80),
  add constraint issues_description_len check (description is null or char_length(description) <= 500),
  add constraint issues_closed_when_closed check ((status = 'closed') = (closed_at is not null));

create unique index issues_photo_unique on public.issues (photo_path) where photo_path is not null;
create index issues_project_idx on public.issues (project_id, status);

-- 2. -------------------------------------------------------------------------------------------------------------
create function private.issues_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.project_id is distinct from old.project_id or new.created_at is distinct from old.created_at) then
    raise exception 'a defect never moves to another project' using errcode = 'check_violation';
  end if;
  if new.phase_id is not null and not exists (
    select 1 from public.phases ph where ph.id = new.phase_id and ph.project_id = new.project_id
  ) then
    raise exception 'the phase does not belong to this project' using errcode = 'foreign_key_violation';
  end if;
  if new.checklist_id is not null and not exists (
    select 1 from public.checklists c where c.id = new.checklist_id and c.project_id = new.project_id
  ) then
    raise exception 'the checklist does not belong to this project' using errcode = 'foreign_key_violation';
  end if;
  if new.photo_path is not null and (tg_op = 'INSERT' or new.photo_path is distinct from old.photo_path)
     and new.photo_path not like new.project_id::text || '/issues/%' then
    raise exception 'the photo is not in this project''s issues folder' using errcode = 'check_violation';
  end if;

  -- The dates of the states: set here, never taken from the client.
  if tg_op = 'INSERT' then
    new.started_at := case when new.status = 'in_progress' then now() end;
    new.closed_at := case when new.status = 'closed' then now() end;
  else
    new.started_at := case
      when old.started_at is not null then old.started_at
      when new.status = 'in_progress' then now()
    end;
    new.closed_at := case
      when new.status <> 'closed' then null
      when old.status = 'closed' then old.closed_at
      else now()
    end;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.issues_guard() from public;

create trigger issues_guard before insert or update on public.issues
  for each row execute function private.issues_guard();

-- 3. -------------------------------------------------------------------------------------------------------------
create trigger issues_audit after update or delete on public.issues
  for each row execute function private.cashflow_audit();

-- 4. -------------------------------------------------------------------------------------------------------------
drop function public.update_phase_schedule(uuid, text, date, date, date, date, jsonb);

create function public.update_phase_schedule(
  p_phase_id uuid,
  p_status text,
  p_planned_start date default null,
  p_planned_end date default null,
  p_actual_start date default null,
  p_actual_end date default null,
  p_start_gaps jsonb default null,
  p_close_open_issues jsonb default null
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
  if p_close_open_issues is not null and (jsonb_typeof(p_close_open_issues) <> 'array' or jsonb_array_length(p_close_open_issues) = 0) then
    raise exception 'open issues must be a non-empty list' using errcode = 'check_violation';
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

  -- FR-PRJ-05 / D2: the owner started the phase knowing these readiness gaps (0027).
  if p_start_gaps is not null and v_old.status = 'not_started' and p_status = 'in_progress' then
    perform private.log_audit(v_project, 'phases', 'start_confirmed_with_gaps', jsonb_build_object(
      'phase_id', p_phase_id, 'gaps', p_start_gaps
    ));
  end if;

  -- FR-QLT-07 / D2: the owner finished the phase knowing these defects are still open.
  if p_close_open_issues is not null and v_old.status <> 'done' and p_status = 'done' then
    perform private.log_audit(v_project, 'phases', 'close_confirmed_with_open_issues', jsonb_build_object(
      'phase_id', p_phase_id, 'open_issues', p_close_open_issues
    ));
  end if;
end;
$$;

revoke all on function public.update_phase_schedule(uuid, text, date, date, date, date, jsonb, jsonb) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.update_phase_schedule(uuid, text, date, date, date, date, jsonb, jsonb) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.update_phase_schedule(uuid, text, date, date, date, date, jsonb, jsonb) to authenticated;
  end if;
end $$;

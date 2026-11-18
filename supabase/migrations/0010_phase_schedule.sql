-- 0010: editing a phase's status and dates (FR-PRJ-03, design S09.1; decision of 18 Nov 2026).
--
-- 1. Date-order checks on phases: an end is never before its start. The TypeScript domain checks the same
--    (validatePhaseSchedule); these constraints are the last line, for any other writer.
-- 2. public.update_phase_schedule: changes ONLY the status and the four dates of one phase, and writes one
--    audit row in the same transaction. SECURITY INVOKER (rule of 0004): the update goes through RLS, so only a
--    writer of the project can change its phases; a stranger or a reader changes nothing and gets 42501.
--    Actual dates after today (in Libya) are refused: they record what happened.

-- 1. -------------------------------------------------------------------------------------------------------------
alter table public.phases
  add constraint phases_planned_order check (planned_start is null or planned_end is null or planned_end >= planned_start),
  add constraint phases_actual_order check (actual_start is null or actual_end is null or actual_end >= actual_start);

-- 2. -------------------------------------------------------------------------------------------------------------
create function public.update_phase_schedule(
  p_phase_id uuid,
  p_status text,
  p_planned_start date default null,
  p_planned_end date default null,
  p_actual_start date default null,
  p_actual_end date default null
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
end;
$$;

revoke all on function public.update_phase_schedule(uuid, text, date, date, date, date) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.update_phase_schedule(uuid, text, date, date, date, date) to authenticated;
  end if;
end $$;

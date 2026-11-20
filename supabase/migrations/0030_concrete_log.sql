-- 0030: the concrete log, 3.13 (FR-QLT-04, FR-QLT-05; UC-19; design S27.1, S27.2; owner's decisions of 20 Nov 2026,
-- change register).
--
-- concrete_pours exists since 0002 (quality's table; RLS: members read, writers write; client_op_id for retries) and is
-- empty.
--
-- 1. The design's fields: mix reference and delivery note number. FR-QLT-05: the engineer's two dates, COPIED BY THE
--    OWNER for each pour (last day of water curing, formwork removal), and when each reminder was marked done. No number
--    of days is stored or computed anywhere: there is nothing here for an engineer to review.
-- 2. Text limits, and the two dates never before the pour.
-- 3. private.concrete_pours_guard: the phase and the checklist belong to this project; a pour date is not in the future;
--    the row never moves; «تمّ» is stamped by the database (the client only asks to mark or unmark it).
-- 4. Audit: every change and deletion, with the old values (private.cashflow_audit, 0017).

-- 1 and 2. -------------------------------------------------------------------------------------------------------
alter table public.concrete_pours
  add column mix_ref text check (mix_ref is null or char_length(mix_ref) <= 80),
  add column delivery_ref text check (delivery_ref is null or char_length(delivery_ref) <= 40),
  add column curing_until date,
  add column formwork_on date,
  add column curing_done_at timestamptz,
  add column formwork_done_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add constraint concrete_pours_location_len check (char_length(btrim(location)) between 2 and 80),
  add constraint concrete_pours_supplier_len check (char_length(btrim(supplier)) between 2 and 80),
  add constraint concrete_pours_note_len check (note is null or char_length(note) <= 200),
  add constraint concrete_pours_cubes_max check (cube_samples <= 1000),
  add constraint concrete_pours_curing_after_pour check (curing_until is null or curing_until >= poured_on),
  add constraint concrete_pours_formwork_after_pour check (formwork_on is null or formwork_on >= poured_on);

-- 3. -------------------------------------------------------------------------------------------------------------
create function private.concrete_pours_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.project_id is distinct from old.project_id or new.created_at is distinct from old.created_at) then
    raise exception 'a pour never moves to another project' using errcode = 'check_violation';
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
  if (tg_op = 'INSERT' or new.poured_on is distinct from old.poured_on) and new.poured_on > private.today_tripoli() then
    raise exception 'a pour date cannot be in the future' using errcode = 'check_violation';
  end if;

  -- «تمّ»: the client sends any value to mark it, null to unmark it; the moment is the database's.
  if tg_op = 'INSERT' then
    new.curing_done_at := null;
    new.formwork_done_at := null;
  else
    new.curing_done_at := case
      when new.curing_done_at is null then null
      when old.curing_done_at is not null then old.curing_done_at
      else now()
    end;
    new.formwork_done_at := case
      when new.formwork_done_at is null then null
      when old.formwork_done_at is not null then old.formwork_done_at
      else now()
    end;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.concrete_pours_guard() from public;

create trigger concrete_pours_guard before insert or update on public.concrete_pours
  for each row execute function private.concrete_pours_guard();

-- 4. -------------------------------------------------------------------------------------------------------------
create trigger concrete_pours_audit after update or delete on public.concrete_pours
  for each row execute function private.cashflow_audit();

-- 0019: the continue-or-pause comparison keeps the owner's figures and review (design S18.1, S18.2; FR-DEC-01,
-- FR-DEC-02, FR-DEC-05; slice 3 of 3.7, owner's decisions of 19 and 20 Nov 2026).
--
-- decision_scenarios exists since 0001 (RLS: members read, writers write) as (choice continue|pause, result_lyd) and
-- has no screen, so it is empty. It becomes ONE row per project: the comparison the owner is working on.
-- Nothing is computed here: the costs, the 30-day outlook and the scenarios come from the TypeScript domain
-- (decisions/domain/scenarios.ts with finance's cash outlook), from these figures.
--
-- 1. The figures, each optional (a missing one is shown as «ناقص», FR-DEC-03): remaining works, materials on site,
--    the phase finished before pausing and its cost, protection, storage and restart costs, and the price change %
--    (−50 to +100, decision of 20 Nov 2026). result_lyd goes: a stored result would go stale when a figure changes.
-- 2. The review (S18.2, an owner-only checklist): a note, the four steps, and the chosen way, now also «finish_phase».
-- 3. private.decision_scenarios_guard: the phase belongs to this project (a foreign key only proves it exists); the
--    row never moves; updated_at follows every change.
-- 4. Audit: every change and deletion, with the old values, by private.cashflow_audit (0017).
-- 5. No new public function, so nothing to revoke from anon.

-- 1, 2. ------------------------------------------------------------------------------------------------------------
alter table public.decision_scenarios
  drop constraint decision_scenarios_choice_check,
  alter column choice drop not null,
  drop column result_lyd,
  add column remaining_works_lyd numeric(14,3) check (remaining_works_lyd is null or remaining_works_lyd > 0),
  add column materials_on_hand_lyd numeric(14,3) check (materials_on_hand_lyd is null or materials_on_hand_lyd >= 0),
  add column phase_id uuid references public.phases(id) on delete set null,
  add column phase_cost_lyd numeric(14,3) check (phase_cost_lyd is null or phase_cost_lyd >= 0),
  add column protection_lyd numeric(14,3) check (protection_lyd is null or protection_lyd >= 0),
  add column storage_lyd numeric(14,3) check (storage_lyd is null or storage_lyd >= 0),
  add column restart_lyd numeric(14,3) check (restart_lyd is null or restart_lyd >= 0),
  add column price_change_pct numeric(5,2) not null default 0 check (price_change_pct between -50 and 100),
  add column review_note text check (review_note is null or char_length(review_note) <= 500),
  add column funding_confirmed boolean not null default false,
  add column contracts_reviewed boolean not null default false,
  add column site_assessed boolean not null default false,
  add column plan_decided boolean not null default false,
  add column updated_at timestamptz not null default now(),
  add constraint decision_scenarios_choice check (choice is null or choice in ('continue', 'pause', 'finish_phase')),
  add constraint decision_scenarios_phase_cost check (phase_cost_lyd is null or phase_id is not null),
  add constraint decision_scenarios_phase_within check (
    phase_cost_lyd is null or remaining_works_lyd is null or phase_cost_lyd <= remaining_works_lyd
  );

create unique index decision_scenarios_one_per_project on public.decision_scenarios (project_id);

-- 3. -------------------------------------------------------------------------------------------------------------
create function private.decision_scenarios_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.project_id is distinct from old.project_id then
    raise exception 'a comparison never moves to another project' using errcode = 'check_violation';
  end if;
  -- Looked up as the caller (security invoker): a phase the caller cannot see is refused too.
  if new.phase_id is not null and not exists (
    select 1 from public.phases ph where ph.id = new.phase_id and ph.project_id = new.project_id
  ) then
    raise exception 'the phase does not belong to this project' using errcode = 'foreign_key_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.decision_scenarios_guard() from public;

create trigger decision_scenarios_guard before insert or update on public.decision_scenarios
  for each row execute function private.decision_scenarios_guard();

-- 4. -------------------------------------------------------------------------------------------------------------
create trigger decision_scenarios_audit after update or delete on public.decision_scenarios
  for each row execute function private.cashflow_audit();

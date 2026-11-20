-- 0021: the budget plan, an allocation per phase (design S15.2 «توزيع الميزانية»; FR-FIN-11; 3.16 financial part,
-- slice 1; owner's decisions of 20 Nov 2026, change register).
--
-- budget_categories exists since 0001 (finance's table; RLS: members read, writers write) with a required name, and
-- has never been written (empty on staging). A phase allocation is a row of it linked to a phase, so the plan stays in
-- the finance module and the phase name stays in the projects module (no copy of the name).
--
-- 1. phase_id (a foreign key to phases is allowed by the module rules); name becomes optional, but every row has a
--    name or a phase; one allocation per phase.
-- 2. private.budget_categories_guard: the phase belongs to this project (a foreign key only proves it exists); the row
--    never moves to another project; updated_at follows every change.
-- 3. Audit: every change and deletion, with the old values, by private.cashflow_audit (0017).
-- 4. Nothing is computed here: the deviation (D5, 10%) is the TypeScript domain's (finance/domain/allocation.ts).
--    No new public function, so nothing to revoke from anon.

-- 1. -------------------------------------------------------------------------------------------------------------
alter table public.budget_categories
  add column phase_id uuid references public.phases(id) on delete cascade,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now(),
  alter column name drop not null,
  add constraint budget_categories_named check (name is not null or phase_id is not null),
  add constraint budget_categories_name_length check (name is null or char_length(btrim(name)) between 2 and 80),
  add constraint budget_categories_one_per_phase unique (project_id, phase_id);

-- 2. -------------------------------------------------------------------------------------------------------------
create function private.budget_categories_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.project_id is distinct from old.project_id then
    raise exception 'an allocation never moves to another project' using errcode = 'check_violation';
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

revoke all on function private.budget_categories_guard() from public;

create trigger budget_categories_guard before insert or update on public.budget_categories
  for each row execute function private.budget_categories_guard();

-- 3. -------------------------------------------------------------------------------------------------------------
create trigger budget_categories_audit after update or delete on public.budget_categories
  for each row execute function private.cashflow_audit();

-- 0022: extra works and changes without a contract (FR-FIN-10, UC-17; 3.16 financial part, slice 2; owner's decisions
-- of 20 Nov 2026, change register).
--
-- change_orders exists since 0001 (finance's table; RLS: members read, writers write) and REQUIRES a contract, but
-- contracts are priority 2 and not built. It is empty on staging.
--
-- 1. contract_id becomes optional (a work can be linked to a contract later); the work gets what the owner records: a
--    title (2–80), a date (today by default), a phase (optional), a note (up to 200); its cost must be positive.
-- 2. private.change_orders_guard: the phase and the contract (when given) belong to this project; the date is not in
--    the future; the row never moves to another project; updated_at follows every change (an approval is a change).
-- 3. Audit: every change (an approval, a rejection) and deletion, with the old values, by private.cashflow_audit (0017).
-- 4. Nothing is computed here: the contingency use is the TypeScript domain's (finance/domain/extras.ts).
--    No new public function, so nothing to revoke from anon.

-- 1. -------------------------------------------------------------------------------------------------------------
alter table public.change_orders
  alter column contract_id drop not null,
  add column title text not null check (char_length(btrim(title)) between 2 and 80),
  add column occurred_on date not null default private.today_tripoli(),
  add column phase_id uuid references public.phases(id) on delete set null,
  add column note text check (note is null or char_length(note) <= 200),
  add column updated_at timestamptz not null default now(),
  add constraint change_orders_cost_positive check (cost_lyd > 0);

create index change_orders_project_idx on public.change_orders (project_id, occurred_on);

-- 2. -------------------------------------------------------------------------------------------------------------
create function private.change_orders_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.project_id is distinct from old.project_id then
    raise exception 'an extra work never moves to another project' using errcode = 'check_violation';
  end if;
  -- Looked up as the caller (security invoker): a phase or contract the caller cannot see is refused too.
  if new.phase_id is not null and not exists (
    select 1 from public.phases ph where ph.id = new.phase_id and ph.project_id = new.project_id
  ) then
    raise exception 'the phase does not belong to this project' using errcode = 'foreign_key_violation';
  end if;
  if new.contract_id is not null and not exists (
    select 1 from public.contracts c where c.id = new.contract_id and c.project_id = new.project_id
  ) then
    raise exception 'the contract does not belong to this project' using errcode = 'foreign_key_violation';
  end if;
  if (tg_op = 'INSERT' or new.occurred_on is distinct from old.occurred_on) and new.occurred_on > private.today_tripoli() then
    raise exception 'an extra work date cannot be in the future' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.change_orders_guard() from public;

create trigger change_orders_guard before insert or update on public.change_orders
  for each row execute function private.change_orders_guard();

-- 3. -------------------------------------------------------------------------------------------------------------
create trigger change_orders_audit after update or delete on public.change_orders
  for each row execute function private.cashflow_audit();

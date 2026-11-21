-- 0031: contracts and the payment schedule (FR-FIN-08, FR-FIN-09, FR-FIN-12; UC-16; 3.16 contractual part, slice 1;
-- owner's decisions of 21 Nov 2026, change register).
--
-- contracts and payments exist since 0001 (finance's tables; RLS: members read, writers write) and are EMPTY on
-- staging: the app never wrote to them. This slice records a contract and its schedule of installments. Paying an
-- installment, the due rule and the expense it makes are slice 2 (0032).
--
-- 1. contracts: a title (2-80) and the contractor's name (2-80); the value is positive; the owner's scope (up to 300);
--    the cleanup clause becomes a short text (who removes the debris, at whose cost; up to 200) instead of the unused
--    boolean has_cleanup_clause; document_id is a WEAK reference to the contract copy (a uuid, no foreign key: documents
--    is another module; the app checks the document belongs to the project); updated_at follows every change.
-- 2. payments = the installments of the schedule: a title (2-80), a positive amount, an optional phase (the stage it
--    falls due after), and retained_lyd: the part the owner writes down as held back until handover (0 = none; at most
--    the amount). D9: the percentage is left to the owner and the contractor, so nothing here imposes or suggests one.
--    It replaces the boolean withheld (a whole payment held or not), which could not say "a part". A paid date can
--    never be in the future.
-- 3. Guards (security invoker, so a phase or contract the caller cannot see is refused too): the phase and the contract
--    belong to this project; a row never moves to another project; a payment never changes its contract; updated_at is
--    server-stamped. A schedule that adds up to more than the contract value is NOT refused here (decision D2: warn,
--    never block): finance/domain/contracts.ts shows the warning.
-- 4. Audit: every change and deletion, with the old values, by private.cashflow_audit (0017).
-- 5. Nothing is computed here. No new public function, so nothing to revoke from anon.

-- 1. -------------------------------------------------------------------------------------------------------------
alter table public.contracts
  drop column has_cleanup_clause,
  add column title text not null check (char_length(btrim(title)) between 2 and 80),
  add column scope text check (scope is null or char_length(scope) <= 300),
  add column cleanup_clause text check (cleanup_clause is null or char_length(cleanup_clause) <= 200),
  add column document_id uuid,
  add column updated_at timestamptz not null default now(),
  add constraint contracts_contractor_length check (char_length(btrim(contractor)) between 2 and 80),
  add constraint contracts_value_positive check (value_lyd > 0);

create index contracts_project_idx on public.contracts (project_id, created_at);

-- 2. -------------------------------------------------------------------------------------------------------------
alter table public.payments
  drop column withheld,
  add column title text not null check (char_length(btrim(title)) between 2 and 80),
  add column retained_lyd numeric(14,3) not null default 0 check (retained_lyd >= 0),
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now(),
  add constraint payments_amount_positive check (amount_lyd > 0),
  add constraint payments_retained_within_amount check (retained_lyd <= amount_lyd);

create index payments_contract_idx on public.payments (contract_id, created_at);

-- 3. -------------------------------------------------------------------------------------------------------------
create function private.contracts_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.project_id is distinct from old.project_id then
    raise exception 'a contract never moves to another project' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create function private.payments_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.project_id is distinct from old.project_id then
      raise exception 'a payment never moves to another project' using errcode = 'check_violation';
    end if;
    if new.contract_id is distinct from old.contract_id then
      raise exception 'a payment never moves to another contract' using errcode = 'check_violation';
    end if;
  end if;
  -- Looked up as the caller (security invoker): a contract or phase the caller cannot see is refused too.
  if not exists (
    select 1 from public.contracts c where c.id = new.contract_id and c.project_id = new.project_id
  ) then
    raise exception 'the contract does not belong to this project' using errcode = 'foreign_key_violation';
  end if;
  if new.phase_id is not null and not exists (
    select 1 from public.phases ph where ph.id = new.phase_id and ph.project_id = new.project_id
  ) then
    raise exception 'the phase does not belong to this project' using errcode = 'foreign_key_violation';
  end if;
  if new.paid_on is not null and new.paid_on > private.today_tripoli()
     and (tg_op = 'INSERT' or new.paid_on is distinct from old.paid_on) then
    raise exception 'a payment date cannot be in the future' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.contracts_guard() from public;
revoke all on function private.payments_guard() from public;

create trigger contracts_guard before insert or update on public.contracts
  for each row execute function private.contracts_guard();
create trigger payments_guard before insert or update on public.payments
  for each row execute function private.payments_guard();

-- 4. -------------------------------------------------------------------------------------------------------------
create trigger contracts_audit after update or delete on public.contracts
  for each row execute function private.cashflow_audit();
create trigger payments_audit after update or delete on public.payments
  for each row execute function private.cashflow_audit();

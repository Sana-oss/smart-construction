-- 0032: paying an installment, its expense, and releasing the retained part (FR-FIN-09, UC-16; 3.16 contractual part,
-- slice 2; owner's decisions of 21 Nov 2026, change register).
--
-- payments (0031) already has paid_on and retained_lyd. This slice adds what a PAID installment points at:
--   expense_id          the ONE expense the payment made (amount minus the retained part); null while unpaid, and null
--                       when the whole payment is retained (nothing leaves until the release). ON DELETE SET NULL: the
--                       owner may delete that expense from the expenses list; the payment then shows it has none.
--   release_op_id       the key of the second expense (the retained part), made once with the row, so a retry of the
--                       release never makes a second expense (expenses.client_op_id, 0001).
--   released_on         the day the owner released the retained part; needs a paid payment with a retained part, and
--                       never before the payment date.
--   release_expense_id  the second expense, made by the release.
--
-- Guards (private.payments_guard, replaced here; security invoker): a paid payment's amount and retained part never
-- change (what was paid is a fact; delete and re-record to correct it); an unpaid payment has no expense (and, by the
-- constraint above, no release: undo the release before the payment); the release's expense exists only with the
-- release; the expenses belong to this project; the release date is not in the future.
--
-- Two public functions, SECURITY INVOKER (anon revoked, as in 0009/0011): the update of the payment and the audit row of
-- a confirmed warning (decision D2) happen in ONE transaction, through private.log_audit, the only writer of audit_log:
--   confirm_payment_paid         pays the installment; with p_gaps (what was missing when the owner confirmed) it logs
--                                payment_confirmed_before_due.
--   release_payment_retained     releases the retained part; with p_early it logs release_confirmed_before_phases_done.
-- The expenses themselves are made BEFORE these calls by the app (create_expense, idempotent by client_op_id), exactly
-- like a purchase (0024): if a call fails, a retry finds the same expense and never makes a second one.
-- Undoing a payment or a release is a plain update by the app (after deleting the expense); the audit trigger records it.

-- 1. -------------------------------------------------------------------------------------------------------------
alter table public.payments
  add column expense_id uuid references public.expenses(id) on delete set null,
  add column release_op_id uuid not null default gen_random_uuid(),
  add column released_on date,
  add column release_expense_id uuid references public.expenses(id) on delete set null,
  add constraint payments_release_needs_paid check (
    released_on is null or (paid_on is not null and retained_lyd > 0 and released_on >= paid_on)
  );

create unique index payments_expense_uidx on public.payments (expense_id) where expense_id is not null;
create unique index payments_release_expense_uidx on public.payments (release_expense_id) where release_expense_id is not null;

-- 2. -------------------------------------------------------------------------------------------------------------
create or replace function private.payments_guard()
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
    -- What was paid is a fact: the amount and the retained part of a paid payment never change.
    if old.paid_on is not null and new.paid_on is not null
       and (new.amount_lyd is distinct from old.amount_lyd or new.retained_lyd is distinct from old.retained_lyd) then
      raise exception 'the amount of a paid payment never changes' using errcode = 'check_violation';
    end if;
  end if;
  -- Looked up as the caller (security invoker): a contract, phase or expense the caller cannot see is refused too.
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
  if new.expense_id is not null and not exists (
    select 1 from public.expenses e where e.id = new.expense_id and e.project_id = new.project_id
  ) then
    raise exception 'the expense does not belong to this project' using errcode = 'foreign_key_violation';
  end if;
  if new.release_expense_id is not null and not exists (
    select 1 from public.expenses e where e.id = new.release_expense_id and e.project_id = new.project_id
  ) then
    raise exception 'the expense does not belong to this project' using errcode = 'foreign_key_violation';
  end if;
  -- An unpaid payment has no expense (a release needs a paid payment: payments_release_needs_paid, so a payment cannot be
  -- marked unpaid while released: undo the release first); one not released has no release expense.
  if new.paid_on is null and new.expense_id is not null then
    raise exception 'an unpaid payment has no expense' using errcode = 'check_violation';
  end if;
  if new.released_on is null and new.release_expense_id is not null then
    raise exception 'a payment not released has no release expense' using errcode = 'check_violation';
  end if;
  if new.paid_on is not null and new.paid_on > private.today_tripoli()
     and (tg_op = 'INSERT' or new.paid_on is distinct from old.paid_on) then
    raise exception 'a payment date cannot be in the future' using errcode = 'check_violation';
  end if;
  if new.released_on is not null and new.released_on > private.today_tripoli()
     and (tg_op = 'INSERT' or new.released_on is distinct from old.released_on) then
    raise exception 'a release date cannot be in the future' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- 3. -------------------------------------------------------------------------------------------------------------
create function public.confirm_payment_paid(
  p_payment_id uuid,
  p_paid_on date,
  p_expense_id uuid default null,
  p_gaps jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;
  if p_gaps is not null and (jsonb_typeof(p_gaps) <> 'array' or jsonb_array_length(p_gaps) = 0) then
    raise exception 'gaps must be a non-empty list' using errcode = 'check_violation';
  end if;

  update public.payments
     set paid_on = p_paid_on, expense_id = p_expense_id
   where id = p_payment_id and paid_on is null
  returning project_id into v_project;

  -- No row updated: not found, already paid, or RLS hid it (not a member, or a member who cannot write).
  if v_project is null then
    raise exception 'payment not found, already paid, or not allowed' using errcode = 'insufficient_privilege';
  end if;

  -- FR-FIN-09 / D2: the owner paid knowing what was missing.
  if p_gaps is not null then
    perform private.log_audit(v_project, 'payments', 'payment_confirmed_before_due', jsonb_build_object(
      'payment_id', p_payment_id, 'gaps', p_gaps
    ));
  end if;
end;
$$;

create function public.release_payment_retained(
  p_payment_id uuid,
  p_released_on date,
  p_expense_id uuid,
  p_early boolean default false
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  update public.payments
     set released_on = p_released_on, release_expense_id = p_expense_id
   where id = p_payment_id and paid_on is not null and released_on is null
  returning project_id into v_project;

  if v_project is null then
    raise exception 'payment not found, not paid, already released, or not allowed' using errcode = 'insufficient_privilege';
  end if;

  -- FR-FIN-09 / D2: the owner released the retained part while a phase was not done.
  if p_early then
    perform private.log_audit(v_project, 'payments', 'release_confirmed_before_phases_done', jsonb_build_object(
      'payment_id', p_payment_id
    ));
  end if;
end;
$$;

revoke all on function public.confirm_payment_paid(uuid, date, uuid, jsonb) from public;
revoke all on function public.release_payment_retained(uuid, date, uuid, boolean) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.confirm_payment_paid(uuid, date, uuid, jsonb) from anon;
    revoke all on function public.release_payment_retained(uuid, date, uuid, boolean) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.confirm_payment_paid(uuid, date, uuid, jsonb) to authenticated;
    grant execute on function public.release_payment_retained(uuid, date, uuid, boolean) to authenticated;
  end if;
end $$;

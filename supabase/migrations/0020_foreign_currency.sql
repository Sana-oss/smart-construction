-- 0020: an expense paid in a foreign currency, and the owner's log of reference rates (3.18, FR-FIN-04, UC-08;
-- owner's decisions of 20 Nov 2026, change register). The columns exist since 0001 (expenses.original_amount,
-- original_currency, rate_lyd_per_unit; table exchange_rates with RLS) and were never written.
--
-- 1. expenses: a foreign expense is consistent or refused. The currency is one of the four (USD, EUR, TRY, CNY; the
--    TypeScript list in finance/domain/currency.ts); currency, original amount and rate come together; and amount_lyd,
--    which every total uses, IS original × rate rounded to the dirham. So no client can store a LYD figure that does
--    not match its own rate. LYD expenses are untouched.
-- 2. create_expense, new version (previous: 0015): the same function plus three optional parameters at the end, so
--    every existing call keeps working. Dropped and recreated because the parameters changed; still ONE function.
--    The event says which currency was used.
-- 3. exchange_rates: created_at (orders two rates of the same day), the same four currencies, a note of up to 200
--    characters, a guard (a rate is one the owner saw: not in the future; it never moves to another project), and the
--    audit trigger of 0017 for changes and deletions.
-- 4. anon gets nothing: the new create_expense is revoked from public and anon, as before.

-- 1. -------------------------------------------------------------------------------------------------------------
alter table public.expenses
  add constraint expenses_currency_known check (original_currency is null or original_currency in ('USD', 'EUR', 'TRY', 'CNY')),
  add constraint expenses_currency_has_rate check ((original_currency is null) = (rate_lyd_per_unit is null)),
  add constraint expenses_original_positive check (original_amount is null or original_amount > 0),
  add constraint expenses_rate_positive check (rate_lyd_per_unit is null or rate_lyd_per_unit > 0),
  add constraint expenses_lyd_matches_rate check (
    original_currency is null or amount_lyd = round(original_amount * rate_lyd_per_unit, 3)
  );

-- 2. -------------------------------------------------------------------------------------------------------------
drop function public.create_expense(uuid, numeric, uuid, text, text, uuid, text, date, text);

create function public.create_expense(
  p_project_id uuid,
  p_amount_lyd numeric,
  p_client_op_id uuid,
  p_title text,
  p_expense_type text,
  p_phase_id uuid default null,
  p_payee text default null,
  p_paid_on date default null,
  p_receipt_path text default null,
  p_original_amount numeric default null,
  p_original_currency text default null,
  p_rate_lyd_per_unit numeric default null
)
returns table (expense_id uuid, created boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := private.today_tripoli();
  v_paid_on date := coalesce(p_paid_on, v_today);
  v_title text := nullif(btrim(p_title), '');
  v_payee text := nullif(btrim(p_payee), '');
  v_receipt text := nullif(btrim(p_receipt_path), '');
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  if p_client_op_id is null then
    raise exception 'client_op_id is required' using errcode = 'check_violation';
  end if;
  -- The table allows a missing title and type (old rows); a NEW expense must have both.
  if v_title is null then
    raise exception 'title is required' using errcode = 'check_violation';
  end if;
  if p_expense_type is null then
    raise exception 'expense_type is required' using errcode = 'check_violation';
  end if;
  -- An expense is money already paid: its date cannot be after today in Libya.
  if v_paid_on > v_today then
    raise exception 'paid_on cannot be in the future' using errcode = 'check_violation';
  end if;
  -- The foreign key only proves that the phase EXISTS. It must also belong to THIS project.
  if p_phase_id is not null and not exists (
    select 1 from public.phases ph where ph.id = p_phase_id and ph.project_id = p_project_id
  ) then
    raise exception 'phase does not belong to this project' using errcode = 'foreign_key_violation';
  end if;

  -- The receipt's path and the foreign amount are checked by the table (0015, and section 1 above).
  insert into public.expenses (project_id, amount_lyd, title, expense_type, phase_id, payee, paid_on, client_op_id, receipt_path,
                               original_amount, original_currency, rate_lyd_per_unit)
  values (p_project_id, p_amount_lyd, v_title, p_expense_type, p_phase_id, v_payee, v_paid_on, p_client_op_id, v_receipt,
          p_original_amount, p_original_currency, p_rate_lyd_per_unit)
  on conflict (project_id, client_op_id) where client_op_id is not null do nothing
  returning id into v_id;

  if v_id is null then
    -- The same request was already stored: give back the original expense and emit nothing.
    select e.id into v_id from public.expenses e
    where e.project_id = p_project_id and e.client_op_id = p_client_op_id;
    return query select v_id, false;
    return;
  end if;

  -- Same transaction as the insert above. Amounts travel as text, so no consumer reads them as a float.
  perform private.emit_event(p_project_id, 'expense.created', jsonb_build_object(
    'expense_id', v_id,
    'amount_lyd', p_amount_lyd::text,
    'expense_type', p_expense_type,
    'phase_id', p_phase_id,
    'paid_on', v_paid_on,
    'has_receipt', v_receipt is not null,
    'original_currency', p_original_currency
  ));

  return query select v_id, true;
end;
$$;

revoke all on function public.create_expense(uuid, numeric, uuid, text, text, uuid, text, date, text, numeric, text, numeric) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.create_expense(uuid, numeric, uuid, text, text, uuid, text, date, text, numeric, text, numeric) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.create_expense(uuid, numeric, uuid, text, text, uuid, text, date, text, numeric, text, numeric) to authenticated;
  end if;
end $$;

-- 3. -------------------------------------------------------------------------------------------------------------
alter table public.exchange_rates
  add column created_at timestamptz not null default now(),
  add constraint exchange_rates_currency_known check (currency in ('USD', 'EUR', 'TRY', 'CNY')),
  add constraint exchange_rates_note_length check (note is null or char_length(note) <= 200);

create function private.exchange_rates_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.project_id is distinct from old.project_id then
    raise exception 'a rate never moves to another project' using errcode = 'check_violation';
  end if;
  if (tg_op = 'INSERT' or new.rate_date is distinct from old.rate_date) and new.rate_date > private.today_tripoli() then
    raise exception 'a rate date cannot be in the future' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.exchange_rates_guard() from public;

create trigger exchange_rates_guard before insert or update on public.exchange_rates
  for each row execute function private.exchange_rates_guard();

create trigger exchange_rates_audit after update or delete on public.exchange_rates
  for each row execute function private.cashflow_audit();

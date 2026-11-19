-- 0015: an optional receipt photo on an expense (UC-07 "مصروف سريع ... وصورة فاتورة"; FR-DOC-02; stage 3 of the
-- documents and photos plan of 18 Nov 2026). The column expenses.receipt_path exists since 0001 and has never been
-- written.
--
-- 1. A check on receipt_path: empty, or "<this project's id>/receipts/<uuid>.jpg" (the private bucket of 0013, whose
--    policies already cover every path that starts with the project id). A regex match is never NULL for a non-null
--    path, so a malformed path cannot slip through (lesson of 0014). One expense per receipt file.
-- 2. create_expense, new version (previous: 0009): the same function plus p_receipt_path (optional, last, so every
--    existing call keeps working). Dropped and recreated because the parameters changed; still ONE function.
--    The browser uploads the receipt before calling; the app removes the file if this call refuses the expense or
--    finds it already recorded (application/create-expense.ts), so no file is left without an expense.

-- 1. -------------------------------------------------------------------------------------------------------------
alter table public.expenses
  add constraint expenses_receipt_in_project check (
    receipt_path is null or receipt_path ~ ('^' || project_id::text || '/receipts/[0-9a-f-]{36}\.jpg$')
  );
create unique index expenses_receipt_unique on public.expenses (receipt_path) where receipt_path is not null;

-- 2. -------------------------------------------------------------------------------------------------------------
drop function public.create_expense(uuid, numeric, uuid, text, text, uuid, text, date);

create function public.create_expense(
  p_project_id uuid,
  p_amount_lyd numeric,
  p_client_op_id uuid,
  p_title text,
  p_expense_type text,
  p_phase_id uuid default null,
  p_payee text default null,
  p_paid_on date default null,
  p_receipt_path text default null
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
  -- The foreign key only proves that the phase EXISTS. It must also belong to THIS project, otherwise an
  -- expense could point at another project's phase.
  if p_phase_id is not null and not exists (
    select 1 from public.phases ph where ph.id = p_phase_id and ph.project_id = p_project_id
  ) then
    raise exception 'phase does not belong to this project' using errcode = 'foreign_key_violation';
  end if;

  -- The receipt's path is checked by the table (expenses_receipt_in_project): inside this project's receipts folder.
  insert into public.expenses (project_id, amount_lyd, title, expense_type, phase_id, payee, paid_on, client_op_id, receipt_path)
  values (p_project_id, p_amount_lyd, v_title, p_expense_type, p_phase_id, v_payee, v_paid_on, p_client_op_id, v_receipt)
  on conflict (project_id, client_op_id) where client_op_id is not null do nothing
  returning id into v_id;

  if v_id is null then
    -- The same request was already stored: give back the original expense and emit nothing.
    select e.id into v_id from public.expenses e
    where e.project_id = p_project_id and e.client_op_id = p_client_op_id;
    return query select v_id, false;
    return;
  end if;

  -- Same transaction as the insert above. The amount travels as text, so no consumer reads it as a float.
  perform private.emit_event(p_project_id, 'expense.created', jsonb_build_object(
    'expense_id', v_id,
    'amount_lyd', p_amount_lyd::text,
    'expense_type', p_expense_type,
    'phase_id', p_phase_id,
    'paid_on', v_paid_on,
    'has_receipt', v_receipt is not null
  ));

  return query select v_id, true;
end;
$$;

revoke all on function public.create_expense(uuid, numeric, uuid, text, text, uuid, text, date, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.create_expense(uuid, numeric, uuid, text, text, uuid, text, date, text) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.create_expense(uuid, numeric, uuid, text, text, uuid, text, date, text) to authenticated;
  end if;
end $$;

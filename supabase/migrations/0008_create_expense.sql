-- Migration 0008 (finance): record an expense and its event in ONE transaction (FR-FIN-02, UC-07, NFR-REL-01,
-- FR-SYS-04). Append-only: 0001–0007 are never edited. No new table: expenses exists since 0001.
--
-- Why a database function and not two calls from the app: the expense and its "expense.created" event must be
-- saved together or not at all (architecture §6). Two separate API calls are two transactions: the app could
-- stop between them and leave an expense without its event.
--
-- SECURITY INVOKER: runs as the signed-in user, so the insert goes through RLS (only the owner or an editor of
-- the project can write; rule of 0004: no callable security definer function in "public"). The event is
-- written through private.emit_event (0007), which checks the same permission again.
-- Validation of what the owner typed is done in the TypeScript domain (rules R4/R5, validateNewExpense); this
-- function stores the result, and the checks below and the table constraints double-check.
--
-- Idempotent (NFR-REL-01): p_client_op_id is made once by the browser for each expense. If the same request
-- arrives again (weak connection, double tap, offline queue), the unique index expenses_client_op (0001) finds
-- the first row: no second expense, no second event, and the ORIGINAL id is returned with created = false.

create function public.create_expense(
  p_project_id uuid,
  p_amount_lyd numeric,
  p_client_op_id uuid,
  p_category_id uuid default null,
  p_phase_id uuid default null,
  p_note text default null,
  p_paid_on date default null
)
returns table (expense_id uuid, created boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := private.today_tripoli();
  v_paid_on date := coalesce(p_paid_on, v_today);
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  if p_client_op_id is null then
    raise exception 'client_op_id is required' using errcode = 'check_violation';
  end if;
  -- An expense is money already paid: its date cannot be after today in Libya.
  if v_paid_on > v_today then
    raise exception 'paid_on cannot be in the future' using errcode = 'check_violation';
  end if;
  -- The foreign keys only prove that the category and the phase EXIST. They must also belong to THIS project,
  -- otherwise an expense could point at another project's rows.
  if p_category_id is not null and not exists (
    select 1 from public.budget_categories c where c.id = p_category_id and c.project_id = p_project_id
  ) then
    raise exception 'category does not belong to this project' using errcode = 'foreign_key_violation';
  end if;
  if p_phase_id is not null and not exists (
    select 1 from public.phases ph where ph.id = p_phase_id and ph.project_id = p_project_id
  ) then
    raise exception 'phase does not belong to this project' using errcode = 'foreign_key_violation';
  end if;

  insert into public.expenses (project_id, amount_lyd, category_id, phase_id, note, paid_on, client_op_id)
  values (p_project_id, p_amount_lyd, p_category_id, p_phase_id, nullif(btrim(p_note), ''), v_paid_on, p_client_op_id)
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
    'category_id', p_category_id,
    'phase_id', p_phase_id,
    'paid_on', v_paid_on
  ));

  return query select v_id, true;
end;
$$;

revoke all on function public.create_expense(uuid, numeric, uuid, uuid, uuid, text, date) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.create_expense(uuid, numeric, uuid, uuid, uuid, text, date) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.create_expense(uuid, numeric, uuid, uuid, uuid, text, date) to authenticated;
  end if;
end $$;

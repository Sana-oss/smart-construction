-- Migration 0009 (finance): the expense fields of the design, screen S14.1 "مصروف سريع" (FR-FIN-02, UC-07).
-- Decision of 16 Nov 2026 (change register): the quick expense follows the design's six fields: name, amount,
-- type, phase, supplier or beneficiary, date. Append-only: 0001–0008 are never edited. No new table.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Three new columns on expenses (amount, phase and date exist since 0001).
--    title: what the money was paid for ("حديد تسليح").
--    payee: supplier or beneficiary, optional.
--    expense_type: the three types shown in the design (S13.1: مواد، عمالة، خدمات), stored as English keys;
--    the Arabic labels are UI text. The same list is in src/modules/finance/domain/expense.ts (EXPENSE_TYPES).
--    All three are nullable in the TABLE because rows recorded before this migration do not have them;
--    create_expense below requires title and type for every new expense.
-- ---------------------------------------------------------------------------------------------------------
alter table public.expenses
  add column title text check (title is null or char_length(btrim(title)) between 2 and 80),
  add column payee text check (payee is null or char_length(btrim(payee)) between 1 and 80),
  add column expense_type text check (expense_type in ('materials', 'labor', 'services'));

-- ---------------------------------------------------------------------------------------------------------
-- 2. create_expense, new version (first version: 0008). The parameters changed, so the old function is
--    dropped and a new one created: two functions with the same name would be two ways to record an expense.
--    Unchanged from 0008: SECURITY INVOKER (RLS decides who may write), the expense and its expense.created
--    event are saved in ONE transaction through private.emit_event, and a repeated client_op_id creates
--    nothing and returns the original id (NFR-REL-01).
--    Changed: p_title and p_expense_type are required; p_payee is new; category and note are no longer
--    parameters (the design's quick expense has neither; the columns stay for later features).
-- ---------------------------------------------------------------------------------------------------------
drop function public.create_expense(uuid, numeric, uuid, uuid, uuid, text, date);

create function public.create_expense(
  p_project_id uuid,
  p_amount_lyd numeric,
  p_client_op_id uuid,
  p_title text,
  p_expense_type text,
  p_phase_id uuid default null,
  p_payee text default null,
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
  v_title text := nullif(btrim(p_title), '');
  v_payee text := nullif(btrim(p_payee), '');
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

  insert into public.expenses (project_id, amount_lyd, title, expense_type, phase_id, payee, paid_on, client_op_id)
  values (p_project_id, p_amount_lyd, v_title, p_expense_type, p_phase_id, v_payee, v_paid_on, p_client_op_id)
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
    'paid_on', v_paid_on
  ));

  return query select v_id, true;
end;
$$;

revoke all on function public.create_expense(uuid, numeric, uuid, text, text, uuid, text, date) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.create_expense(uuid, numeric, uuid, text, text, uuid, text, date) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.create_expense(uuid, numeric, uuid, text, text, uuid, text, date) to authenticated;
  end if;
end $$;

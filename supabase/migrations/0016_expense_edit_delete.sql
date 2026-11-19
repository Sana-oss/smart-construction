-- 0016: edit and delete an expense, and an audit row for every change (owner's decision of 19 Nov 2026, change
-- register: "delete with an audit log"; FR-SYS-03: every financial change is logged with who, when and what).
--
-- Since 0001, the policy write_expenses already lets a writer of the project UPDATE and DELETE expenses directly,
-- with nothing recorded. This migration does not add a new way to write; it makes every existing way safe:
--
-- 1. private.expenses_guard (BEFORE UPDATE): an edit keeps the rules of create_expense (0015) for what it changes
--    (a name, a type, a date not after today in Libya, a phase of THIS project), and never changes what identifies
--    the expense: its project, client_op_id, creation time and receipt photo. Only CHANGED fields are checked, so
--    old rows (no name before 0009) and "on delete set null" from a deleted phase still work.
-- 2. private.expenses_audit (AFTER UPDATE OR DELETE): writes the audit row (all old values, and the new ones) and
--    the event (expense.updated / expense.deleted) in the same transaction as the change, through the two writers
--    of 0006 and 0007. Being a trigger, it cannot be skipped by any client: the database records it, not the app.
--    When the project itself is being deleted (cascade), nothing is written: its audit rows and events go with it.
-- 3. No new public function, so nothing to revoke from anon.

-- 1. -------------------------------------------------------------------------------------------------------------
create function private.expenses_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id
     or new.client_op_id is distinct from old.client_op_id
     or new.created_at is distinct from old.created_at
     or new.receipt_path is distinct from old.receipt_path then
    raise exception 'an expense keeps its project, client_op_id, creation time and receipt' using errcode = 'check_violation';
  end if;

  if new.title is distinct from old.title and nullif(btrim(new.title), '') is null then
    raise exception 'title is required' using errcode = 'check_violation';
  end if;
  if new.expense_type is distinct from old.expense_type and new.expense_type is null then
    raise exception 'expense_type is required' using errcode = 'check_violation';
  end if;
  -- An expense is money already paid: its date cannot be after today in Libya.
  if new.paid_on is distinct from old.paid_on and new.paid_on > private.today_tripoli() then
    raise exception 'paid_on cannot be in the future' using errcode = 'check_violation';
  end if;
  -- The foreign key only proves that the phase EXISTS; it must also belong to this project. Looked up as the
  -- caller (security invoker), so a phase the caller cannot see is refused too.
  if new.phase_id is distinct from old.phase_id and new.phase_id is not null and not exists (
    select 1 from public.phases ph where ph.id = new.phase_id and ph.project_id = new.project_id
  ) then
    raise exception 'phase does not belong to this project' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.expenses_guard() from public;

create trigger expenses_guard
  before update on public.expenses
  for each row execute function private.expenses_guard();

-- 2. -------------------------------------------------------------------------------------------------------------
create function private.expenses_audit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- The project is being deleted (cascade): its audit rows and events are deleted with it.
  if not exists (select 1 from public.projects p where p.id = old.project_id) then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    if old is not distinct from new then
      return null; -- saved without a change: nothing to record
    end if;
    perform private.log_audit(old.project_id, 'expenses', 'updated', jsonb_build_object(
      'expense_id', old.id, 'before', to_jsonb(old), 'after', to_jsonb(new)
    ));
    -- Amounts travel as text, so no consumer reads them as a float.
    perform private.emit_event(old.project_id, 'expense.updated', jsonb_build_object(
      'expense_id', old.id,
      'amount_lyd', new.amount_lyd::text,
      'previous_amount_lyd', old.amount_lyd::text,
      'expense_type', new.expense_type,
      'phase_id', new.phase_id,
      'paid_on', new.paid_on
    ));
  else
    perform private.log_audit(old.project_id, 'expenses', 'deleted', jsonb_build_object(
      'expense_id', old.id, 'before', to_jsonb(old)
    ));
    perform private.emit_event(old.project_id, 'expense.deleted', jsonb_build_object(
      'expense_id', old.id,
      'amount_lyd', old.amount_lyd::text,
      'expense_type', old.expense_type,
      'phase_id', old.phase_id,
      'paid_on', old.paid_on,
      'had_receipt', old.receipt_path is not null
    ));
  end if;
  return null;
end;
$$;

revoke all on function private.expenses_audit() from public;

create trigger expenses_audit
  after update or delete on public.expenses
  for each row execute function private.expenses_audit();

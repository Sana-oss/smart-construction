-- 0017: obligations and expected income get the fields of design S16.2 «إضافة حركة متوقعة», and every change or
-- deletion is audited (FR-FIN-06, FR-FIN-07, FR-SYS-03; slice 1 of 3.7, owner's decision of 19 Nov 2026).
--
-- The tables exist since 0002, with RLS (is_member reads, can_write writes) and no screen, so they are empty.
--
-- 1. title («الوصف»): required, 2–80 characters, like the expense name. creditor / source («المصدر أو المستفيد»)
--    get the same length rule. The TypeScript domain (finance/domain/cashflow.ts) checks the same first.
-- 2. private.cashflow_guard (BEFORE UPDATE): a row never moves to another project.
-- 3. private.cashflow_audit (AFTER UPDATE OR DELETE): one audit row with the old (and new) values, written by the
--    database itself, so no client can skip it (the lesson of 0016). Saving without a change records nothing; a
--    project being deleted (cascade) writes nothing. No event yet: nothing consumes one (3.7 reads the tables).
-- 4. No new public function, so nothing to revoke from anon.

-- 1. -------------------------------------------------------------------------------------------------------------
alter table public.obligations
  add column title text not null check (char_length(btrim(title)) between 2 and 80),
  add constraint obligations_creditor_length check (char_length(btrim(creditor)) between 2 and 80);

alter table public.expected_income
  add column title text not null check (char_length(btrim(title)) between 2 and 80),
  add constraint expected_income_source_length check (char_length(btrim(source)) between 2 and 80);

-- 2. -------------------------------------------------------------------------------------------------------------
create function private.cashflow_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id then
    raise exception 'a row never moves to another project' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.cashflow_guard() from public;

create trigger obligations_guard before update on public.obligations
  for each row execute function private.cashflow_guard();
create trigger expected_income_guard before update on public.expected_income
  for each row execute function private.cashflow_guard();

-- 3. -------------------------------------------------------------------------------------------------------------
create function private.cashflow_audit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- The project is being deleted (cascade): its audit rows go with it.
  if not exists (select 1 from public.projects p where p.id = old.project_id) then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    if old is not distinct from new then
      return null; -- saved without a change: nothing to record
    end if;
    perform private.log_audit(old.project_id, tg_table_name, 'updated', jsonb_build_object(
      'row_id', old.id, 'before', to_jsonb(old), 'after', to_jsonb(new)
    ));
  else
    perform private.log_audit(old.project_id, tg_table_name, 'deleted', jsonb_build_object(
      'row_id', old.id, 'before', to_jsonb(old)
    ));
  end if;
  return null;
end;
$$;

revoke all on function private.cashflow_audit() from public;

create trigger obligations_audit after update or delete on public.obligations
  for each row execute function private.cashflow_audit();
create trigger expected_income_audit after update or delete on public.expected_income
  for each row execute function private.cashflow_audit();

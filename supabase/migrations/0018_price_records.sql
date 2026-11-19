-- 0018: the owner's price log and supplier quotes get what design S24 and FR-MAT-08 need (slice 2 of 3.7, owner's
-- decision of 19 Nov 2026). The table exists since 0001 (with RLS: members read, writers write; transport cost since
-- 0002) and has no screen, so it is empty.
--
-- 1. created_at: orders two prices of the same day (S24.2 history, newest first).
-- 2. Length rules, the same as the TypeScript domain (materials/domain/price.ts): material 2–60, unit 1–20,
--    supplier up to 80, note up to 200. A quote cannot expire before the day it was given.
-- 3. private.price_records_guard (BEFORE INSERT OR UPDATE): a price or a quote is something that already happened, so
--    its date is never after today in Libya (a CHECK cannot use "today"); and a row never moves to another project.
-- 4. Audit: every change and deletion, with the old values, by private.cashflow_audit (0017). That function only uses
--    tg_table_name, id and project_id, so it serves any project table; it is reused rather than copied.
-- 5. No new public function, so nothing to revoke from anon.

-- 1. -------------------------------------------------------------------------------------------------------------
alter table public.price_records
  add column created_at timestamptz not null default now();

-- 2. -------------------------------------------------------------------------------------------------------------
alter table public.price_records
  add constraint price_records_material_length check (char_length(btrim(material)) between 2 and 60),
  add constraint price_records_unit_length check (char_length(btrim(unit)) between 1 and 20),
  add constraint price_records_supplier_length check (supplier is null or char_length(btrim(supplier)) between 1 and 80),
  add constraint price_records_note_length check (note is null or char_length(note) <= 200),
  add constraint price_records_expiry_order check (quote_expires_on is null or quote_expires_on >= recorded_on);

-- 3. -------------------------------------------------------------------------------------------------------------
create function private.price_records_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.project_id is distinct from old.project_id then
    raise exception 'a price never moves to another project' using errcode = 'check_violation';
  end if;
  if (tg_op = 'INSERT' or new.recorded_on is distinct from old.recorded_on) and new.recorded_on > private.today_tripoli() then
    raise exception 'a price date cannot be in the future' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.price_records_guard() from public;

create trigger price_records_guard before insert or update on public.price_records
  for each row execute function private.price_records_guard();

-- 4. -------------------------------------------------------------------------------------------------------------
create trigger price_records_audit after update or delete on public.price_records
  for each row execute function private.cashflow_audit();

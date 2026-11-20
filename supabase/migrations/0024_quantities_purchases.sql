-- 0024: the quantity table and purchases (3.3 slice 2 / 3.9; FR-MAT-01, FR-MAT-02, FR-MAT-03, FR-FIN-03; UC-09, UC-10;
-- design S20.1, S20.2, S21.1; owner's decisions of 20 Nov 2026, change register).
--
-- quantity_items and purchases exist since 0001 (materials' tables; RLS: members read, writers write) and are empty.
--
-- 1. quantity_items gets the rules the screen relies on: text lengths, a timestamp, and no duplicate (material, unit,
--    phase) even when the phase is empty (the 0001 unique constraint lets NULL phases repeat).
-- 2. private.quantity_items_guard: the phase belongs to this project; the line never moves; updated_at. A line that has
--    purchases cannot be deleted (the 0001 cascade would silently drop them).
-- 3. purchases gets created_at and a supplier length; private.purchases_guard: the line belongs to this project; the
--    date is not in the future; the row never moves and never changes line; expense_ref is set once and never changed
--    (it is the weak reference to finance's expense, architecture §4.3).
-- 4. public.record_purchase: the purchase and its purchase.recorded event in ONE transaction (architecture §6), with
--    the same idempotency as create_expense (client_op_id). When the owner confirmed buying past the allowed quantity
--    (FR-MAT-03, decision D2: warn, confirm, log), the confirmation goes to the audit log.
--    Finance turns the event into ONE expense (FR-FIN-03). Until the event worker exists (3.21, it needs the service
--    role), the app hands the event to finance right after this call; finance's handler is idempotent (the expense's
--    client_op_id is the purchase id), so a retry or the future worker never makes a second expense.
-- 5. Audit: every change and deletion of a line or a purchase, with the old values (private.cashflow_audit, 0017).
-- Nothing is computed here except the event's copy of the inputs: totals and the allowed quantity are the TypeScript
-- domain's (materials/domain/quantities.ts).

-- 1. -------------------------------------------------------------------------------------------------------------
alter table public.quantity_items
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now(),
  add constraint quantity_items_material_len check (char_length(btrim(material)) between 2 and 60),
  add constraint quantity_items_unit_len check (char_length(btrim(unit)) between 1 and 20),
  add constraint quantity_items_source_len check (source is null or char_length(source) <= 80),
  add constraint quantity_items_verified_by_len check (verified_by is null or char_length(verified_by) <= 80);

create unique index quantity_items_line_unique on public.quantity_items
  (project_id, material, unit, coalesce(phase_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 2. -------------------------------------------------------------------------------------------------------------
create function private.quantity_items_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.purchases p where p.quantity_item_id = old.id)
       and exists (select 1 from public.projects pr where pr.id = old.project_id) then
      raise exception 'a line with purchases cannot be deleted' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and new.project_id is distinct from old.project_id then
    raise exception 'a quantity line never moves to another project' using errcode = 'check_violation';
  end if;
  if new.phase_id is not null and not exists (
    select 1 from public.phases ph where ph.id = new.phase_id and ph.project_id = new.project_id
  ) then
    raise exception 'the phase does not belong to this project' using errcode = 'foreign_key_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.quantity_items_guard() from public;

create trigger quantity_items_guard before insert or update or delete on public.quantity_items
  for each row execute function private.quantity_items_guard();

-- 3. -------------------------------------------------------------------------------------------------------------
alter table public.purchases
  add column created_at timestamptz not null default now(),
  add constraint purchases_supplier_len check (supplier is null or char_length(supplier) <= 80);

create index purchases_item_idx on public.purchases (quantity_item_id);

create function private.purchases_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.project_id is distinct from old.project_id or new.quantity_item_id is distinct from old.quantity_item_id then
      raise exception 'a purchase never moves' using errcode = 'check_violation';
    end if;
    if old.expense_ref is not null and new.expense_ref is distinct from old.expense_ref then
      raise exception 'the expense of a purchase is set once' using errcode = 'check_violation';
    end if;
  end if;
  if not exists (
    select 1 from public.quantity_items q where q.id = new.quantity_item_id and q.project_id = new.project_id
  ) then
    raise exception 'the quantity line does not belong to this project' using errcode = 'foreign_key_violation';
  end if;
  if (tg_op = 'INSERT' or new.purchased_on is distinct from old.purchased_on) and new.purchased_on > private.today_tripoli() then
    raise exception 'a purchase date cannot be in the future' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.purchases_guard() from public;

create trigger purchases_guard before insert or update on public.purchases
  for each row execute function private.purchases_guard();

-- 4. -------------------------------------------------------------------------------------------------------------
create function public.record_purchase(
  p_project_id uuid,
  p_quantity_item_id uuid,
  p_qty numeric,
  p_unit_price_lyd numeric,
  p_client_op_id uuid,
  p_supplier text default null,
  p_purchased_on date default null,
  p_over_allowance_confirmed boolean default false
)
returns table (purchase_id uuid, created boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_item public.quantity_items%rowtype;
  v_purchased_on date := coalesce(p_purchased_on, private.today_tripoli());
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  if p_client_op_id is null then
    raise exception 'client_op_id is required' using errcode = 'check_violation';
  end if;
  -- A purchase costs money (an expense must be positive).
  if p_unit_price_lyd is null or p_unit_price_lyd <= 0 then
    raise exception 'unit price must be positive' using errcode = 'check_violation';
  end if;

  -- RLS applies (security invoker): a line of a project the caller cannot see is not found.
  select * into v_item from public.quantity_items q where q.id = p_quantity_item_id and q.project_id = p_project_id;
  if not found then
    raise exception 'the quantity line does not belong to this project' using errcode = 'foreign_key_violation';
  end if;

  insert into public.purchases (project_id, quantity_item_id, qty, unit_price_lyd, supplier, purchased_on, client_op_id)
  values (p_project_id, p_quantity_item_id, p_qty, p_unit_price_lyd, nullif(btrim(p_supplier), ''), v_purchased_on, p_client_op_id)
  on conflict (project_id, client_op_id) where client_op_id is not null do nothing
  returning id into v_id;

  if v_id is null then
    -- The same request was already stored: give back the original purchase and emit nothing.
    select p.id into v_id from public.purchases p where p.project_id = p_project_id and p.client_op_id = p_client_op_id;
    return query select v_id, false;
    return;
  end if;

  -- Same transaction as the insert. Numbers travel as text, so no consumer reads them as floats.
  perform private.emit_event(p_project_id, 'purchase.recorded', jsonb_build_object(
    'purchase_id', v_id,
    'quantity_item_id', v_item.id,
    'material', v_item.material,
    'unit', v_item.unit,
    'phase_id', v_item.phase_id,
    'qty', p_qty::text,
    'unit_price_lyd', p_unit_price_lyd::text,
    'supplier', nullif(btrim(p_supplier), ''),
    'purchased_on', v_purchased_on
  ));

  if p_over_allowance_confirmed then
    perform private.log_audit(p_project_id, 'purchases', 'over_allowance_confirmed', jsonb_build_object(
      'row_id', v_id, 'quantity_item_id', v_item.id, 'material', v_item.material, 'qty', p_qty::text
    ));
  end if;

  return query select v_id, true;
end;
$$;

revoke all on function public.record_purchase(uuid, uuid, numeric, numeric, uuid, text, date, boolean) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.record_purchase(uuid, uuid, numeric, numeric, uuid, text, date, boolean) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.record_purchase(uuid, uuid, numeric, numeric, uuid, text, date, boolean) to authenticated;
  end if;
end $$;

-- 5. -------------------------------------------------------------------------------------------------------------
create trigger quantity_items_audit after update or delete on public.quantity_items
  for each row execute function private.cashflow_audit();
create trigger purchases_audit after update or delete on public.purchases
  for each row execute function private.cashflow_audit();

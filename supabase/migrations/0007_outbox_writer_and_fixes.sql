-- Migration 0007 (shared + projects + dashboard views): four gaps found in the code review of 16 Nov 2026,
-- closed BEFORE the expense feature is built on top of them (FR-SYS-04, FR-PRJ-01, FR-DSH-01, data rules).
-- Append-only: 0001–0006 are never edited.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Today's date in Libya.
--    current_date is the date in the database's time zone, which is UTC on Supabase. Libya is UTC+2, so between
--    00:00 and 02:00 Tripoli time current_date is still "yesterday": an expense recorded at 01:00 got the wrong
--    paid_on. CLAUDE.md: calendar dates are shown in Africa/Tripoli. 0006 already did this for available_as_of.
--    One helper, in "private" (not exposed as an API endpoint, like the helpers of 0004).
-- ---------------------------------------------------------------------------------------------------------
create function private.today_tripoli()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Africa/Tripoli')::date $$;

revoke all on function private.today_tripoli() from public;
do $$ begin
  -- Column defaults and views run with the caller's privileges, so the API roles must be able to execute it.
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function private.today_tripoli() to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function private.today_tripoli() to authenticated;
  end if;
  -- weekly_report_v is read by reporting_reader (n8n); the view itself runs as its owner, so no grant is needed.
end $$;

alter table public.exchange_rates alter column rate_date    set default private.today_tripoli();
alter table public.expenses       alter column paid_on      set default private.today_tripoli();
alter table public.purchases      alter column purchased_on set default private.today_tripoli();
alter table public.price_records  alter column recorded_on  set default private.today_tripoli();
alter table public.photos         alter column taken_on     set default private.today_tripoli();

-- Same columns as in 0001, only "today" changes. create or replace keeps the views' owners, options and grants.
create or replace view public.expiring_quotes with (security_invoker = true) as
select * from public.price_records
where is_quote and quote_expires_on between private.today_tripoli() and private.today_tripoli() + 7;

create or replace view public.weekly_report_v as
select pr.id as project_id, pr.name, pr.report_email,
       (select count(*) from public.expenses e where e.project_id = pr.id
          and e.paid_on >= private.today_tripoli() - 7) as expenses_this_week,
       (select count(*) from public.phases ph where ph.project_id = pr.id
          and ph.status = 'closing') as phases_pending_closing,
       (select count(*) from public.quantity_progress qp where qp.project_id = pr.id and qp.is_over) as materials_over_allowance,
       (select count(*) from public.expiring_quotes eq where eq.project_id = pr.id) as quotes_expiring
from public.projects pr
where pr.weekly_report_enabled and pr.status = 'active';

-- ---------------------------------------------------------------------------------------------------------
-- 2. Outbox writer (architecture §6: the data and its event are written in the SAME transaction).
--    Until now nothing could write outbox_events: it has RLS with no policies, so a signed-in user's transaction
--    could not insert the event next to the expense. Same solution as the audit log in 0006: ONE writer,
--    private.emit_event, which only writes for a project the caller may write.
--    How it is used: a public SECURITY INVOKER function (for example the future create_expense) inserts the data
--    and calls private.emit_event in the same transaction, exactly like create_first_project calls log_audit.
--    Clients still cannot insert, read, change or delete events directly (no policies); the worker reads them
--    with the service role.
--    project_id: every event belongs to a project (DomainEvent.projectId in src/shared-kernel/events.ts). The
--    table is empty (it never had a writer), so NOT NULL is safe. Closes review note 7 of 12 Nov.
-- ---------------------------------------------------------------------------------------------------------
alter table public.outbox_events
  add column project_id uuid not null references public.projects(id) on delete cascade,
  -- Shape only ("expense.created"). The LIST of event types lives in one place: src/shared-kernel/events.ts.
  add constraint outbox_events_type_shape check (event_type ~ '^[a-z_]+\.[a-z_]+$');

-- The worker asks for "events not processed yet, oldest first".
create index outbox_events_pending on public.outbox_events (created_at) where processed_at is null;

create function private.emit_event(p_project_id uuid, p_event_type text, p_payload jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not private.can_write(p_project_id) then
    raise exception 'not allowed to emit events for this project' using errcode = 'insufficient_privilege';
  end if;
  insert into public.outbox_events (project_id, event_type, payload)
  values (p_project_id, p_event_type, coalesce(p_payload, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function private.emit_event(uuid, text, jsonb) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function private.emit_event(uuid, text, jsonb) to authenticated;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- 3. One project per owner, enforced by the database (decision 10 of 14 Nov: "one project per owner for now").
--    create_first_project (0006) checks first and inserts after, so two requests at the same moment could both
--    pass the check; and the write_projects policy lets a client insert into projects directly, without the
--    function. A unique index closes both. The app already maps this error (23505) to "already has a project".
--    When several projects per owner are allowed, a new migration drops this index.
-- ---------------------------------------------------------------------------------------------------------
create unique index projects_one_per_owner on public.projects (owner_id);

-- ---------------------------------------------------------------------------------------------------------
-- 4. budget_summary shows RAW numbers only (review note 2 of 12 Nov, rule R5).
--    Before: spent_lyd ignored spent_before_lyd (added in 0006), so the view and the dashboard disagreed about
--    "spent"; and contingency_lyd repeated a calculation that belongs to the finance domain (budgetSummary).
--    Now the view only adds up rows (which the database must do: an API request returns at most 1,000 rows) and
--    hands over the inputs. Spent, remaining and contingency are computed in ONE place, the TypeScript domain.
--    Dropped and recreated because columns are removed and renamed. Nothing else in the database reads this view.
-- ---------------------------------------------------------------------------------------------------------
drop view public.budget_summary;
create view public.budget_summary with (security_invoker = true) as
select pr.id as project_id,
       pr.total_budget_lyd,
       pr.contingency_pct,
       pr.spent_before_lyd,
       coalesce((select sum(e.amount_lyd) from public.expenses e where e.project_id = pr.id), 0) as recorded_expenses_lyd
from public.projects pr;

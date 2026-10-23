-- Smart Residential Construction Manager — schema v2
-- Matches analysis_and_design.md (ERD v2) and system_architecture.md section 13.
-- Money: numeric(14,3) in LYD. Modules own their tables (see architecture §4.3).

-- ============ identity & membership (3.11) ============
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  city text,
  project_type text not null default 'new' check (project_type in ('new','add_floor')),
  status text not null default 'active' check (status in ('active','archived')),
  planned_start date,
  planned_end date,
  total_budget_lyd numeric(14,3) not null default 0 check (total_budget_lyd >= 0),
  contingency_pct numeric(5,2) not null default 10 check (contingency_pct between 0 and 100),
  weekly_report_enabled boolean not null default false,
  report_email text,
  created_at timestamptz not null default now()
);
create index on projects(owner_id);

create table project_members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('editor','viewer')),
  primary key (project_id, user_id)
);

create table shared_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  token_hash text not null unique,          -- only a hash of the link token is stored
  expires_at timestamptz not null,
  revoked boolean not null default false,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

-- Access helpers. security definer so policies can check membership without recursion.
create function is_member(pid uuid) returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from projects p where p.id = pid and p.owner_id = auth.uid())
      or exists (select 1 from project_members m where m.project_id = pid and m.user_id = auth.uid());
$$;

create function can_write(pid uuid) returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from projects p where p.id = pid and p.owner_id = auth.uid())
      or exists (select 1 from project_members m where m.project_id = pid and m.user_id = auth.uid() and m.role = 'editor');
$$;

-- ============ phases & tasks (3.1, 3.23) ============
create table phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  position int not null,
  planned_start date, planned_end date,
  actual_start date, actual_end date,
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','closing','done','blocked')),
  unique (project_id, position)
);

create table phase_closing_checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  phase_id uuid not null references phases(id) on delete cascade,
  result text not null check (result in ('complete','incomplete_confirmed')),
  confirmed_by_owner boolean not null default false,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  phase_id uuid references phases(id) on delete set null,
  title text not null,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  due_date date,
  done_at timestamptz
);

-- ============ finance (3.2, 3.16, 3.18, 3.19) ============
create table budget_categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  planned_lyd numeric(14,3) not null default 0 check (planned_lyd >= 0),
  is_contingency boolean not null default false,
  unique (project_id, name)
);

create table exchange_rates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  currency text not null check (currency <> 'LYD'),
  lyd_per_unit numeric(12,4) not null check (lyd_per_unit > 0),
  rate_date date not null default current_date,
  note text
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  category_id uuid references budget_categories(id) on delete set null,
  phase_id uuid references phases(id) on delete set null,
  amount_lyd numeric(14,3) not null check (amount_lyd > 0),
  original_amount numeric(14,3),
  original_currency text,
  rate_lyd_per_unit numeric(12,4),
  paid_on date not null default current_date,
  note text,
  receipt_path text,
  client_op_id uuid,                         -- offline idempotency (3.20)
  created_at timestamptz not null default now(),
  check ((original_currency is null) = (original_amount is null))
);
create index on expenses(project_id, paid_on);
create unique index expenses_client_op on expenses(project_id, client_op_id) where client_op_id is not null;

create table contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  contractor text not null,
  value_lyd numeric(14,3) not null check (value_lyd >= 0),
  has_cleanup_clause boolean not null default false,   -- who removes debris (3.23-ب)
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  contract_id uuid not null references contracts(id) on delete cascade,
  phase_id uuid references phases(id) on delete set null,
  amount_lyd numeric(14,3) not null check (amount_lyd >= 0),
  withheld boolean not null default false,              -- retention until closing
  paid_on date
);

create table change_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  contract_id uuid not null references contracts(id) on delete cascade,
  cost_lyd numeric(14,3) not null,
  status text not null default 'proposed' check (status in ('proposed','approved','rejected')),
  created_at timestamptz not null default now()
);

-- ============ materials (3.3, 3.9, 3.10, 3.23) ============
create table quantity_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  phase_id uuid references phases(id) on delete set null,
  material text not null,
  unit text not null,
  planned_qty numeric(14,3) not null check (planned_qty > 0),
  waste_pct numeric(5,2) not null default 0 check (waste_pct between 0 and 100),  -- reviewed per D10
  source text,
  verified_by text,
  unique (project_id, material, unit, phase_id)
);

-- No FK to expenses: link is an event (purchase.recorded), per architecture §4.3.
create table purchases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  quantity_item_id uuid not null references quantity_items(id) on delete cascade,
  expense_ref uuid,                          -- weak reference, not a foreign key
  qty numeric(14,3) not null check (qty > 0),
  unit_price_lyd numeric(14,3) not null check (unit_price_lyd >= 0),
  supplier text,
  purchased_on date not null default current_date,
  client_op_id uuid
);
create unique index purchases_client_op on purchases(project_id, client_op_id) where client_op_id is not null;

create table stock_counts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  quantity_item_id uuid not null references quantity_items(id) on delete cascade,
  phase_id uuid references phases(id) on delete set null,
  remaining_qty numeric(14,3) not null check (remaining_qty >= 0),
  counted_at timestamptz not null default now(),
  client_op_id uuid
);

create table price_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  material text not null,
  unit text not null,
  supplier text,
  price_lyd numeric(14,3) not null check (price_lyd >= 0),
  recorded_on date not null default current_date,
  is_quote boolean not null default false,
  quote_expires_on date,
  note text,
  check (quote_expires_on is null or is_quote)
);
create index on price_records(project_id, material, recorded_on);

-- ============ documents & photos (3.4, 3.8) ============
create table photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  phase_id uuid references phases(id) on delete set null,
  angle_label text,
  storage_path text not null,
  taken_on date not null default current_date,
  note text
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  kind text not null,                        -- permit, contract, structural_assessment, ...
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- ============ quality engine (3.12, 3.13, 3.14, 3.17) ============
create table checklists (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  phase_id uuid references phases(id) on delete set null,
  template_id uuid,                          -- references trade_templates, weak (cross-module)
  kb_entry_id uuid,                          -- weak reference to knowledge base
  kind text not null check (kind in ('hold_point','concrete','safe_stop','closing','trade')),
  status text not null default 'open' check (status in ('open','completed')),
  completed_at timestamptz
);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references checklists(id) on delete cascade,
  text text not null,
  result text check (result in ('ok','issue','na')),
  requires_photo boolean not null default false
);

create table issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  checklist_id uuid references checklists(id) on delete set null,
  kind text not null default 'defect' check (kind in ('defect','waste','cleanliness','note')),
  severity text not null default 'minor' check (severity in ('minor','major','critical')),
  status text not null default 'open' check (status in ('open','resolved')),
  location text,
  responsible text,
  description text,
  created_at timestamptz not null default now()
);

-- ============ trades & knowledge (3.22, 3.6) ============
create table trade_templates (
  id uuid primary key default gen_random_uuid(),
  trade text not null unique,                -- plumbing, electrical, plaster, gypsum, flooring, painting
  content jsonb not null,
  status text not null default 'unreviewed' check (status in ('unreviewed','approved')),
  reviewed_by text,
  reviewed_on date,
  check ((status = 'approved') = (reviewed_by is not null and reviewed_on is not null))
);

create table kb_entries (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  content text not null,
  status text not null default 'draft' check (status in ('draft','approved')),
  reviewed_by text,
  reviewed_on date,
  check ((status = 'approved') = (reviewed_by is not null and reviewed_on is not null))
);

-- ============ decisions (3.7) ============
create table decision_scenarios (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  choice text not null check (choice in ('continue','pause')),
  result_lyd numeric(14,3),
  created_at timestamptz not null default now()
);

-- ============ notifications (3.21) ============
create table notification_settings (
  project_id uuid primary key references projects(id) on delete cascade,
  enabled boolean not null default false,
  weekday text not null default 'fri',
  channel text not null default 'email' check (channel in ('email','telegram'))
);

create table notification_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  sent_at timestamptz not null default now(),
  status text not null check (status in ('sent','failed'))
);

-- ============ shared-kernel tables ============
create table outbox_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  table_name text not null,
  action text not null,
  at timestamptz not null default now()
);

create table feature_flags (
  module text primary key,
  enabled boolean not null default true
);

-- ============ views ============
create view quantity_progress with (security_invoker = true) as
select q.id, q.project_id, q.material, q.unit, q.planned_qty,
       coalesce(sum(p.qty),0) as purchased_qty,
       q.planned_qty * (1 + q.waste_pct / 100) as allowed_qty,
       coalesce(sum(p.qty),0) > q.planned_qty * (1 + q.waste_pct / 100) as is_over
from quantity_items q left join purchases p on p.quantity_item_id = q.id
group by q.id;

create view budget_summary with (security_invoker = true) as
select pr.id as project_id, pr.total_budget_lyd,
       coalesce((select sum(amount_lyd) from expenses e where e.project_id = pr.id),0) as spent_lyd,
       pr.total_budget_lyd * pr.contingency_pct / 100 as contingency_lyd
from projects pr;

create view expiring_quotes with (security_invoker = true) as
select * from price_records
where is_quote and quote_expires_on between current_date and current_date + 7;

-- Weekly report source (3.21): only numbers, no logic in n8n.
-- Owner-privileged view on purpose: it exposes only aggregate counts, and only the
-- reporting_reader role may select from it (see grants at the end).
create view weekly_report_v as
select pr.id as project_id, pr.name, pr.report_email,
       (select count(*) from expenses e where e.project_id = pr.id
          and e.paid_on >= current_date - 7) as expenses_this_week,
       (select count(*) from phases ph where ph.project_id = pr.id
          and ph.status = 'closing') as phases_pending_closing,
       (select count(*) from quantity_progress qp where qp.project_id = pr.id and qp.is_over) as materials_over_allowance,
       (select count(*) from expiring_quotes eq where eq.project_id = pr.id) as quotes_expiring
from projects pr
where pr.weekly_report_enabled and pr.status = 'active';

-- ============ row-level security ============
alter table profiles enable row level security;
create policy own_profile on profiles for all using (id = auth.uid()) with check (id = auth.uid());

alter table projects enable row level security;
create policy read_projects on projects for select using (is_member(id));
create policy write_projects on projects for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table project_members enable row level security;
create policy owner_manages_members on project_members for all
  using (exists (select 1 from projects p where p.id = project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from projects p where p.id = project_id and p.owner_id = auth.uid()));

alter table shared_reports enable row level security;
create policy owner_reports on shared_reports for all
  using (exists (select 1 from projects p where p.id = project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from projects p where p.id = project_id and p.owner_id = auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['phases','tasks','budget_categories','exchange_rates','expenses',
    'contracts','payments','change_orders','quantity_items','purchases','stock_counts',
    'price_records','photos','documents','checklists','issues','decision_scenarios',
    'notification_settings','notification_log','phase_closing_checks'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy read_%1$s on %1$I for select using (is_member(project_id))', t);
    execute format('create policy write_%1$s on %1$I for all using (can_write(project_id)) with check (can_write(project_id))', t);
  end loop;
end $$;

-- checklist_items inherit access through their checklist
alter table checklist_items enable row level security;
create policy read_checklist_items on checklist_items for select
  using (exists (select 1 from checklists c where c.id = checklist_id and is_member(c.project_id)));
create policy write_checklist_items on checklist_items for all
  using (exists (select 1 from checklists c where c.id = checklist_id and can_write(c.project_id)))
  with check (exists (select 1 from checklists c where c.id = checklist_id and can_write(c.project_id)));

-- Shared-kernel and reference tables: no direct client access.
alter table outbox_events enable row level security;
alter table audit_log enable row level security;  -- no policies: service role only
alter table feature_flags enable row level security;
alter table trade_templates enable row level security;
alter table kb_entries enable row level security;
create policy read_templates on trade_templates for select using (status = 'approved' or auth.uid() is not null);
create policy read_kb on kb_entries for select using (status = 'approved' or auth.uid() is not null);
create policy read_flags on feature_flags for select using (auth.uid() is not null);
-- outbox_events: no policies, so only the service role (backend worker) can touch it.

-- reporting_reader: n8n gets SELECT on the weekly view only.
do $$ begin if not exists (select 1 from pg_roles where rolname='reporting_reader') then create role reporting_reader nologin; end if; end $$;
grant usage on schema public to reporting_reader;
do $$ begin
  -- Supabase defines anon/authenticated; plain PostgreSQL does not.
  revoke all on weekly_report_v from public;
  if exists (select 1 from pg_roles where rolname='anon') then revoke all on weekly_report_v from anon; end if;
  if exists (select 1 from pg_roles where rolname='authenticated') then revoke all on weekly_report_v from authenticated; end if;
end $$;
grant select on weekly_report_v to reporting_reader;

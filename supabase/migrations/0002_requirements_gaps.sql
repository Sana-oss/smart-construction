-- Migration 0002: closes the schema gaps found while writing requirements_specification.md (section 5).
-- Append-only: 0001 is never edited.

-- 1. Obligations and expected income (FR-FIN-06, FR-FIN-07, FR-DEC-01). Owned by: finance.
create table obligations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  creditor text not null,
  amount_lyd numeric(14,3) not null check (amount_lyd > 0),
  due_on date not null,
  paid boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);
create index on obligations(project_id, due_on);

create table expected_income (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  source text not null,
  amount_lyd numeric(14,3) not null check (amount_lyd > 0),
  expected_on date not null,
  received boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);
create index on expected_income(project_id, expected_on);

-- 2. Defect statuses: open, in_progress, closed (FR-QLT-06). Migrate old 'resolved' rows.
alter table issues drop constraint issues_status_check;
update issues set status = 'closed' where status = 'resolved';
alter table issues add constraint issues_status_check check (status in ('open','in_progress','closed'));

-- 3. Readiness checklists (FR-PRJ-05).
alter table checklists drop constraint checklists_kind_check;
alter table checklists add constraint checklists_kind_check
  check (kind in ('hold_point','concrete','safe_stop','closing','trade','readiness'));

-- 4. Structured concrete log (FR-QLT-04). Owned by: quality.
create table concrete_pours (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  phase_id uuid references phases(id) on delete set null,
  checklist_id uuid references checklists(id) on delete set null,
  poured_on date not null,
  location text not null,
  qty_m3 numeric(10,3) not null check (qty_m3 > 0),
  supplier text not null,
  cube_samples int not null default 0 check (cube_samples >= 0),
  note text,
  client_op_id uuid,
  created_at timestamptz not null default now()
);
create index on concrete_pours(project_id, poured_on);
create unique index concrete_pours_client_op on concrete_pours(project_id, client_op_id) where client_op_id is not null;

-- 5. Transport cost on price records and quotes (FR-MAT-08).
alter table price_records add column transport_cost_lyd numeric(14,3) check (transport_cost_lyd is null or transport_cost_lyd >= 0);

-- RLS for the new tables (same pattern as 0001).
do $$
declare t text;
begin
  foreach t in array array['obligations','expected_income','concrete_pours'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy read_%1$s on %1$I for select using (is_member(project_id))', t);
    execute format('create policy write_%1$s on %1$I for all using (can_write(project_id)) with check (can_write(project_id))', t);
  end loop;
end $$;

-- Migration 0006 (projects + shared audit): first-project wizard (FR-PRJ-01/02/03, FR-FIN-01).
-- Decisions of 14 Nov 2026 (docs/project_change_register.md). Append-only: 0001–0005 are never edited.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Project facts asked by the wizard (owned by the projects module).
--    spent_before_lyd: money spent before using the app. Kept on the project, NOT as an expense row, so the
--    projects module never writes finance's tables (rule R2) and it never counts as "spent this week".
--    available_now_lyd + available_as_of: a dated snapshot of the cash the owner has; it never changes by itself.
-- ---------------------------------------------------------------------------------------------------------
alter table public.projects
  add column building_area_m2 numeric(10,2) check (building_area_m2 is null or building_area_m2 > 0),
  add column spent_before_lyd numeric(14,3) not null default 0 check (spent_before_lyd >= 0),
  add column available_now_lyd numeric(14,3) check (available_now_lyd is null or available_now_lyd >= 0),
  add column available_as_of date,
  add constraint projects_available_has_date check ((available_now_lyd is null) = (available_as_of is null));

-- ---------------------------------------------------------------------------------------------------------
-- 2. Phase template: GLOBAL reference data (no project_id), same pattern as kb_entries and trade_templates.
--    This is the explicit exception to "every table has project_id" (CLAUDE.md). Engineering content: stored as
--    'unreviewed' until a named engineer approves it (reviewed_by, reviewed_on). Owners only read it.
--    Seed: the four phases of the teammate's design, screen S02.2 (not written from memory).
-- ---------------------------------------------------------------------------------------------------------
create table public.phase_templates (
  id uuid primary key default gen_random_uuid(),
  position int not null unique check (position > 0),
  name text not null,
  description text,
  status text not null default 'unreviewed' check (status in ('unreviewed', 'approved')),
  reviewed_by text,
  reviewed_on date,
  check ((status = 'approved') = (reviewed_by is not null and reviewed_on is not null))
);

alter table public.phase_templates enable row level security;
create policy read_phase_templates on public.phase_templates for select using (auth.uid() is not null);
-- No write policy: only migrations (and the engineer's approval, done by an admin) change it.

insert into public.phase_templates (position, name, description) values
  (1, 'الحفر والأساسات', 'أعمال التحضير والأساس'),
  (2, 'الهيكل الخرساني', 'أعمدة وأسقف'),
  (3, 'المباني والتأسيسات', 'مبانٍ وكهرباء وسباكة'),
  (4, 'التشطيب والتسليم', 'تشطيبات وفحص نهائي');

-- ---------------------------------------------------------------------------------------------------------
-- 3. Audit log writer (decision D2: every warning the owner confirms is logged).
--    audit_log (0001) had no way to be written. It gains project_id and detail, a read policy for project
--    members, and ONE writer: private.log_audit, which records the CALLER (auth.uid()) and only for a project
--    the caller may write. Clients still cannot insert into audit_log directly (no insert policy).
-- ---------------------------------------------------------------------------------------------------------
alter table public.audit_log
  add column project_id uuid references public.projects(id) on delete cascade,
  add column detail jsonb not null default '{}'::jsonb;
create index on public.audit_log (project_id, at);

create policy read_audit_log on public.audit_log for select
  using (project_id is not null and private.is_member(project_id));

create function private.log_audit(p_project_id uuid, p_table text, p_action text, p_detail jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not private.can_write(p_project_id) then
    raise exception 'not allowed to write the audit log of this project' using errcode = 'insufficient_privilege';
  end if;
  insert into public.audit_log (actor_id, project_id, table_name, action, detail)
  values (auth.uid(), p_project_id, p_table, p_action, coalesce(p_detail, '{}'::jsonb));
end;
$$;

revoke all on function private.log_audit(uuid, text, text, jsonb) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function private.log_audit(uuid, text, text, jsonb) to authenticated;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Create the first project in ONE transaction (decision 15).
--    SECURITY INVOKER: runs as the signed-in owner, so every insert goes through RLS (rule of migration 0004:
--    no callable security definer function in public). Validation and the phase plan are computed in the
--    TypeScript domain (rules R4/R5); this function only stores them, and the table constraints double-check.
--    p_phases: [{"position":1,"name":"...","status":"done"}, ...]
-- ---------------------------------------------------------------------------------------------------------
create function public.create_first_project(
  p_name text,
  p_city text,
  p_project_type text,
  p_building_area_m2 numeric,
  p_total_budget_lyd numeric,
  p_available_now_lyd numeric,
  p_spent_before_lyd numeric,
  p_contingency_pct numeric,
  p_phases jsonb,
  p_over_budget_confirmed boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_project uuid;
begin
  if v_owner is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  -- One project per owner for now (decision 10). RLS shows the caller only their own projects.
  if exists (select 1 from public.projects where owner_id = v_owner) then
    raise exception 'owner already has a project' using errcode = 'unique_violation';
  end if;
  if p_phases is null or jsonb_typeof(p_phases) <> 'array' or jsonb_array_length(p_phases) = 0 then
    raise exception 'phases are required' using errcode = 'check_violation';
  end if;

  insert into public.projects (owner_id, name, city, project_type, building_area_m2, total_budget_lyd,
                               contingency_pct, spent_before_lyd, available_now_lyd, available_as_of)
  values (v_owner, p_name, p_city, p_project_type, p_building_area_m2, p_total_budget_lyd,
          p_contingency_pct, p_spent_before_lyd, p_available_now_lyd,
          (now() at time zone 'Africa/Tripoli')::date)
  returning id into v_project;

  insert into public.phases (project_id, position, name, status)
  select v_project, (p ->> 'position')::int, p ->> 'name', p ->> 'status'
  from jsonb_array_elements(p_phases) as p;

  -- Decision D2: spending above the budget is allowed after an explicit confirmation, and the confirmation is logged.
  if p_over_budget_confirmed then
    perform private.log_audit(v_project, 'projects', 'over_budget_confirmed',
      jsonb_build_object('total_budget_lyd', p_total_budget_lyd, 'spent_before_lyd', p_spent_before_lyd));
  end if;

  return v_project;
end;
$$;

revoke all on function public.create_first_project(text, text, text, numeric, numeric, numeric, numeric, numeric, jsonb, boolean) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.create_first_project(text, text, text, numeric, numeric, numeric, numeric, numeric, jsonb, boolean) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.create_first_project(text, text, text, numeric, numeric, numeric, numeric, numeric, jsonb, boolean) to authenticated;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- 5. Feature flags for the two features built on internal analysis (CLAUDE.md, review note 1).
-- ---------------------------------------------------------------------------------------------------------
insert into public.feature_flags (module, enabled) values ('offline', true), ('handover', true)
on conflict (module) do nothing;

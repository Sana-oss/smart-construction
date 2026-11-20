-- 0023: the rebar calculator's coefficient, kept as reviewed DATA, not code (3.3, FR-MAT-04; design S22; owner's
-- decision of 20 Nov 2026, change register).
--
-- CLAUDE.md: an engineering number is never written into code from memory; it is data with status 'unreviewed' until a
-- named engineer approves it (reviewed_by, reviewed_on). The rebar weight per metre is d² / divisor (kg/m, d in mm).
--
-- 1. public.calc_coefficients: GLOBAL reference data (no project_id), the same pattern and the same stated exception as
--    phase_templates (0006), kb_entries and trade_templates (0001). Signed-in users only read it; there is no write
--    policy, so only migrations (and the engineer's approval, applied by an admin) change it.
-- 2. Seed: ONE row, the divisor that reproduces the teammate's design S22.2 (16 mm × 12 m → 18.96 kg per bar:
--    16² / 162 × 12 = 18.96). Its source says so. It stays 'unreviewed', and the screen says so, until the engineer
--    approves it or replaces it (the engineering review file, section C).
-- 3. Nothing is computed here: the formulas are the TypeScript domain's (materials/domain/calculators.ts).
--    No new function, so nothing to revoke from anon.

-- 1. -------------------------------------------------------------------------------------------------------------
create table public.calc_coefficients (
  key text primary key check (key in ('rebar_kg_per_m_divisor')),
  value numeric(14,6) not null check (value > 0),
  unit text not null,
  source text not null check (char_length(btrim(source)) > 0),
  status text not null default 'unreviewed' check (status in ('unreviewed', 'approved')),
  reviewed_by text,
  reviewed_on date,
  check ((status = 'approved') = (reviewed_by is not null and reviewed_on is not null))
);

alter table public.calc_coefficients enable row level security;
create policy read_calc_coefficients on public.calc_coefficients for select using (auth.uid() is not null);
-- Belt and braces: the API roles never write it, even if a write policy were added by mistake.
revoke insert, update, delete, truncate on public.calc_coefficients from anon, authenticated;

-- 2. -------------------------------------------------------------------------------------------------------------
insert into public.calc_coefficients (key, value, unit, source) values
  ('rebar_kg_per_m_divisor', 162, 'مم² لكل (كجم/م)',
   'مستنتج من مثال تصميم الزميل S22.2 (قطر 16 مم وطول 12 م = 18.96 كجم)، وينتظر اعتماد المهندس');

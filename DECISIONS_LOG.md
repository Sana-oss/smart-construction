# DECISIONS_LOG.md — decisions, constraints, rejected approaches

Condensed from `CLAUDE.md`, `docs/graduation_project_master_reference.md` (§8, §16.3, §17) and
`docs/project_change_register.md` (the full dated record — consult it for detail). Do not change any of these silently;
record every change in the change register.

## Hard rules (CLAUDE.md)
- Modular monolith; import only a module's `index.ts`; levels L0→L3; **L2 modules never import each other** (compose in
  `src/app`); domain is pure; **the UI and n8n compute nothing** (rule R5); each module touches only its own tables.
- Money is never a JS number: `@/shared-kernel` Decimal, 3 places, LYD; DB `numeric(14,3)`; amounts travel as text.
- Every table: RLS with `is_member`/`can_write` + an RLS test proving a stranger cannot read/write.
- Migrations append-only; ask the owner before applying each to staging; staging only, never production.
- No secrets in code; service-role key server-only and **not used** by the app; never commit `.env*` (except
  `.env.example`), `.claude/`, `AGENTS.md`.
- Arabic RTL, logical CSS properties, strings in message files; mobile first; quick expense stays at 3 answers.
- **Engineering numbers are never invented** (cover, waste %, pressure, curing days, tolerances, checklist items): data
  with `status='unreviewed'` until a named engineer approves (`reviewed_by`, `reviewed_on`). The system documents and
  warns, never certifies.
- **Decision D2: warn, never block.** Risky actions show what is missing, require an explicit owner confirmation, and log it.
- No callable `SECURITY DEFINER` function in `public` (0004/0006); RPCs are SECURITY INVOKER with anon revoked.

## Explicitly excluded (do not build without asking)
AI photo analysis, automatic quantity extraction from drawings, price forecasting; engineer/contractor accounts (use a
read-only share link); hard-blocking phase closure or work start; WhatsApp, supplier integrations, live exchange rates.
3.20 offline and 3.23 handover only behind feature flags (`offline`, `handover`); 3.23 cut on 18 Nov ("designed and documented").

## Feature decisions by the owner (20–21 Nov 2026, chronological)
- **3.16 financial:** extra works recorded without a contract; approved ones use the contingency first, then raise the
  expected cost above budget with a warning; proposed ones counted nowhere; alert computed when screens open.
- **3.3:** calculators before contracts (last of priority 1); rebar weight per metre = d²/**162**, stored as data
  (`calc_coefficients`) **unreviewed**, derived from the design's S22.2 example; brick/cement/sand/paint calculators NOT
  built (need engineer ratios); geometry calculators save nothing (GET forms).
- **3.3 slice 2:** a purchase writes the purchase + `purchase.recorded` event in one transaction; the app hands the event
  to finance at once (no worker yet), which makes **one expense keyed on the purchase id** (idempotent); if that fails the
  purchase stays and offers «تسجيل المصروف». Waste % typed by the owner from the engineer, never suggested (D10 open).
  **Future worker must skip purchases that already have `expense_ref`.**
- **3.12:** pre-pour template = the 4 items of design S26.1, unreviewed (D4 open); two slices; several named checklists
  per phase; a sound item is «سليم», never «معتمد»; every technical screen says «يوثّق النظام الفحص ولا يحل محل المهندس المسؤول».
- **3.12 slice 2:** one replaceable photo per item; **«فحص التسليح» requires a photo by the owner's decision** (I had
  recommended waiting for the engineer) — template stays unreviewed and its source says so.
- **3.15:** one readiness list per project (FR-PRJ-05 items; structural assessment only for add-floor); gate when a phase
  goes «لم تبدأ» → «قيد التنفيذ»: lists gaps, confirm, logged (`start_confirmed_with_gaps`).
- **3.14:** waited for PR 41 merge; stop plan per phase from an unreviewed template (S19.1 items + 4 protection measures);
  the owner's cost estimates on the measures sum (without «لا ينطبق») into «الحماية» of the stop scenario for the
  **current phase**, prefilled only when nothing is saved, still editable; the app never suggests a cost.
- **3.17:** phase-end warning now (confirm + `close_confirmed_with_open_issues`); one optional replaceable photo per
  defect; «تسجيل عيب مرتبط» from a checklist item with a problem; priority is illustrative («يحدده المهندس»); the owner
  closes defects (no engineer accounts), with advice to close after the engineer's review.
- **3.13:** the owner copies the engineer's two dates per pour (curing until, formwork removal); **no number of days
  anywhere**; reminders from 2 days before (display window) until «تمّ» (stamped by DB, undoable); design S27.2 fields.

## Technical patterns established
- DB per feature: BEFORE guard trigger (same project, never moves, no future dates, server-stamped timestamps) + AFTER
  UPDATE/DELETE audit via `private.cashflow_audit`; transaction-local flags (`app.creating_checklist`,
  `app.checklist_sync`) so only the intended function can create checklists or change their status.
- Each new migration gets `tests/db/rls_00NN.test.sql` and a mutation run; surviving mutants are either closed with a new
  test or documented as equivalent.
- Cross-module features are composed in `src/app` (Server Actions there): purchase→expense, readiness gate, open defects
  at phase end, stop-plan cost into the comparison form.
- Photos: compressed in the browser, one-time upload token, server checks type/size, unused uploads removed, replaced
  files removed, signed links 10 min.
- Client forms that upload or pre-check do it in `onSubmit` (not the form action) so a refusal keeps the owner's answers.

## Rejected / failed approaches
- SECURITY DEFINER RPCs for checklists (violates the 0004/0006 rule) → triggers + flags instead.
- Overloading `update_phase_schedule` with a defaulted extra parameter (ambiguous API call) → drop and re-create.
- Pre-filling engineering values (waste %, curing days, rebar per-diameter tables) → owner-typed or unreviewed data.
- Marking a readiness/stop template item "approved" without a named reviewer → DB check forbids it.

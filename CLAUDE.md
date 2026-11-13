# CLAUDE.md — Smart Residential Construction Manager

Web system (Arabic, RTL) that helps first-time home builders in Libya manage a residential construction project:
budget and expenses in LYD, material quantities and prices, technical checklists before concealment/pour,
phase handover, a reviewed engineering knowledge base, and a weekly report. Two-person graduation project,
target delivery **1 January 2027**. The team must be able to explain every line of code to a committee.

## Sources of truth (read before large changes)
- `docs/graduation_project_master_reference.md` — scope, priorities, decisions, risks. Section 17 = execution rules.
- `docs/system_architecture.md` — modular monolith, layers, module ownership, events, security.
- `docs/analysis_and_design.md` — use cases, activity/sequence diagrams, ERD v2.
- `docs/requirements_specification.md` — numbered requirements (FR-/NFR-) with acceptance criteria. Implement by requirement ID
  and cite the ID in commit messages. If a requirement conflicts with another doc, stop and ask.
- `docs/project_change_register.md` — decisions, file status, known inconsistencies. Record every scope change there.
- `supabase/migrations/` — the database (0001–0006, applied in order; the source of truth, not `schema.sql`). Migrations are append-only: never edit an applied migration, add a new one.

If code and docs disagree, stop and ask; do not silently pick one.

## Commands
- `npm run check` — lint + typecheck + unit tests (run before every commit)
- `npm run build` — production build (what Vercel runs)
- `npm run test:db` — migration + RLS tests; needs `DATABASE_URL` of a THROWAWAY Postgres. Never a real project.

## Scope (committed; see docs/graduation_project_master_reference.md section 17)
All features 3.1–3.23 in the docs are in scope for v1, built minimal-first, then deepened. Priorities and the cut order live in
master section 8. Before changing scope or a decision, check `docs/project_change_register.md` and record the change there.

**Do NOT build** (explicitly excluded; ask first if you think one is needed):
- AI analysis of site photos, automatic quantity extraction from drawings, or price forecasting. The replacements are:
  structured photo documentation (3.8), a quantity table entered once (3.9), and the owner's own price log (3.10).
- Engineer/contractor accounts. Use a read-only share link (hashed token, expiry, revocable) instead.
- Hard-blocking phase closure or work start. Warn, require explicit owner confirmation, and log it (decision D2).
- WhatsApp integration, supplier integrations, or live exchange-rate feeds.

**Built on internal analysis, not proven user demand:** 3.20 (offline) and 3.23 (stock count and handover). Keep each behind a
feature flag (`offline`, `handover` in `feature_flags`) so it can be switched off without rebuilding anything else.

## Architecture rules (enforced by lint/CI; do not work around them)
1. **Modular monolith.** Code lives in `src/modules/<name>/{domain,application,infra,ui}` with one public file `index.ts`.
   Outside a module, import only from `@/modules/<name>` — never from its internals (R1).
2. **Levels (R2).** L0 `shared-kernel`, `platform`. L1 `identity`, `projects`. L2 `finance`, `materials`, `quality`,
   `documents`, `knowledge`. L3 `decisions`, `trades`, `dashboard`, `notifications`. A module imports only from lower
   levels. **L2 modules never import each other**: they react to each other through events (outbox).
3. **Domain is pure (R4).** `domain/` has no React, Next, Supabase, or infra imports. Business and financial math lives
   here and is unit-tested. The UI and n8n only display numbers; they never compute them (R5).
4. **Each module touches only its own tables.** Foreign keys across modules are allowed only to `projects` and `phases`.
   Anything else is a weak reference (plain uuid) or an event.
5. **Events (outbox).** Write the data and the `outbox_events` row in the same transaction. Handlers MUST be idempotent.
6. **Feature flags (R6).** Every module can be switched off without breaking others.
7. **n8n and the AI assistant are read-only** (R7): n8n reads only `weekly_report_v` via the `reporting_reader` role; the
   assistant reads approved knowledge-base entries and the user's own data under the user's RLS (never the service role).
8. **No secrets in code or in n8n workflows (R8).** Use environment variables. Only `NEXT_PUBLIC_*` values may reach the
   browser. The service-role key is server-only.

## Data rules
- **Money is never a JS `number`.** Use `@/shared-kernel` (`money`, `addMoney`, `percentOf`, ...; Decimal, 3 places, LYD).
  Database: `numeric(14,3)`.
- **Every new table** gets `project_id`, RLS enabled with `is_member`/`can_write` policies, **and a test** in
  `tests/db/rls.test.sql` (or `rls_00NN.test.sql`) proving a stranger cannot read or write it. Only exception: global
  reference tables (`phase_templates`, `kb_entries`, `trade_templates`): no `project_id`, read-only for users, engineering
  content kept `unreviewed` until approved (decision 14 Nov 2026).
- RLS helpers (`private.is_member`, `private.can_write`) live in schema `private`. Never put a callable `security definer`
  function in `public`: Supabase exposes every `public` function as an API endpoint (migration 0004, test `rls_0004`).
- Identity numbers (`profiles.national_id`, `profiles.passport_number`, FR-ID-06) are readable only by their owner and
  written only by the sign-up trigger. Never expose them in views, reports, share links, logs, or to project members.
- Confirmed warnings (decision D2) are logged with `private.log_audit(project_id, table, action, detail)`, the only writer of
  `audit_log`. Writes spanning several tables go through one SECURITY INVOKER function (e.g. `create_first_project`).
- Tables written from offline/PWA flows carry `client_op_id` with a unique index per project (idempotent retries).
- Dates: `date` for calendar dates, `timestamptz` for events; display in `Africa/Tripoli`.

## UI rules
- Arabic first, RTL. Use **logical** CSS properties (`margin-inline-start`, `padding-inline`, `text-align: start`), not
  left/right. User-facing strings go in message files, not inline in components.
- Mobile first: owners use phones on site. Quick expense entry must stay at 3 taps.

## Engineering content: do NOT invent
Concrete cover, waste percentages, pressure-test values, curing days, tolerances, and checklist items are engineering
claims. Never write numbers from memory into code or seed data. Keep them as **data** with `status = 'unreviewed'` until a
named engineer approves them (`reviewed_by`, `reviewed_on`). The system documents and warns; it never certifies safety.
Warnings require explicit owner confirmation and are logged — they do not hard-block (decision D2).

## Working style
- Small increments following the vertical slice in master reference section 17. Do not start a new feature until the
  previous one meets "degree 1: works end to end". Build every feature minimal first, deepen later.
- Write the domain function and its test first, then the use case, then the UI.
- Code and identifiers in English. User-facing text in Arabic. After a change, summarize in Arabic what changed and why,
  in plain language, so both teammates can follow.
- Prefer boring, readable code over clever code. If a change needs a new dependency, say why.
- Do not touch production data or any production project. Use the staging Supabase project.
- Never commit `.env*` files (except `.env.example`).

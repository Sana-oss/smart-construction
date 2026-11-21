# NEXT_STEPS.md — prioritized (21 Nov 2026)

## 1. Immediate next action

**Start 3.16 contractual part: contracts and payments (FR-FIN-08, FR-FIN-09; UC-16; design S17.1, S17.2, S17.3).**
Proposed to the owner at the end of the last session; **not started and not yet confirmed** — begin by syncing `main`
(`git checkout main && git pull`, new branch e.g. `feat/contracts`) and asking the open decisions.

- Existing schema (0001): `contracts(id, project_id, contractor, value_lyd, has_cleanup_clause, created_at)`,
  `payments(id, project_id, contract_id, phase_id, amount_lyd, withheld, paid_on)`; `change_orders.contract_id` is optional
  since 0022 (extra works can later be linked). Check staging rows are empty before altering.
- FR-FIN-08: contract value, scope, payment schedule; shown on the dashboard. FR-FIN-09: a payment tied to a phase, with an
  optional withheld part released after handover; «لا تُعلَّم الدفعة مستحقة قبل اعتماد المالك للمرحلة بصور». FR-FIN-12 (P3):
  cleanup clause field. D9: retention percentage is left to owner/contractor agreement (shown as an option, never imposed).
- Questions to ask first (suggested): does paying a payment create an expense (one expense, like purchases — idempotent,
  composed in the app layer)? Is "phase approved with photos" = phase status `done` + at least one phase photo (photos
  belong to `documents`, L2 → compose in app)? Link existing extra works to a contract now or later?
- Files likely involved: new `src/modules/finance/domain/contracts.ts` (+ tests), `application/`, `infra/`, `ui/`,
  `src/app/contracts/…`, migration `supabase/migrations/0031_*.sql`, `tests/db/rls_0031.test.sql`, `tests/e2e/contracts.spec.ts`,
  docs (change register, requirements, analysis_and_design §28, status report, e2e README, CLAUDE.md range 0001–0031).
- Must not change: applied migrations 0001–0030; the money rules (Decimal, numeric(14,3)); D2 (warn, never block);
  `update_phase_schedule` signature unless re-created deliberately (tests `rls_0010`, `rls_0027`, `rls_0029` name it).
- Done when: `npm run check` + build pass; DB tests + mutation run pass; migration applied to staging **after owner says
  yes**; new e2e spec and full e2e pass; staging test accounts cleaned; docs updated; owner asked "commit and open the PR?".

## 2. Prioritized backlog

**P0 — blockers**
- Stabilize the dev environment: repo on USB `E:` disconnects (crashes e2e). Move to an internal disk or fix USB (owner's call).

**P1 — high**
- 3.16 contracts & payments (above). Depends on nothing new; reuses the finance module and the app-layer composition pattern.
- Refresh `docs/status_report_week1.md` section 4 table (stale since 19 Nov) — docs only.

**P2 — normal**
- FR-FIN-05 expense report per phase + planned vs actual (status report §9 item 3). Depends on budget allocations (done).
- Quick-expense form: keep the owner's answers when a receipt upload fails (same fix as `CheckItemForm`, move to `onSubmit`).
- 3.22 trade packs — **blocked on the engineer** (D7, D8); engine (quality checklists) is ready.
- Engineer review of unreviewed content (D4, D10, rebar coefficient 162, readiness and stop-plan templates) — external.

**P3 — later (priority 3–4 in the master reference)**
- 3.21 weekly report via n8n (reads only `weekly_report_v` as `reporting_reader`) + the outbox worker (needs the service role,
  server-only). The worker must skip purchases that already have `expense_ref` (see DECISIONS_LOG).
- 3.6 AI assistant over approved knowledge-base entries (read-only, user's RLS, never the service role); `knowledge` module empty.
- 3.20 offline (behind feature flag `offline`); tables written offline already carry `client_op_id` where built.
- 3.11 read-only share link for the engineer (hashed token, expiry, revocable) — instead of engineer accounts.
- 3.23 phase handover / stock count — cut on 18 Nov ("designed and documented"); flag `handover` if ever built.
- Editing a concrete pour; multiple photos per defect; non-app notifications for reminders.

# NEXT_STEPS.md — prioritized (21 Nov 2026)

## 1. Immediate next action

**Merge the contracts pull request (3.16 contracts and payments, FR-FIN-08, FR-FIN-09, FR-FIN-12), then pick the next P2 item.**
After the merge: `git checkout main && git pull`. Migrations 0031 and 0032 are already applied to staging.

Suggested next feature: **FR-FIN-05 expense report per phase + planned vs actual** (depends on budget allocations: done), or
the small deepening items below. Ask the owner which first.

## 2. Prioritized backlog

**P0 — blockers**
- Stabilize the dev environment: repo on USB `E:` disconnects (crashes e2e) when worked on locally. Move to an internal disk or fix USB (owner's call).

**P1 — high**
- Refresh `docs/status_report_week1.md` section 4 table (stale since 19 Nov; it does not mention 3.16 contracts) — docs only.

**P2 — normal**
- Contracts deepening: edit a contract or a payment after saving (today: delete and re-record); link existing extra works
  (`change_orders.contract_id`) to a contract; a paid payment whose expense the owner deleted shows as paid without an expense.
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

# CURRENT_STATE.md — 21 Nov 2026

**Where we are:** priority 0 and 1 complete; priority 2 nearly complete. 3.16 is complete (financial part + contracts and
payments, merged via PR #46). FR-FIN-05 (expenses report by phase and type, planned vs actual) is built on branch
`feat/phase-expense-report`, not yet committed (waiting for the owner's go-ahead to commit and open the PR).

**Git:** `main` @ `ddb77d7` (PR #46). Working branch `feat/phase-expense-report` from it. Untracked by rule: `.claude/`, `AGENTS.md`
(never commit). `.env.local` (public staging URL and key) is git-ignored.

**Database:** migrations `0001`–`0032`, all applied to staging `rakeeza-staging`. Next number: **0033**.

**Last verified (21 Nov, on `feat/phase-expense-report`, local Windows):** `npm run check` 628 unit tests; build OK; full e2e on
staging 58 passed / 1 skipped (HEIC). DB tests unchanged since PR #46 (63 files; FR-FIN-05 adds no migration). Staging test
accounts cleaned afterwards; one known orphan photo remains in the bucket.

**Built, by feature:** core (wizard, phases/tasks, expenses + receipts, documents, photos, dashboard), 3.7, 3.18, 3.16
(financial part + contracts and payments: S17.1–S17.3), 3.3 (calculators + quantity table/purchases), 3.12 (+ photos), 3.15,
3.14, 3.17, 3.13, FR-FIN-05 expenses report (`/expenses/report`, no migration).

**Not built:** 3.22 trade packs (waits for engineer D7/D8); 3.21 weekly report + outbox worker; 3.6 assistant/knowledge base;
3.20 offline; 3.11 share link; 3.23 handover (cut: "designed and documented"); editing a
contract or a payment after saving; linking existing extra works to a contract.

**Waiting on people:** the engineer has not answered the confirmation file → templates for pre-pour (D4), readiness, stop
plan, and the rebar coefficient (162) stay `unreviewed`; «فحص التسليح» requires a photo by the owner's decision.

**Environment note:** the repo used to live on USB drive `E:` that disconnects intermittently. The 21 Nov contracts work was done in a
cloud session (Linux container); to run e2e there the session needed the staging host allowed in the environment's network and
`NODE_USE_ENV_PROXY=1` for Node's fetch.

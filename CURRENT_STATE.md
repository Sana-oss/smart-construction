# CURRENT_STATE.md — 21 Nov 2026

**Where we are:** priority 0 and 1 complete; priority 2 nearly complete. Everything built is merged to `main` (last: PR #44,
3.13 concrete log). No work in progress, no uncommitted tracked changes.

**Git:** branch `feat/concrete-log` @ `96ca690` (pushed; merged via #44). Untracked by rule: `.claude/`, `AGENTS.md`. New
untracked handoff files: `PROJECT_HANDOFF.md`, `CURRENT_STATE.md`, `NEXT_STEPS.md`, `DECISIONS_LOG.md` (not committed).

**Database:** migrations `0001`–`0030`, all applied to staging `rakeeza-staging`. Next number: **0031**.

**Last verified (21 Nov):** 557 unit tests; 59 DB test files (PGlite) incl. mutation runs for each new migration; build OK;
full e2e on staging 52 passed / 1 skipped (HEIC).

**Built, by feature:** core (wizard, phases/tasks, expenses + receipts, documents, photos, dashboard), 3.7, 3.18, 3.16
(financial part), 3.3 (calculators + quantity table/purchases), 3.12 (+ photos), 3.15, 3.14, 3.17, 3.13.

**Not built:** 3.16 contracts & payments (FR-FIN-08/09) ← next; 3.22 trade packs (waits for engineer D7/D8); 3.21 weekly report +
outbox worker; 3.6 assistant/knowledge base; 3.20 offline; 3.11 share link; 3.23 handover (cut: "designed and documented");
FR-FIN-05 expense report per phase.

**Waiting on people:** the engineer has not answered the confirmation file → templates for pre-pour (D4), readiness, stop
plan, and the rebar coefficient (162) stay `unreviewed`; «فحص التسليح» requires a photo by the owner's decision.

**Environment risk:** repo is on USB drive `E:` that disconnects intermittently; C: had ~5.4 GB free on 21 Nov.

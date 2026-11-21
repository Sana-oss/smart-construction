# CURRENT_STATE.md — 21 Nov 2026

**Where we are:** priority 0 and 1 complete; priority 2 nearly complete. 3.16 is now complete (financial part + contracts and
payments). The contracts work is on branch `feat/contracts`, pushed to `origin/claude/beautiful-sagan-v9nftx` and covered by one
pull request (see Git); everything before it is merged to `main` (last: PR #45, handoff files).

**Git:** local branch `feat/contracts` tracks `origin/claude/beautiful-sagan-v9nftx` @ `bafb65a`+ (the session could push only to that
branch). Untracked by rule: `.claude/`, `AGENTS.md` (never commit). `.env.local` (public staging URL and key) is git-ignored.

**Database:** migrations `0001`–`0032`, all applied to staging `rakeeza-staging`. Next number: **0033**.

**Last verified (21 Nov):** 617 unit tests; 63 DB test files (Postgres 16) incl. mutation runs (21 for 0031, 27 for 0032, all
caught); build OK; e2e on staging: 57 passed / 1 skipped (HEIC) of 58. Two runs: the full run gave 47 passed; 3 specs (documents, photos, receipt) failed only because the
test process's own HTTP client could not resolve the Supabase host through this container's proxy, and they plus their 8 dependent
tests passed (10) when re-run with the proxy set for the test client.

**Built, by feature:** core (wizard, phases/tasks, expenses + receipts, documents, photos, dashboard), 3.7, 3.18, 3.16
(financial part + contracts and payments: S17.1–S17.3), 3.3 (calculators + quantity table/purchases), 3.12 (+ photos), 3.15,
3.14, 3.17, 3.13.

**Not built:** 3.22 trade packs (waits for engineer D7/D8); 3.21 weekly report + outbox worker; 3.6 assistant/knowledge base;
3.20 offline; 3.11 share link; 3.23 handover (cut: "designed and documented"); FR-FIN-05 expense report per phase; editing a
contract or a payment after saving; linking existing extra works to a contract.

**Waiting on people:** the engineer has not answered the confirmation file → templates for pre-pour (D4), readiness, stop
plan, and the rebar coefficient (162) stay `unreviewed`; «فحص التسليح» requires a photo by the owner's decision.

**Environment note:** the repo used to live on USB drive `E:` that disconnects intermittently. The 21 Nov contracts work was done in a
cloud session (Linux container); to run e2e there the session needed the staging host allowed in the environment's network and
`NODE_USE_ENV_PROXY=1` for Node's fetch.

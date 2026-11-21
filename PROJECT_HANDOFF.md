# PROJECT_HANDOFF.md — «ركيزة» (Smart Residential Construction Manager)

Handoff written 21 Nov 2026 at the end of a long Claude Code session. Verified against the repository unless marked
**(assumption)**. Read with `CURRENT_STATE.md`, `NEXT_STEPS.md`, `DECISIONS_LOG.md`, and above all `CLAUDE.md`
(the binding project rules) and the docs listed in section 7.

---

## 1. Project understanding

**Purpose.** An Arabic, RTL, mobile-first web app that helps first-time home builders in Libya run a residential build:
budget and expenses in LYD, phases and tasks, quantities and prices, technical checks before pouring/covering, readiness
before starting, defects, concrete log, documents and photos, and a continue-or-pause comparison. Two-person graduation
project (one developer, one designer), delivery **1 January 2027**; every line must be explainable to a committee.

**Stack (verified in `package.json`).** Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript 6,
Supabase (Postgres + Auth + Storage, `@supabase/ssr`, `@supabase/supabase-js`), `decimal.js` for money, `zod`, `heic-to`
(iPhone photos). Tests: Vitest (unit), Playwright (e2e, phone viewport), SQL tests run on PGlite locally / Postgres 16 in CI.
Lint: ESLint 9 + `eslint-plugin-boundaries` (enforces the module rules). Hosting: Vercel (region `fra1`, `vercel.json`).

**Architecture: modular monolith** (`docs/system_architecture.md`). Code in `src/modules/<name>/{domain,application,infra,ui}`
with one public `index.ts`. Levels: L0 `shared-kernel`, `platform`; L1 `identity`, `projects`; L2 `finance`, `materials`,
`quality`, `documents`, `knowledge`; L3 `decisions`, `trades`, `dashboard`, `notifications`. A module imports only lower
levels; **L2 modules never import each other**. `src/app` (routes) may compose any modules — cross-L2 features (purchase →
expense; readiness gate; defects at phase end; stop-plan cost → stop scenario) are composed there.

**Module responsibilities (verified by `src/modules/*/domain`).**
| Module | Owns (built) |
|---|---|
| shared-kernel | money (Decimal, 3 dp), Arabic digit parsing, dates in Africa/Tripoli, ids, image limits, event types |
| platform | Supabase clients (server/browser/session), private file storage (`project-files` bucket), image compression |
| identity | phone + national id sign-up (no SMS), sign-in, display name, identity document |
| projects | first-project wizard, phases (status, dates, delay), tasks/progress, phase-close/start rules |
| finance | quick expense (3 required answers), list/filter/edit/delete, receipt photo, foreign currency + rate log, budget per phase + contingency, extra works, cash flow (obligations/income), purchase→expense handler |
| materials | price log & quotes, quantity calculators (rebar, concrete, area, tiles), quantity table + purchases |
| documents | site photos, project documents |
| quality | checklist engine: pre-pour checklists (+ item photos), project readiness list, stop plans (with protection costs); defects list; concrete log |
| decisions | continue / pause / finish-phase comparison (3.7) |
| dashboard | project summary (S07.1) and its rows |
| knowledge, trades, notifications | **empty** (not built) |

**Integrations.** Supabase (staging project `rakeeza-staging`, ref `itffcugtpmkjuvmkgvqr`); Vercel deployment protected by
Vercel sign-in; GitHub `Sana-oss/smart-construction` with CI (`.github/workflows`: lint, typecheck, unit tests, build; DB
tests on Postgres 16). n8n and the AI assistant are planned, read-only, not built.

**Structure (top level).** `src/app` (routes), `src/modules`, `src/shared-kernel`, `src/platform`, `supabase/migrations`
(0001–0030), `tests/db` (RLS/migration SQL tests), `tests/e2e` (Playwright), `docs/` (source-of-truth documents),
`Design/` (teammate's Figma exports + outline), `scripts/test-db.sh`.

---

## 2. Work completed (all merged to `main`)

Merged PRs in this and earlier sessions: up to **#44**. Recent features, each with domain + tests, migration + RLS test +
mutation run, UI, e2e on staging, and docs:

| Feature | Requirement | Migration | Main paths |
|---|---|---|---|
| Core (priority 0): wizard, phases+delay, tasks, quick expense, expense list/filter/edit/delete, receipts, documents, photos, dashboard | FR-PRJ-*, FR-FIN-02/05 (list), FR-DOC-* | 0001–0016 | `src/modules/{projects,finance,documents,dashboard}` |
| 3.7 continue/pause (cash flow, price log S24, scenarios S18) | FR-DEC-01..05, FR-MAT-08/10 | 0017–0019 | `finance/…/cashflow`, `materials/…/price`, `decisions/` |
| 3.18 currency & reference rates | FR-FIN-04 | 0020 | `finance/domain/currency.ts` |
| 3.16 financial part: phase allocations + alert; extra works | FR-FIN-10/11 | 0021–0022 | `finance/domain/{allocation,extras}.ts` |
| 3.3 slice 1: calculators; rebar coefficient as unreviewed data | FR-MAT-04/05 | 0023 | `materials/domain/calculators.ts`, `/materials/*` |
| 3.3 slice 2: quantity table, purchase = one expense, over-allowance warning | FR-MAT-01..03, FR-FIN-03 | 0024 | `materials/domain/quantities.ts`, `src/app/materials/items/` |
| 3.12 pre-pour checklists (slice 1) | FR-QLT-01/02 | 0025 | `quality/domain/checklist.ts`, `/checklists/*` |
| 3.12 item photo + photo-required rule (slice 2) | FR-QLT-01 | 0026 | `quality/ui/CheckItemForm.tsx` |
| 3.15 readiness gate | FR-PRJ-05 | 0027 | `/readiness`, `src/app/phases/[id]/schedule/actions.ts` |
| 3.14 safe stop points (stop plan + costs → stop scenario) | FR-DEC-04 | 0028 | `/stop-plan`, `src/app/decision/inputs/page.tsx` |
| 3.17 defects list + warning at phase end | FR-QLT-06/07 | 0029 | `quality/domain/issue.ts`, `/issues/*` |
| 3.13 concrete log + reminders on engineer's dates | FR-QLT-04/05 | 0030 | `quality/domain/concrete.ts`, `/concrete/*` |

Bugs fixed along the way (all merged): a form refusal in the page wiped the owner's answers (React resets a form after
its action — check/upload moved to `onSubmit`, in `CheckItemForm` and `IssueForm`); the pre-pour form offered the
readiness template (now filtered by kind); several old DB tests adapted to new rules (`rls_0002`, `rls_0007`, `rls_0010`,
`rls_0025`, `rls_0027`) with comments — each still tests what it tested.

Last verified results (21 Nov, on `feat/concrete-log` = merged into `main` via #44): `npm run check` 557 unit tests pass;
`npm run build` passes; 59 DB test files pass (PGlite); full e2e 52 passed, 1 skipped (HEIC, needs a real iPhone file).

---

## 3. Current state

- **Working:** everything in section 2, on staging, at phone size.
- **Partially implemented:** 3.16 (financial part done; **contracts & payments not built**); 3.12/3.14/3.15 templates hold
  **unreviewed** engineering content awaiting the engineer (D4); `docs/status_report_week1.md` table in its section 4 is
  stale (dated 19 Nov; the narrative in section 9 is current).
- **Broken:** nothing known in code. Environment: the USB drive `E:` (holds the repo) disconnects intermittently — see §6.
- **Not built:** 3.16 contracts/payments (FR-FIN-08/09), 3.22 trade packs, 3.6 AI assistant + knowledge base, 3.20 offline,
  3.21 weekly report (n8n) + outbox worker, 3.11 read-only share link, 3.23 phase handover/stock count (cut, "designed and
  documented"), FR-FIN-05 expense report per phase, engineer review workflow (no engineer accounts by design).
- **Stage:** priority 0 and 1 complete; priority 2 nearly complete (contracts remain; trade packs wait for the engineer).

---

## 4. Important decisions → see `DECISIONS_LOG.md` (complete list, do not change silently).

## 5. Pending tasks → see `NEXT_STEPS.md`.

---

## 6. Bugs, known issues, root causes

| Issue | Root cause | Status / workaround |
|---|---|---|
| E2E runs crash midway (`ENOENT mkdir '\\?'`, EIO, "Slow filesystem detected") | Repo on USB drive `E:` (ASMT ASM225) disconnects/slow | Reconnect; write e2e log to C: scratchpad; rerun. Recommended: move repo to an internal disk or fix USB (port/cable/power saving) |
| Node "out of memory / committing semi space failed" | C: was full (0.25 GB) → page file could not grow. Caused by a 1.87 GB runaway task log (an accidental interactive `python -` in a pipe) | Fixed: log deleted, caches cleared, C: had ~5.4 GB free on 21 Nov. Never pipe a heredoc into a bare `python -` together with another heredoc |
| Two unrelated e2e tests failed once (documents delete, expense stranger) | Timeouts on the slow USB drive | Passed when rerun alone and in the next full run |
| One orphan test photo in staging bucket `project-files/e4817b2f-…/checklists/16f94a95-….jpg` | Run interrupted by the drive before cleanup; Supabase forbids deleting storage rows via SQL; its project no longer exists | Harmless; delete from the Supabase dashboard if wanted |
| Quick expense: a receipt upload failure wipes the form | Same React form-reset pattern as the fixed bug | Not fixed (noted in change register) |
| Supabase security advisor: leaked-password protection off | Project setting | Owner's decision; not changed |
| Writing test titles with an apostrophe from Python heredocs broke files | Quoting | Use double-quoted titles, or the Edit tool |
| Python printing Arabic crashes on Windows console | cp1252 | Run scripts with `python -I -X utf8` (`-I` ignores `PYTHONIOENCODING`) |

---

## 7. Critical technical information

**Sources of truth (read before large changes):** `CLAUDE.md`; `docs/graduation_project_master_reference.md` (scope,
priorities §8, decisions D1–D10 §16.3, execution rules §17); `docs/system_architecture.md`; `docs/analysis_and_design.md`
(sections 13–27 describe each built feature with a Mermaid diagram); `docs/requirements_specification.md` (FR/NFR IDs —
cite them in commits); `docs/project_change_register.md` (every decision and slice, dated); `docs/status_report_week1.md`;
`tests/e2e/README.md` (one paragraph per spec); `Design/Screens/rakeza-v2-63-screens.outline.txt` (screen texts S01–S34).

**Database:** `supabase/migrations/0001…0030` (append-only; never edit an applied one). All applied to staging
`rakeeza-staging`. Every table has RLS (`is_member`/`can_write` in schema `private`); global reference tables without
`project_id` are the stated exception: `phase_templates`, `calc_coefficients`, `checklist_templates`, `kb_entries`,
`trade_templates`. Helpers: `private.today_tripoli()`, `private.log_audit()`, `private.emit_event()` (outbox),
`private.cashflow_audit()` (generic AFTER UPDATE/DELETE audit trigger). Public RPCs (all SECURITY INVOKER, anon revoked):
`create_first_project`, `create_expense`, `update_phase_schedule` (8 params since 0029: `p_start_gaps`,
`p_close_open_issues`), `record_purchase`, `create_checklist`, `create_readiness_checklist`, `create_stop_plan`.
Rule: no callable SECURITY DEFINER function in `public`.

**Storage:** private bucket `project-files`; paths `<project id>/{photos,documents,receipts,checklists,issues}/<uuid>.jpg`;
browser uploads with a one-time token from a Server Action, server checks type/size, signed links 10 min.

**Environment variable NAMES** (values never in code; `.env.local` exists locally and is git-ignored):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only; **not used** — the
app runs as the signed-in user), `INTERNAL_WORKER_SECRET` (planned worker), `ANTHROPIC_API_KEY` (planned assistant).
E2E-only: `E2E_BASE_URL`, `E2E_VERCEL_SHARE_URL`, `E2E_HEIC_FILE`, `E2E_TIMING_ROUNDS`, `E2E_QUICK_EXPENSE_MAX_MS`.

**Commands** (Git Bash paths; repo at `E:\smart-construction`):
- `npm run check` (lint + typecheck + unit) — before every commit. `npm run build` — what Vercel runs.
- `npm run test:db` needs `DATABASE_URL` of a throwaway Postgres (CI does this). Local equivalent used in sessions:
  `cd /e/Temp/sc-pglite && node run.mjs /e/smart-construction` (PGlite runner, outside the repo).
- E2E (against staging, starts `npm run dev`): `PLAYWRIGHT_BROWSERS_PATH='E:\ms-playwright' npx playwright test [spec]`.
  Full run ≈ 11–15 min; write its log to C: (e.g. the session scratchpad) in case E: drops.
- Mutation testing (local, outside repo): `E:\Temp\mutNN.py` copies migrations to `E:\Temp\mut`, mutates one rule, runs
  PGlite, expects FAIL — run with `python -I -X utf8`.
- Mermaid check (outside repo): extract blocks to `E:\Temp\mblocks.json`, then
  `PLAYWRIGHT_BROWSERS_PATH='E:\ms-playwright' NODE_PATH=/e/smart-construction/node_modules node /e/Temp/mcheck.cjs /e/Temp/mblocks.json`.
- npm on this machine needs an explicit `--cache` on E: when installing (per user memory).

**Staging cleanup after e2e** (run via the Supabase tool on `rakeeza-staging`): delete `auth.users` whose email is like
`'2189500%@phone.rakeeza.invalid'` and `raw_user_meta_data->>'full_name' = 'حساب اختبار آلي'`, after deleting their
projects' `outbox_events` and `audit_log` rows (projects cascade). Test files are removed by `removeProjectFiles`
(`tests/e2e/helpers.ts`, folders photos/documents/receipts/checklists/issues).

**Deployment:** Vercel project deploys `main` (protected by Vercel sign-in; status report §10 names the URL). Staging DB only
— never touch production.

---

## 8. Immediate next step → `NEXT_STEPS.md` §1 (3.16 contracts & payments, after the owner confirms).

## 9. Git status (verified 21 Nov)

- Current branch: `feat/concrete-log` at `96ca690`, pushed, **PR #44 merged** into `main` (`main` contains it).
- Uncommitted changes: **none** in tracked files.
- Untracked: `.claude/` and `AGENTS.md` — **deliberately never committed** (owner's rule).
- New, untracked: these four handoff files (created now, not committed — commit only if the owner asks).
- Nothing unfinished or unpushed.

---

## 10. How the owner works (keep this)

- Writes in Arabic; short commands: «دمجت الطلب، ابدأ X», «next», «أودِع وافتح الطلب», «نعم، طبّقه (موصى به)».
- Each feature: ask the open decisions first (AskUserQuestion, recommended option first) → domain + tests → migration +
  `tests/db/rls_00NN.test.sql` + mutation run → **ask before applying the migration to staging** → use cases, adapter,
  UI → e2e spec → full e2e → docs (change register row + file-status row, requirements note, analysis_and_design section,
  status report, e2e README, CLAUDE.md migration range) → staging cleanup → wrap up asking «commit and open the PR?».
- Commit/PR only when asked; commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR body
  ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`; never `git add` `.claude/` or `AGENTS.md`.
- After each change, summarize in Arabic for both teammates. UI only from the teammate's design (`Design/`); where no
  design exists, build from design components and record it in the change register.

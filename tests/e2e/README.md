# End-to-end tests (week-1 task 15)

`journey.spec.ts` drives a real Chromium browser at a phone's screen size (Pixel 7) through the app:

1. **Owner journey** (NFR-USE-02; FR-ID-01, FR-PRJ-01, FR-FIN-02, FR-DSH-01): sign up, the first-project wizard,
   the dashboard, a quick expense, and back to the dashboard (spent = money spent before the app + the new expense;
   the "record your first expense" prompt disappears). Every page is checked for sideways scrolling.
2. **Stranger test** (NFR-SEC-01): a second new account lands on its own empty wizard and never sees the owner's
   project. Then, signed in as the stranger with the public key only (what any browser can do), it tries to read
   `projects`, `phases`, `expenses` and `budget_summary`, to record an expense with `create_expense`, to insert into
   `expenses` directly, and to rename the project. Everything must be refused or empty, and the owner's data must
   be unchanged afterwards.

Checked on 17 Nov 2026 that the stranger test really catches a leak: with the stranger signed in as the owner by
mistake, it fails with "stranger can read projects".

## Run

Needs `.env.local` pointing at the **staging** project (the same two public values as the dev server).

```bash
npx playwright install chromium   # once per machine (about 300 MB; set PLAYWRIGHT_BROWSERS_PATH to keep it off C:)
npm run test:e2e                  # starts `npm run dev` if nothing is running on port 3000
```

Against a deployed site instead: `E2E_BASE_URL=https://... npm run test:e2e`. A Vercel site behind Vercel's
sign-in cannot be tested this way unless protection is bypassed for the run.

## Test accounts

Each run creates **two accounts on staging**, named `حساب اختبار آلي`, with phone numbers `09500XXXXX` and random
passwords that are never printed. They are not deleted automatically, because the app has no server-side key
(rule R8). Delete them with [`scripts/e2e-cleanup.sql`](../../scripts/e2e-cleanup.sql) in the staging project's SQL
editor. Never run these tests against a production database.

Not in CI yet: the run needs the staging values as GitHub secrets and creates accounts on every pull request
(team decision, change register 17 Nov 2026).

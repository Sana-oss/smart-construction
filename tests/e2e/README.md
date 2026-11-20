# End-to-end tests (week-1 tasks 15 and 16)

The tests drive a real Chromium browser at a phone's screen size (Pixel 7) through the app.

`journey.spec.ts` (task 15):

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

`photos.spec.ts` (FR-DOC-02, NFR-SEC-03): a 4032x3024 JPEG is compressed in the browser (stored smaller, 1600 px), without downloading the HEIC converter; the signed link works and a tampered one does not; a stranger can neither list, download, link, upload nor delete the owner's files (the owner can); delete asks first and removes the file. HEIC: set `E2E_HEIC_FILE` to a real iPhone photo kept OUTSIDE the repository; skipped otherwise. The tests remove their own stored files (Supabase refuses to delete files with SQL).

`documents.spec.ts` (FR-DOC-01): PDF and PNG stored as they are; a Word file and a PDF over 10 MB refused in the browser; a form missing a field leaves NO file in storage; the signed link returns the PDF; the phase page lists only that phase's documents; a stranger reaches nothing while the owner can; delete asks first and removes the file.

`calculators.spec.ts` (FR-MAT-04, FR-MAT-05; needs migration 0023): the «المواد» tab opens the materials home; the rebar calculator refuses wrong inputs and keeps them, then gives the design example (16 mm × 12 m × 50 bars = 948 kg, 18.96 kg per bar, 600 m) with the coefficient marked unreviewed; «تعديل المدخلات» brings the values back, and 5% waste with 4,000 LYD a ton gives 996 kg and 3,982.222 LYD; concrete volume 10 × 8 × 0.15 = 12 m³; 13.5 m² of 60 × 60 cm tiles = 38 tiles; a missing field is reported; a user can read the coefficient but not change it.

`extras.spec.ts` (FR-FIN-10, FR-FIN-11; needs migration 0022): a proposed extra work counts nowhere; approved ones come out of the 45,000 contingency first; past it, S15.1 warns the contingency is used up and the expected cost is 455,000; S15.2 shows what is used and left; a rejected work changes nothing; deleting gives the contingency back; every change is audited; a stranger can neither see nor change extra works.

`budget.spec.ts` (design S15.1, S15.2, FR-FIN-11; needs migration 0021): the dashboard leads to the budget, whose figures match the dashboard; a phase gets an allocation, and 70,000 spent on 60,000 shows «116%» and the 10% warning on S15.2 and S15.1; an allocation above the budget is a warning, not a refusal; clearing a field removes the allocation; changes are audited; a stranger can neither see nor change allocations.

`currency.spec.ts` (3.18, FR-FIN-04; needs migration 0020): the reference rates log keeps the newest rate per currency; a quick expense in dollars starts with that rate, shows the LYD amount computed (not typed) and the list shows «1,000 USD بسعر 7.25»; the dashboard totals in LYD; editing the rate recomputes the expense, a newer rate in the log does not; a stranger can neither see nor change the rates.

`decision.spec.ts` (design S18, FR-DEC-01/02/03/05; needs migrations 0017-0019): with the cash of S16 and an expired quote in S24, the comparison shows the 30-day balance, the expired quote and «ناقص» before any figure; after the figures, each scenario's now/later costs, 30-day balance or shortfall and total match a calculation done by hand; a % out of range is refused; the S18.2 checklist is saved and audited; a stranger can neither see nor change it.

`prices.spec.ts` (design S24, FR-MAT-08, FR-MAT-10; needs migration 0018): prices and quotes are grouped by material and unit with the latest first; «إضافة تحديث للسعر» starts on the same material; a quote expiring within 7 days and an expired one are marked; an expiry date on a price paid is refused and the form keeps its values; deleting asks first and is audited; a stranger can neither see nor change the prices.

`cashflow.spec.ts` (design S16, FR-FIN-06, FR-FIN-07; needs migration 0017): the current liquidity is the wizard's available figure minus later expenses; obligations and expected income give the 30-day balance; income that arrives after an obligation does not cover it (a shortfall is shown); an overdue obligation is flagged; deleting asks first and is audited; a stranger can neither see nor change the movements.

`expense-filter.spec.ts` (design S13.2, FR-FIN-05): search by name or supplier, period, phase and type narrow the list; the results card totals all matching expenses; no match has its own message; «مسح التصفية» goes back; a hand-made address with odd characters is cleaned, never an error.

`expense-edit.spec.ts` (decision of 19 Nov 2026, FR-SYS-03; needs migration 0016): the owner opens an expense from the list and edits it, and the audit log keeps the old and the new values; a refused edit keeps the typed values; deleting asks twice, then removes the expense and its receipt photo, and the audit log keeps the old values; a stranger can neither open, edit nor delete it.

`receipt.spec.ts` (UC-07, FR-DOC-02): a quick expense with a receipt photo stores a compressed JPEG in the project's receipts folder and the list opens it through a signed link; a refused form uploads nothing and keeps the chosen type; an expense without a receipt is unchanged; a stranger cannot download the receipt.

`quick-expense-timing.spec.ts` (task 16, NFR-USE-03): checks that the quick expense asks for **at most three required
answers**, then records several quick expenses in a row and measures how long the **app** makes the owner wait:

| Measure | From | To |
|---|---|---|
| open | tap «إضافة مصروف سريع» on the dashboard | the form is ready (save button enabled) |
| save | tap «حفظ المصروف» | «تم حفظ المصروف» is shown |
| list | tap «عرض المصروفات» | the expenses list is shown (S13.1; since 18 Nov, before that: back to the dashboard) |

The robot types instantly, so these numbers are the app's share only. The first round is a warm-up and is left out
of the medians. The test does not fail on time: the threshold is agreed with the supervisor (requirements spec).
Once agreed, `E2E_QUICK_EXPENSE_MAX_MS` makes it fail when the median open + save is above it. Results are printed
and written to `test-results/quick-expense-timing.json`.

### Results, 17 Nov 2026 (phone size, staging database in Frankfurt, 8 rounds)

| Where the app ran | open (median) | save (median) | open + save (median) | open + save (worst) |
|---|---|---|---|---|
| **Vercel site** (`fra1`, next to the database) | 382 ms | 437 ms | **826 ms** | 1,384 ms |
| Production build on a laptop (database far away) | 277 ms | 943 ms | 1,215 ms | 1,257 ms |

The Vercel numbers are the ones that matter: there the server sits next to the database. They were measured from
one laptop on one network; a phone on a slow mobile connection will wait longer. Dev mode (`npm run dev`) is slower
still and is not a measure of the real app.

### The person's share (measure by hand with the supervisor)

The app's share is under a second; most of the real time is the owner reading and typing. To measure it, ask 3 to 5
people who have not used the app to record one expense on their own phone, on the Vercel site, signed in to a test
account with a project:

1. Start the stopwatch when they tap «إضافة مصروف سريع» on the dashboard.
2. They type a name, an amount, and choose a type (the three required answers). Nothing else.
3. Stop when «تم حفظ المصروف» appears.

Note each time and any hesitation. The median of these times, compared with the threshold agreed with the
supervisor, is the result for NFR-USE-03.

## Run

Needs `.env.local` pointing at the **staging** project (the same two public values as the dev server).

```bash
npx playwright install chromium   # once per machine (about 300 MB; set PLAYWRIGHT_BROWSERS_PATH to keep it off C:)
npm run test:e2e                  # starts `npm run dev` if nothing is running on port 3000
```

Against a deployed site: `E2E_BASE_URL=https://... npm run test:e2e`. The Vercel site is behind Vercel's sign-in, so
also set `E2E_VERCEL_SHARE_URL` to a temporary share link (Vercel dashboard → the deployment → Share). The link
expires; never commit it. More rounds: `E2E_TIMING_ROUNDS=10`.

## Test accounts

Each run creates **three accounts on staging** (two for the journey, one for the timing), named `حساب اختبار آلي`,
with phone numbers `09500XXXXX` and random passwords that are never printed. They are not deleted automatically,
because the app has no server-side key (rule R8). Delete them with
[`scripts/e2e-cleanup.sql`](../../scripts/e2e-cleanup.sql) in the staging project's SQL editor. Never run these
tests against a production database.

Not in CI yet: the run needs the staging values as GitHub secrets and creates accounts on every pull request
(team decision, change register 17 Nov 2026).

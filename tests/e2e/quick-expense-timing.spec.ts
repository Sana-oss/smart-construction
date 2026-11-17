import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { expect, test } from '@playwright/test';
import { createFirstProjectThroughUi, expectNoSidewaysScroll, newTestAccount, signUpThroughUi } from './helpers';

// Week-1 task 16: measure the quick expense (NFR-USE-03).
//
// What the requirement says: at most three required answers, the time is MEASURED, and the time threshold is agreed
// with the supervisor (requirements spec, open items). So this test:
//   - CHECKS the count: the form asks for at most three required answers;
//   - MEASURES how long the app makes the owner wait, at phone size, over several rounds:
//       open = tap «إضافة مصروف سريع» on the dashboard  -> form ready (save button enabled)
//       save = tap «حفظ المصروف»                           -> «تم حفظ المصروف» shown
//       list = tap «عرض المصروفات»                        -> the expenses list shown (S13.1)
//     Then «رجوع» goes back to the dashboard for the next round (not timed).
//     The robot types instantly, so this is the app's share of the time, not a person's reading and typing.
//     The person's share is measured by hand with the protocol in tests/e2e/README.md.
//   - does NOT fail on time unless E2E_QUICK_EXPENSE_MAX_MS is set (no threshold is agreed yet; we do not invent one).
// Results: printed, attached to the HTML report, and written to test-results/quick-expense-timing.json.

const ROUNDS = Number(process.env.E2E_TIMING_ROUNDS ?? 6);

interface Round {
  round: number;
  openMs: number;
  saveMs: number;
  listMs: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

async function timed(action: () => Promise<unknown>, done: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await action();
  await done();
  return Math.round(performance.now() - start);
}

test('quick expense: three required answers, and how long the app takes', async ({ page, baseURL }, testInfo) => {
  test.setTimeout(300_000);
  const account = newTestAccount();
  await signUpThroughUi(page, account);
  await createFirstProjectThroughUi(page, `مشروع قياس الزمن ${account.localPhone.slice(-4)}`);

  const saveButton = page.getByRole('button', { name: 'حفظ المصروف' });
  const rounds: Round[] = [];

  for (let round = 1; round <= ROUNDS; round++) {
    const openMs = await timed(
      () => page.getByRole('link', { name: 'إضافة مصروف سريع' }).click(),
      () => expect(saveButton).toBeEnabled(),
    );

    if (round === 1) {
      // The count NFR-USE-03 is about: required inputs in the quick-expense form.
      const required = await page.locator('form :is(input, select, textarea)[required]').count();
      expect(required, 'required answers in the quick expense').toBeLessThanOrEqual(3);
      await expectNoSidewaysScroll(page);
    }

    // The three required answers. Test data only.
    await page.getByLabel('اسم المصروف').fill(`مصروف قياس ${round}`);
    await page.getByLabel('المبلغ · د.ل').fill(`${100 + round}.5`);
    await page.getByLabel('نوع المصروف').selectOption({ label: 'مواد' });

    const saveMs = await timed(
      () => saveButton.click(),
      () => expect(page.getByText('تم حفظ المصروف')).toBeVisible(),
    );
    const listMs = await timed(
      () => page.getByRole('link', { name: 'عرض المصروفات' }).click(),
      () => expect(page.getByRole('heading', { name: 'المصروفات' })).toBeVisible(),
    );
    rounds.push({ round, openMs, saveMs, listMs });

    // Back to the dashboard for the next round (not timed).
    await page.getByRole('link', { name: 'رجوع' }).click();
    await expect(page.getByRole('heading', { name: 'لوحة المشروع' })).toBeVisible();
  }

  // Round 1 includes first-visit costs (in dev mode: compiling the page), so the summary uses the later rounds.
  const warm = rounds.length > 1 ? rounds.slice(1) : rounds;
  const summary = {
    measuredOn: new Date().toISOString(),
    baseURL,
    device: testInfo.project.name,
    requiredAnswers: 3,
    rounds,
    medianWarmMs: {
      open: median(warm.map((r) => r.openMs)),
      save: median(warm.map((r) => r.saveMs)),
      list: median(warm.map((r) => r.listMs)),
      openPlusSave: median(warm.map((r) => r.openMs + r.saveMs)),
    },
    worstWarmOpenPlusSaveMs: Math.max(...warm.map((r) => r.openMs + r.saveMs)),
  };

  console.table(rounds);
  console.log('quick expense, median of warm rounds (ms):', summary.medianWarmMs);
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/quick-expense-timing.json', `${JSON.stringify(summary, null, 2)}\n`);
  await testInfo.attach('quick-expense-timing', { body: JSON.stringify(summary, null, 2), contentType: 'application/json' });

  // Only once the team and the supervisor agree a threshold (then it is recorded in the requirements spec).
  const max = process.env.E2E_QUICK_EXPENSE_MAX_MS;
  if (max) expect(summary.medianWarmMs.openPlusSave, 'app time for one quick expense').toBeLessThanOrEqual(Number(max));
});

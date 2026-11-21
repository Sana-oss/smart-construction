import { expect, test, type Page } from '@playwright/test';
import { createFirstProjectThroughUi, expectNoSidewaysScroll, newTestAccount, signUpThroughUi, tripoliDate } from './helpers';

// The expenses report (FR-FIN-05; decisions of 21 Nov 2026). Runs against the staging project, at phone size.
// - Opened from the expenses list; totals by type and by phase that add up to every expense recorded.
// - «كل الفترات» compares each phase with its allocation (same 10% warning as S15.2); another period does not, and says why.
// - The period lives in the address; an unknown period falls back to «كل الفترات».

const owner = newTestAccount();

/** The 15th of last month in Libya: always inside «الشهر الماضي», whatever day the test runs. */
function lastMonth15(): string {
  const [y, m] = tripoliDate(0).split('-').map(Number);
  const year = m === 1 ? y - 1 : y;
  const month = m === 1 ? 12 : m - 1;
  return `${year}-${String(month).padStart(2, '0')}-15`;
}

async function addExpense(page: Page, e: { title: string; amount: string; type: string; date?: string; noPhase?: boolean }) {
  await page.goto('/expenses/new');
  await page.getByLabel('اسم المصروف').fill(e.title);
  await page.getByLabel('المبلغ · د.ل').fill(e.amount);
  await page.getByLabel('نوع المصروف').selectOption({ label: e.type });
  if (e.noPhase) await page.getByLabel('المرحلة').selectOption({ label: 'غير مرتبط بمرحلة' });
  if (e.date) await page.getByLabel('التاريخ').fill(e.date);
  await page.getByRole('button', { name: 'حفظ المصروف' }).click();
  await expect(page.getByText('تم حفظ المصروف')).toBeVisible({ timeout: 30_000 });
}

const card = (page: Page) => page.locator('main').getByText(/^مجموع المصروفات · /).locator('..');
const byType = (page: Page) => page.getByRole('list', { name: 'حسب نوع المصروف' });
const byPhase = (page: Page) => page.getByRole('list', { name: 'حسب المرحلة' });
const phaseRow = (page: Page, name: string) => byPhase(page).getByRole('listitem').filter({ hasText: name });

test('owner reads the expenses report by phase and type (FR-FIN-05)', async ({ page }) => {
  await signUpThroughUi(page, owner);
  await createFirstProjectThroughUi(page, `مشروع تقرير ${owner.localPhone.slice(-4)}`);

  await addExpense(page, { title: 'حديد تسليح', amount: '12000', type: 'مواد' });
  await addExpense(page, { title: 'أجرة عمال الصبة', amount: '1800', type: 'عمالة', noPhase: true });
  await addExpense(page, { title: 'حديد ربط', amount: '300', type: 'مواد', date: lastMonth15() });

  // An allocation for the phase the expenses went to: 12,300 spent of 10,000 = 123%, over the 10% margin.
  await page.goto('/budget/phases/edit');
  await page.getByLabel('الهيكل الخرساني · د.ل').fill('10000');
  await page.getByRole('button', { name: 'حفظ التوزيع' }).click();
  await expect(page.getByText('حُفظ توزيع الميزانية.')).toBeVisible({ timeout: 30_000 });

  // Opened from the expenses list.
  await page.goto('/expenses');
  await page.getByRole('link', { name: /تقرير المصروفات/ }).click();
  await expect(page.getByRole('heading', { name: 'تقرير المصروفات' })).toBeVisible();
  await expectNoSidewaysScroll(page);

  // «كل الفترات»: every expense; the types and the phases add up to the same total.
  await expect(card(page)).toContainText('كل الفترات');
  await expect(card(page)).toContainText('14,100');
  await expect(card(page)).toContainText('3 مصروفات');
  await expect(byType(page).getByRole('listitem').filter({ hasText: 'مواد' })).toContainText('12,300');
  await expect(byType(page).getByRole('listitem').filter({ hasText: 'عمالة' })).toContainText('1,800');
  await expect(byType(page).getByRole('listitem').filter({ hasText: 'خدمات' })).toContainText('0');
  await expect(phaseRow(page, 'الهيكل الخرساني')).toContainText('12,300');
  await expect(phaseRow(page, 'الهيكل الخرساني')).toContainText('المخصص: 10,000 د.ل · 123% من المخصص');
  await expect(phaseRow(page, 'الهيكل الخرساني')).toContainText('تجاوز المخصص بأكثر من 10%');
  await expect(phaseRow(page, 'مصروفات بلا مرحلة')).toContainText('1,800');
  // A phase with nothing spent is still listed.
  await expect(byPhase(page).getByText('لا مصروفات').first()).toBeVisible();

  // Last month: only that expense, and no comparison with the allocation (it covers the whole project).
  await page.getByLabel('الفترة').selectOption({ label: 'الشهر الماضي' });
  await page.getByRole('button', { name: 'عرض التقرير' }).click();
  await expect(page).toHaveURL(/\/expenses\/report\?period=last_month/);
  await expect(card(page)).toContainText('الشهر الماضي');
  await expect(card(page)).toContainText('300');
  await expect(phaseRow(page, 'الهيكل الخرساني')).toContainText('300');
  await expect(phaseRow(page, 'الهيكل الخرساني')).not.toContainText('المخصص');
  await expect(byPhase(page).getByText('مصروفات بلا مرحلة')).toHaveCount(0);
  await expect(page.getByText(/المقارنة بالمخصص تظهر مع «كل الفترات» فقط/)).toBeVisible();

  // An unknown period in a hand-made address: «كل الفترات», never an error.
  await page.goto('/expenses/report?period=forever');
  await expect(card(page)).toContainText('كل الفترات');
  await expect(card(page)).toContainText('14,100');
});

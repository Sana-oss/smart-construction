import { expect, test, type Page } from '@playwright/test';
import { createFirstProjectThroughUi, expectNoSidewaysScroll, newTestAccount, signUpThroughUi, tripoliDate } from './helpers';

// Filter the expenses list (design S13.2; FR-FIN-05 groundwork). Runs against the staging project, at phone size.
// - «التصفية والبحث» opens the filter; the results card totals ALL the matching expenses.
// - Search finds the name or the supplier; period, phase and type narrow it; no match has its own message.
// - The filter lives in the address; a hand-made address with odd characters is cleaned, never an error.

const owner = newTestAccount();

/** The 15th of last month in Libya: always inside «الشهر الماضي», whatever day the test runs. */
function lastMonth15(): string {
  const [y, m] = tripoliDate(0).split('-').map(Number);
  const year = m === 1 ? y - 1 : y;
  const month = m === 1 ? 12 : m - 1;
  return `${year}-${String(month).padStart(2, '0')}-15`;
}

async function addExpense(page: Page, e: { title: string; amount: string; type: string; payee?: string; date?: string; noPhase?: boolean }) {
  await page.goto('/expenses/new');
  await page.getByLabel('اسم المصروف').fill(e.title);
  await page.getByLabel('المبلغ · د.ل').fill(e.amount);
  await page.getByLabel('نوع المصروف').selectOption({ label: e.type });
  if (e.payee) await page.getByLabel('المورد أو المستفيد').fill(e.payee);
  if (e.noPhase) await page.getByLabel('المرحلة').selectOption({ label: 'غير مرتبط بمرحلة' });
  if (e.date) await page.getByLabel('التاريخ').fill(e.date);
  await page.getByRole('button', { name: 'حفظ المصروف' }).click();
  await expect(page.getByText('تم حفظ المصروف')).toBeVisible({ timeout: 30_000 });
}

const rows = (page: Page) => page.getByRole('list', { name: 'المصروفات' }).getByRole('link');
const card = (page: Page) => page.locator('main').getByText('مجموع النتائج').locator('..');

async function openFilter(page: Page) {
  await page.getByRole('link', { name: /التصفية والبحث/ }).click();
  await expect(page.getByRole('heading', { name: 'تصفية المصروفات' })).toBeVisible();
}

test('owner filters the expenses list (S13.2)', async ({ page }) => {
  await signUpThroughUi(page, owner);
  await createFirstProjectThroughUi(page, `مشروع تصفية ${owner.localPhone.slice(-4)}`);

  await addExpense(page, { title: 'حديد تسليح', amount: '12000', type: 'مواد', payee: 'مصنع مصراتة' });
  await addExpense(page, { title: 'أجرة عمال الصبة', amount: '1800', type: 'عمالة', noPhase: true });
  await addExpense(page, { title: 'حديد ربط', amount: '300', type: 'مواد', date: lastMonth15() });

  // Search + type: both «حديد» expenses, from two months; the card totals them (12,000 + 300).
  await page.goto('/expenses');
  await openFilter(page);
  await expectNoSidewaysScroll(page);
  await page.getByLabel('بحث باسم المصروف أو المورد').fill('حديد');
  await page.getByLabel('نوع المصروف').selectOption({ label: 'مواد' });
  await page.getByRole('button', { name: 'تطبيق التصفية' }).click();
  await expect(page).toHaveURL(/\/expenses\?.*type=materials/);
  await expect(card(page)).toContainText('12,300');
  await expect(card(page)).toContainText('مصروفان مسجلان');
  await expect(rows(page)).toHaveText([/حديد تسليح/, /حديد ربط/]);
  await expect(page.getByText('«حديد» · مواد')).toBeVisible();

  // The filter page opens with the filter in use; adding «هذا الشهر» leaves only this month's one.
  await openFilter(page);
  await expect(page.getByLabel('بحث باسم المصروف أو المورد')).toHaveValue('حديد');
  await expect(page.getByLabel('نوع المصروف')).toHaveValue('materials');
  await page.getByLabel('الفترة').selectOption({ label: 'هذا الشهر' });
  await page.getByRole('button', { name: 'تطبيق التصفية' }).click();
  await expect(rows(page)).toHaveText([/حديد تسليح/]);
  await expect(card(page)).toContainText('12,000');

  // The supplier is searched too.
  await page.goto('/expenses?q=مصراتة');
  await expect(rows(page)).toHaveText([/حديد تسليح/]);

  // Last month only.
  await page.goto('/expenses?period=last_month');
  await expect(rows(page)).toHaveText([/حديد ربط/]);
  await expect(card(page)).toContainText('300');

  // By phase: the expense recorded without a phase is left out.
  await page.goto('/expenses');
  await openFilter(page);
  await page.getByLabel('المرحلة').selectOption({ label: 'الهيكل الخرساني' });
  await page.getByRole('button', { name: 'تطبيق التصفية' }).click();
  await expect(rows(page)).toHaveText([/حديد تسليح/, /حديد ربط/]);

  // Nothing matches: its own message, not the «no expenses yet» screen.
  await page.goto('/expenses?q=اسمنت');
  await expect(page.getByText('لا توجد مصروفات تطابق التصفية')).toBeVisible();
  await expect(page.getByText('لا توجد مصروفات بعد')).toHaveCount(0);
  await expect(card(page)).toContainText('0');

  // «مسح التصفية» goes back to the month view with every expense.
  await page.getByRole('link', { name: 'مسح التصفية' }).click();
  await expect(page).toHaveURL(/\/expenses$/);
  await expect(page.getByText('مصروفات هذا الشهر')).toBeVisible();
  await expect(rows(page)).toHaveCount(3);

  // A hand-made address: odd characters are cleaned, unknown values ignored. Never an error page.
  await page.goto('/expenses?q=%25%2C(title.eq.x)&type=food&phase=abc&period=forever');
  await expect(page.getByRole('heading', { name: 'المصروفات' })).toBeVisible();
  await expect(page.getByText('لا توجد مصروفات تطابق التصفية')).toBeVisible(); // "title eq x" matches nothing
  await page.goto('/expenses?q=%25&type=food');
  await expect(page.getByText('مصروفات هذا الشهر')).toBeVisible(); // nothing left = no filter
  await expect(rows(page)).toHaveCount(3);
});

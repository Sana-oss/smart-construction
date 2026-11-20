import { expect, test, type Page } from '@playwright/test';
import { createFirstProjectThroughUi, expectNoSidewaysScroll, newTestAccount, signedInClient, signInThroughUi, signUpThroughUi, tripoliDate } from './helpers';

// Foreign currency and the owner's reference rates (3.18, FR-FIN-04; decisions of 20 Nov 2026). Runs against the staging
// project at phone size, and needs migration 0020 there. The wizard gives 5,000 spent before the app (helpers.ts).

const owner = newTestAccount();
const stranger = newTestAccount();

async function addRate(page: Page, currency: string, rate: string, date?: string, note?: string) {
  await page.goto('/rates/new');
  await page.getByLabel('العملة').selectOption({ label: currency });
  await page.getByLabel('د.ل لكل وحدة واحدة').fill(rate);
  if (date) await page.getByLabel('التاريخ').fill(date);
  if (note) await page.getByLabel(/ملاحظة/).fill(note);
  await page.getByRole('button', { name: 'حفظ السعر' }).click();
}

test.describe.serial('foreign currency and reference rates (3.18)', () => {
  test('owner keeps reference rates, and records an expense paid in dollars', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع عملة ${owner.localPhone.slice(-4)}`);

    // The log: empty, then two dollar rates; the newest is «آخر سعر». A rate with 5 decimals is refused.
    await page.goto('/more');
    await page.getByRole('link', { name: /أسعار الصرف المرجعية/ }).click();
    await expect(page.getByText('لا أسعار صرف مسجلة بعد')).toBeVisible();
    await addRate(page, 'دولار أمريكي (USD)', '7.12345');
    await expect(page.getByText('اكتب سعرًا مثل 7.25، بأربع خانات عشرية على الأكثر.')).toBeVisible();
    await addRate(page, 'دولار أمريكي (USD)', '7.1', tripoliDate(-10));
    await expect(page.getByRole('status').filter({ hasText: 'حُفظ سعر الصرف' })).toBeVisible();
    await addRate(page, 'دولار أمريكي (USD)', '7.25', undefined, 'السوق الموازي');
    const latest = page.getByRole('list', { name: 'آخر سعر لكل عملة' }).getByRole('listitem');
    await expect(latest).toHaveCount(1);
    await expect(latest.first()).toContainText('7.25');
    await expect(page.getByRole('list', { name: 'كل الأسعار المسجلة' }).getByRole('listitem')).toHaveCount(2);
    await expectNoSidewaysScroll(page);

    // A quick expense paid in dollars: the rate starts at the latest one, and the LYD amount is computed, not typed.
    await page.goto('/expenses/new');
    await page.getByLabel('اسم المصروف').fill('حديد تركي');
    await page.getByLabel('نوع المصروف').selectOption({ label: 'مواد' });
    await page.getByText('دُفع بعملة أخرى').click();
    await page.getByLabel('العملة').selectOption({ label: 'دولار أمريكي (USD)' });
    await expect(page.getByLabel(/سعر الصرف/)).toHaveValue('7.25');
    await expect(page.getByLabel('المبلغ · د.ل')).toHaveJSProperty('readOnly', true);
    await page.getByLabel(/المبلغ بالعملة/).fill('1,000');
    await expect(page.getByRole('status').filter({ hasText: 'المبلغ بالدينار' })).toContainText('7,250');
    await expectNoSidewaysScroll(page);
    await page.getByRole('button', { name: 'حفظ المصروف' }).click();
    await expect(page.getByText('تم حفظ المصروف')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('7,250', { exact: true })).toBeVisible();
    await expect(page.locator('main')).toContainText('1,000 USD بسعر 7.25');

    // The list shows what was paid in dollars; the dashboard totals in LYD (5,000 before the app + 7,250).
    await page.getByRole('link', { name: 'عرض المصروفات' }).click();
    const row = page.getByRole('list', { name: 'المصروفات' }).getByRole('listitem').first();
    await expect(row).toContainText('1,000 USD بسعر 7.25');
    await expect(row).toContainText('7,250');
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'لوحة المشروع' }).getByRole('link', { name: /المصروفات/ })).toContainText('12,250');
  });

  test('editing the rate recomputes the expense; a newer rate in the log does not', async ({ page }) => {
    await signInThroughUi(page, owner);
    await page.goto('/expenses');
    await page.getByRole('link', { name: 'فتح المصروف: حديد تركي' }).click();
    await expect(page.getByLabel('العملة', { exact: true })).toHaveValue('USD');
    await expect(page.getByLabel(/المبلغ بالعملة/)).toHaveValue('1,000');
    await expect(page.getByLabel(/سعر الصرف/)).toHaveValue('7.25');
    await page.getByLabel(/سعر الصرف/).fill('7.3');
    await page.getByRole('button', { name: 'حفظ التعديل' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظ التعديل' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'المصروفات' }).getByRole('listitem').first()).toContainText('7,300');

    await addRate(page, 'دولار أمريكي (USD)', '8');
    await page.goto('/expenses');
    await expect(page.getByRole('list', { name: 'المصروفات' }).getByRole('listitem').first()).toContainText('7,300');

    const asOwner = await signedInClient(owner);
    const { data } = await asOwner.from('expenses').select('amount_lyd::text, original_amount::text, original_currency, rate_lyd_per_unit::text').single();
    await asOwner.auth.signOut();
    expect(data).toEqual({ amount_lyd: '7300.000', original_amount: '1000.000', original_currency: 'USD', rate_lyd_per_unit: '7.3000' });
  });

  test('a stranger can neither see nor change the rates', async ({ page }) => {
    await signUpThroughUi(page, stranger);
    const asStranger = await signedInClient(stranger);
    const read = await asStranger.from('exchange_rates').select('id');
    const changed = await asStranger.from('exchange_rates').update({ lyd_per_unit: '1' }).neq('currency', 'X').select('id');
    await asStranger.auth.signOut();
    expect(read.data ?? []).toHaveLength(0);
    expect(changed.data ?? []).toHaveLength(0);
  });
});

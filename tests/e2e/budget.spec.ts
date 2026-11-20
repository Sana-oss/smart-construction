import { expect, test, type Page } from '@playwright/test';
import { createFirstProjectThroughUi, expectNoSidewaysScroll, newTestAccount, signedInClient, signUpThroughUi } from './helpers';

// The budget plan (design S15.1, S15.2; FR-FIN-11 with D5 = 10%; 3.16 financial part, slice 1). Runs against the staging
// project at phone size, and needs migration 0021 there. The wizard gives a 450,000 budget and 5,000 spent before the
// app; the current phase is «الهيكل الخرساني» (helpers.ts).

const owner = newTestAccount();
const stranger = newTestAccount();

async function addExpense(page: Page, title: string, amount: string, noPhase = false) {
  await page.goto('/expenses/new');
  await page.getByLabel('اسم المصروف').fill(title);
  await page.getByLabel('المبلغ · د.ل').fill(amount);
  await page.getByLabel('نوع المصروف').selectOption({ label: 'مواد' });
  if (noPhase) await page.getByLabel('المرحلة').selectOption({ label: 'غير مرتبط بمرحلة' });
  await page.getByRole('button', { name: 'حفظ المصروف' }).click();
  await expect(page.getByText('تم حفظ المصروف')).toBeVisible({ timeout: 30_000 });
}

const phaseRow = (page: Page, name: string) => page.getByRole('list', { name: 'توزيع الميزانية' }).getByRole('listitem').filter({ hasText: name });

test.describe.serial('budget plan (S15)', () => {
  test('owner allocates the budget to phases and sees the 10% warning', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع ميزانية ${owner.localPhone.slice(-4)}`);
    await addExpense(page, 'خرسانة جاهزة', '70000');
    await addExpense(page, 'أدوات متفرقة', '250', true);

    // From the dashboard's «المتبقي من الميزانية» to S15.1: 450,000 − (5,000 + 70,000 + 250).
    await page.goto('/');
    await page.getByRole('navigation', { name: 'لوحة المشروع' }).getByRole('link', { name: /المتبقي من الميزانية/ }).click();
    await expect(page.getByRole('heading', { name: 'ميزانية المشروع' })).toBeVisible();
    const summary = page.locator('main').getByText('المتبقي من الميزانية').locator('..');
    await expect(summary).toContainText('374,750');
    await expect(summary).toContainText('المعتمد: 450,000 · المصروف: 75,250');
    await expect(page.getByText('العقود والدفعات')).toBeVisible();
    await expectNoSidewaysScroll(page);

    // S15.2 before any allocation: every phase «بلا مخصص»; the unassigned expense and the money spent before apart.
    await page.getByRole('link', { name: /تفصيل الميزانية حسب المراحل/ }).click();
    await expect(page.getByRole('heading', { name: 'توزيع الميزانية' })).toBeVisible();
    await expect(phaseRow(page, 'الهيكل الخرساني')).toContainText('بلا مخصص');
    await expect(phaseRow(page, 'الهيكل الخرساني')).toContainText('مصروف: 70,000 د.ل');
    await expect(phaseRow(page, 'مصروفات بلا مرحلة')).toContainText('250');
    await expect(phaseRow(page, 'المصروف قبل التطبيق')).toContainText('5,000');
    await expect(phaseRow(page, 'احتياطي المشروع')).toBeVisible();

    // Allocate: a wrong amount is refused and the others stay; then 60,000 to the structure.
    await page.getByRole('link', { name: 'تعديل التوزيع' }).click();
    await page.getByLabel('الهيكل الخرساني · د.ل').fill('60,000');
    await page.getByLabel('المباني والتأسيسات · د.ل').fill('abc');
    await page.getByRole('button', { name: 'حفظ التوزيع' }).click();
    await expect(page.getByText(/اكتب رقمًا صحيحًا/)).toBeVisible();
    await expect(page.getByLabel('الهيكل الخرساني · د.ل')).toHaveValue('60,000');
    await page.getByLabel('المباني والتأسيسات · د.ل').fill('');
    await expectNoSidewaysScroll(page);
    await page.getByRole('button', { name: 'حفظ التوزيع' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظ توزيع الميزانية' })).toBeVisible();

    // 70,000 spent on a 60,000 allocation: 116%, more than 10% over (FR-FIN-11).
    const structure = phaseRow(page, 'الهيكل الخرساني');
    await expect(structure).toContainText('60,000');
    await expect(structure).toContainText('116% من المخصص');
    await expect(structure).toContainText('تجاوز المخصص بأكثر من 10%');
    await expect(page.getByText(/الموزّع 60,000 من/)).toBeVisible();

    // S15.1 says so too.
    await page.getByRole('link', { name: 'العودة للميزانية' }).click();
    await expect(page.getByText('مرحلة واحدة تجاوزت مخصصها بأكثر من 10%.')).toBeVisible();

    // An allocation above the budget is a warning, not a refusal (decision D2).
    await page.goto('/budget/phases/edit');
    await page.getByLabel('الهيكل الخرساني · د.ل').fill('600000');
    await page.getByRole('button', { name: 'حفظ التوزيع' }).click();
    await expect(page.getByText(/مجموع المخصصات أكبر من الميزانية بعد بند الطوارئ/)).toBeVisible();
    await expect(phaseRow(page, 'الهيكل الخرساني')).not.toContainText('تجاوز المخصص');

    // Clearing the field removes the allocation.
    await page.goto('/budget/phases/edit');
    await page.getByLabel('الهيكل الخرساني · د.ل').fill('');
    await page.getByRole('button', { name: 'حفظ التوزيع' }).click();
    await expect(phaseRow(page, 'الهيكل الخرساني')).toContainText('بلا مخصص');

    const asOwner = await signedInClient(owner);
    const { data } = await asOwner.from('audit_log').select('action').eq('table_name', 'budget_categories');
    await asOwner.auth.signOut();
    expect(data!.map((a) => a.action).sort()).toEqual(['deleted', 'updated']);
  });

  test('a stranger can neither see nor change the allocations', async ({ page }) => {
    await signUpThroughUi(page, stranger);
    const asStranger = await signedInClient(stranger);
    const read = await asStranger.from('budget_categories').select('id');
    const changed = await asStranger.from('budget_categories').update({ planned_lyd: '0' }).gte('planned_lyd', 0).select('id');
    await asStranger.auth.signOut();
    expect(read.data ?? []).toHaveLength(0);
    expect(changed.data ?? []).toHaveLength(0);
  });
});

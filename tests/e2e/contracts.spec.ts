import { expect, test, type Page } from '@playwright/test';
import { createFirstProjectThroughUi, expectNoSidewaysScroll, newTestAccount, signedInClient, signUpThroughUi } from './helpers';

// Contracts and the payment schedule (FR-FIN-08, FR-FIN-09; 3.16 contractual part, slice 1). Runs against the staging
// project at phone size, and needs migration 0031 there. Paying an installment and its due rule are slice 2.

const owner = newTestAccount();
const stranger = newTestAccount();

async function addPayment(page: Page, title: string, amount: string, retained = '') {
  await page.getByRole('link', { name: 'إضافة دفعة' }).click();
  await page.getByLabel('اسم الدفعة').fill(title);
  await page.getByLabel('قيمة الدفعة · د.ل').fill(amount);
  if (retained) await page.getByLabel('الجزء المحتجز · د.ل').fill(retained);
  await page.getByRole('button', { name: 'حفظ الدفعة' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'حُفظت الدفعة في الجدول' })).toBeVisible();
}

const card = (page: Page) => page.locator('main').getByText('قيمة العقد').first().locator('..');

test.describe.serial('contracts and payments (FR-FIN-08, FR-FIN-09)', () => {
  test('a contract with its payment schedule, warn-never-block, and deleting', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع عقود ${owner.localPhone.slice(-4)}`);

    // From S15.1 the row is a link now, and the list is empty.
    await page.goto('/budget');
    const row = page.getByRole('link', { name: /العقود والدفعات/ });
    await expect(row).toContainText('سجّل عقد المقاول وجدول دفعاته');
    await row.click();
    await expect(page.getByText('لا عقود مسجلة').first()).toBeVisible();

    // A refused form keeps the values.
    await page.getByRole('link', { name: 'إضافة عقد' }).click();
    await page.getByLabel('عنوان العقد').fill('عقد الهيكل الخرساني');
    await page.getByLabel('المقاول').fill('شركة البناء');
    await page.getByLabel('قيمة العقد · د.ل').fill('0');
    await page.getByRole('button', { name: 'حفظ العقد' }).click();
    await expect(page.getByText('يجب أن يكون المبلغ أكبر من صفر.')).toBeVisible();
    await expect(page.getByLabel('عنوان العقد')).toHaveValue('عقد الهيكل الخرساني');
    await expectNoSidewaysScroll(page);

    // The design's S17.2 contract: 90,000, with a cleanup clause.
    await page.getByLabel('قيمة العقد · د.ل').fill('90,000');
    await page.getByLabel('بند النظافة').fill('المقاول يزيل المخلفات على حسابه');
    await page.getByRole('button', { name: 'حفظ العقد' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظ العقد' })).toBeVisible();
    await expect(card(page)).toContainText('90,000');
    await expect(card(page).locator('..')).toContainText('المدفوع: 0 · المتبقي: 90,000');
    await expect(page.getByText('المقاول يزيل المخلفات على حسابه')).toBeVisible();
    await expectNoSidewaysScroll(page);

    // The first installment, with a retained part the owner typed (never suggested).
    await addPayment(page, 'الدفعة الأولى', '30,000', '3,000');
    await expect(page.getByRole('listitem').filter({ hasText: 'الدفعة الأولى' })).toContainText('محتجز 3,000 د.ل');
    await expect(page.getByText('المحتجز في الجدول: 3,000 د.ل')).toBeVisible();

    // A retained part above the payment is refused and keeps the values.
    await page.getByRole('link', { name: 'إضافة دفعة' }).click();
    await page.getByLabel('اسم الدفعة').fill('الدفعة الثانية');
    await page.getByLabel('قيمة الدفعة · د.ل').fill('15000');
    await page.getByLabel('الجزء المحتجز · د.ل').fill('16000');
    await page.getByRole('button', { name: 'حفظ الدفعة' }).click();
    await expect(page.getByText('المبلغ المحتجز لا يزيد على قيمة الدفعة.')).toBeVisible();
    await expect(page.getByLabel('اسم الدفعة')).toHaveValue('الدفعة الثانية');
    await expectNoSidewaysScroll(page);

    // Fixed, and tied to a phase.
    await page.getByLabel('الجزء المحتجز · د.ل').fill('');
    await page.getByLabel('تستحق بعد المرحلة').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'حفظ الدفعة' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظت الدفعة في الجدول' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'الدفعة الثانية' })).toContainText('بعد مرحلة');
    // 30,000 + 15,000 scheduled: 45,000 of the contract is not scheduled yet.
    await expect(page.getByRole('listitem').filter({ hasText: 'باقي الدفعات' })).toContainText('45,000');

    // D2: a schedule above the contract value is shown with a warning, never refused.
    await addPayment(page, 'دفعة كبيرة', '60,000');
    await expect(page.getByRole('alert').filter({ hasText: 'مجموع الدفعات أكبر من قيمة العقد بـ 15,000 د.ل' })).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'حذف: دفعة كبيرة' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُذفت الدفعة' })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'مجموع الدفعات أكبر من قيمة العقد' })).toHaveCount(0);

    // The list (S17.1) and the budget row show the contract.
    await page.goto('/contracts');
    await expect(page.getByRole('link', { name: /عقد الهيكل الخرساني/ })).toContainText('المقاول: شركة البناء');
    await page.goto('/budget');
    await expect(page.getByRole('link', { name: /العقود والدفعات/ })).toContainText('عقد واحد مسجل · بقيمة 90,000 د.ل');

    // Deleting the contract asks first and takes its payments with it; both stay in the audit log.
    await page.goto('/contracts');
    await page.getByRole('link', { name: /عقد الهيكل الخرساني/ }).click();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'حذف العقد: عقد الهيكل الخرساني' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُذف العقد ودفعاته' })).toBeVisible();
    await expect(page.getByText('لا عقود مسجلة').first()).toBeVisible();

    const asOwner = await signedInClient(owner);
    const audit = await asOwner.from('audit_log').select('table_name, action, detail').in('table_name', ['contracts', 'payments']);
    await asOwner.auth.signOut();
    const rows = audit.data ?? [];
    expect(rows.some((a) => a.table_name === 'contracts' && a.action === 'deleted' && a.detail.before.title === 'عقد الهيكل الخرساني')).toBe(true);
    expect(rows.some((a) => a.table_name === 'payments' && a.action === 'deleted' && a.detail.before.title === 'دفعة كبيرة')).toBe(true);
  });

  test('a stranger can neither see nor change contracts and payments', async ({ page }) => {
    await signUpThroughUi(page, stranger);
    const asStranger = await signedInClient(stranger);
    const contracts = await asStranger.from('contracts').select('id');
    const payments = await asStranger.from('payments').select('id');
    const changed = await asStranger.from('contracts').update({ title: 'تعديل غريب' }).neq('title', 'x').select('id');
    await asStranger.auth.signOut();
    expect(contracts.data ?? []).toHaveLength(0);
    expect(payments.data ?? []).toHaveLength(0);
    expect(changed.data ?? []).toHaveLength(0);
  });
});

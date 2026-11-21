import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { createFirstProjectThroughUi, expectNoSidewaysScroll, newTestAccount, signedInClient, signUpThroughUi } from './helpers';

// Paying an installment, its expense, and releasing the retained part (FR-FIN-09; 3.16 contractual part, slice 2). Runs
// against the staging project at phone size, and needs migrations 0031 and 0032 there.

const owner = newTestAccount();
const owner2 = newTestAccount();
const stranger = newTestAccount();
const CONTRACT = 'عقد الهيكل الخرساني';

async function addContract(page: Page) {
  await page.goto('/contracts/new');
  await page.getByLabel('عنوان العقد').fill(CONTRACT);
  await page.getByLabel('المقاول').fill('شركة البناء');
  await page.getByLabel('قيمة العقد · د.ل').fill('90,000');
  await page.getByRole('button', { name: 'حفظ العقد' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'حُفظ العقد' })).toBeVisible();
}

/** @param phase 'last' = the last phase (never done in a new project), 'first', or none. */
async function addPayment(page: Page, title: string, amount: string, opts: { retained?: string; phase?: 'last' | 'first' } = {}) {
  await page.getByRole('link', { name: 'إضافة دفعة' }).click();
  await page.getByLabel('اسم الدفعة').fill(title);
  await page.getByLabel('قيمة الدفعة · د.ل').fill(amount);
  if (opts.retained) await page.getByLabel('الجزء المحتجز · د.ل').fill(opts.retained);
  if (opts.phase) {
    const n = await page.locator('#phaseId option').count();
    await page.getByLabel('تستحق بعد المرحلة').selectOption({ index: opts.phase === 'last' ? n - 1 : 1 });
  }
  await page.getByRole('button', { name: 'حفظ الدفعة' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'حُفظت الدفعة في الجدول' })).toBeVisible();
}

const openPayment = (page: Page, title: string) => page.getByRole('link', { name: new RegExp(title) }).first().click();
const summary = (page: Page) => page.locator('main').getByText(/المدفوع: .* · المتبقي: .*/);
const expenseRow = (page: Page, text: string) => page.getByRole('listitem').filter({ hasText: text });

test.describe.serial('paying an installment (FR-FIN-09)', () => {
  test('a payment before it is due asks first, makes one expense, and the retained part is released later', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع دفعات ${owner.localPhone.slice(-4)}`);
    await addContract(page);
    await addPayment(page, 'الدفعة الأولى', '30,000', { retained: '3,000', phase: 'last' });

    // S17.3: the phase is not done and has no photo, so the payment waits; paying asks first and nothing is saved.
    await openPayment(page, 'الدفعة الأولى');
    await expect(page.getByRole('heading', { name: 'تفاصيل الدفعة' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'شرط الاستحقاق' })).toContainText('بانتظار اعتماد المرحلة');
    await expect(page.getByRole('listitem').filter({ hasText: 'شرط الاستحقاق' })).toContainText('المرحلة لم تُنجَز بعد، لا صورة موثّقة للمرحلة');
    await expect(page.getByText('يُحوَّل الآن: 27,000 د.ل')).toBeVisible();
    await expectNoSidewaysScroll(page);
    await page.getByRole('button', { name: 'تأكيد السداد' }).click();
    await expect(page.getByText('اضغط على خانة التأكيد أولًا.')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'تأكيد التحويل' })).toContainText('غير مدفوعة');

    // After the owner ticks the confirmation: one expense of 27,000 (30,000 minus the 3,000 retained).
    await page.getByLabel('أعلم أن الدفعة غير مستحقة بعد، وأؤكد السداد').check();
    await page.getByRole('button', { name: 'تأكيد السداد' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'وُثّق الدفع وسُجّل مصروف واحد' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'تأكيد التحويل' })).toContainText('مدفوعة');
    await expect(page.getByRole('listitem').filter({ hasText: 'الجزء المحتجز' })).toContainText('3,000 د.ل حتى التسليم');
    await page.goto('/expenses');
    await expect(expenseRow(page, `الدفعة الأولى · ${CONTRACT}`)).toContainText('27,000');

    // The contract: 27,000 paid (the retained part is not paid yet), 63,000 remaining.
    await page.goto('/contracts');
    await page.getByRole('link', { name: new RegExp(CONTRACT) }).click();
    await expect(summary(page)).toContainText('المدفوع: 27,000 · المتبقي: 63,000');
    await expect(page.getByText('المحتجز في الجدول: 3,000 د.ل')).toBeVisible();

    // Releasing the retained part while phases are not done asks first (D2), then makes the second expense of 3,000.
    await openPayment(page, 'الدفعة الأولى');
    await expect(page.getByText('لم تُنجَز كل المراحل بعد')).toBeVisible();
    await page.getByRole('button', { name: 'تأكيد الإفراج' }).click();
    await expect(page.getByText('اضغط على خانة التأكيد أولًا.')).toBeVisible();
    await page.getByLabel('أعلم أن المراحل لم تنتهِ، وأؤكد الإفراج').check();
    await page.getByRole('button', { name: 'تأكيد الإفراج' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'أُفرج عن المحتجز وسُجّل مصروفه' })).toBeVisible();
    await page.goto('/expenses');
    await expect(expenseRow(page, 'إفراج المحتجز')).toContainText('3,000');
    await page.goto('/contracts');
    await page.getByRole('link', { name: new RegExp(CONTRACT) }).click();
    await expect(summary(page)).toContainText('المدفوع: 30,000 · المتبقي: 60,000');

    // Both confirmations are in the audit log, with what was missing.
    const asOwner = await signedInClient(owner);
    const audit = await asOwner.from('audit_log').select('action, detail').eq('table_name', 'payments');
    await asOwner.auth.signOut();
    const gaps = audit.data?.find((a) => a.action === 'payment_confirmed_before_due')?.detail.gaps;
    expect(gaps).toEqual(['phase_not_done', 'phase_without_photo']);
    expect(audit.data?.some((a) => a.action === 'release_confirmed_before_phases_done')).toBe(true);

    // Undo the release, then the payment: each asks first, deletes its expense, and the numbers go back.
    await openPayment(page, 'الدفعة الأولى');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'تراجع عن الإفراج: الدفعة الأولى' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'تراجعتَ عن الإفراج' })).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'تراجع عن السداد: الدفعة الأولى' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'تراجعتَ عن السداد' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'تأكيد التحويل' })).toContainText('غير مدفوعة');
    await page.goto('/expenses');
    await expect(expenseRow(page, 'الدفعة الأولى')).toHaveCount(0);
    await expect(expenseRow(page, 'إفراج المحتجز')).toHaveCount(0);
  });

  test('a payment not tied to a phase, one fully retained, and one that is due', async ({ page }) => {
    await signUpThroughUi(page, owner2);
    await createFirstProjectThroughUi(page, `مشروع دفعات ٢ ${owner2.localPhone.slice(-4)}`);
    await addContract(page);

    // Not tied to a phase: no condition, no warning, no tick needed.
    await addPayment(page, 'بداية الأعمال', '10,000');
    await openPayment(page, 'بداية الأعمال');
    await expect(page.getByRole('listitem').filter({ hasText: 'شرط الاستحقاق' })).toContainText('غير مرتبطة بمرحلة');
    await expect(page.getByText('الدفعة غير مستحقة بعد')).toHaveCount(0);
    await page.getByRole('button', { name: 'تأكيد السداد' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'وُثّق الدفع وسُجّل مصروف واحد' })).toBeVisible();

    // The whole payment is retained: paying makes no expense now.
    await page.getByRole('link', { name: 'العودة للعقد' }).click();
    await addPayment(page, 'محتجزة كلها', '500', { retained: '500' });
    await openPayment(page, 'محتجزة كلها');
    await page.getByRole('button', { name: 'تأكيد السداد' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'الدفعة كلها محتجزة، فلا مصروف الآن' })).toBeVisible();
    await page.goto('/expenses');
    await expect(expenseRow(page, 'بداية الأعمال')).toContainText('10,000');
    await expect(expenseRow(page, 'محتجزة كلها')).toHaveCount(0);

    // Due: the phase is done and has a photo (rows the owner's own session records), so no warning and no tick.
    await page.goto('/contracts');
    await page.getByRole('link', { name: new RegExp(CONTRACT) }).click();
    await addPayment(page, 'بعد المرحلة الأولى', '20,000', { phase: 'first' });
    const asOwner = await signedInClient(owner2);
    const project = await asOwner.from('projects').select('id').single();
    const firstPhase = await asOwner.from('phases').select('id').order('position').limit(1).single();
    const done = await asOwner.from('phases').update({ status: 'done' }).eq('id', firstPhase.data!.id).select('id');
    const photo = await asOwner.from('photos').insert({
      project_id: project.data!.id,
      phase_id: firstPhase.data!.id,
      storage_path: `${project.data!.id}/photos/${randomUUID()}.jpg`,
    });
    await asOwner.auth.signOut();
    expect(done.error).toBeNull();
    expect(photo.error).toBeNull();

    await page.reload();
    await openPayment(page, 'بعد المرحلة الأولى');
    await expect(page.getByRole('listitem').filter({ hasText: 'شرط الاستحقاق' })).toContainText('مستحقة');
    await expect(page.getByText('الدفعة غير مستحقة بعد')).toHaveCount(0);
    await page.getByRole('button', { name: 'تأكيد السداد' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'وُثّق الدفع وسُجّل مصروف واحد' })).toBeVisible();
    // Nothing was logged as «paid before due» for this payment.
    const check = await signedInClient(owner2);
    const audit = await check.from('audit_log').select('action').eq('table_name', 'payments').eq('action', 'payment_confirmed_before_due');
    await check.auth.signOut();
    expect(audit.data ?? []).toHaveLength(0);
  });

  test('a stranger can neither pay nor release, and anon cannot call the functions', async ({ page }) => {
    await signUpThroughUi(page, stranger);
    const asStranger = await signedInClient(stranger);
    const payment = randomUUID();
    const pay = await asStranger.rpc('confirm_payment_paid', { p_payment_id: payment, p_paid_on: '2026-11-01', p_expense_id: null, p_gaps: null });
    const release = await asStranger.rpc('release_payment_retained', { p_payment_id: payment, p_released_on: '2026-11-01', p_expense_id: randomUUID(), p_early: false });
    const read = await asStranger.from('payments').select('id');
    await asStranger.auth.signOut();
    expect(pay.error).not.toBeNull();
    expect(release.error).not.toBeNull();
    expect(read.data ?? []).toHaveLength(0);
  });
});

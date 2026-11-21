import { expect, test, type Page } from '@playwright/test';
import { createFirstProjectThroughUi, expectNoSidewaysScroll, newTestAccount, signedInClient, signUpThroughUi } from './helpers';

// Contracts deepening (3.16; owner's decisions of 21 Nov 2026): edit a contract (every field), edit an UNPAID installment
// (a paid one cannot be edited), and link extra works to a contract (shown on its page, never in its numbers). Runs against
// the staging project at phone size, and needs migrations 0031 and 0032 there. No migration of its own.

const owner = newTestAccount();
const stranger = newTestAccount();

async function addContract(page: Page, title: string, value: string) {
  await page.goto('/contracts/new');
  await page.getByLabel('عنوان العقد').fill(title);
  await page.getByLabel('المقاول').fill('شركة البناء');
  await page.getByLabel('قيمة العقد · د.ل').fill(value);
  await page.getByRole('button', { name: 'حفظ العقد' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'حُفظ العقد' })).toBeVisible();
}

async function addPayment(page: Page, title: string, amount: string, retained = '') {
  await page.getByRole('link', { name: 'إضافة دفعة' }).click();
  await page.getByLabel('اسم الدفعة').fill(title);
  await page.getByLabel('قيمة الدفعة · د.ل').fill(amount);
  if (retained) await page.getByLabel('الجزء المحتجز · د.ل').fill(retained);
  await page.getByRole('button', { name: 'حفظ الدفعة' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'حُفظت الدفعة في الجدول' })).toBeVisible();
}

const summary = (page: Page) => page.locator('main').getByText(/المدفوع: .* · المتبقي: .*/);

test.describe.serial('contracts deepening (3.16)', () => {
  test('edit a contract and an unpaid installment; a paid one cannot be edited', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع تعديل عقود ${owner.localPhone.slice(-4)}`);
    await addContract(page, 'عقد الهيكل الخرساني', '90,000');
    await addPayment(page, 'الدفعة الأولى', '30,000', '3,000');
    await addPayment(page, 'بداية الأعمال', '10,000');

    // Edit the contract: the form starts from the saved values; a refused edit keeps what the owner typed.
    await page.getByRole('link', { name: 'تعديل العقد: عقد الهيكل الخرساني' }).click();
    await expect(page.getByRole('heading', { name: 'تعديل العقد' })).toBeVisible();
    await expect(page.getByLabel('عنوان العقد')).toHaveValue('عقد الهيكل الخرساني');
    await expect(page.getByLabel('قيمة العقد · د.ل')).toHaveValue('90000.000');
    await expectNoSidewaysScroll(page);
    await page.getByLabel('عنوان العقد').fill('عقد الهيكل والسلالم');
    await page.getByLabel('قيمة العقد · د.ل').fill('0');
    await page.getByRole('button', { name: 'حفظ التعديل' }).click();
    await expect(page.getByText('يجب أن يكون المبلغ أكبر من صفر.')).toBeVisible();
    await expect(page.getByLabel('عنوان العقد')).toHaveValue('عقد الهيكل والسلالم');

    await page.getByLabel('قيمة العقد · د.ل').fill('95,000');
    await page.getByLabel('نطاق العقد').fill('الهيكل والسلالم');
    await page.getByRole('button', { name: 'حفظ التعديل' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظ تعديل العقد' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'عقد الهيكل والسلالم' })).toBeVisible();
    await expect(summary(page)).toContainText('المدفوع: 0 · المتبقي: 95,000');
    await expect(page.getByText('الهيكل والسلالم').first()).toBeVisible();

    // The old value stays in the audit log.
    const asOwner = await signedInClient(owner);
    const audit = await asOwner.from('audit_log').select('action, detail').eq('table_name', 'contracts').eq('action', 'updated');
    await asOwner.auth.signOut();
    expect(audit.data?.some((a) => Number(a.detail.before.value_lyd) === 90000 && Number(a.detail.after.value_lyd) === 95000)).toBe(true);

    // Edit an unpaid installment: saved values first; a retained part above the amount is refused.
    await page.getByRole('link', { name: 'تعديل: الدفعة الأولى' }).click();
    await expect(page.getByLabel('اسم الدفعة')).toHaveValue('الدفعة الأولى');
    await expect(page.getByLabel('قيمة الدفعة · د.ل')).toHaveValue('30000.000');
    await expect(page.getByLabel('الجزء المحتجز · د.ل')).toHaveValue('3000.000');
    await page.getByLabel('قيمة الدفعة · د.ل').fill('100');
    await page.getByLabel('الجزء المحتجز · د.ل').fill('101');
    await page.getByRole('button', { name: 'حفظ التعديل' }).click();
    await expect(page.getByText('المبلغ المحتجز لا يزيد على قيمة الدفعة.')).toBeVisible();
    await page.getByLabel('قيمة الدفعة · د.ل').fill('32,000');
    await page.getByLabel('الجزء المحتجز · د.ل').fill('3,200');
    await page.getByRole('button', { name: 'حفظ التعديل' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظ تعديل الدفعة' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'الدفعة الأولى' })).toContainText('32,000');
    await expect(page.getByRole('listitem').filter({ hasText: 'الدفعة الأولى' })).toContainText('محتجز 3,200 د.ل');

    // A paid installment has no edit link, and its edit address goes back to its page.
    await page.getByRole('link', { name: /^بداية الأعمال/ }).click();
    await expect(page.getByRole('heading', { name: 'تفاصيل الدفعة' })).toBeVisible();
    const paymentPage = page.url();
    await page.getByRole('button', { name: 'تأكيد السداد' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'وُثّق الدفع وسُجّل مصروف واحد' })).toBeVisible();
    await page.getByRole('link', { name: 'العودة للعقد' }).click();
    await expect(page.getByRole('link', { name: 'تعديل: بداية الأعمال' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'تعديل: الدفعة الأولى' })).toBeVisible();
    await page.goto(`${paymentPage}/edit`);
    await expect(page).toHaveURL(paymentPage);
  });

  test('extra works linked to a contract are shown on it and never change its numbers', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('رقم الهاتف').fill(owner.localPhone);
    await page.getByRole('textbox', { name: 'كلمة المرور', exact: true }).fill(owner.password);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/sign-in')); // signed in before going elsewhere
    await page.goto('/contracts');
    await page.getByRole('link', { name: /عقد الهيكل والسلالم/ }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'أعمال إضافية مرتبطة' })).toContainText('لا أعمال إضافية مرتبطة بهذا العقد');
    const contractUrl = page.url();
    const remainingBefore = await summary(page).innerText();

    // An approved work linked when it is recorded.
    await page.goto('/budget/extras/new');
    await page.getByLabel('الوصف').fill('نافذة إضافية');
    await page.getByLabel('القيمة · د.ل').fill('2,000');
    await page.getByLabel('الحالة').selectOption({ label: 'معتمدة' });
    await page.getByLabel('العقد').selectOption({ label: 'عقد الهيكل والسلالم' });
    await page.getByRole('button', { name: 'حفظ العمل' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظ العمل الإضافي' })).toBeVisible();
    // The list's choice is what is saved (the row's text also lists every contract, so the selected option is checked).
    await expect(page.getByLabel('عقد العمل الإضافي: نافذة إضافية').locator('option:checked')).toHaveText('عقد الهيكل والسلالم');

    // A proposed one, recorded without a contract, then linked from its row.
    await page.goto('/budget/extras/new');
    await page.getByLabel('الوصف').fill('باب حديد');
    await page.getByLabel('القيمة · د.ل').fill('1,000');
    await page.getByRole('button', { name: 'حفظ العمل' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظ العمل الإضافي' })).toBeVisible();
    await expect(page.getByLabel('عقد العمل الإضافي: باب حديد').locator('option:checked')).toHaveText('غير مرتبط بعقد');
    await page.getByLabel('عقد العمل الإضافي: باب حديد').selectOption({ label: 'عقد الهيكل والسلالم' });
    await page.getByRole('listitem').filter({ hasText: 'باب حديد' }).getByRole('button', { name: 'حفظ الربط' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'رُبط العمل بالعقد' })).toBeVisible();
    await expect(page.getByLabel('عقد العمل الإضافي: باب حديد').locator('option:checked')).toHaveText('عقد الهيكل والسلالم');
    await expectNoSidewaysScroll(page);

    // On the contract: approved 2,000 and proposed 1,000, and the contract's own numbers did not move.
    await page.goto(contractUrl);
    await expect(page.getByRole('listitem').filter({ hasText: 'أعمال إضافية مرتبطة' })).toContainText('معتمدة 2,000 · مقترحة 1,000 د.ل');
    await expect(page.getByText('لا تغيّر قيمة العقد ولا المتبقي منه')).toBeVisible();
    expect(await summary(page).innerText()).toBe(remainingBefore);

    // Unlinking takes it off the contract.
    await page.goto('/budget/extras');
    await page.getByLabel('عقد العمل الإضافي: باب حديد').selectOption({ label: 'غير مرتبط بعقد' });
    await page.getByRole('listitem').filter({ hasText: 'باب حديد' }).getByRole('button', { name: 'حفظ الربط' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'أُلغي ربط العمل بالعقد' })).toBeVisible();
    await page.goto(contractUrl);
    await expect(page.getByRole('listitem').filter({ hasText: 'أعمال إضافية مرتبطة' })).toContainText('معتمدة 2,000 · مقترحة 0 د.ل');
  });

  test('a stranger cannot link a work to the owner contract or edit it', async ({ page }) => {
    await signUpThroughUi(page, stranger);
    const asStranger = await signedInClient(stranger);
    const contracts = await asStranger.from('contracts').update({ title: 'تعديل غريب' }).neq('title', 'x').select('id');
    const works = await asStranger.from('change_orders').update({ contract_id: null }).neq('title', 'x').select('id');
    const payments = await asStranger.from('payments').update({ amount_lyd: 1 }).neq('title', 'x').select('id');
    await asStranger.auth.signOut();
    expect(contracts.data ?? []).toHaveLength(0);
    expect(works.data ?? []).toHaveLength(0);
    expect(payments.data ?? []).toHaveLength(0);
  });
});

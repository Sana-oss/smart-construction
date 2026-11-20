import { expect, test, type Page } from '@playwright/test';
import { createFirstProjectThroughUi, expectNoSidewaysScroll, newTestAccount, signedInClient, signUpThroughUi } from './helpers';

// Extra works and changes (FR-FIN-10; FR-FIN-11's contingency warning; 3.16 financial part, slice 2). Runs against the
// staging project at phone size, and needs migration 0022 there. The wizard gives a 450,000 budget with a 10%
// contingency: 45,000 (helpers.ts, DEFAULT_CONTINGENCY_PCT).

const owner = newTestAccount();
const stranger = newTestAccount();

async function addExtra(page: Page, title: string, cost: string, status: 'مقترحة' | 'معتمدة' = 'مقترحة') {
  await page.goto('/budget/extras/new');
  await page.getByLabel('الوصف').fill(title);
  await page.getByLabel('القيمة · د.ل').fill(cost);
  await page.getByLabel('الحالة').selectOption({ label: status });
  await page.getByRole('button', { name: 'حفظ العمل' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'حُفظ العمل الإضافي' })).toBeVisible();
}

const card = (page: Page) => page.locator('main').getByText('الأعمال الإضافية المعتمدة').locator('..');

test.describe.serial('extra works (FR-FIN-10)', () => {
  test('approved works come out of the contingency first, then above the budget', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع إضافات ${owner.localPhone.slice(-4)}`);

    // From S15.1 to the list: empty.
    await page.goto('/budget');
    await page.getByRole('link', { name: /الأعمال الإضافية والتغييرات/ }).click();
    await expect(page.getByText('لا أعمال إضافية مسجلة')).toBeVisible();

    // A refused form keeps the values.
    await page.getByRole('link', { name: 'إضافة عمل إضافي' }).click();
    await page.getByLabel('الوصف').fill('توسيع الشرفة');
    await page.getByLabel('القيمة · د.ل').fill('0');
    await page.getByRole('button', { name: 'حفظ العمل' }).click();
    await expect(page.getByText('يجب أن يكون المبلغ أكبر من صفر.')).toBeVisible();
    await expect(page.getByLabel('الوصف')).toHaveValue('توسيع الشرفة');
    await expectNoSidewaysScroll(page);

    // One proposed (counted nowhere), one approved straight away.
    await addExtra(page, 'توسيع الشرفة', '30,000');
    await addExtra(page, 'نافذة إضافية', '20000', 'معتمدة');
    await expect(card(page)).toContainText('20,000');
    await expect(card(page)).toContainText('متبقٍ منه: 25,000 د.ل');
    await expect(page.getByText('مقترحة بانتظار قرارك: 30,000 د.ل (لا تُحسب بعد)')).toBeVisible();
    await expectNoSidewaysScroll(page);

    // Approving the proposed one asks first; then 50,000 approved: the contingency is used up, 5,000 beyond.
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'اعتماد: توسيع الشرفة' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُدّثت حالة العمل الإضافي' })).toBeVisible();
    await expect(card(page)).toContainText('50,000');
    await expect(card(page)).toContainText('متبقٍ منه: 0 د.ل');

    await page.goto('/budget');
    await expect(page.getByText(/استُهلك بند الطوارئ بالأعمال الإضافية المعتمدة/)).toBeVisible();
    await expect(page.getByText(/التكلفة المتوقعة صارت 455,000 د.ل، أي فوق الميزانية بـ 5,000 د.ل/)).toBeVisible();
    await expect(page.getByRole('link', { name: /الأعمال الإضافية والتغييرات/ })).toContainText('معتمدة 50,000 · مقترحة 0 د.ل');
    await page.goto('/budget/phases');
    await expect(page.getByRole('list', { name: 'توزيع الميزانية' }).getByRole('listitem').filter({ hasText: 'احتياطي المشروع' })).toContainText(
      'للأعمال الإضافية المعتمدة: 50,000 د.ل · متبقٍ: 0 د.ل',
    );

    // A rejected work changes nothing; deleting an approved one gives the contingency back.
    await addExtra(page, 'باب حديد', '1000');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'رفض: باب حديد' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'باب حديد' })).toContainText('مرفوضة');
    await expect(card(page)).toContainText('50,000');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'حذف: نافذة إضافية' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُذف العمل الإضافي' })).toBeVisible();
    await expect(card(page)).toContainText('30,000');
    await expect(card(page)).toContainText('متبقٍ منه: 15,000 د.ل');
    await page.goto('/budget');
    await expect(page.getByText(/استُهلك بند الطوارئ/)).toHaveCount(0);

    // The approval, the rejection and the deletion are in the audit log.
    const asOwner = await signedInClient(owner);
    const { data } = await asOwner.from('audit_log').select('action, detail').eq('table_name', 'change_orders');
    await asOwner.auth.signOut();
    expect(data!.some((a) => a.action === 'updated' && a.detail.after.status === 'approved')).toBe(true);
    expect(data!.some((a) => a.action === 'updated' && a.detail.after.status === 'rejected')).toBe(true);
    expect(data!.some((a) => a.action === 'deleted' && a.detail.before.title === 'نافذة إضافية')).toBe(true);
  });

  test('a stranger can neither see nor change extra works', async ({ page }) => {
    await signUpThroughUi(page, stranger);
    const asStranger = await signedInClient(stranger);
    const read = await asStranger.from('change_orders').select('id');
    const changed = await asStranger.from('change_orders').update({ status: 'approved' }).neq('status', 'x').select('id');
    await asStranger.auth.signOut();
    expect(read.data ?? []).toHaveLength(0);
    expect(changed.data ?? []).toHaveLength(0);
  });
});

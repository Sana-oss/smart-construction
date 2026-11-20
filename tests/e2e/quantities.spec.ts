import { expect, test } from '@playwright/test';
import { createFirstProjectThroughUi, expectNoSidewaysScroll, navTab, newTestAccount, signedInClient, signInThroughUi, signUpThroughUi } from './helpers';

// The quantity table and purchases (3.3 slice 2; FR-MAT-01, FR-MAT-02, FR-MAT-03, FR-FIN-03; design S20.1, S20.2, S21.1).
// Runs against the staging project at phone size, and needs migration 0024 there.

const owner = newTestAccount();
const stranger = newTestAccount();

test.describe.serial('quantity table and purchases (3.3)', () => {
  test('a line, a purchase that becomes one expense, and the over-allowance warning', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع كميات ${owner.localPhone.slice(-4)}`);

    // The dashboard row opens the materials tab; the table is empty.
    await page.getByRole('link', { name: /المواد والكميات/ }).click();
    await expect(navTab(page, 'المواد')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('لا بنود في جدول الكميات بعد')).toBeVisible();

    // FR-MAT-01: a refused line keeps what was typed.
    await page.getByRole('link', { name: 'إضافة بند' }).click();
    await page.getByLabel(/^المادة/).fill('حديد تسليح');
    await page.getByLabel(/الكمية المطلوبة/).fill('0');
    await page.getByRole('button', { name: 'حفظ البند' }).click();
    await expect(page.getByText('هذا الحقل مطلوب.')).toBeVisible(); // the unit
    await expect(page.getByText('يجب أن يكون الرقم أكبر من صفر.')).toBeVisible();
    await expect(page.getByLabel(/^المادة/)).toHaveValue('حديد تسليح');

    await page.getByLabel(/^الوحدة/).fill('طن');
    await page.getByLabel(/الكمية المطلوبة/).fill('5');
    await page.getByLabel(/نسبة الهدر/).fill('10');
    await page.getByLabel(/^المرحلة/).selectOption({ label: 'الهيكل الخرساني' });
    await page.getByLabel(/^المصدر/).fill('جدول كميات المهندس');
    await page.getByRole('button', { name: 'حفظ البند' }).click();

    // S20.2: planned 5, allowed 5 + 10% = 5.5.
    await expect(page.getByRole('status').filter({ hasText: 'أُضيف البند' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'حديد تسليح' })).toBeVisible();
    await expect(page.getByText('تفاصيل بند · الهيكل الخرساني')).toBeVisible();
    await expect(page.getByText('المشترى: 0 طن · المتبقي للتوريد: 5 طن')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'المسموح مع الهدر' })).toContainText('5.5 طن');
    await expectNoSidewaysScroll(page);

    // S21.1: 3 t × 4,000 = one expense of 12,000.
    await page.getByRole('link', { name: 'تسجيل شراء لهذا البند' }).click();
    await expect(page.getByText('الهيكل الخرساني')).toBeVisible();
    await page.getByLabel(/الكمية · طن/).fill('3');
    await page.getByLabel(/سعر الوحدة/).fill('4,000');
    await page.getByLabel(/^المورد/).fill('مورد الحديد');
    await expectNoSidewaysScroll(page);
    await page.getByRole('button', { name: 'حفظ الشراء والمصروف' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظ الشراء وسُجّل مصروفه.' })).toBeVisible();
    await expect(page.getByText('المشترى: 3 طن · المتبقي للتوريد: 2 طن')).toBeVisible();
    await expect(page.getByRole('list', { name: 'المشتريات' })).toContainText('المصروف مسجّل');

    await navTab(page, 'المصروفات').click();
    const expense = page.getByRole('listitem').filter({ hasText: 'حديد تسليح' });
    await expect(expense).toHaveCount(1);
    await expect(expense).toContainText('12,000');

    // FR-MAT-03 / D2: 3 + 2.8 = 5.8 > 5.5 asks first and saves nothing; confirming saves it and logs the confirmation.
    await page.goto('/materials');
    await page.getByRole('link', { name: 'تفاصيل حديد تسليح' }).click();
    await page.getByRole('link', { name: 'تسجيل شراء لهذا البند' }).click();
    await page.getByLabel(/الكمية · طن/).fill('2.8');
    await page.getByLabel(/سعر الوحدة/).fill('4100');
    await page.getByRole('button', { name: 'حفظ الشراء والمصروف' }).click();
    await expect(page.getByText('بهذا الشراء يصير المشترى 5.8 طن، والمسموح 5.5 طن (الكمية مع الهدر)، أي تجاوز بـ 0.3 طن.')).toBeVisible();
    await expect(page.getByLabel(/الكمية · طن/)).toHaveValue('2.8');
    await page.getByLabel(/أؤكد الشراء رغم التجاوز/).check();
    await page.getByRole('button', { name: 'حفظ الشراء والمصروف' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظ الشراء وسُجّل مصروفه.' })).toBeVisible();
    await expect(page.getByText(/اشتُري فوق المسموح بـ 0.3 طن/)).toBeVisible();

    await page.goto('/materials');
    await expect(page.getByText('بند واحد اشتُري فوق الكمية المسموحة.')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'حديد تسليح' })).toContainText('تجاوز المسموح بـ 0.3 طن');
    await page.goto('/');
    await expect(page.getByRole('link', { name: /المواد والكميات/ })).toContainText('بند واحد فوق الكمية المسموحة');

    // Each purchase made exactly one expense, linked back; the confirmation is in the audit log.
    const asOwner = await signedInClient(owner);
    const { data: purchases } = await asOwner.from('purchases').select('id, expense_ref');
    const { data: expenses } = await asOwner.from('expenses').select('id, client_op_id, amount_lyd::text, expense_type').eq('title', 'حديد تسليح');
    const { data: audit } = await asOwner.from('audit_log').select('action').eq('table_name', 'purchases').eq('action', 'over_allowance_confirmed');
    await asOwner.auth.signOut();
    expect(purchases).toHaveLength(2);
    expect(expenses).toHaveLength(2);
    for (const p of purchases!) {
      const e = expenses!.find((x) => x.client_op_id === p.id);
      expect(e?.id).toBe(p.expense_ref);
      expect(e?.expense_type).toBe('materials');
    }
    expect(expenses!.map((e) => e.amount_lyd).sort()).toEqual(['11480.000', '12000.000']);
    expect(audit).toHaveLength(1);
  });

  test('an unused line can be deleted; one with purchases cannot', async ({ page }) => {
    await signInThroughUi(page, owner);
    await page.goto('/materials/items/new');
    await page.getByLabel(/^المادة/).fill('رمل');
    await page.getByLabel(/^الوحدة/).fill('م³');
    await page.getByLabel(/الكمية المطلوبة/).fill('20');
    await page.getByRole('button', { name: 'حفظ البند' }).click();
    await expect(page.getByRole('heading', { name: 'رمل' })).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'حذف البند' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُذف البند' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'رمل' })).toHaveCount(0);

    await page.getByRole('link', { name: 'تفاصيل حديد تسليح' }).click();
    await expect(page.getByRole('button', { name: 'حذف البند' })).toHaveCount(0);
  });

  test('a stranger can neither see nor buy on the quantity table', async ({ page }) => {
    await signUpThroughUi(page, stranger);
    const asOwner = await signedInClient(owner);
    const { data: lines } = await asOwner.from('quantity_items').select('id, project_id');
    await asOwner.auth.signOut();

    const asStranger = await signedInClient(stranger);
    const read = await asStranger.from('quantity_items').select('id');
    const bought = await asStranger.rpc('record_purchase', {
      p_project_id: lines![0].project_id,
      p_quantity_item_id: lines![0].id,
      p_qty: '1',
      p_unit_price_lyd: '10',
      p_client_op_id: crypto.randomUUID(),
    });
    await asStranger.auth.signOut();
    expect(read.data ?? []).toHaveLength(0);
    expect(bought.error).not.toBeNull();
  });
});

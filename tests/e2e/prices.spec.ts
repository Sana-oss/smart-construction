import { expect, test, type Page } from '@playwright/test';
import { createFirstProjectThroughUi, expectNoSidewaysScroll, newTestAccount, signedInClient, signUpThroughUi, tripoliDate } from './helpers';

// The owner's price log and supplier quotes (design S24; FR-MAT-08, FR-MAT-10; slice 2 of 3.7). Runs against the staging
// project at phone size, and needs migration 0018 there.

const owner = newTestAccount();
const stranger = newTestAccount();

const summary = (page: Page) => page.locator('main').getByText('آخر سعر').locator('..');

async function fillPrice(
  page: Page,
  p: { material?: string; unit?: string; price: string; kind?: 'سعر دفعته' | 'عرض من مورد'; supplier?: string; date?: string; expiresOn?: string; transport?: string; note?: string },
) {
  if (p.material !== undefined) await page.getByLabel('المادة').fill(p.material);
  if (p.unit !== undefined) await page.getByLabel('الوحدة').fill(p.unit);
  await page.getByLabel('السعر · د.ل').fill(p.price);
  if (p.kind) await page.getByLabel('نوع السعر').selectOption({ label: p.kind });
  if (p.supplier) await page.getByLabel('المورد').fill(p.supplier);
  if (p.date) await page.getByLabel('التاريخ', { exact: true }).fill(p.date);
  if (p.expiresOn) await page.getByLabel(/العرض صالح حتى/).fill(p.expiresOn);
  if (p.transport) await page.getByLabel(/تكلفة النقل/).fill(p.transport);
  if (p.note) await page.getByLabel(/ملاحظات/).fill(p.note);
  await page.getByRole('button', { name: 'حفظ السعر' }).click();
}

test.describe.serial('price log and quotes (S24)', () => {
  test('owner records prices and quotes, and sees each material with its latest price', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع أسعار ${owner.localPhone.slice(-4)}`);

    await page.goto('/more');
    await page.getByRole('link', { name: /سجل الأسعار/ }).click();
    await expect(page.getByRole('heading', { name: 'سجل الأسعار' })).toBeVisible();
    await expect(page.getByText('لا أسعار مسجلة بعد')).toBeVisible();

    // A price paid ten days ago: lands on the material's history (S24.2).
    await page.getByRole('link', { name: 'إضافة سعر' }).click();
    await expectNoSidewaysScroll(page);
    await fillPrice(page, { material: 'حديد التسليح', unit: 'طن', price: '3,850', supplier: 'مورد الحديد', date: tripoliDate(-10) });
    await expect(page.getByRole('heading', { name: 'تاريخ سعر حديد التسليح' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظ السعر' })).toBeVisible();
    await expect(summary(page)).toContainText('3,850');

    // «إضافة تحديث للسعر» starts on the same material; a newer price with transport becomes «آخر سعر».
    await page.getByRole('link', { name: 'إضافة تحديث للسعر' }).click();
    await expect(page.getByLabel('المادة')).toHaveValue('حديد التسليح');
    await expect(page.getByLabel('الوحدة')).toHaveValue('طن');
    await fillPrice(page, { price: '4000', supplier: 'مورد الحديد', transport: '200', note: 'توريد إلى الموقع' });
    await expect(summary(page)).toContainText('4,000');
    const history = page.getByRole('list', { name: 'تاريخ سعر حديد التسليح' }).getByRole('listitem');
    await expect(history).toHaveCount(2);
    await expect(history.first()).toContainText('نقل 200 د.ل');
    await expect(history.first()).toContainText('4,000');
    await expect(history.last()).toContainText('3,850');

    // A refused form keeps the values: an expiry date on a price paid.
    await page.goto('/prices/new');
    await fillPrice(page, { material: 'أسمنت', unit: 'كيس', price: '42', expiresOn: tripoliDate(3) });
    await expect(page.getByText('تاريخ الصلاحية للعروض فقط')).toBeVisible();
    await expect(page.getByLabel('المادة')).toHaveValue('أسمنت');

    // Two quotes: one expiring in 3 days (FR-MAT-10), one already expired (FR-DEC-03: marked).
    await page.getByLabel('نوع السعر').selectOption({ label: 'عرض من مورد' });
    await page.getByRole('button', { name: 'حفظ السعر' }).click();
    await expect(page.getByRole('heading', { name: 'تاريخ سعر أسمنت' })).toBeVisible();
    await page.getByRole('link', { name: 'إضافة تحديث للسعر' }).click();
    await fillPrice(page, { price: '40', kind: 'عرض من مورد', date: tripoliDate(-20), expiresOn: tripoliDate(-5) });
    const cement = page.getByRole('list', { name: 'تاريخ سعر أسمنت' }).getByRole('listitem');
    await expect(cement.first()).toContainText('ينتهي خلال 3 أيام');
    await expect(cement.last()).toContainText('عرض منتهي');

    // The log: one row per material, latest first, and the count of quotes expiring soon.
    await page.goto('/prices');
    const rows = page.getByRole('list', { name: 'سجل الأسعار' }).getByRole('listitem');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('أسمنت');
    await expect(rows.first()).toContainText('42');
    await expect(rows.first()).toContainText('ينتهي خلال 3 أيام');
    await expect(rows.last()).toContainText('حديد التسليح');
    await expect(rows.last()).toContainText('4,000');
    await expect(page.getByText('عرض سعر واحد ينتهي خلال 7 أيام.')).toBeVisible();
    await expectNoSidewaysScroll(page);
  });

  test('deleting asks first, and the audit log keeps the price', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('رقم الهاتف').fill(owner.localPhone);
    await page.getByRole('textbox', { name: 'كلمة المرور', exact: true }).fill(owner.password);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page.getByRole('heading', { name: 'لوحة المشروع' })).toBeVisible();

    await page.goto('/prices');
    await page.getByRole('link', { name: 'تاريخ سعر حديد التسليح لكل طن' }).click();
    const oldest = page.getByRole('list', { name: 'تاريخ سعر حديد التسليح' }).getByRole('listitem').last();
    page.once('dialog', (d) => d.accept());
    await oldest.getByRole('button', { name: /حذف سعر/ }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُذف السعر' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'تاريخ سعر حديد التسليح' }).getByRole('listitem')).toHaveCount(1);

    const asOwner = await signedInClient(owner);
    const { data } = await asOwner.from('audit_log').select('action, detail').eq('table_name', 'price_records');
    await asOwner.auth.signOut();
    expect(data).toHaveLength(1);
    expect(data![0].action).toBe('deleted');
    expect(data![0].detail.before).toMatchObject({ material: 'حديد التسليح', supplier: 'مورد الحديد', recorded_on: tripoliDate(-10) });
  });

  test('a stranger can neither see nor change the prices', async ({ page }) => {
    await signUpThroughUi(page, stranger);
    const asStranger = await signedInClient(stranger);
    const read = await asStranger.from('price_records').select('id');
    const changed = await asStranger.from('price_records').update({ price_lyd: '1' }).neq('material', '').select('id');
    const deleted = await asStranger.from('price_records').delete().neq('material', '').select('id');
    await asStranger.auth.signOut();
    expect(read.data ?? []).toHaveLength(0);
    expect(changed.data ?? []).toHaveLength(0);
    expect(deleted.data ?? []).toHaveLength(0);

    const asOwner = await signedInClient(owner);
    const { count } = await asOwner.from('price_records').select('id', { count: 'exact', head: true });
    await asOwner.auth.signOut();
    expect(count).toBe(3);
  });
});

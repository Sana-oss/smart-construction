import { expect, test } from '@playwright/test';
import {
  createFirstProjectThroughUi,
  newTestAccount,
  phoneReceiptJpeg,
  removeProjectFiles,
  signedInClient,
  signInThroughUi,
  signUpThroughUi,
  tripoliDate,
} from './helpers';
import { notFoundTextAr } from '../../src/app/messages.ar';

// Edit and delete an expense (owner's decision of 19 Nov 2026; FR-SYS-03). Runs against the staging project, at
// phone size, and needs migration 0016 there.
// - The owner opens an expense from the list, edits it, and the audit log holds the old and the new values.
// - A refused edit keeps what the owner typed.
// - Deleting asks twice; then the expense AND its receipt photo are gone, and the audit log keeps the old values.
// - A stranger can neither open, edit nor delete the owner's expense.

const owner = newTestAccount();
const stranger = newTestAccount();
const BUCKET = 'project-files';
const NOT_FOUND = notFoundTextAr.heading;

let projectId = '';

async function ownerQuery<T>(run: (c: Awaited<ReturnType<typeof signedInClient>>) => Promise<T>): Promise<T> {
  const client = await signedInClient(owner);
  try {
    return await run(client);
  } finally {
    await client.auth.signOut();
  }
}

test.describe.serial('edit and delete an expense', () => {
  test.afterAll(async () => {
    await removeProjectFiles(owner).catch(() => 0);
  });

  test('owner edits an expense; the audit log keeps the old and the new values', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع تعديل ${owner.localPhone.slice(-4)}`);
    projectId = await ownerQuery(async (c) => (await c.from('projects').select('id').single()).data!.id as string);

    // An expense with a receipt photo, recorded as usual.
    await page.getByRole('link', { name: 'إضافة مصروف سريع' }).click();
    await page.getByLabel('اسم المصروف').fill('رمل');
    await page.getByLabel('المبلغ · د.ل').fill('850');
    await page.getByLabel('نوع المصروف').selectOption({ label: 'مواد' });
    await page.locator('input[type="file"]').setInputFiles({ name: 'r.jpg', mimeType: 'image/jpeg', buffer: await phoneReceiptJpeg(page) });
    await expect(page.getByText('تغيير الصورة')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'حفظ المصروف' }).click();
    await expect(page.getByText('تم حفظ المصروف')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('link', { name: 'عرض المصروفات' }).click();

    // Open it from the list: the form shows the stored values.
    await page.getByRole('link', { name: 'فتح المصروف: رمل' }).click();
    await expect(page).toHaveURL(/\/expenses\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: 'تعديل المصروف' })).toBeVisible();
    await expect(page.getByLabel('اسم المصروف')).toHaveValue('رمل');
    await expect(page.getByLabel('المبلغ · د.ل')).toHaveValue('850');
    await expect(page.getByLabel('نوع المصروف')).toHaveValue('materials');
    await expect(page.getByLabel(/التاريخ/)).toHaveValue(tripoliDate(0));
    await expect(page.getByRole('link', { name: 'عرض صورة الفاتورة' })).toBeVisible();

    // A refused edit (empty name) keeps the other values, including the chosen type.
    await page.getByLabel('اسم المصروف').fill('');
    await page.getByLabel('نوع المصروف').selectOption({ label: 'خدمات' });
    await page.getByRole('button', { name: 'حفظ التعديل' }).click();
    await expect(page.getByText('هذا الحقل مطلوب.')).toBeVisible();
    await expect(page.getByLabel('نوع المصروف')).toHaveValue('services');

    // A real edit: name, amount, date.
    await page.getByLabel('اسم المصروف').fill('رمل مغسول');
    await page.getByLabel('المبلغ · د.ل').fill('900.5');
    await page.getByLabel(/التاريخ/).fill(tripoliDate(-2));
    await page.getByRole('button', { name: 'حفظ التعديل' }).click();
    await expect(page).toHaveURL(/\/expenses\?done=updated$/);
    await expect(page.getByRole('status').filter({ hasText: 'حُفظ التعديل' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'فتح المصروف: رمل مغسول' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'المصروفات' }).getByText('900.5', { exact: true })).toBeVisible();

    const audit = await ownerQuery(async (c) =>
      (await c.from('audit_log').select('action, detail').eq('table_name', 'expenses')).data ?? [],
    );
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe('updated');
    expect(audit[0].detail.before).toMatchObject({ title: 'رمل', expense_type: 'materials', paid_on: tripoliDate(0) });
    expect(Number(audit[0].detail.before.amount_lyd)).toBe(850);
    expect(audit[0].detail.after).toMatchObject({ title: 'رمل مغسول', expense_type: 'services', paid_on: tripoliDate(-2) });
    expect(Number(audit[0].detail.after.amount_lyd)).toBe(900.5);
  });

  test('a stranger can neither open, edit nor delete the expense', async ({ page }) => {
    const expenseId = await ownerQuery(async (c) => (await c.from('expenses').select('id').single()).data!.id as string);

    // The stranger has a project of their own, so the page looks the expense up in THAT project and finds nothing.
    await signUpThroughUi(page, stranger);
    await createFirstProjectThroughUi(page, `مشروع غريب ${stranger.localPhone.slice(-4)}`);
    await page.goto(`/expenses/${expenseId}`);
    await expect(page.getByRole('heading', { name: NOT_FOUND })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'تعديل المصروف' })).toHaveCount(0);
    await expect(page.getByText('رمل مغسول')).toHaveCount(0);

    const asStranger = await signedInClient(stranger);
    const edited = await asStranger.from('expenses').update({ amount_lyd: '1' }).eq('id', expenseId).select('id');
    const deleted = await asStranger.from('expenses').delete().eq('id', expenseId).select('id');
    await asStranger.auth.signOut();
    expect(edited.data ?? []).toHaveLength(0);
    expect(deleted.data ?? []).toHaveLength(0);

    const amount = await ownerQuery(async (c) => (await c.from('expenses').select('amount_lyd::text').single()).data);
    expect(amount).toEqual({ amount_lyd: '900.500' });
  });

  test('owner deletes the expense after confirming; its receipt photo goes too', async ({ page }) => {
    const receipts = () => ownerQuery(async (c) => (await c.storage.from(BUCKET).list(`${projectId}/receipts`)).data ?? []);
    expect(await receipts()).toHaveLength(1);

    await signInThroughUi(page, owner);
    await page.goto('/expenses');
    await page.getByRole('link', { name: 'فتح المصروف: رمل مغسول' }).click();

    // The first tap only explains; «إلغاء» leaves everything as it was.
    await page.getByRole('button', { name: 'حذف المصروف' }).click();
    await expect(page.getByText('لا يمكن التراجع عن الحذف')).toBeVisible();
    await page.getByRole('button', { name: 'إلغاء' }).click();
    await expect(page.getByRole('button', { name: 'نعم، احذف المصروف' })).toHaveCount(0);

    await page.getByRole('button', { name: 'حذف المصروف' }).click();
    await page.getByRole('button', { name: 'نعم، احذف المصروف' }).click();
    await expect(page).toHaveURL(/\/expenses\?done=deleted$/);
    await expect(page.getByRole('status').filter({ hasText: 'حُذف المصروف' })).toBeVisible();
    await expect(page.getByText('لا توجد مصروفات بعد')).toBeVisible();

    expect(await receipts(), 'the receipt photo was left in storage').toHaveLength(0);
    const deleted = await ownerQuery(async (c) =>
      (await c.from('audit_log').select('detail').eq('table_name', 'expenses').eq('action', 'deleted')).data ?? [],
    );
    expect(deleted).toHaveLength(1);
    expect(deleted[0].detail.before).toMatchObject({ title: 'رمل مغسول', expense_type: 'services' });
    expect(deleted[0].detail.before.receipt_path).toMatch(new RegExp(`^${projectId}/receipts/`));

    // The dashboard total follows: nothing recorded in the app any more.
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'لوحة المشروع' }).getByRole('link', { name: /الخطوة التالية/ })).toContainText(
      'سجّل أول مصروف',
    );
  });
});

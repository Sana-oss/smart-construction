import { expect, test } from '@playwright/test';
import {
  createFirstProjectThroughUi,
  newTestAccount,
  phoneReceiptJpeg,
  removeProjectFiles,
  signedInClient,
  signUpThroughUi,
} from './helpers';

// Receipt photo on a quick expense (UC-07, FR-DOC-02, NFR-SEC-03). Runs against the staging project, at phone size.
// - The photo is optional: with it, the expense stores a compressed JPEG in the project's receipts folder, the saved
//   screen says it is attached, and the list opens it through a signed link.
// - A form the server would refuse (missing amount) uploads NOTHING.
// - A stranger cannot download the receipt.

const owner = newTestAccount();
const stranger = newTestAccount();
const BUCKET = 'project-files';

async function receiptFiles(projectId: string) {
  const asOwner = await signedInClient(owner);
  const { data } = await asOwner.storage.from(BUCKET).list(`${projectId}/receipts`);
  await asOwner.auth.signOut();
  return data ?? [];
}

test.describe.serial('receipt photo on a quick expense', () => {
  test.afterAll(async () => {
    await removeProjectFiles(owner).catch(() => 0);
  });

  test('owner records an expense with a receipt and opens it from the list', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع فواتير ${owner.localPhone.slice(-4)}`);
    const asOwner = await signedInClient(owner);
    const { data: proj } = await asOwner.from('projects').select('id').single();
    const projectId = proj!.id as string;
    await asOwner.auth.signOut();

    await page.getByRole('link', { name: 'إضافة مصروف سريع' }).click();
    await expect(page).toHaveURL(/\/expenses\/new$/);
    const photo = await phoneReceiptJpeg(page);

    // A form the server would refuse (no amount): nothing is uploaded.
    await page.getByLabel('اسم المصروف').fill('فاتورة الإسمنت');
    await page.getByLabel('نوع المصروف').selectOption({ label: 'مواد' });
    await page.locator('input[type="file"]').setInputFiles({ name: 'receipt.jpg', mimeType: 'image/jpeg', buffer: photo });
    await expect(page.getByText('تغيير الصورة')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'حفظ المصروف' }).click();
    await expect(page.getByText('هذا الحقل مطلوب.').first()).toBeVisible();
    expect(await receiptFiles(projectId), 'a receipt was uploaded for a refused form').toHaveLength(0);
    // The refused form keeps what the owner chose (the type list used to go back to its placeholder).
    await expect(page.getByLabel('نوع المصروف')).toHaveValue('materials');
    await expect(page.getByText('تغيير الصورة')).toBeVisible();

    // Complete the form: saved with its receipt.
    await page.getByLabel('المبلغ · د.ل').fill('850');
    await page.getByRole('button', { name: 'حفظ المصروف' }).click();
    await expect(page.getByText('تم حفظ المصروف')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('مرفقة')).toBeVisible();

    const files = await receiptFiles(projectId);
    expect(files).toHaveLength(1);
    expect(files[0].metadata?.mimetype).toBe('image/jpeg');
    expect(Number(files[0].metadata?.size)).toBeLessThan(photo.length); // compressed before upload

    // The list opens it through a signed link.
    await page.getByRole('link', { name: 'عرض المصروفات' }).click();
    const link = page.getByRole('link', { name: 'صورة فاتورة: فاتورة الإسمنت' });
    await expect(link).toBeVisible();
    const href = (await link.getAttribute('href'))!;
    expect(href).toContain('token=');
    const res = await page.request.get(href);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/jpeg');
  });

  test('an expense without a receipt is unchanged (three answers, no link)', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('رقم الهاتف').fill(owner.localPhone);
    await page.getByRole('textbox', { name: 'كلمة المرور', exact: true }).fill(owner.password);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await page.getByRole('link', { name: 'إضافة مصروف سريع' }).click();
    await page.getByLabel('اسم المصروف').fill('أجرة نقل');
    await page.getByLabel('المبلغ · د.ل').fill('120');
    await page.getByLabel('نوع المصروف').selectOption({ label: 'خدمات' });
    await page.getByRole('button', { name: 'حفظ المصروف' }).click();
    await expect(page.getByText('بلا صورة')).toBeVisible();
    await page.getByRole('link', { name: 'عرض المصروفات' }).click();
    await expect(page.getByRole('link', { name: 'صورة فاتورة: أجرة نقل' })).toHaveCount(0);
  });

  test('a stranger cannot download the receipt', async ({ page }) => {
    await signUpThroughUi(page, stranger);
    const asOwner = await signedInClient(owner);
    const { data } = await asOwner.from('expenses').select('receipt_path').not('receipt_path', 'is', null);
    const path = data![0].receipt_path as string;
    const asStranger = await signedInClient(stranger);
    expect((await asStranger.storage.from(BUCKET).download(path)).error).not.toBeNull();
    expect((await asStranger.storage.from(BUCKET).createSignedUrl(path, 60)).error).not.toBeNull();
    expect((await asOwner.storage.from(BUCKET).download(path)).error).toBeNull();
    await asOwner.auth.signOut();
    await asStranger.auth.signOut();
  });
});

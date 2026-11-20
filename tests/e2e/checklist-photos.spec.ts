import { expect, test } from '@playwright/test';
import {
  createFirstProjectThroughUi,
  newTestAccount,
  phoneReceiptJpeg,
  removeProjectFiles,
  signedInClient,
  signUpThroughUi,
} from './helpers';

// The checklist item photo (3.12 slice 2; FR-QLT-01). Runs against the staging project at phone size, and needs migration
// 0026 there: «فحص التسليح» requires a photo to be «سليم» (the owner's decision, the template stays unreviewed).
// - «سليم» without the photo is refused, in the page and by the database; a problem is recorded without one.
// - The photo is compressed, stored in the project's checklists folder, shown again through a signed link, and a new
//   photo replaces the old file.
// - A stranger cannot read the photo.

const owner = newTestAccount();
const stranger = newTestAccount();
const BUCKET = 'project-files';

async function checklistFiles(projectId: string) {
  const asOwner = await signedInClient(owner);
  const { data } = await asOwner.storage.from(BUCKET).list(`${projectId}/checklists`);
  await asOwner.auth.signOut();
  return data ?? [];
}

test.describe.serial('checklist item photo (3.12)', () => {
  test.afterAll(async () => {
    await removeProjectFiles(owner).catch(() => 0);
  });

  test('a photo-required item is «سليم» only with its photo; a new photo replaces the old one', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع صور فحص ${owner.localPhone.slice(-4)}`);
    const asOwner = await signedInClient(owner);
    const { data: projects } = await asOwner.from('projects').select('id');
    await asOwner.auth.signOut();
    const projectId = projects![0].id as string;

    await page.goto('/phases');
    await page.getByRole('link', { name: /الهيكل الخرساني/ }).first().click();
    await page.getByRole('link', { name: /قوائم الفحص/ }).click();
    await page.getByRole('link', { name: 'إضافة قائمة فحص' }).click();
    await page.getByLabel(/اسم القائمة/).fill('صب سقف الدور الأرضي');
    await page.getByRole('button', { name: 'إنشاء القائمة' }).click();

    // The list marks the item that needs a photo.
    const rebar = page.getByRole('list', { name: 'بنود الفحص' }).getByRole('listitem').filter({ hasText: 'فحص التسليح' });
    await expect(rebar).toContainText('يتطلب صورة');

    // «سليم» without a photo: refused in the page; nothing is uploaded or saved.
    await page.getByRole('link', { name: 'فحص: فحص التسليح' }).click();
    await expect(page.getByText('مطلوبة لتسجيل «سليم»')).toBeVisible();
    await page.getByRole('radio', { name: 'سليم' }).check();
    await page.getByRole('button', { name: 'حفظ والعودة للقائمة' }).click();
    await expect(page.getByText('هذا البند يتطلب صورة ليُسجَّل «سليم». أرفق صورة، أو سجّل «توجد ملاحظة».')).toBeVisible();
    expect(await checklistFiles(projectId)).toHaveLength(0);
    // The refusal happens before the form is sent, so the owner's answer stays (React resets a form after its action).
    await expect(page.getByRole('radio', { name: 'سليم' })).toBeChecked();

    // With the photo: saved, compressed, in the project's checklists folder.
    const photo = await phoneReceiptJpeg(page);
    await page.locator('input[type="file"]').setInputFiles({ name: 'rebar.jpg', mimeType: 'image/jpeg', buffer: photo });
    await expect(page.getByText('استبدال الصورة')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'حفظ والعودة للقائمة' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظت نتيجة البند.' })).toBeVisible({ timeout: 30_000 });
    await expect(rebar).toContainText('سليم');
    await expect(rebar).toContainText('صورة مرفقة');
    let files = await checklistFiles(projectId);
    expect(files).toHaveLength(1);
    expect(files[0].metadata?.mimetype).toBe('image/jpeg');
    expect(Number(files[0].metadata?.size)).toBeLessThan(photo.length);
    const firstName = files[0].name;

    // Opening the item again shows the saved photo through a signed link.
    await page.getByRole('link', { name: 'فحص: فحص التسليح' }).click();
    const saved = page.getByRole('img', { name: 'الصورة المحفوظة' });
    await expect(saved).toBeVisible();
    expect(await saved.getAttribute('src')).toContain('token=');

    // A new photo replaces the old file: still one file, a new name.
    await page.locator('input[type="file"]').setInputFiles({ name: 'rebar2.jpg', mimeType: 'image/jpeg', buffer: photo });
    await expect(page.getByRole('button', { name: 'إلغاء الصورة الجديدة' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'حفظ والعودة للقائمة' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظت نتيجة البند.' })).toBeVisible({ timeout: 30_000 });
    files = await checklistFiles(projectId);
    expect(files).toHaveLength(1);
    expect(files[0].name).not.toBe(firstName);

    // The database refuses «سليم» without a photo too (a client that skips the page).
    const again = await signedInClient(owner);
    const { data: items } = await again.from('checklist_items').select('id, text');
    const formwork = items!.find((i) => i.text === 'فحص الشدة والدعامات')!;
    const rebarRow = items!.find((i) => i.text === 'فحص التسليح')!;
    const ok = await again.from('checklist_items').update({ result: 'ok' }).eq('id', formwork.id).select('id');
    const removed = await again.from('checklist_items').update({ photo_path: null }).eq('id', rebarRow.id).select('id');
    await again.auth.signOut();
    expect(ok.error).toBeNull(); // this item needs no photo
    expect(removed.error).not.toBeNull(); // the sound rebar item keeps its photo
  });

  test('a stranger cannot read the photo', async ({ page }) => {
    await signUpThroughUi(page, stranger);
    const asOwner = await signedInClient(owner);
    const { data: items } = await asOwner.from('checklist_items').select('photo_path').not('photo_path', 'is', null);
    await asOwner.auth.signOut();
    const path = items![0].photo_path as string;

    const asStranger = await signedInClient(stranger);
    expect((await asStranger.storage.from(BUCKET).download(path)).error).not.toBeNull();
    expect((await asStranger.storage.from(BUCKET).createSignedUrl(path, 60)).error).not.toBeNull();
    await asStranger.auth.signOut();
  });
});

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  createFirstProjectThroughUi,
  navTab,
  newTestAccount,
  removeProjectFiles,
  signedInClient,
  signInThroughUi,
  signUpThroughUi,
} from './helpers';

// Site photos (FR-DOC-02, NFR-SEC-03, design S31.1/S31.2). Runs against the staging project, at phone size.
// - A large JPEG is compressed in the browser before upload (stored smaller, 1600 px on its longest side), and the
//   3 MB HEIC converter is NOT downloaded for it.
// - The photo is shown through a short-lived signed link; a tampered link does not work.
// - A stranger cannot list, read, upload to or delete the owner's files, nor read the photos table.
// - Delete asks first and removes the file too.
// - HEIC: only when E2E_HEIC_FILE points at a real iPhone photo (kept OUTSIDE the repository; never commit a
//   personal photo). Chromium cannot read HEIC itself, so this proves the converter path.

const owner = newTestAccount();
const stranger = newTestAccount();
const BUCKET = 'project-files';

/** A 4032x3024 photo-like JPEG (noise does not compress well, like a real site photo), made in the browser. */
async function bigJpeg(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 4032;
    c.height = 3024;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      img.data[i] = v;
      img.data[i + 1] = (v * 7) % 255;
      img.data[i + 2] = (v * 13) % 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.95));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  });
  return Buffer.from(base64, 'base64');
}

/** Records every downloaded script bigger than 2 MB (the HEIC converter is about 3.2 MB). */
function watchBigScripts(page: Page): string[] {
  const big: string[] = [];
  page.on('response', async (r) => {
    if (!r.url().includes('/_next/static/') || !r.url().endsWith('.js')) return;
    const len = Number(r.headers()['content-length'] ?? 0) || (await r.body().catch(() => Buffer.alloc(0))).length;
    if (len > 2 * 1024 * 1024) big.push(r.url());
  });
  return big;
}

test.describe.serial('site photos', () => {
  // Leave no file behind on staging, whatever happened in the tests (SQL cannot delete storage files).
  test.afterAll(async () => {
    await removeProjectFiles(owner).catch(() => 0);
  });

  test('owner adds a compressed photo and sees it by phase', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع صور ${owner.localPhone.slice(-4)}`);

    await navTab(page, 'المزيد').click();
    await page.getByRole('link', { name: /صور الموقع/ }).click();
    await expect(page).toHaveURL(/\/photos$/);
    await expect(page.getByText('لا توجد صور بعد')).toBeVisible();

    await page.getByRole('link', { name: 'إضافة صورة وملاحظة' }).click();
    await expect(page).toHaveURL(/\/photos\/new$/);
    const bigScripts = watchBigScripts(page);
    const original = await bigJpeg(page);

    await page.locator('input[type="file"]').setInputFiles({ name: 'site.jpg', mimeType: 'image/jpeg', buffer: original });
    await expect(page.getByText(/بعد الضغط/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('combobox', { name: 'المرحلة' })).toHaveValue(/.+/); // the current phase is preselected
    await page.getByLabel('الملاحظة').fill('تسليح السقف قبل مراجعة المهندس');
    await page.getByRole('button', { name: 'حفظ الصورة والملاحظة' }).click();

    await expect(page).toHaveURL(/\/photos$/, { timeout: 30_000 });
    const group = page.getByRole('region', { name: 'الهيكل الخرساني' });
    await expect(group).toContainText('صورة واحدة');
    const img = group.getByRole('img', { name: 'تسليح السقف قبل مراجعة المهندس' });
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1600);
    expect(bigScripts, 'the HEIC converter was downloaded for a JPEG').toEqual([]);

    // Stored smaller than the original (FR-DOC-02 acceptance), as a JPEG.
    const asOwner = await signedInClient(owner);
    const { data: rows } = await asOwner.from('photos').select('storage_path, size_bytes, note');
    expect(rows).toHaveLength(1);
    expect(rows![0].size_bytes).toBeLessThan(original.length);
    const info = await asOwner.storage.from(BUCKET).info(rows![0].storage_path);
    expect(info.data?.contentType).toBe('image/jpeg');

    // The link is signed and short-lived; a tampered token is refused.
    const src = (await img.getAttribute('src'))!;
    expect(src).toContain('token=');
    expect((await page.request.get(src)).status()).toBe(200);
    const tampered = src.replace(/token=([^&]+)/, (_, tok: string) => `token=${tok.slice(0, -4)}AAAA`);
    expect((await page.request.get(tampered)).status()).toBeGreaterThanOrEqual(400);
    await asOwner.auth.signOut();
  });

  test('a stranger cannot reach the owner photos or files', async ({ page }) => {
    await signUpThroughUi(page, stranger); // a signed-in user with no access to the owner's project
    const asOwner = await signedInClient(owner);
    const asStranger = await signedInClient(stranger);
    const { data: rows } = await asOwner.from('photos').select('project_id, storage_path');
    const { project_id: projectId, storage_path: path } = rows![0];

    const table = await asStranger.from('photos').select('id').eq('project_id', projectId);
    expect(table.data, 'stranger reads the photos table').toHaveLength(0);

    // The owner CAN list and read the folder: the refusals below come from the policies, not from a broken store.
    const ownerList = await asOwner.storage.from(BUCKET).list(`${projectId}/photos`);
    expect(ownerList.data ?? []).toHaveLength(1);
    expect((await asOwner.storage.from(BUCKET).download(path)).error).toBeNull();

    const files = asStranger.storage.from(BUCKET);
    const list = await files.list(`${projectId}/photos`);
    expect(list.data ?? [], 'stranger lists the owner folder').toHaveLength(0);
    const download = await files.download(path);
    expect(download.error, 'stranger downloads the owner photo').not.toBeNull();
    const link = await files.createSignedUrl(path, 60);
    expect(link.error, 'stranger gets a link to the owner photo').not.toBeNull();
    const ticket = await files.createSignedUploadUrl(`${projectId}/photos/00000000-0000-4000-8000-000000000001.jpg`);
    expect(ticket.error, 'stranger may upload into the owner folder').not.toBeNull();
    const upload = await files.upload(`${projectId}/photos/00000000-0000-4000-8000-000000000002.jpg`, new Blob(['x']), {
      contentType: 'image/jpeg',
    });
    expect(upload.error, 'stranger uploads into the owner folder').not.toBeNull();
    await files.remove([path]);
    expect((await asOwner.storage.from(BUCKET).info(path)).data, 'stranger deleted the owner file').not.toBeNull();

    await asOwner.auth.signOut();
    await asStranger.auth.signOut();
  });

  test('HEIC from an iPhone is converted in a browser that cannot read it', async ({ page }) => {
    const heic = process.env.E2E_HEIC_FILE;
    test.skip(!heic, 'set E2E_HEIC_FILE to a real .heic photo (outside the repository) to run this test');
    await signInThroughUi(page, owner);
    await page.goto('/photos/new');
    await page.locator('input[type="file"]').setInputFiles({ name: basename(heic!), mimeType: 'image/heic', buffer: readFileSync(heic!) });
    await expect(page.getByText(/بعد الضغط/)).toBeVisible({ timeout: 60_000 });
    await page.getByLabel('الملاحظة').fill('صورة آيفون HEIC');
    await page.getByRole('button', { name: 'حفظ الصورة والملاحظة' }).click();
    await expect(page).toHaveURL(/\/photos$/, { timeout: 30_000 });
    await expect(page.getByRole('img', { name: 'صورة آيفون HEIC' })).toBeVisible();
  });

  test('deleting a photo asks first and removes its file', async ({ page }) => {
    await signInThroughUi(page, owner);
    const asOwner = await signedInClient(owner);
    const { data: before } = await asOwner.from('photos').select('storage_path').eq('note', 'تسليح السقف قبل مراجعة المهندس');
    const path = before![0].storage_path;

    await page.goto('/photos');
    page.once('dialog', (d) => d.dismiss()); // "no" keeps it
    await page.getByRole('button', { name: 'حذف: تسليح السقف قبل مراجعة المهندس' }).click();
    await expect(page.getByRole('img', { name: 'تسليح السقف قبل مراجعة المهندس' })).toBeVisible();

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'حذف: تسليح السقف قبل مراجعة المهندس' }).click();
    await expect(page.getByRole('img', { name: 'تسليح السقف قبل مراجعة المهندس' })).toHaveCount(0);
    expect((await asOwner.from('photos').select('id').eq('storage_path', path)).data).toHaveLength(0);
    expect((await asOwner.storage.from(BUCKET).info(path)).data, 'the file is still stored').toBeNull();
    await asOwner.auth.signOut();
  });
});


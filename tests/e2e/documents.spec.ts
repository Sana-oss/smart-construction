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

// Project documents (FR-DOC-01, NFR-SEC-03, design S30.1/S30.2/S10.4). Runs against the staging project, at phone size.

const owner = newTestAccount();
const stranger = newTestAccount();
const BUCKET = 'project-files';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n', 'utf8');

async function smallPng(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 400;
    const x = c.getContext('2d')!;
    x.fillStyle = '#e8e2d0';
    x.fillRect(0, 0, 600, 400);
    x.fillStyle = '#333';
    x.fillRect(40, 40, 520, 8);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'));
    const u = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(s);
  });
  return Buffer.from(b64, 'base64');
}

async function addDocument(page: Page, d: { title: string; kind: string; phase?: string; version?: string; file: { name: string; mimeType: string; buffer: Buffer } }) {
  await page.getByLabel('اسم الوثيقة').fill(d.title);
  await page.getByLabel('نوع الوثيقة').selectOption({ label: d.kind });
  if (d.phase) await page.getByLabel('المرحلة المرتبطة').selectOption({ label: d.phase });
  if (d.version) await page.getByLabel('رقم الإصدار').fill(d.version);
  await page.locator('input[type="file"]').setInputFiles(d.file);
  await expect(page.getByText(d.file.name, { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'حفظ الوثيقة' }).click();
}

test.describe.serial('project documents', () => {
  test.afterAll(async () => {
    await removeProjectFiles(owner).catch(() => 0);
  });

  test('owner adds a PDF and a PNG; wrong types and big files are refused', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع وثائق ${owner.localPhone.slice(-4)}`);

    await navTab(page, 'المزيد').click();
    await page.getByRole('link', { name: /وثائق المشروع/ }).click();
    await expect(page).toHaveURL(/\/documents$/);
    await expect(page.getByText('لا توجد وثائق بعد')).toBeVisible();
    await page.getByRole('link', { name: 'إضافة وثيقة' }).click();
    await expect(page).toHaveURL(/\/documents\/new$/);

    // Refused in the browser before any upload: a Word file, then a PDF over 10 MB.
    await page.locator('input[type="file"]').setInputFiles({ name: 'contract.docx', mimeType: 'application/msword', buffer: Buffer.from('x') });
    await expect(page.getByText('نوع الملف غير مقبول. اختر PDF أو صورة.')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({ name: 'big.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
    await expect(page.getByText('الملف كبير جدًا (10 ميغابايت على الأكثر).')).toBeVisible();

    // A required field missing: refused with a message, nothing stored.
    await page.locator('input[type="file"]').setInputFiles({ name: 'roof-plan-v03.pdf', mimeType: 'application/pdf', buffer: PDF });
    await page.getByRole('button', { name: 'حفظ الوثيقة' }).click();
    await expect(page.getByText('هذا الحقل مطلوب.').first()).toBeVisible();
    // Nothing was uploaded for the refused form (it used to leave a file in storage without a row).
    const asOwner0 = await signedInClient(owner);
    const { data: proj } = await asOwner0.from('projects').select('id').single();
    expect((await asOwner0.storage.from(BUCKET).list(`${proj!.id}/documents`)).data ?? [], 'file left after a refused form').toHaveLength(0);
    await asOwner0.auth.signOut();

    await page.goto('/documents/new');
    await addDocument(page, {
      title: 'مخطط السقف المعتمد',
      kind: 'مخطط',
      phase: 'الهيكل الخرساني',
      version: '03',
      file: { name: 'roof-plan-v03.pdf', mimeType: 'application/pdf', buffer: PDF },
    });
    await expect(page).toHaveURL(/\/documents$/, { timeout: 30_000 });
    const pdfRow = page.getByRole('listitem').filter({ hasText: 'مخطط السقف المعتمد' });
    await expect(pdfRow).toContainText('مخطط · الهيكل الخرساني · الإصدار 03 · PDF');

    await page.getByRole('link', { name: 'إضافة وثيقة' }).click();
    await addDocument(page, {
      title: 'فاتورة الحديد',
      kind: 'فاتورة',
      file: { name: 'invoice.png', mimeType: 'image/png', buffer: await smallPng(page) },
    });
    await expect(page).toHaveURL(/\/documents$/, { timeout: 30_000 });
    await expect(page.getByRole('listitem').filter({ hasText: 'فاتورة الحديد' })).toContainText('فاتورة · PNG');

    // «عرض» opens the stored file through a signed link, as the right type.
    const href = (await pdfRow.getByRole('link', { name: 'عرض: مخطط السقف المعتمد' }).getAttribute('href'))!;
    expect(href).toContain('token=');
    const res = await page.request.get(href);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/pdf');
  });

  test("the phase page links to the phase's documents (S10.4)", async ({ page }) => {
    await signInThroughUi(page, owner);
    await navTab(page, 'المراحل').click();
    await page.getByRole('listitem').nth(1).getByRole('link').click(); // الهيكل الخرساني
    const row = page.getByRole('link', { name: /وثائق المرحلة/ });
    await expect(row).toContainText('ملف واحد');
    await row.click();
    await expect(page).toHaveURL(/\/documents\?phase=/);
    await expect(page.getByRole('heading', { name: 'وثائق المرحلة' })).toBeVisible();
    await expect(page.getByText('مخطط السقف المعتمد')).toBeVisible();
    await expect(page.getByText('فاتورة الحديد')).toHaveCount(0); // not linked to this phase

    // Adding from here preselects the phase.
    await page.getByRole('link', { name: 'إضافة وثيقة' }).click();
    await expect(page.getByLabel('المرحلة المرتبطة')).toHaveValue(/[0-9a-f-]{36}/);
  });

  test('a stranger cannot reach the owner documents or files', async ({ page }) => {
    await signUpThroughUi(page, stranger);
    const asOwner = await signedInClient(owner);
    const asStranger = await signedInClient(stranger);
    const { data: rows } = await asOwner.from('documents').select('project_id, storage_path').order('created_at');
    const { project_id: projectId, storage_path: path } = rows![0];

    expect((await asOwner.storage.from(BUCKET).list(`${projectId}/documents`)).data ?? []).toHaveLength(2);
    expect((await asStranger.from('documents').select('id').eq('project_id', projectId)).data).toHaveLength(0);

    const files = asStranger.storage.from(BUCKET);
    expect((await files.list(`${projectId}/documents`)).data ?? []).toHaveLength(0);
    expect((await files.download(path)).error).not.toBeNull();
    expect((await files.createSignedUrl(path, 60)).error).not.toBeNull();
    const up = await files.upload(`${projectId}/documents/00000000-0000-4000-8000-000000000003.pdf`, new Blob([PDF]), {
      contentType: 'application/pdf',
    });
    expect(up.error).not.toBeNull();
    await files.remove([path]);
    expect((await asOwner.storage.from(BUCKET).info(path)).data).not.toBeNull();

    await asOwner.auth.signOut();
    await asStranger.auth.signOut();
  });

  test('deleting a document asks first and removes its file', async ({ page }) => {
    await signInThroughUi(page, owner);
    const asOwner = await signedInClient(owner);
    const { data } = await asOwner.from('documents').select('storage_path').eq('title', 'فاتورة الحديد');
    const path = data![0].storage_path;

    await page.goto('/documents');
    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: 'حذف: فاتورة الحديد' }).click();
    await expect(page.getByText('فاتورة الحديد')).toBeVisible();

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'حذف: فاتورة الحديد' }).click();
    await expect(page.getByText('فاتورة الحديد')).toHaveCount(0);
    expect((await asOwner.storage.from(BUCKET).info(path)).data).toBeNull();
    await asOwner.auth.signOut();
  });
});

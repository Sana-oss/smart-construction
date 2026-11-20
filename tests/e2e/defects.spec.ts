import { expect, test } from '@playwright/test';
import {
  createFirstProjectThroughUi,
  expectNoSidewaysScroll,
  newTestAccount,
  phoneReceiptJpeg,
  removeProjectFiles,
  signedInClient,
  signUpThroughUi,
} from './helpers';

// The defects list (3.17; FR-QLT-06, FR-QLT-07; design S28.1, S28.2, S28.3). Runs against the staging project at phone
// size, and needs migration 0029 there.
// - A defect with its place, who fixes it, priority, due date and an optional photo; followed through its states.
// - Open defects show on the dashboard; finishing a phase with open defects asks first and logs the confirmation (D2).
// - A checklist item with a problem links to a new defect, filled from the item.

const owner = newTestAccount();
const stranger = newTestAccount();

test.describe.serial('defects list (3.17)', () => {
  test.afterAll(async () => {
    await removeProjectFiles(owner).catch(() => 0);
  });

  test('record a defect with a photo, warn when finishing its phase, and follow it until closed', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع عيوب ${owner.localPhone.slice(-4)}`);
    const dashboardRow = page.getByRole('link', { name: /سجل العيوب/ });
    await expect(dashboardRow).toContainText('لا عيوب مفتوحة');

    // From the current phase: the phase's empty list, then the form (S28.2).
    await page.goto('/phases');
    await page.getByRole('link', { name: /الهيكل الخرساني/ }).first().click();
    await expect(page).toHaveURL(/\/phases\/[0-9a-f-]{36}$/);
    const phaseUrl = page.url();
    await page.getByRole('link', { name: /سجل العيوب/ }).click();
    await expect(page.getByText('لا عيوب مسجلة')).toBeVisible();
    await expect(page.getByText('تصنيف الأولوية توضيحي ويحدده المهندس بعد المعاينة.')).toBeVisible();
    await page.getByRole('link', { name: 'تسجيل عيب' }).click();
    await expect(page.getByLabel(/^المرحلة/)).toHaveValue(phaseUrl.split('/').pop()!);

    // A defect without a title is refused and keeps what was typed.
    await page.getByLabel(/^الموقع/).fill('الدور الأرضي · المحور ب');
    await page.getByRole('button', { name: 'حفظ الملاحظة' }).click();
    await expect(page.getByText('هذا الحقل مطلوب.')).toBeVisible();
    await expect(page.getByLabel(/^الموقع/)).toHaveValue('الدور الأرضي · المحور ب');

    await page.getByLabel(/عنوان الملاحظة/).fill('مراجعة تسليح السقف');
    await page.getByLabel(/^المسؤول/).fill('مقاول الهيكل');
    await page.getByLabel(/^الأولوية/).selectOption({ label: 'عالية' });
    await page.getByLabel(/موعد المعالجة/).fill('2026-12-01');
    await page.locator('input[type="file"]').setInputFiles({ name: 'crack.jpg', mimeType: 'image/jpeg', buffer: await phoneReceiptJpeg(page) });
    await expect(page.getByText('استبدال الصورة')).toBeVisible({ timeout: 30_000 });
    await expectNoSidewaysScroll(page);
    await page.getByRole('button', { name: 'حفظ الملاحظة' }).click();

    // S28.3: open, with who fixes it and the photo.
    await expect(page.getByRole('status').filter({ hasText: 'سُجّل العيب.' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'مراجعة تسليح السقف' })).toBeVisible();
    await expect(page.getByText('المسؤول: مقاول الهيكل')).toBeVisible();
    await expect(page.locator('main').getByText('مفتوح', { exact: true })).toBeVisible();
    expect(await page.getByRole('img', { name: 'الصورة' }).getAttribute('src')).toContain('token=');
    const issueUrl = page.url().split('?')[0];
    await expectNoSidewaysScroll(page);

    // The list and the dashboard count it.
    await page.getByRole('link', { name: 'العودة لسجل العيوب' }).click();
    await expect(page.getByText('الهيكل الخرساني · عيب واحد مفتوح')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'مراجعة تسليح السقف' })).toContainText('عالية');
    await page.goto('/');
    await expect(dashboardRow).toContainText('عيب واحد مفتوح');

    // FR-QLT-07: finishing the phase with the defect open asks first and saves nothing; confirming finishes and logs it.
    await page.goto(`${phaseUrl}/schedule`);
    await page.getByLabel('حالة المرحلة').selectOption({ label: 'مكتملة' });
    await page.getByRole('button', { name: 'حفظ' }).click();
    const warning = page.getByRole('alert').filter({ hasText: 'في هذه المرحلة عيوب لم تُغلق' });
    await expect(warning).toContainText('مراجعة تسليح السقف (مفتوح)');
    await expect(warning.getByRole('link', { name: 'فتح سجل العيوب' })).toBeVisible();
    await page.getByLabel(/أؤكد إنهاء المرحلة رغم العيوب المفتوحة/).check();
    await page.getByRole('button', { name: 'حفظ' }).click();
    await expect(page).toHaveURL(phaseUrl);
    const asOwner = await signedInClient(owner);
    const { data: logged } = await asOwner.from('audit_log').select('detail').eq('action', 'close_confirmed_with_open_issues');
    expect(logged).toHaveLength(1);
    expect(logged![0].detail.open_issues).toEqual(['مراجعة تسليح السقف (مفتوح)']);

    // Following it: being fixed, then closed after asking; the dates of the states are shown.
    await page.goto(issueUrl);
    await page.getByRole('button', { name: 'بدء المعالجة' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُدّثت حالة العيب.' })).toBeVisible();
    await expect(page.locator('main').getByText('قيد المعالجة', { exact: true }).first()).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'إغلاق العيب' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُدّثت حالة العيب.' })).toBeVisible();
    await expect(page.locator('main').getByText('مغلق', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'إعادة فتح العيب' })).toBeVisible();
    const { data: row } = await asOwner.from('issues').select('status, started_at, closed_at, photo_path').single();
    await asOwner.auth.signOut();
    expect(row!.status).toBe('closed');
    expect(row!.started_at).not.toBeNull();
    expect(row!.closed_at).not.toBeNull();
    expect(row!.photo_path).toMatch(/\/issues\/[0-9a-f-]{36}\.jpg$/);
    await page.goto('/');
    await expect(dashboardRow).toContainText('لا عيوب مفتوحة');
  });

  test('a checklist item with a problem opens a defect filled from it', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('رقم الهاتف').fill(owner.localPhone);
    await page.getByRole('textbox', { name: 'كلمة المرور', exact: true }).fill(owner.password);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page.getByRole('heading', { name: 'لوحة المشروع' })).toBeVisible();

    await page.goto('/phases');
    await page.getByRole('link', { name: /المباني والتأسيسات/ }).first().click();
    await page.getByRole('link', { name: /قوائم الفحص/ }).click();
    await page.getByRole('link', { name: 'إضافة قائمة فحص' }).click();
    await page.getByLabel(/اسم القائمة/).fill('فحص الجدران');
    await page.getByRole('button', { name: 'إنشاء القائمة' }).click();
    await page.getByRole('link', { name: 'فحص: فحص الشدة والدعامات' }).click();
    await page.getByLabel('توجد ملاحظة').check();
    await page.getByLabel(/^ملاحظة/).fill('دعامة مائلة');
    await page.getByRole('button', { name: 'حفظ والعودة للقائمة' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظت نتيجة البند.' })).toBeVisible();

    await page.getByRole('link', { name: 'فحص: فحص الشدة والدعامات' }).click();
    await page.getByRole('link', { name: /تسجيل عيب مرتبط/ }).click();
    await expect(page.getByText('من بند الفحص «فحص الشدة والدعامات»')).toBeVisible();
    await expect(page.getByLabel(/عنوان الملاحظة/)).toHaveValue('فحص الشدة والدعامات');
    await expect(page.getByLabel(/^الوصف/)).toHaveValue('دعامة مائلة');
    await page.getByRole('button', { name: 'حفظ الملاحظة' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'سُجّل العيب.' })).toBeVisible();

    const asOwner = await signedInClient(owner);
    const { data } = await asOwner.from('issues').select('checklist_id, title').eq('title', 'فحص الشدة والدعامات');
    await asOwner.auth.signOut();
    expect(data).toHaveLength(1);
    expect(data![0].checklist_id).not.toBeNull();
  });

  test('a stranger can neither see nor change the defects', async ({ page }) => {
    await signUpThroughUi(page, stranger);
    const asOwner = await signedInClient(owner);
    const { data: own } = await asOwner.from('issues').select('id, photo_path').not('photo_path', 'is', null);
    await asOwner.auth.signOut();

    const asStranger = await signedInClient(stranger);
    const read = await asStranger.from('issues').select('id');
    const changed = await asStranger.from('issues').update({ status: 'open' }).eq('id', own![0].id).select('id');
    const photo = await asStranger.storage.from('project-files').createSignedUrl(own![0].photo_path as string, 60);
    await asStranger.auth.signOut();
    expect(read.data ?? []).toHaveLength(0);
    expect(changed.data ?? []).toHaveLength(0);
    expect(photo.error).not.toBeNull();
  });
});

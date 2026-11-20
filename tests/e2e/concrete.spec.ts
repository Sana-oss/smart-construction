import { expect, test, type Page } from '@playwright/test';
import { createFirstProjectThroughUi, expectNoSidewaysScroll, newTestAccount, signedInClient, signUpThroughUi, tripoliDate } from './helpers';

// The concrete log (3.13; FR-QLT-04, FR-QLT-05; design S27.1, S27.2). Runs against the staging project at phone size, and
// needs migration 0030 there. The curing and formwork dates are the engineer's, typed by the owner: the app only reminds.

const owner = newTestAccount();
const stranger = newTestAccount();

async function fillPour(page: Page, p: { element: string; daysAgo: number; supplier: string; qty: string; curing?: number; formwork?: number }) {
  await page.getByLabel(/عنصر الصب/).fill(p.element);
  await page.getByLabel(/تاريخ الصب/).fill(tripoliDate(-p.daysAgo));
  await page.getByLabel(/^المورد/).fill(p.supplier);
  await page.getByLabel(/الكمية الفعلية/).fill(p.qty);
  if (p.curing !== undefined) await page.getByLabel(/آخر يوم للمعالجة بالماء/).fill(tripoliDate(p.curing));
  if (p.formwork !== undefined) await page.getByLabel(/موعد فك الشدات/).fill(tripoliDate(p.formwork));
}

test.describe.serial('concrete log (3.13)', () => {
  test('pours with the engineer dates, reminders until done, totals and deleting', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع خرسانة ${owner.localPhone.slice(-4)}`);
    const dashboardRow = page.getByRole('link', { name: /سجل الخرسانة/ });
    await expect(dashboardRow).toContainText('لا تذكيرات');

    // From the current phase: an empty log, then the form.
    await page.goto('/phases');
    await page.getByRole('link', { name: /الهيكل الخرساني/ }).first().click();
    await expect(page).toHaveURL(/\/phases\/[0-9a-f-]{36}$/);
    const phaseLink = page.getByRole('link', { name: /سجل الخرسانة/ });
    await expect(phaseLink).toContainText('لا صبات بعد');
    await phaseLink.click();
    await expect(page.getByText('لا صبات مسجلة')).toBeVisible();
    await page.getByRole('link', { name: 'تسجيل صبة جديدة' }).click();
    await expect(page.getByText('انسخها من تعليمات المهندس؛ النظام لا يقترح مددًا، ويذكّرك قبلها بيومين.')).toBeVisible();

    // FR-QLT-04: no pour without a supplier and a quantity; a reminder date before the pour is refused.
    await page.getByLabel(/عنصر الصب/).fill('سقف الدور الأرضي');
    await page.getByLabel(/آخر يوم للمعالجة بالماء/).fill(tripoliDate(-20));
    await page.getByRole('button', { name: 'حفظ السجل' }).click();
    await expect(page.getByText('هذا الحقل مطلوب.').first()).toBeVisible();
    await expect(page.getByText('هذا الموعد لا يكون قبل تاريخ الصب.')).toBeVisible();
    await expect(page.getByLabel(/عنصر الصب/)).toHaveValue('سقف الدور الأرضي');
    await expectNoSidewaysScroll(page);

    // The design's example: 30 m³, six cubes, the mix reference and the delivery note; curing ended yesterday.
    await fillPour(page, { element: 'سقف الدور الأرضي', daysAgo: 8, supplier: 'الخرسانة الحديثة', qty: '30', curing: -1, formwork: 13 });
    await page.getByLabel(/عدد عينات المكعبات/).fill('6');
    await page.getByLabel(/مرجع الخلطة المعتمدة/).fill('حسب مستند المشروع');
    await page.getByLabel(/رقم إذن التوريد/).fill('DN-024');
    await page.getByRole('button', { name: 'حفظ السجل' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظت الصبة.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'سقف الدور الأرضي' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'إذن التوريد' })).toContainText('DN-024');
    await expectNoSidewaysScroll(page);

    // A second pour of 18 m³, without reminder dates.
    await page.getByRole('link', { name: 'سجل الخرسانة' }).click();
    await page.getByRole('link', { name: 'تسجيل صبة جديدة' }).click();
    await fillPour(page, { element: 'صب الأعمدة', daysAgo: 13, supplier: 'الخرسانة الحديثة', qty: '18' });
    await page.getByRole('button', { name: 'حفظ السجل' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظت الصبة.' })).toBeVisible();

    // S27.1: the total, the count, and the late curing reminder; the dashboard counts it.
    await page.getByRole('link', { name: 'سجل الخرسانة' }).click();
    const total = page.locator('main').getByText('إجمالي الكمية المسجلة').locator('..');
    await expect(total).toContainText('48 م³');
    await expect(total).toContainText('صبّتان موثقتان');
    const reminders = page.getByRole('list', { name: 'تذكيرات' }).getByRole('listitem');
    await expect(reminders).toHaveCount(1);
    await expect(reminders.first()).toContainText('آخر يوم لمعالجة «سقف الدور الأرضي» بالماء');
    await expect(reminders.first()).toContainText('متأخر يومًا');
    await page.goto('/');
    await expect(dashboardRow).toContainText('تذكير واحد');

    // «تمّ» ends the reminder; the moment is stamped by the database and audited.
    await page.goto('/concrete');
    await page.getByRole('link', { name: 'تفاصيل سقف الدور الأرضي' }).click();
    await page.getByRole('button', { name: 'تمّ: المعالجة بالماء حتى' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُدّث التذكير.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'إلغاء «تمّ»: المعالجة بالماء حتى' })).toBeVisible();
    await page.goto('/');
    await expect(dashboardRow).toContainText('لا تذكيرات');

    // Deleting a pour asks first; the total follows.
    await page.goto('/concrete');
    await page.getByRole('link', { name: 'تفاصيل صب الأعمدة' }).click();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'حذف الصبة' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُذفت الصبة' })).toBeVisible();
    await expect(page.locator('main').getByText('إجمالي الكمية المسجلة').locator('..')).toContainText('30 م³');

    const asOwner = await signedInClient(owner);
    const { data: rows } = await asOwner.from('concrete_pours').select('curing_done_at, formwork_done_at');
    const { data: audit } = await asOwner.from('audit_log').select('action').eq('table_name', 'concrete_pours');
    await asOwner.auth.signOut();
    expect(rows).toHaveLength(1);
    expect(rows![0].curing_done_at).not.toBeNull();
    expect(rows![0].formwork_done_at).toBeNull();
    expect(audit!.map((a) => a.action).sort()).toEqual(['deleted', 'updated']);
  });

  test('a stranger can neither see nor change the concrete log', async ({ page }) => {
    await signUpThroughUi(page, stranger);
    const asOwner = await signedInClient(owner);
    const { data: own } = await asOwner.from('concrete_pours').select('id');
    await asOwner.auth.signOut();

    const asStranger = await signedInClient(stranger);
    const read = await asStranger.from('concrete_pours').select('id');
    const changed = await asStranger.from('concrete_pours').update({ formwork_done_at: new Date().toISOString() }).eq('id', own![0].id).select('id');
    await asStranger.auth.signOut();
    expect(read.data ?? []).toHaveLength(0);
    expect(changed.data ?? []).toHaveLength(0);
  });
});

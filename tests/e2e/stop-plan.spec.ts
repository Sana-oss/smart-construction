import { expect, test, type Page } from '@playwright/test';
import { createFirstProjectThroughUi, expectNoSidewaysScroll, newTestAccount, signedInClient, signUpThroughUi } from './helpers';

// A phase's stop plan, the safe stop points (3.14; FR-DEC-04; design S19.1). Runs against the staging project at phone
// size, and needs migration 0028 there.
// - One plan per phase, from the unreviewed template; the screen says the engineer decides where to stop.
// - The protection measures take the owner's cost estimates; their sum (without «لا ينطبق») fills «الحماية» in the stop
//   scenario of 3.7, where the owner can still change it.

const owner = newTestAccount();
const stranger = newTestAccount();

async function checkItem(page: Page, item: string, answer: 'جاهز' | 'يحتاج عمل' | 'لا ينطبق', cost?: string) {
  await page.getByRole('link', { name: `فحص: ${item}` }).click();
  await page.getByRole('radio', { name: answer }).check();
  if (cost !== undefined) await page.getByLabel(/التكلفة التقديرية/).fill(cost);
  await page.getByRole('button', { name: 'حفظ والعودة للقائمة' }).click();
}

test.describe.serial('stop plan (3.14)', () => {
  test('a phase stop plan whose protection costs fill the stop scenario', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع توقف ${owner.localPhone.slice(-4)}`);

    // From the current phase's page: no plan yet.
    await page.goto('/phases');
    await page.getByRole('link', { name: /الهيكل الخرساني/ }).first().click();
    const link = page.getByRole('link', { name: /نقاط التوقف الآمنة/ });
    await expect(link).toContainText('لا خطة بعد');
    await link.click();
    await expect(page.getByText('خطة توقف مقترحة · الهيكل الخرساني')).toBeVisible();
    await expect(page.getByText('يحدد المهندس نقطة التوقف المناسبة')).toBeVisible();
    await expect(page.getByText('التطبيق لا يقرر سلامة التوقف تلقائيًا؛ يعتمد القرار على تقييم المهندس للموقع.')).toBeVisible();
    await page.getByRole('button', { name: 'إنشاء خطة التوقف' }).click();

    // Eight unreviewed items; no cost yet.
    const items = page.getByRole('list', { name: 'نقاط التوقف الآمنة' }).getByRole('listitem');
    await expect(items).toHaveCount(8);
    await expect(page.getByText('قالب غير مراجَع من مهندس')).toBeVisible();
    await expect(page.getByText('لم تُدخل تكاليف بعد')).toBeVisible();
    await expectNoSidewaysScroll(page);

    // An item that is not a measure takes no cost; a negative cost is refused and nothing is saved.
    await page.getByRole('link', { name: 'فحص: تحديد حدود الأعمال المنجزة' }).click();
    await expect(page.getByLabel(/التكلفة التقديرية/)).toHaveCount(0);
    await page.goBack();
    await page.getByRole('link', { name: 'فحص: حماية الحديد المكشوف' }).click();
    await page.getByRole('radio', { name: 'جاهز' }).check();
    await page.getByLabel(/التكلفة التقديرية/).fill('-5');
    await page.getByRole('button', { name: 'حفظ والعودة للقائمة' }).click();
    await expect(page.getByText('اكتب مبلغًا صحيحًا بثلاث خانات عشرية على الأكثر، مثل 1,200 أو 350.5')).toBeVisible();
    await expectNoSidewaysScroll(page);

    // The owner's estimates: 1,200 + 800; «لا ينطبق» (500) is left out of the total.
    await page.getByLabel(/التكلفة التقديرية/).fill('1,200');
    await page.getByRole('button', { name: 'حفظ والعودة للقائمة' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظ البند.' })).toBeVisible();
    await expect(page.locator('main').getByText('1,200 د.ل').first()).toBeVisible();
    await checkItem(page, 'عزل الأسطح من المطر', 'يحتاج عمل', '800');
    await checkItem(page, 'تصريف المياه', 'لا ينطبق', '500');
    const total = page.locator('main').getByText('مجموع تكاليف الحماية المقدّرة').locator('..');
    await expect(total).toContainText('2,000 د.ل');
    await expect(items.filter({ hasText: 'عزل الأسطح من المطر' })).toContainText('يحتاج عمل');

    // The stop scenario's protection cost starts from the plan, and says where it came from.
    await page.getByRole('link', { name: 'فتح أرقام سيناريو التوقف' }).click();
    await expect(page.getByLabel(/الحماية/)).toHaveValue('2000');
    await expect(page.getByText('من خطة التوقف لمرحلة «الهيكل الخرساني»: 2000 د.ل (مجموع تقديراتك للإجراءات). يمكنك تغييره.')).toBeVisible();

    // The phase page shows the plan's progress; costs are audited.
    await page.goto('/phases');
    await page.getByRole('link', { name: /الهيكل الخرساني/ }).first().click();
    await expect(page.getByRole('link', { name: /نقاط التوقف الآمنة/ })).toContainText('3 من 8 بندًا');
    const asOwner = await signedInClient(owner);
    const { data: audit } = await asOwner.from('audit_log').select('detail').eq('table_name', 'checklist_items');
    await asOwner.auth.signOut();
    expect(audit!.some((a) => Number(a.detail.after?.cost_lyd) === 1200)).toBe(true); // to_jsonb keeps numeric as a JSON number
  });

  test('a stranger can neither see nor create the stop plan', async ({ page }) => {
    await signUpThroughUi(page, stranger);
    const asOwner = await signedInClient(owner);
    const { data: phases } = await asOwner.from('phases').select('id, project_id').eq('name', 'الهيكل الخرساني');
    await asOwner.auth.signOut();

    const asStranger = await signedInClient(stranger);
    const read = await asStranger.from('checklists').select('id').eq('kind', 'safe_stop');
    const created = await asStranger.rpc('create_stop_plan', { p_project_id: phases![0].project_id, p_phase_id: phases![0].id });
    await asStranger.auth.signOut();
    expect(read.data ?? []).toHaveLength(0);
    expect(created.error).not.toBeNull();
  });
});

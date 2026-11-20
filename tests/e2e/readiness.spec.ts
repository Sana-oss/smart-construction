import { expect, test, type Page } from '@playwright/test';
import { createFirstProjectThroughUi, expectNoSidewaysScroll, newTestAccount, signedInClient, signUpThroughUi } from './helpers';

// The readiness gate (3.15; FR-PRJ-05). Runs against the staging project at phone size, and needs migration 0027 there.
// - One readiness list per project, from the unreviewed template (a new-build project has no structural-assessment item).
// - Starting a phase with gaps shows them and asks; nothing is saved until the owner confirms; the confirmation and
//   the gaps are logged. With no gaps, a phase starts without the question (decision D2: warn, never block).

const owner = newTestAccount();
const stranger = newTestAccount();

async function phaseIds(): Promise<Record<string, string>> {
  const asOwner = await signedInClient(owner);
  const { data } = await asOwner.from('phases').select('id, name');
  await asOwner.auth.signOut();
  return Object.fromEntries((data ?? []).map((p) => [p.name, p.id]));
}

async function setReadiness(page: Page, item: string, answer: 'متوفر' | 'ناقص' | 'لا ينطبق', note = '') {
  await page.getByRole('link', { name: `فحص: ${item}` }).click();
  await page.getByRole('radio', { name: answer }).check();
  if (note) await page.getByLabel(/^ملاحظة/).fill(note);
  await page.getByRole('button', { name: 'حفظ والعودة للقائمة' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'حُفظ البند.' })).toBeVisible();
}

test.describe.serial('readiness gate (3.15)', () => {
  test('starting a phase with gaps asks first and logs the confirmation; with no gaps it does not ask', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع جاهزية ${owner.localPhone.slice(-4)}`);

    // The dashboard row: no list yet.
    const row = page.getByRole('link', { name: /جاهزية المشروع/ });
    await expect(row).toContainText('لم تُنشأ بعد');
    await row.click();
    await expect(page.getByText('لم تُنشأ قائمة الجاهزية بعد')).toBeVisible();
    await page.getByRole('button', { name: 'إنشاء قائمة الجاهزية' }).click();

    // Five items for a new build (the structural assessment is for adding a floor), none reviewed.
    const items = page.getByRole('list', { name: 'جاهزية المشروع' }).getByRole('listitem');
    await expect(items).toHaveCount(5);
    await expect(items.first()).toContainText('فحص التربة');
    await expect(items.first()).toContainText('لم يُراجَع');
    await expect(page.getByText('تقييم إنشائي')).toHaveCount(0);
    await expect(page.getByText('قالب غير مراجَع من مهندس')).toBeVisible();
    await expect(page.getByText('5 بنود ناقصة أو لم تُراجَع.')).toBeVisible();
    await expectNoSidewaysScroll(page);

    // Starting «المباني والتأسيسات» with every item unreviewed: the form lists the gaps and saves nothing.
    const ids = await phaseIds();
    await page.goto(`/phases/${ids['المباني والتأسيسات']}/schedule`);
    await page.getByLabel('حالة المرحلة').selectOption({ label: 'قيد التنفيذ' });
    await page.getByRole('button', { name: 'حفظ' }).click();
    const gate = page.getByRole('alert').filter({ hasText: 'قائمة جاهزية المشروع لم تكتمل' });
    await expect(gate).toBeVisible();
    await expect(gate).toContainText('فحص التربة (لم يُراجَع)');
    await expect(gate.getByRole('link', { name: 'فتح قائمة الجاهزية' })).toBeVisible();
    await expect(page.getByLabel('حالة المرحلة')).toHaveValue('in_progress');
    await expectNoSidewaysScroll(page);
    const asOwner = await signedInClient(owner);
    expect((await asOwner.from('phases').select('status').eq('id', ids['المباني والتأسيسات']).single()).data?.status).toBe('not_started');

    // Confirming starts it, and the confirmation is logged with the five gaps.
    await page.getByLabel(/أؤكد بدء المرحلة رغم النقص/).check();
    await page.getByRole('button', { name: 'حفظ' }).click();
    await expect(page).toHaveURL(new RegExp(`/phases/${ids['المباني والتأسيسات']}$`));
    expect((await asOwner.from('phases').select('status').eq('id', ids['المباني والتأسيسات']).single()).data?.status).toBe('in_progress');
    const { data: logged } = await asOwner.from('audit_log').select('detail').eq('action', 'start_confirmed_with_gaps');
    expect(logged).toHaveLength(1);
    expect(logged![0].detail.gaps).toHaveLength(5);
    expect(logged![0].detail.gaps).toContain('ترخيص البناء (لم يُراجَع)');

    // The owner completes the list: one item missing.
    await page.goto('/readiness');
    await setReadiness(page, 'فحص التربة', 'متوفر');
    await setReadiness(page, 'مخططات إنشائية ومعمارية معتمدة', 'متوفر');
    await setReadiness(page, 'ترخيص البناء', 'ناقص', 'قيد الإصدار من البلدية');
    await setReadiness(page, 'مهندس مشرف', 'متوفر');
    await setReadiness(page, 'عقد مقاول', 'لا ينطبق');
    await expect(page.getByText('بند واحد ناقص أو لم يُراجَع.')).toBeVisible();
    await expect(items.filter({ hasText: 'ترخيص البناء' })).toContainText('ناقص');
    await page.goto('/');
    await expect(row).toContainText('بند واحد ناقص');

    // With the permit available, a phase starts without the question, and nothing extra is logged.
    await page.goto('/readiness');
    await setReadiness(page, 'ترخيص البناء', 'متوفر');
    await expect(page.getByText('كل البنود متوفرة أو لا تنطبق.')).toBeVisible();
    await page.goto(`/phases/${ids['التشطيب والتسليم']}/schedule`);
    await page.getByLabel('حالة المرحلة').selectOption({ label: 'قيد التنفيذ' });
    await page.getByRole('button', { name: 'حفظ' }).click();
    await expect(page).toHaveURL(new RegExp(`/phases/${ids['التشطيب والتسليم']}$`));
    const { data: after } = await asOwner.from('audit_log').select('detail').eq('action', 'start_confirmed_with_gaps');
    await asOwner.auth.signOut();
    expect(after).toHaveLength(1);
    await page.goto('/');
    await expect(row).toContainText('جاهز');
  });

  test('a stranger can neither see nor create the readiness list', async ({ page }) => {
    await signUpThroughUi(page, stranger);
    const asOwner = await signedInClient(owner);
    const { data: projects } = await asOwner.from('projects').select('id');
    await asOwner.auth.signOut();

    const asStranger = await signedInClient(stranger);
    const read = await asStranger.from('checklists').select('id').eq('kind', 'readiness');
    const created = await asStranger.rpc('create_readiness_checklist', { p_project_id: projects![0].id });
    await asStranger.auth.signOut();
    expect(read.data ?? []).toHaveLength(0);
    expect(created.error).not.toBeNull();
  });
});

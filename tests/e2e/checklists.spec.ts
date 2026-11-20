import { expect, test } from '@playwright/test';
import { createFirstProjectThroughUi, expectNoSidewaysScroll, newTestAccount, signedInClient, signUpThroughUi } from './helpers';

// Pre-pour checkpoints, slice 1 (3.12; FR-QLT-01, FR-QLT-02; design S26.1, S26.2). Runs against the staging project at
// phone size, and needs migration 0025 there (the unreviewed pre-pour template with the design's four items).

const owner = newTestAccount();
const stranger = newTestAccount();

test.describe.serial('pre-pour checkpoints (3.12)', () => {
  test('a named checklist for a phase, checked item by item until complete', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع فحص ${owner.localPhone.slice(-4)}`);

    // From the phase page: no checklists yet.
    await page.goto('/phases');
    await page.getByRole('link', { name: /الهيكل الخرساني/ }).first().click();
    const link = page.getByRole('link', { name: /قوائم الفحص/ });
    await expect(link).toContainText('لا قوائم بعد');
    await link.click();
    await expect(page.getByText('لا قوائم فحص لهذه المرحلة بعد')).toBeVisible();
    await expect(page.getByText('يوثّق النظام الفحص ولا يحل محل المهندس المسؤول.')).toBeVisible();

    // A refused name; then the checklist, copied from the unreviewed template.
    await page.getByRole('link', { name: 'إضافة قائمة فحص' }).click();
    await expect(page.getByText('قالب غير مراجَع من مهندس')).toBeVisible();
    await page.getByRole('button', { name: 'إنشاء القائمة' }).click();
    await expect(page.getByText('هذا الحقل مطلوب.')).toBeVisible();
    await page.getByLabel(/اسم القائمة/).fill('صب سقف الدور الأرضي');
    await page.getByRole('button', { name: 'إنشاء القائمة' }).click();

    // S26.1: four items, none checked.
    await expect(page.getByRole('status').filter({ hasText: 'أُنشئت القائمة من القالب.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'صب سقف الدور الأرضي' })).toBeVisible();
    await expect(page.getByText('الهيكل الخرساني · 0 من 4 بندًا')).toBeVisible();
    const items = page.getByRole('list', { name: 'بنود الفحص' }).getByRole('listitem');
    await expect(items).toHaveCount(4);
    await expect(items.first()).toContainText('مراجعة المخطط المعتمد');
    await expect(items.first()).toContainText('لم يُفحص');
    await expectNoSidewaysScroll(page);

    // S26.2: a problem with who fixes it and when it is checked again.
    await page.getByRole('link', { name: 'فحص: فحص التسليح' }).click();
    await page.getByRole('button', { name: 'حفظ والعودة للقائمة' }).click();
    await expect(page.getByText('هذا الحقل مطلوب.')).toBeVisible();
    await page.getByLabel('توجد ملاحظة').check();
    await page.getByLabel(/^ملاحظة/).fill('تباعد الكانات أكبر من المخطط');
    await page.getByLabel(/المسؤول عن المعالجة/).fill('مقاول الهيكل');
    await page.getByLabel(/موعد إعادة الفحص/).fill('2026-12-01');
    await expectNoSidewaysScroll(page);
    await page.getByRole('button', { name: 'حفظ والعودة للقائمة' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظت نتيجة البند.' })).toBeVisible();
    await expect(page.getByText('بند واحد عليه ملاحظة.')).toBeVisible();
    const rebar = items.filter({ hasText: 'فحص التسليح' });
    await expect(rebar).toContainText('توجد ملاحظة');
    await expect(rebar).toContainText('مقاول الهيكل');
    await expect(page.getByText('الهيكل الخرساني · 1 من 4 بندًا')).toBeVisible();

    // The other three: sound, sound, not applicable. A problem does not stop completion (D2).
    for (const [text, result] of [
      ['مراجعة المخطط المعتمد', 'سليم'],
      ['فحص الشدة والدعامات', 'سليم'],
      ['مراجعة الفتحات والتمديدات', 'لا ينطبق'],
    ] as const) {
      await page.getByRole('link', { name: `فحص: ${text}` }).click();
      await page.getByLabel(result).check();
      await page.getByRole('button', { name: 'حفظ والعودة للقائمة' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'حُفظت نتيجة البند.' })).toBeVisible();
    }
    await expect(page.getByText('اكتملت القائمة: لكل بند نتيجة.')).toBeVisible();
    await expect(page.getByText('الهيكل الخرساني · 4 من 4 بندًا')).toBeVisible();

    // The phase's list shows it complete; the phase page counts it.
    await page.getByRole('link', { name: 'العودة إلى المرحلة' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'صب سقف الدور الأرضي' })).toContainText('مكتملة');
    await page.getByRole('link', { name: 'رجوع' }).click();
    await expect(page.getByRole('link', { name: /قوائم الفحص/ })).toContainText('قائمة واحدة · مكتملة');

    // Each check is audited; a checklist cannot be completed or deleted directly.
    const asOwner = await signedInClient(owner);
    const { data: audit } = await asOwner.from('audit_log').select('action').eq('table_name', 'checklist_items');
    const { data: lists } = await asOwner.from('checklists').select('id, status');
    const forced = await asOwner.from('checklists').update({ status: 'open' }).eq('id', lists![0].id);
    const deleted = await asOwner.from('checklists').delete().eq('id', lists![0].id);
    await asOwner.auth.signOut();
    expect(audit).toHaveLength(4);
    expect(lists).toEqual([{ id: lists![0].id, status: 'completed' }]);
    expect(forced.error).not.toBeNull();
    expect(deleted.error).not.toBeNull();
  });

  test('a stranger can neither see nor check the checklist', async ({ page }) => {
    await signUpThroughUi(page, stranger);
    const asOwner = await signedInClient(owner);
    const { data: items } = await asOwner.from('checklist_items').select('id');
    await asOwner.auth.signOut();

    const asStranger = await signedInClient(stranger);
    const read = await asStranger.from('checklists').select('id');
    const changed = await asStranger.from('checklist_items').update({ result: 'ok' }).eq('id', items![0].id).select('id');
    await asStranger.auth.signOut();
    expect(read.data ?? []).toHaveLength(0);
    expect(changed.data ?? []).toHaveLength(0);
  });
});

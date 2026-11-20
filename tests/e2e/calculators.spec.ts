import { expect, test } from '@playwright/test';
import { createFirstProjectThroughUi, expectNoSidewaysScroll, navTab, newTestAccount, signedInClient, signInThroughUi, signUpThroughUi } from './helpers';

// Quantity calculators (3.3 slice 1; FR-MAT-04, FR-MAT-05; design S20.1, S22, S23). Runs against the staging project at
// phone size, and needs migration 0023 there (the rebar coefficient, unreviewed). Nothing is saved.

const owner = newTestAccount();

test.describe.serial('quantity calculators (3.3)', () => {
  test('rebar weight from the bar schedule, with the coefficient marked unreviewed', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع حاسبات ${owner.localPhone.slice(-4)}`);

    // «المواد» is a tab now; it opens the materials home (S20.1).
    await navTab(page, 'المواد').click();
    await expect(navTab(page, 'المواد')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { name: 'المواد والكميات' })).toBeVisible();
    await page.getByRole('link', { name: /حاسبة الحديد/ }).click();

    // S22.1: wrong inputs are refused and kept.
    await page.getByLabel(/قطر السيخ/).fill('0');
    await page.getByLabel(/طول السيخ/).fill('12');
    await page.getByLabel(/عدد الأسياخ/).fill('2.5');
    await page.getByRole('button', { name: 'احسب الوزن التقريبي' }).click();
    await expect(page.getByText('يجب أن يكون الرقم أكبر من صفر.')).toBeVisible();
    await expect(page.getByText('اكتب عددًا صحيحًا.')).toBeVisible();
    await expect(page.getByLabel(/طول السيخ/)).toHaveValue('12');
    await expectNoSidewaysScroll(page);

    // S22.2: the design's example, in Arabic digits: 16 mm × 12 m × 50 bars.
    await page.getByLabel(/قطر السيخ/).fill('١٦');
    await page.getByLabel(/عدد الأسياخ/).fill('50');
    await page.getByRole('button', { name: 'احسب الوزن التقريبي' }).click();
    await expect(page.getByRole('heading', { name: 'نتيجة وزن الحديد' })).toBeVisible();
    await expect(page.getByText('قطر 16 مم · طول 12 م · 50 سيخًا')).toBeVisible();
    await expect(page.getByText('948 كجم', { exact: true })).toBeVisible();
    await expect(page.getByText('حوالي 0.95 طن')).toBeVisible();
    const rows = page.getByRole('list', { name: 'نتيجة وزن الحديد' }).getByRole('listitem');
    await expect(rows.filter({ hasText: 'وزن السيخ الواحد' })).toContainText('18.96 كجم');
    await expect(rows.filter({ hasText: 'إجمالي الأطوال' })).toContainText('600 متر');
    await expect(rows.filter({ hasText: 'المعادلة المستخدمة' })).toContainText('غير مراجَع');
    await expect(page.getByText('المعامل غير مراجَع من مهندس بعد')).toBeVisible();
    await expect(rows.filter({ hasText: 'المعادلة المستخدمة' })).toContainText('القطر² ÷ 162');
    await expectNoSidewaysScroll(page);

    // «تعديل المدخلات» brings the values back; waste and a price per ton add the weight with waste and the cost.
    await page.getByRole('link', { name: 'تعديل المدخلات' }).click();
    await expect(page.getByLabel(/قطر السيخ/)).toHaveValue('١٦');
    await page.getByLabel(/نسبة الهدر/).fill('5');
    await page.getByLabel(/سعر الطن/).fill('4,000');
    await page.getByRole('button', { name: 'احسب الوزن التقريبي' }).click();
    await expect(page.getByText('الوزن التقريبي · مع هدر 5%')).toBeVisible();
    await expect(page.getByText('996 كجم', { exact: true })).toBeVisible();
    await expect(rows.filter({ hasText: 'الوزن دون هدر' })).toContainText('948 كجم');
    await expect(rows.filter({ hasText: 'التكلفة التقديرية' })).toContainText('3,982.222 د.ل');
    await expect(rows.filter({ hasText: 'التكلفة التقديرية' })).toContainText('بسعر 4,000 د.ل للطن');
  });

  test('geometric calculators: concrete volume, finish area, tile count', async ({ page }) => {
    await signInThroughUi(page, owner);
    await page.goto('/materials');
    await page.getByRole('link', { name: /حاسبات أخرى/ }).click();
    await expect(page.getByText(/الطوب والأسمنت والرمل تحتاج نسبًا هندسية/)).toBeVisible();

    // S23.2: the design's example, 10 × 8 × 0.15 = 12 m³.
    await page.getByRole('link', { name: 'فتح حاسبة حجم الخرسانة' }).click();
    await page.getByLabel(/الطول/).fill('10');
    await page.getByLabel(/العرض/).fill('8');
    await page.getByLabel(/السمك/).fill('0.15');
    await page.getByRole('button', { name: 'احسب', exact: true }).click();
    const result = page.getByRole('status');
    await expect(result).toContainText('الحجم الهندسي');
    await expect(result).toContainText('12 م³');
    await expect(result).toContainText('10 × 8 × 0.15 · دون إضافات');
    await expectNoSidewaysScroll(page);

    await page.getByRole('link', { name: 'العودة للحاسبات' }).click();
    await page.getByRole('link', { name: 'فتح حاسبة عدد البلاط' }).click();
    await page.getByLabel(/المساحة/).fill('13.5');
    await page.getByLabel(/طول البلاطة/).fill('60');
    await page.getByLabel(/عرض البلاطة/).fill('60');
    await page.getByRole('button', { name: 'احسب', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('38 قطعة');
    await expect(page.getByRole('status')).toContainText('مقرّبة لأعلى إلى قطعة كاملة');

    // A missing field is reported, not guessed.
    await page.getByRole('link', { name: 'العودة للحاسبات' }).click();
    await page.getByRole('link', { name: 'فتح حاسبة مساحة التشطيب' }).click();
    await page.getByLabel(/الطول/).fill('4.5');
    await page.getByRole('button', { name: 'احسب', exact: true }).click();
    await expect(page.getByText('هذا الحقل مطلوب.')).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
  });

  test('the coefficient is read-only for users', async () => {
    const asOwner = await signedInClient(owner);
    const read = await asOwner.from('calc_coefficients').select('key, status');
    const changed = await asOwner.from('calc_coefficients').update({ value: 100 }).eq('key', 'rebar_kg_per_m_divisor').select('key');
    await asOwner.auth.signOut();
    expect(read.data).toEqual([{ key: 'rebar_kg_per_m_divisor', status: 'unreviewed' }]);
    expect(changed.data ?? []).toHaveLength(0);
  });
});

import { expect, test, type Page } from '@playwright/test';
import { createFirstProjectThroughUi, expectNoSidewaysScroll, newTestAccount, signedInClient, signUpThroughUi, tripoliDate } from './helpers';

// Continue or pause (design S18.1, S18.2; FR-DEC-01, 02, 03, 05; slice 3 of 3.7). Runs against the staging project at
// phone size, and needs migrations 0017–0019 there. The wizard gives «المتاح الآن» 100,000 today (helpers.ts).
// Figures worked out by hand (the model of 20 Nov 2026):
//   works 150,000 − 20,000 on site = 130,000 to buy; phase 50,000 − 20,000 = 30,000; pause 3,000 + 1,500 + 5,000 = 9,500;
//   prices +10% for what is bought later; cash: 100,000, −30,000 in 5 days, +40,000 in 10 days.
//   continue      now 130,000  later 0        total 130,000  -> short from today, lowest −60,000
//   pause         now 9,500    later 143,000  total 152,500  -> 100,500 after 30 days
//   finish phase  now 39,500   later 110,000  total 149,500  -> 70,500 after 30 days

const owner = newTestAccount();
const stranger = newTestAccount();

const scenario = (page: Page, name: RegExp) => page.getByRole('list', { name: 'السيناريوهات' }).getByRole('listitem').filter({ hasText: name });

test.describe.serial('continue or pause (S18)', () => {
  test('owner compares the three scenarios from their own figures', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع قرار ${owner.localPhone.slice(-4)}`);

    // Cash: an obligation, then income (S16), and an expired quote in the price log (S24).
    for (const m of [
      { kind: 'التزام', title: 'دفعة مقاول الهيكل', amount: '30000', date: tripoliDate(5), party: 'المقاول' },
      { kind: 'دخل متوقع', title: 'تمويل من المالك', amount: '40000', date: tripoliDate(10), party: 'مالك المشروع' },
    ]) {
      await page.goto('/cashflow/new');
      await page.getByLabel('نوع الحركة').selectOption({ label: m.kind });
      await page.getByLabel('الوصف').fill(m.title);
      await page.getByLabel('المبلغ · د.ل').fill(m.amount);
      await page.getByLabel('التاريخ المتوقع').fill(m.date);
      await page.getByLabel('المصدر أو المستفيد').fill(m.party);
      await page.getByRole('button', { name: 'حفظ الحركة' }).click();
      await expect(page.getByText('حُفظت الحركة')).toBeVisible();
    }
    await page.goto('/prices/new');
    await page.getByLabel('المادة').fill('أسمنت');
    await page.getByLabel('الوحدة').fill('كيس');
    await page.getByLabel('السعر · د.ل').fill('40');
    await page.getByLabel('نوع السعر').selectOption({ label: 'عرض من مورد' });
    await page.getByLabel('التاريخ', { exact: true }).fill(tripoliDate(-20));
    await page.getByLabel(/العرض صالح حتى/).fill(tripoliDate(-5));
    await page.getByRole('button', { name: 'حفظ السعر' }).click();
    await expect(page.getByText('حُفظ السعر')).toBeVisible();

    // S18.1 before any figure: the 30-day balance, the expired quote, and every scenario «ناقص» (FR-DEC-03).
    await page.goto('/more');
    await page.getByRole('link', { name: /الاستمرار أو التوقف/ }).click();
    await expect(page.getByRole('heading', { name: 'الاستمرار أو التوقف' })).toBeVisible();
    const summary = page.locator('main').getByText('الرصيد المتوقع بعد 30 يومًا').locator('..');
    await expect(summary).toContainText('110,000');
    await expect(summary).toContainText('100,000 + 40,000 − 30,000');
    await expect(page.getByText(/أسمنت \(كيس\): عرض منتهي منذ/)).toBeVisible();
    await expect(page.getByText('أدخل تكلفة الأعمال المتبقية لتظهر المقارنة.')).toBeVisible();
    await expect(scenario(page, /الاستمرار حسب الخطة/)).toContainText('ناقص: تكلفة الأعمال المتبقية');
    await expect(page.getByText(/ليست نصيحة مالية أو هندسية نهائية/)).toBeVisible(); // FR-DEC-05
    await expectNoSidewaysScroll(page);

    // The figures. A % out of range is refused and the other values stay.
    await page.getByRole('link', { name: 'إدخال تكاليف السيناريوهات' }).click();
    await page.getByLabel(/تكلفة الأعمال المتبقية/).fill('150,000');
    await page.getByLabel(/قيمة المواد الموجودة/).fill('20000');
    await page.getByLabel('المرحلة التي تُكمل قبل التوقف').selectOption({ label: 'الهيكل الخرساني' });
    await page.getByLabel(/تكلفة إكمال هذه المرحلة/).fill('50000');
    await page.getByLabel(/الحماية/).fill('3000');
    await page.getByLabel(/تخزين المواد/).fill('1500');
    await page.getByLabel(/إعادة تشغيل العمل/).fill('5000');
    await page.getByLabel(/تغير الأسعار/).fill('150');
    await page.getByRole('button', { name: 'حفظ الأرقام' }).click();
    await expect(page.getByText('النسبة بين -50 و100.')).toBeVisible();
    await expect(page.getByLabel('المرحلة التي تُكمل قبل التوقف')).not.toHaveValue('');
    await expectNoSidewaysScroll(page);
    await page.getByLabel(/تغير الأسعار/).fill('10');
    await page.getByRole('button', { name: 'حفظ الأرقام' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظت الأرقام' })).toBeVisible();

    const go = scenario(page, /الاستمرار حسب الخطة/);
    await expect(go).toContainText('الآن 130,000 د.ل · لاحقًا 0 د.ل');
    await expect(go).toContainText(/عجز من .*: ينزل الرصيد إلى -60,000 د.ل/);
    await expect(go).toContainText('130,000');

    const pause = scenario(page, /التوقف المؤقت الآن/);
    await expect(pause).toContainText('الآن 9,500 د.ل · لاحقًا 143,000 د.ل');
    await expect(pause).toContainText('الرصيد بعد 30 يومًا: 100,500 د.ل');
    await expect(pause).toContainText('152,500');

    const phase = scenario(page, /إكمال «الهيكل الخرساني» ثم التوقف/);
    await expect(phase).toContainText('الآن 39,500 د.ل · لاحقًا 110,000 د.ل');
    await expect(phase).toContainText('الرصيد بعد 30 يومًا: 70,500 د.ل');
    await expect(phase).toContainText('149,500');
    await expect(page.getByText('تغير الأسعار المفترض لما يُشترى لاحقًا: 10%')).toBeVisible();

    // S18.2: the owner ticks a step, chooses a way and writes a note.
    await page.getByRole('link', { name: 'مراجعة السيناريو' }).click();
    await expect(page.getByRole('heading', { name: 'مراجعة السيناريو' })).toBeVisible();
    await page.getByLabel('ملاحظة المراجعة').fill('بانتظار تأكيد التمويل ومراجعة المهندس');
    await page.getByRole('checkbox', { name: /تأكيد مصادر التمويل/ }).check();
    await page.getByLabel('الطريقة المختارة').selectOption({ label: 'إكمال «الهيكل الخرساني» ثم التوقف' });
    await expectNoSidewaysScroll(page);
    await page.getByRole('button', { name: 'حفظ المراجعة' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُفظت المراجعة' })).toBeVisible();
    await expect(page.getByText('الطريقة المختارة في المراجعة: إكمال «الهيكل الخرساني» ثم التوقف')).toBeVisible();

    // The review reopens as saved, and the figures form keeps the saved numbers.
    await page.getByRole('link', { name: 'مراجعة السيناريو' }).click();
    await expect(page.getByRole('checkbox', { name: /تأكيد مصادر التمويل/ })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /تقييم الأعمال بالموقع/ })).not.toBeChecked();
    await page.goto('/decision/inputs');
    await expect(page.getByLabel(/تكلفة الأعمال المتبقية/)).toHaveValue('150000');
    await expect(page.getByLabel(/تغير الأسعار/)).toHaveValue('10');

    // Saving the review was audited (the figures did not change; the review did).
    const asOwner = await signedInClient(owner);
    const { data } = await asOwner.from('audit_log').select('action, detail').eq('table_name', 'decision_scenarios').eq('action', 'updated');
    await asOwner.auth.signOut();
    expect(data!.some((a) => a.detail.before.funding_confirmed === false && a.detail.after.funding_confirmed === true)).toBe(true);
  });

  test('a stranger can neither see nor change the comparison', async ({ page }) => {
    await signUpThroughUi(page, stranger);
    const asStranger = await signedInClient(stranger);
    const read = await asStranger.from('decision_scenarios').select('id');
    const changed = await asStranger.from('decision_scenarios').update({ price_change_pct: '0' }).neq('price_change_pct', 99).select('id');
    await asStranger.auth.signOut();
    expect(read.data ?? []).toHaveLength(0);
    expect(changed.data ?? []).toHaveLength(0);

    const asOwner = await signedInClient(owner);
    const { data } = await asOwner.from('decision_scenarios').select('price_change_pct::text').single();
    await asOwner.auth.signOut();
    expect(data).toEqual({ price_change_pct: '10.00' });
  });
});

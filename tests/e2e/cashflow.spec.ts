import { expect, test, type Page } from '@playwright/test';
import { createFirstProjectThroughUi, expectNoSidewaysScroll, newTestAccount, signedInClient, signUpThroughUi, tripoliDate } from './helpers';

// Obligations and expected income (design S16.1, S16.2; FR-FIN-06, FR-FIN-07; the timing rule of FR-DEC-01). Slice 1 of
// 3.7. Runs against the staging project at phone size, and needs migration 0017 there.
// The wizard gives «المتاح الآن» 100,000 today (helpers.ts).

const owner = newTestAccount();
const stranger = newTestAccount();

const card = (page: Page) => page.locator('main').getByText('السيولة الحالية').locator('..');
const balanceRow = (page: Page) => page.locator('main').getByText('الرصيد المتوقع بعد 30 يومًا').locator('../..');

async function addMovement(page: Page, m: { kind: 'دخل متوقع' | 'التزام'; title: string; amount: string; date: string; party: string }) {
  await page.getByRole('link', { name: 'إضافة التزام أو دخل' }).click();
  await expect(page.getByRole('heading', { name: 'إضافة حركة متوقعة' })).toBeVisible();
  await page.getByLabel('نوع الحركة').selectOption({ label: m.kind });
  await page.getByLabel('الوصف').fill(m.title);
  await page.getByLabel('المبلغ · د.ل').fill(m.amount);
  await page.getByLabel('التاريخ المتوقع').fill(m.date);
  await page.getByLabel('المصدر أو المستفيد').fill(m.party);
  await page.getByRole('button', { name: 'حفظ الحركة' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'حُفظت الحركة' })).toBeVisible();
}

test.describe.serial('obligations and expected income (S16)', () => {
  test('owner records movements and sees the 30-day balance, with the timing rule', async ({ page }) => {
    await signUpThroughUi(page, owner);
    await createFirstProjectThroughUi(page, `مشروع سيولة ${owner.localPhone.slice(-4)}`);

    // An expense of 20,000 today: «السيولة الحالية» = 100,000 − 20,000.
    await page.getByRole('link', { name: 'إضافة مصروف سريع' }).click();
    await page.getByLabel('اسم المصروف').fill('حديد تسليح');
    await page.getByLabel('المبلغ · د.ل').fill('20000');
    await page.getByLabel('نوع المصروف').selectOption({ label: 'مواد' });
    await page.getByRole('button', { name: 'حفظ المصروف' }).click();
    await expect(page.getByText('تم حفظ المصروف')).toBeVisible({ timeout: 30_000 });

    // From «المزيد» to S16.1: empty, liquidity 80,000, balance 80,000.
    await page.goto('/more');
    await page.getByRole('link', { name: /الالتزامات والدخل/ }).click();
    await expect(page.getByRole('heading', { name: 'الالتزامات والدخل' })).toBeVisible();
    await expect(page.getByText('لا التزامات ولا دخل متوقع بعد')).toBeVisible();
    await expect(card(page)).toContainText('80,000');
    await expect(balanceRow(page)).toContainText('80,000');
    await expectNoSidewaysScroll(page);

    // A refused form keeps the chosen kind.
    await page.getByRole('link', { name: 'إضافة التزام أو دخل' }).click();
    await page.getByLabel('نوع الحركة').selectOption({ label: 'التزام' });
    await page.getByRole('button', { name: 'حفظ الحركة' }).click();
    await expect(page.getByText('هذا الحقل مطلوب.').first()).toBeVisible();
    await expect(page.getByLabel('نوع الحركة')).toHaveValue('obligation');
    await expectNoSidewaysScroll(page);
    await page.goto('/cashflow');

    // 90,000 due in 3 days, 40,000 expected in 10: fine at the end (30,000), but short in between (FR-DEC-01).
    await addMovement(page, { kind: 'التزام', title: 'دفعة مقاول الهيكل', amount: '90000', date: tripoliDate(3), party: 'المقاول' });
    await addMovement(page, { kind: 'دخل متوقع', title: 'تمويل من المالك', amount: '40000', date: tripoliDate(10), party: 'مالك المشروع' });
    await expect(card(page)).toContainText('دخل متوقع: 40,000 · التزامات: 90,000');
    await expect(balanceRow(page)).toContainText('30,000');
    await expect(page.getByText(/عجز متوقع من .*: ينزل الرصيد إلى -10,000 د.ل/)).toBeVisible();
    await expect(page.getByRole('list', { name: 'الالتزامات والدخل' }).getByRole('listitem')).toHaveText([
      /دفعة مقاول الهيكل.*التزام · مستحق/,
      /تمويل من المالك.*دخل متوقع · متوقع/,
    ]);

    // An overdue obligation still counts (due today at the latest) and is flagged.
    await addMovement(page, { kind: 'التزام', title: 'توريد رمل', amount: '1000', date: tripoliDate(-2), party: 'المورد' });
    await expect(page.getByText('التزام واحد فات موعده ولم يُحذف بعد.')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'توريد رمل' })).toContainText('فات موعده');
    await expect(balanceRow(page)).toContainText('29,000');
  });

  test('deleting asks first, and the audit log keeps the values', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('رقم الهاتف').fill(owner.localPhone);
    await page.getByRole('textbox', { name: 'كلمة المرور', exact: true }).fill(owner.password);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page.getByRole('heading', { name: 'لوحة المشروع' })).toBeVisible();
    await page.goto('/cashflow');

    // Cancel first: nothing changes.
    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: 'حذف: تمويل من المالك' }).click();
    await expect(page.getByText('تمويل من المالك')).toBeVisible();

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'حذف: تمويل من المالك' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'حُذفت الحركة' })).toBeVisible();
    await expect(page.getByText('تمويل من المالك')).toHaveCount(0);
    await expect(balanceRow(page)).toContainText('-11,000'); // 80,000 − 90,000 − 1,000

    const asOwner = await signedInClient(owner);
    const { data } = await asOwner.from('audit_log').select('action, detail').eq('table_name', 'expected_income');
    await asOwner.auth.signOut();
    expect(data).toHaveLength(1);
    expect(data![0].action).toBe('deleted');
    expect(data![0].detail.before).toMatchObject({ title: 'تمويل من المالك', source: 'مالك المشروع' });
    expect(Number(data![0].detail.before.amount_lyd)).toBe(40000);
  });

  test('a stranger can neither see nor change the movements', async ({ page }) => {
    await signUpThroughUi(page, stranger);
    const asStranger = await signedInClient(stranger);
    const read = await asStranger.from('obligations').select('id');
    const changed = await asStranger.from('obligations').update({ amount_lyd: '1' }).neq('id', '00000000-0000-0000-0000-000000000000').select('id');
    const deleted = await asStranger.from('obligations').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id');
    await asStranger.auth.signOut();
    expect(read.data ?? []).toHaveLength(0);
    expect(changed.data ?? []).toHaveLength(0);
    expect(deleted.data ?? []).toHaveLength(0);

    const asOwner = await signedInClient(owner);
    const { data } = await asOwner.from('obligations').select('amount_lyd::text').order('due_on');
    await asOwner.auth.signOut();
    expect(data).toEqual([{ amount_lyd: '1000.000' }, { amount_lyd: '90000.000' }]);
  });
});

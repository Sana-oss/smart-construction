import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { expectNoSidewaysScroll, newTestAccount, signedInClient, signUpThroughUi } from './helpers';

// Week-1 task 15. Two tests, run in order:
// 1. The owner's journey (degree 1 "works end to end"): sign up -> first-project wizard -> dashboard ->
//    quick expense -> back to the dashboard, at phone size (NFR-USE-02; FR-ID-01, FR-PRJ-01, FR-FIN-02, FR-DSH-01).
// 2. The stranger test (NFR-SEC-01): a second account cannot see or change the first owner's project, neither
//    through the pages nor by calling the database directly with its own sign-in.
// Test data only; amounts are arbitrary.

const owner = newTestAccount();
const stranger = newTestAccount();
const projectName = `مشروع اختبار آلي ${owner.localPhone.slice(-4)}`;

test.describe.serial('owner journey and stranger', () => {
  test('owner signs up, creates the first project and records an expense', async ({ page }) => {
    await signUpThroughUi(page, owner);

    // Wizard step 1: project details (design S02.1).
    await expectNoSidewaysScroll(page);
    await page.getByLabel('اسم المشروع').fill(projectName);
    await page.locator('#city').selectOption({ index: 1 });
    await page.getByRole('radio', { name: 'بناء جديد' }).check();
    await page.getByLabel('مساحة البناء · م²').fill('240');
    await page.getByRole('button', { name: 'التالي: خطة المراحل' }).click();

    // Step 2: phases (S02.2). The owner is at the second phase; the first stays marked as finished (solution B).
    await expect(page).toHaveURL(/\/setup\/phases/);
    await expectNoSidewaysScroll(page);
    await page.locator('input[name="currentPhase"]').nth(1).check();
    await page.getByRole('button', { name: 'التالي: الميزانية' }).click();

    // Step 3: budget (S02.3). The contingency field keeps its suggested value.
    await expect(page).toHaveURL(/\/setup\/budget/);
    await expectNoSidewaysScroll(page);
    await page.getByLabel('الميزانية الإجمالية · د.ل').fill('450000');
    await page.getByLabel('المبلغ المتاح حاليًا · د.ل').fill('100000');
    await page.getByLabel('المصروف قبل استخدام التطبيق · د.ل').fill('5000');
    await page.getByRole('button', { name: 'التالي: مراجعة الإعداد' }).click();

    // Step 4: review (S02.5), then the dashboard.
    await expect(page).toHaveURL(/\/setup\/review/);
    await expectNoSidewaysScroll(page);
    await expect(page.getByText(projectName)).toBeVisible();
    await page.getByRole('button', { name: 'فتح لوحة المشروع' }).click();

    await expect(page.getByRole('heading', { name: 'لوحة المشروع' })).toBeVisible();
    await expect(page.getByText(projectName)).toBeVisible();
    await expect(page.getByText('الخطوة التالية: سجّل أول مصروف')).toBeVisible();
    await expectNoSidewaysScroll(page);

    // Quick expense (S14.1): the three required answers, then save.
    await page.getByRole('link', { name: 'إضافة مصروف سريع' }).click();
    await expect(page).toHaveURL(/\/expenses\/new/);
    await expectNoSidewaysScroll(page);
    await page.getByLabel('اسم المصروف').fill('إسمنت للأساسات');
    await page.getByLabel('المبلغ · د.ل').fill('1250.5');
    await page.getByLabel('نوع المصروف').selectOption({ label: 'مواد' });
    await page.getByRole('button', { name: 'حفظ المصروف' }).click();

    // Saved screen (S14.2).
    await expect(page.getByText('تم حفظ المصروف')).toBeVisible();
    await expectNoSidewaysScroll(page);
    await page.getByRole('link', { name: 'العودة للوحة المشروع' }).click();

    // Spent = 5,000 before the app + 1,250.5 recorded = 6,250.5; the first-expense prompt is gone.
    await expect(page.getByRole('heading', { name: 'لوحة المشروع' })).toBeVisible();
    await expect(page.getByText('6,250.5', { exact: true })).toBeVisible();
    await expect(page.getByText('الخطوة التالية: سجّل أول مصروف')).toHaveCount(0);
  });

  test('a stranger cannot see or change that project', async ({ page }) => {
    // Through the pages: the stranger lands on their own empty wizard and never sees the owner's project.
    await signUpThroughUi(page, stranger);
    await expect(page.getByText(projectName)).toHaveCount(0);
    await page.goto('/');
    await expect(page).toHaveURL(/\/setup/);
    await expect(page.getByText(projectName)).toHaveCount(0);
    await page.goto('/expenses/new');
    await expect(page).not.toHaveURL(/\/expenses\/new/);

    // Directly against the database, with the stranger's own sign-in and the public key (what any browser can do).
    const asOwner = await signedInClient(owner);
    const asStranger = await signedInClient(stranger);

    const { data: mine, error: ownerReadError } = await asOwner.from('projects').select('id, name');
    expect(ownerReadError).toBeNull();
    expect(mine).toHaveLength(1);
    const projectId = mine![0].id as string;
    const expensesBefore = await asOwner.from('expenses').select('id').eq('project_id', projectId);
    expect(expensesBefore.data).toHaveLength(1);

    // Read: every table the journey wrote to returns nothing for the stranger.
    for (const [table, column] of [
      ['projects', 'id'],
      ['phases', 'project_id'],
      ['expenses', 'project_id'],
      ['budget_summary', 'project_id'],
    ] as const) {
      const { data, error } = await asStranger.from(table).select('*').eq(column, projectId);
      expect(error, `reading ${table}`).toBeNull();
      expect(data, `stranger can read ${table}`).toHaveLength(0);
    }

    // Write through the app's own function: refused.
    const viaFunction = await asStranger.rpc('create_expense', {
      p_project_id: projectId,
      p_amount_lyd: '1',
      p_client_op_id: randomUUID(),
      p_title: 'محاولة من غريب',
      p_expense_type: 'materials',
    });
    expect(viaFunction.error, 'stranger could record an expense').not.toBeNull();

    // Write straight into the table: refused by row-level security.
    const direct = await asStranger.from('expenses').insert({
      project_id: projectId,
      amount_lyd: '1',
      title: 'محاولة من غريب',
      expense_type: 'materials',
      client_op_id: randomUUID(),
    });
    expect(direct.error?.code, 'stranger could insert an expense').toBe('42501');

    // Change the project's name: no row is touched.
    const rename = await asStranger.from('projects').update({ name: 'تغيير من غريب' }).eq('id', projectId).select('id');
    expect(rename.data ?? []).toHaveLength(0);

    // The owner's data is exactly as before.
    const after = await asOwner.from('projects').select('name').eq('id', projectId).single();
    expect(after.data?.name).toBe(projectName);
    const expensesAfter = await asOwner.from('expenses').select('id').eq('project_id', projectId);
    expect(expensesAfter.data).toHaveLength(1);

    await asOwner.auth.signOut();
    await asStranger.auth.signOut();
  });
});

import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  createFirstProjectThroughUi,
  expectNoSidewaysScroll,
  newTestAccount,
  signedInClient,
  signInThroughUi,
  signUpThroughUi,
  tripoliDate,
} from './helpers';

// Week-1 task 15, plus the phases screen (18 Nov). Tests run in order:
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
    await createFirstProjectThroughUi(page, projectName);
    await expect(page.getByText(projectName)).toBeVisible();
    await expect(page.getByText('الخطوة التالية: سجّل أول مصروف')).toBeVisible();
    await expectNoSidewaysScroll(page);

    // Empty expenses list (S13.3) before the first expense, opened from the dashboard.
    await page.getByRole('link', { name: 'عرض المصروفات' }).click();
    await expect(page.getByText('لا توجد مصروفات بعد')).toBeVisible();
    await expect(page.getByRole('link', { name: 'إضافة أول مصروف' })).toBeVisible();
    await expectNoSidewaysScroll(page);
    await page.getByRole('link', { name: 'رجوع' }).click();
    await expect(page.getByRole('heading', { name: 'لوحة المشروع' })).toBeVisible();

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
    await page.getByRole('link', { name: 'عرض المصروفات' }).click();

    // Expenses list (S13.1): the new expense, and this month's total from the finance domain.
    await expect(page).toHaveURL(/\/expenses$/);
    await expect(page.getByRole('heading', { name: 'المصروفات' })).toBeVisible();
    const row = page.getByRole('listitem').filter({ hasText: 'إسمنت للأساسات' });
    await expect(row).toContainText('1,250.5');
    await expect(row).toContainText('مواد');
    await expect(page.getByText('مصروف واحد مسجل')).toBeVisible();
    await expectNoSidewaysScroll(page);
    await page.getByRole('link', { name: 'رجوع' }).click();

    // Spent = 5,000 before the app + 1,250.5 recorded = 6,250.5; the first-expense prompt is gone.
    await expect(page.getByRole('heading', { name: 'لوحة المشروع' })).toBeVisible();
    await expect(page.getByText('6,250.5', { exact: true })).toBeVisible();
    await expect(page.getByText('الخطوة التالية: سجّل أول مصروف')).toHaveCount(0);
  });

  test('owner plans a phase and sees its delay (FR-PRJ-03)', async ({ page }) => {
    await signInThroughUi(page, owner);
    await page.getByRole('link', { name: 'مراحل المشروع' }).click();
    await expect(page).toHaveURL(/\/phases$/);
    await expect(page.getByRole('heading', { name: 'مراحل المشروع' })).toBeVisible();
    await expectNoSidewaysScroll(page);

    // The wizard made phase 1 finished and phase 2 current (createFirstProjectThroughUi). No dates yet: no delay.
    const rows = page.getByRole('listitem');
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(1)).toContainText('قيد التنفيذ · المرحلة الحالية');
    await expect(rows.nth(1)).toContainText('بلا تواريخ مخططة');

    // Plan the current phase to have ended 5 days ago: it is now late by 5 days, still running.
    await rows.nth(1).getByRole('link').click();
    await expect(page).toHaveURL(/\/phases\/[0-9a-f-]{36}$/);
    await expectNoSidewaysScroll(page);
    await page.getByLabel('بداية مخططة').fill(tripoliDate(-30));
    await page.getByLabel('نهاية مخططة').fill(tripoliDate(-5));
    await page.getByLabel('بداية فعلية').fill(tripoliDate(-28));
    await page.getByRole('button', { name: 'حفظ' }).click();

    await expect(page).toHaveURL(/\/phases$/);
    await expect(page.getByRole('listitem').nth(1)).toContainText('متأخرة · 5 أيام');
    await expect(page.getByText('مرحلة واحدة متأخرة')).toBeVisible();

    // An actual date after today is refused with a message, and nothing is saved.
    await page.getByRole('listitem').nth(1).getByRole('link').click();
    await page.getByLabel('نهاية فعلية').fill(tripoliDate(1));
    await page.getByRole('button', { name: 'حفظ' }).click();
    await expect(page.getByText('التاريخ الفعلي لا يكون بعد اليوم.')).toBeVisible();
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

    // Change a phase's status and dates through the app's function (0010): refused.
    const { data: ownerPhases } = await asOwner.from('phases').select('id, status').eq('project_id', projectId).order('position');
    const phase = ownerPhases![1];
    const phaseChange = await asStranger.rpc('update_phase_schedule', { p_phase_id: phase.id, p_status: 'blocked' });
    expect(phaseChange.error?.code, 'stranger could change a phase').toBe('42501');
    const phaseAfter = await asOwner.from('phases').select('status').eq('id', phase.id).single();
    expect(phaseAfter.data?.status).toBe(phase.status);

    // The owner's data is exactly as before.
    const after = await asOwner.from('projects').select('name').eq('id', projectId).single();
    expect(after.data?.name).toBe(projectName);
    const expensesAfter = await asOwner.from('expenses').select('id').eq('project_id', projectId);
    expect(expensesAfter.data).toHaveLength(1);

    await asOwner.auth.signOut();
    await asStranger.auth.signOut();
  });
});

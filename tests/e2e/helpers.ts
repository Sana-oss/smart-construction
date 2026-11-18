import { randomInt } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loginEmailForPhone } from '../../src/modules/identity/domain/login-identifier';

// Shared helpers for the end-to-end tests. Test data only: nothing here is an engineering value.

/**
 * Every test account has this name and a phone number in the +218 9500 range, so they are easy to find and delete
 * on the staging project (scripts/e2e-cleanup.sql). The login name ends in ".invalid": no mail can ever reach it.
 */
export const TEST_ACCOUNT_NAME = 'حساب اختبار آلي';
const TEST_PHONE_PREFIX = '+2189500';

export interface TestAccount {
  fullName: string;
  /** As the owner would type it on a phone keyboard: 09500XXXXX. */
  localPhone: string;
  /** Normalized form, used to derive the login name. */
  e164Phone: string;
  nationalId: string;
  password: string;
}

const digits = (n: number) => Array.from({ length: n }, () => randomInt(10)).join('');

export function newTestAccount(): TestAccount {
  const rest = digits(5);
  return {
    fullName: TEST_ACCOUNT_NAME,
    localPhone: `09500${rest}`,
    e164Phone: `${TEST_PHONE_PREFIX}${rest}`,
    // Law 8/2014 structure: sex digit (1), birth year (1990), then 7 digits. Random so each run is unique.
    nationalId: `11990${digits(7)}`,
    // Random per run and never printed: the accounts are throwaway, but a fixed password would be guessable.
    password: `E2e-${digits(12)}`,
  };
}

/** Phone first (NFR-USE-02): the page must never scroll sideways at phone width. */
export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `page ${page.url()} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
}

/** Signs up through the real form (design S01.3) and waits for the first-project wizard. */
export async function signUpThroughUi(page: Page, account: TestAccount) {
  await page.goto('/');
  await expectNoSidewaysScroll(page);
  await page.getByRole('link', { name: 'إنشاء حساب جديد' }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await expectNoSidewaysScroll(page);

  await page.getByLabel('الاسم الكامل').fill(account.fullName);
  await page.getByLabel('رقم الهاتف').fill(account.localPhone);
  await page.getByRole('radio', { name: 'ليبي', exact: true }).check();
  await page.getByLabel('الرقم الوطني').fill(account.nationalId);
  await page.getByRole('textbox', { name: 'كلمة المرور', exact: true }).fill(account.password);
  await page.getByLabel('تأكيد كلمة المرور').fill(account.password);
  await page.getByRole('button', { name: 'متابعة إنشاء الحساب' }).click();

  // A new account has no project, so home sends it to the wizard (FR-ID-01, FR-PRJ-01).
  await expect(page).toHaveURL(/\/setup/);
}

/** Signs in through the real form (design S01.2) and waits for the dashboard. */
export async function signInThroughUi(page: Page, account: TestAccount) {
  await page.goto('/sign-in');
  await page.getByLabel('رقم الهاتف').fill(account.localPhone);
  await page.getByRole('textbox', { name: 'كلمة المرور', exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await expect(page.getByRole('heading', { name: 'لوحة المشروع' })).toBeVisible();
}

/** Today in Libya plus `offsetDays`, as "YYYY-MM-DD" (the app counts days in Africa/Tripoli). */
export function tripoliDate(offsetDays: number): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tripoli' }).format(new Date()); // YYYY-MM-DD
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Walks the first-project wizard (designs S02.1, S02.2, S02.3, S02.5) and waits for the dashboard.
 * Spent before the app: 5,000 (the journey test checks the total). Each page is checked for sideways scrolling.
 */
export async function createFirstProjectThroughUi(page: Page, projectName: string) {
  // Step 1: project details.
  await expectNoSidewaysScroll(page);
  await page.getByLabel('اسم المشروع').fill(projectName);
  await page.locator('#city').selectOption({ index: 1 });
  await page.getByRole('radio', { name: 'بناء جديد' }).check();
  await page.getByLabel('مساحة البناء · م²').fill('240');
  await page.getByRole('button', { name: 'التالي: خطة المراحل' }).click();

  // Step 2: phases. The owner is at the second phase; the first stays marked as finished (solution B).
  await expect(page).toHaveURL(/\/setup\/phases/);
  await expectNoSidewaysScroll(page);
  await page.locator('input[name="currentPhase"]').nth(1).check();
  await page.getByRole('button', { name: 'التالي: الميزانية' }).click();

  // Step 3: budget. The contingency field keeps its suggested value.
  await expect(page).toHaveURL(/\/setup\/budget/);
  await expectNoSidewaysScroll(page);
  await page.getByLabel('الميزانية الإجمالية · د.ل').fill('450000');
  await page.getByLabel('المبلغ المتاح حاليًا · د.ل').fill('100000');
  await page.getByLabel('المصروف قبل استخدام التطبيق · د.ل').fill('5000');
  await page.getByRole('button', { name: 'التالي: مراجعة الإعداد' }).click();

  // Step 4: review, then the dashboard.
  await expect(page).toHaveURL(/\/setup\/review/);
  await expectNoSidewaysScroll(page);
  await expect(page.getByText(projectName)).toBeVisible();
  await page.getByRole('button', { name: 'فتح لوحة المشروع' }).click();
  await expect(page.getByRole('heading', { name: 'لوحة المشروع' })).toBeVisible();
}

/**
 * A Supabase client signed in as the account, with the PUBLIC key only: exactly what any browser could do with
 * that account. Used by the stranger test to try the database directly, not just the pages.
 */
export async function signedInClient(account: TestAccount): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set (.env.local)');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({
    email: loginEmailForPhone(account.e164Phone),
    password: account.password,
  });
  if (error) throw new Error(`could not sign in the test account: ${error.message}`);
  return client;
}

/**
 * Removes every stored file of the account's project, through the Storage API as that account. Supabase refuses to
 * delete storage files with SQL, so scripts/e2e-cleanup.sql (which deletes the accounts) cannot remove them: each
 * test that stores files calls this before it ends.
 */
export async function removeProjectFiles(account: TestAccount): Promise<number> {
  const client = await signedInClient(account);
  const { data: projects } = await client.from('projects').select('id');
  let removed = 0;
  for (const { id } of projects ?? []) {
    for (const folder of ['photos', 'documents']) {
      const { data } = await client.storage.from('project-files').list(`${id}/${folder}`);
      const paths = (data ?? []).map((f) => `${id}/${folder}/${f.name}`);
      if (paths.length > 0) removed += (await client.storage.from('project-files').remove(paths)).data?.length ?? 0;
    }
  }
  await client.auth.signOut();
  return removed;
}

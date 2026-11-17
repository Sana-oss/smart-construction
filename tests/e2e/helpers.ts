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

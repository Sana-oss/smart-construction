import { chromium } from '@playwright/test';

// Only for runs against a Vercel site behind Vercel's own sign-in (team default protection).
// E2E_VERCEL_SHARE_URL is a temporary share link from the team's Vercel account (it expires; never commit it).
// Opening it once sets Vercel's access cookie, which every test then reuses. Without the variable, nothing happens.

export const VERCEL_STATE_FILE = 'test-results/.auth/vercel-share.json';

export default async function globalSetup() {
  const shareUrl = process.env.E2E_VERCEL_SHARE_URL;
  if (!shareUrl) return;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(shareUrl);
  await page.context().storageState({ path: VERCEL_STATE_FILE });
  await browser.close();
}

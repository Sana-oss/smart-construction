import { defineConfig, devices } from '@playwright/test';
import { loadEnvConfig } from '@next/env';

// End-to-end tests (week-1 task 15: NFR-SEC-01 stranger test through the app, NFR-USE-02 phone first).
// They drive a real browser at phone size against a running app, which talks to the STAGING Supabase project.
// Never point them at a production database: each run creates two throwaway test accounts (see tests/e2e/README.md).
//
// - Default: starts `npm run dev` on http://localhost:3000 (reads .env.local, like the dev server).
// - E2E_BASE_URL=https://... runs against an already deployed site instead (no local server is started).

// Loads .env.local so the tests know the public Supabase URL and key (the same two values the browser gets).
loadEnvConfig(process.cwd());

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: 'tests/e2e',
  // The journey and the stranger test share the accounts they create, so they run in order, one at a time.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // The first visit to each page in dev mode compiles it, which can take a while on a laptop.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'ar-LY',
    timezoneId: 'Africa/Tripoli',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Owners use phones on site (NFR-USE-02): every test runs at a phone's screen size, with touch.
  projects: [{ name: 'phone', use: { ...devices['Pixel 7'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev', url: baseURL, reuseExistingServer: true, timeout: 180_000 },
});

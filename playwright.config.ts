import { defineConfig } from '@playwright/test';

/**
 * Playwright config for minirue-dashboard.
 *
 * 2026-07-07 v5 fix: this file was a verbatim copy of `apps/minirue-frontend/playwright.config.ts`
 * (it even said "minirue-frontend e2e tests" in its JSDoc) and pointed at a `./e2e` directory
 * that did not exist in the dashboard. Per RULEBOOK §26 Rule 5 (diff atomicity) and §24 sweep-2
 * (out-of-spec file audit), the prior config was dead code — a green `npx playwright test`
 * would have been a no-op, which is how a falsified acceptance row slipped through §19
 * verification.
 *
 * 2026-07-14 CI audit fix: `baseURL` was still `http://localhost:3000`, the FRONTEND's dev
 * port, with no `webServer` block at all — `npx playwright test` would run against whatever
 * happened to be listening on 3000 (or nothing). The dashboard's own dev port is 3001 (see
 * `e2e/smoke.spec.ts`'s note and the frontend's `playwright.config.ts`, which owns 3000). This
 * now boots the dashboard's own dev server on 3001 before tests run.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },

  webServer: {
    command: 'npm run dev -- -p 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

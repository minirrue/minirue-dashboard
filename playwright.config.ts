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
 * Until the dashboard has its own e2e suite, this config is intentionally minimal: it does
 * NOT spin up a webServer (the dashboard is a separate Next.js app on a different port and
 * we do not want to silently boot a second dev server). The real auth e2e suite for both
 * apps lives at `apps/minirue-frontend/e2e/auth/` and is run from the frontend repo. When
 * the dashboard grows its own e2e/ directory, replace this stub with a proper config that
 * points `testDir` at it and `webServer.url` at the dashboard's port.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
});

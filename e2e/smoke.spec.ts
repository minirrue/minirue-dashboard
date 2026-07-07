/**
 * Dashboard e2e smoke test.
 *
 * 2026-07-07 v5 fix: `apps/minirue-dashboard/playwright.config.ts` was a verbatim copy of
 * the frontend's (pointing at a non-existent `e2e/` directory). This file exists so
 * `npx playwright test` from the dashboard repo has at least one real test to run. The
 * dashboard's real auth e2e coverage lives in the sibling frontend suite at
 * `apps/minirue-frontend/e2e/auth/` (the §25 §26 regression set for the logout fix is run
 * from there). When the dashboard grows its own e2e/ surface, replace this smoke with real
 * coverage that runs against a dashboard dev server (port different from the frontend's 3000).
 */

import { test, expect } from '@playwright/test';

test.describe('dashboard — config smoke', () => {
  test('playwright config is wired and self-resolves', async ({ page }) => {
    // This test does not boot a webServer. It asserts the config file is parseable
    // and that a Playwright Page fixture can be instantiated. Real dashboard e2e
    // tests should add a `webServer: { command: 'npm run dev', port: 3001, ... }`
    // block in playwright.config.ts and use the page fixture against the dashboard
    // URL.
    expect(page).toBeDefined();
    expect(typeof page.goto).toBe('function');
  });
});

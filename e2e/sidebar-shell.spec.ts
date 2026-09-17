import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function authenticateAndStub(page: Page) {
  await page.context().addCookies([{ name: 'mr-auth', value: '1', url: 'http://localhost:3001' }]);
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/health')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
    }
    if (!url.pathname.startsWith('/v1/')) return route.continue();
    let body: unknown = {};
    if (url.pathname.endsWith('/auth/get-session')) {
      body = { user: { id: 'qa-admin', name: 'Youssef', email: 'contact@minirueshop.com', role: 'SUPERADMIN' } };
    } else if (url.pathname.endsWith('/auth/me')) {
      body = { userId: 'qa-admin', name: 'Youssef', email: 'contact@minirueshop.com', role: 'SUPERADMIN' };
    } else if (url.pathname.includes('/notifications/counts')) {
      body = { ORDER: 4, SUPPORT: 2 };
    } else if (url.pathname.includes('/notifications')) {
      body = { items: [], total: 6, unreadCount: 6, categoryCounts: { ORDER: 4, SUPPORT: 2 } };
    } else if (url.pathname.includes('/pricing') || url.pathname.includes('/warnings/check')) {
      body = { total: 2, byProduct: {}, items: [] };
    } else if (url.pathname.endsWith('/orders/admin')) {
      body = { data: [], meta: { page: 1, limit: 100, total: 0, pageCount: 0 } };
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test('sidebar expands, collapses, persists, and becomes a mobile drawer', async ({ page }) => {
  await mkdir('.impeccable/review', { recursive: true });
  await authenticateAndStub(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/orders');
  await expect(page.getByRole('complementary', { name: 'Dashboard navigation' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /^Orders/ }).first()).toHaveAttribute('data-active', 'true');
  await page.waitForTimeout(100);
  await page.screenshot({ path: '.impeccable/review/sidebar-expanded-1440.png', fullPage: true });

  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(page.locator('.dash-shell')).toHaveAttribute('data-sidebar-collapsed', 'true');
  await page.reload();
  await expect(page.locator('.dash-shell')).toHaveAttribute('data-sidebar-collapsed', 'true');
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ path: '.impeccable/review/sidebar-collapsed-1024.png', fullPage: true });

  await page.setViewportSize({ width: 400, height: 844 });
  await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Dashboard navigation' })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/sidebar-mobile-400.png', fullPage: true });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Dashboard navigation' })).not.toBeVisible();
});

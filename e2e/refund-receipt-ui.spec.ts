import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const now = '2026-09-17T06:00:00.000Z';

test('non-COD refund receipt requirement is clear at desktop and mobile widths', async ({ page }) => {
  await mkdir('.impeccable/review', { recursive: true });
  await page.context().addCookies([{ name: 'mr-auth', value: '1', url: 'http://localhost:3001' }]);
  await page.route('**/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (path.endsWith('/auth/get-session')) json = { user: { id: 'qa-admin', name: 'MiniRueShop', email: 'contact@minirueshop.com', role: 'SUPERADMIN' } };
    else if (path.endsWith('/auth/me')) json = { userId: 'qa-admin', name: 'MiniRueShop', email: 'contact@minirueshop.com', role: 'SUPERADMIN' };
    else if (path.endsWith('/orders/admin')) json = { data: [{ id: 'order-1', orderNumber: 'MR-82', orderSeq: 82, status: 'DELIVERED', totalAmount: '1250.00', totalCurrency: 'EGP', shippingFee: '80.00', paymentMethod: 'INSTAPAY', paid: true, refundedAt: null, refundedAmountCents: 0, guestContact: { fullName: 'Mariam Adel' }, shippingAddressSnapshot: { fullName: 'Mariam Adel' }, createdAt: now, statusHistory: [], items: [] }], total: 1, page: 1, limit: 100 };
    else if (path.endsWith('/admin/refunds')) json = { data: [], total: 0 };
    else if (path.includes('/notifications/counts')) json = {};
    else if (path.includes('/notifications')) json = { items: [], total: 0, unreadCount: 0, categoryCounts: {} };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/refunds');
  await page.getByRole('button', { name: 'Refund' }).click();
  await expect(page.getByLabel(/Payout receipt \(required\)/i)).toBeVisible();
  await expect(page.getByLabel('Reason')).toHaveValue('DAMAGED_ITEM');
  await page.screenshot({ path: '.impeccable/review/issue-82-refund-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.screenshot({ path: '.impeccable/review/issue-82-refund-mobile.png', fullPage: true });
});

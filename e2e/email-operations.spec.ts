import { mkdir } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';

const now = '2026-09-17T00:58:00.000Z';

async function authenticateAndStub(page: Page) {
  await page.context().addCookies([{ name: 'mr-auth', value: '1', url: 'http://localhost:3001' }]);
  await page.route('**/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let json: unknown = {};
    if (path.endsWith('/auth/get-session')) json = { user: { id: 'qa-admin', name: 'MiniRueShop', email: 'contact@minirueshop.com', role: 'SUPERADMIN' } };
    else if (path.endsWith('/auth/me')) json = { userId: 'qa-admin', name: 'MiniRueShop', email: 'contact@minirueshop.com', role: 'SUPERADMIN' };
    else if (path.endsWith('/admin/emails/threads')) json = [{ id: 'thread-1', customerId: '03ba1ba5-d417-4f28-85f3-3c404eeda96b', customerName: 'Mariam Adel', participantEmail: 'mariam@example.test', subject: 'Where is my order?', status: 'OPEN', unread: true, lastMessageAt: now, createdAt: now, updatedAt: now }];
    else if (path.endsWith('/admin/emails/threads/thread-1')) json = { thread: { id: 'thread-1', customerId: '03ba1ba5-d417-4f28-85f3-3c404eeda96b', customerName: 'Mariam Adel', participantEmail: 'mariam@example.test', subject: 'Where is my order?', status: 'OPEN', unread: true, lastMessageAt: now, createdAt: now, updatedAt: now, orders: [{ id: 'order-1', orderNumber: 'MR-42', status: 'SHIPPED', createdAt: now }] }, messages: [{ id: 'message-1', threadId: 'thread-1', direction: 'INBOUND', sender: 'mariam@example.test', recipient: 'contact@minirueshop.com', subject: 'Where is my order?', textBody: 'Can you confirm the delivery time for my order?', htmlBody: null, createdAt: now }] };
    else if (path.endsWith('/admin/emails/events')) json = [{ id: 'event-1', messageId: 'message-1', eventType: 'DELIVERED', severity: 'INFO', occurredAt: now, provider: 'RESEND', metadata: { detail: 'Accepted by the recipient server.' } }];
    else if (path.endsWith('/admin/email-campaigns')) json = [];
    else if (path.endsWith('/admin/email-templates')) json = [{ id: 'template-1', key: 'order.follow_up', name: 'Order follow-up', subject: 'An update about {{orderNumber}}', textBody: 'Hello {{customerName}}', variables: ['customerName', 'orderNumber'], createdAt: now, updatedAt: now }];
    else if (path.endsWith('/admin/email-branding')) json = { logoUrl: null, logoShape: 'ROUNDED' };
    else if (path.includes('/notifications/counts')) json = {};
    else if (path.includes('/notifications')) json = { items: [], total: 0, unreadCount: 0, categoryCounts: {} };
    else if (path.includes('/pricing')) json = [];
    else if (path.includes('/settings')) json = {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
  });
}

test('email workspace works at desktop and mobile widths', async ({ page }) => {
  await mkdir('.impeccable/review', { recursive: true });
  await authenticateAndStub(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/emails');
  await expect(page.getByRole('heading', { name: 'Customer email' })).toBeVisible();
  await expect(page.getByText('Where is my order?', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Mariam Adel').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /MR-42/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reply from contact@minirueshop.com' })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/desktop.png', fullPage: true });

  await page.getByRole('button', { name: 'Event log' }).click();
  await expect(page.getByRole('heading', { name: 'Delivery audit' })).toBeVisible();
  await page.getByRole('button', { name: 'Campaigns' }).click();
  await expect(page.getByRole('heading', { name: 'New campaign' })).toBeVisible();
  await page.getByPlaceholder('September loyalty thank-you').fill('VIP thank-you');
  await page.getByPlaceholder('Paste customer IDs, separated by commas').fill('03ba1ba5-d417-4f28-85f3-3c404eeda96b');
  await page.getByPlaceholder('A little something for you').fill('A gift from MiniRueShop');
  await page.getByPlaceholder('Write the campaign in MiniRueShop’s voice…').fill('Thank you for being part of MiniRueShop.');
  await expect(page.getByRole('button', { name: 'Save and preview' })).toBeEnabled();
  await page.getByRole('button', { name: 'Templates' }).click();
  await page.getByRole('button', { name: /Order follow-up/ }).click();
  await expect(page.getByRole('heading', { name: 'Edit template' })).toBeVisible();
  await page.getByRole('button', { name: 'Branding' }).click();
  await expect(page.getByLabel('Logo shape')).toHaveValue('ROUNDED');
  await page.screenshot({ path: '.impeccable/review/branding-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Inbox' }).click();
  await expect(page.getByText('mariam@example.test').first()).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/mobile.png', fullPage: true });
});

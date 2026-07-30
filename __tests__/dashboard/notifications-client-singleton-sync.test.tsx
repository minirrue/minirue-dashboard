import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { render, screen, waitFor, cleanup as cleanupRender } from '@testing-library/react';
import { renderHook, cleanup as cleanupHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationsClient from '@/app/dashboard/notifications/NotificationsClient';
import { useNotificationCounts } from '@/lib/hooks/use-notification-counts';
import type { AdminNotification } from '@/lib/api/notifications';

jest.mock('@/lib/api/notifications', () => ({
  NOTIFICATION_CATEGORIES: ['ORDER', 'PAYMENT', 'FULFILLMENT', 'REFUND', 'INVENTORY', 'CUSTOMER', 'SUPPORT', 'COLLAB', 'SYSTEM'],
  NOTIFICATION_SEVERITIES: ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'],
  apiAdminListNotifications: jest.fn(),
  apiAdminMarkNotificationRead: jest.fn(),
  apiAdminMarkNotificationUnread: jest.fn(),
  apiAdminMarkAllNotificationsRead: jest.fn(),
}));

import {
  apiAdminListNotifications,
  apiAdminMarkAllNotificationsRead,
} from '@/lib/api/notifications';

const mockList = apiAdminListNotifications as jest.Mock;
const mockMarkAllRead = apiAdminMarkAllNotificationsRead as jest.Mock;

function n(over: Partial<AdminNotification> = {}): AdminNotification {
  return {
    id: 1,
    type: 'order.order',
    category: 'ORDER',
    severity: 'INFO',
    title: 'New order #47',
    body: 'Nadia placed an order for EGP 150.00.',
    entityType: 'order',
    entityId: 'uuid-1',
    actorName: 'Nadia',
    link: '/orders/uuid-1',
    isRead: false,
    data: null,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanupRender();
  cleanupHook();
});

describe('NotificationsClient <-> singleton sync', () => {
  it(
    '"Mark all read" on the full notification centre updates the shared ' +
      'singleton (what feeds the bell and every nav badge), not just the page',
    async () => {
      // A second, independent subscriber to the same singleton the sidebar
      // bell reads from — proves the fix reaches beyond the page itself.
      mockList.mockResolvedValue({
        data: [n()],
        total: 1,
        unreadCount: 1,
        categoryCounts: { ORDER: 1 },
      });
      const bell = renderHook(() => useNotificationCounts());
      await waitFor(() => expect(bell.result.current.unreadCount).toBe(1));

      mockMarkAllRead.mockResolvedValue({ count: 1 });
      render(<NotificationsClient />);
      await screen.findByText('New order #47');

      // Once "Mark all read" resolves, the page's own list will re-fetch
      // this to reflect an empty/read feed — the singleton must agree.
      mockList.mockResolvedValue({ data: [], total: 0, unreadCount: 0, categoryCounts: {} });

      await userEvent.click(screen.getByRole('button', { name: /mark all read/i }));

      expect(mockMarkAllRead).toHaveBeenCalled();
      // This is the assertion that matters: the bell subscriber — a
      // completely separate hook instance from the page — sees the update.
      await waitFor(() => expect(bell.result.current.unreadCount).toBe(0));
    },
  );
});

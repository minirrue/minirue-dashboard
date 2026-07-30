import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useAdminNotifications } from '@/components/dashboard/notifications/useAdminNotifications';
import type { AdminNotification } from '@/lib/api/notifications';

/**
 * 2026-07-30 owner report: "we already marked as read and still notification
 * is there... on same tab notification is on and still its there."
 *
 * Two real bugs, both in this hook:
 *
 * 1. markRead/markUnread/markAllRead called refreshNotificationCounts()
 *    BEFORE awaiting the mark-read PATCH. The GET that refresh fires could
 *    land before the PATCH committed, reloading the OLD unread numbers on
 *    top of the correct optimistic guess — so a just-read notification kept
 *    reappearing on the bell and the sidebar.
 * 2. This hook's own `categoryCounts` (what feeds the drawer's and the full
 *    notification centre's filter chips) was only ever set from a full
 *    `fetchPage()` response, never adjusted on a single mark-read/unread —
 *    so the chip stayed stale even once the row itself greyed out and the
 *    shared singleton (bell/sidebar) had already caught up.
 *
 * use-notification-counts is mocked out here so these two things are tested
 * in isolation from the singleton's own network traffic.
 */

jest.mock('@/lib/api/notifications', () => ({
  apiAdminListNotifications: jest.fn(),
  apiAdminMarkNotificationRead: jest.fn(),
  apiAdminMarkNotificationUnread: jest.fn(),
  apiAdminMarkAllNotificationsRead: jest.fn(),
}));

jest.mock('@/lib/hooks/use-notification-counts', () => ({
  refreshNotificationCounts: jest.fn(),
  setUnreadCountOptimistic: jest.fn(),
}));

import {
  apiAdminListNotifications,
  apiAdminMarkNotificationRead,
  apiAdminMarkAllNotificationsRead,
} from '@/lib/api/notifications';
import { refreshNotificationCounts } from '@/lib/hooks/use-notification-counts';

const mockList = apiAdminListNotifications as jest.Mock;
const mockMarkRead = apiAdminMarkNotificationRead as jest.Mock;
const mockMarkAllRead = apiAdminMarkAllNotificationsRead as jest.Mock;
const mockRefresh = refreshNotificationCounts as jest.Mock;

function n(over: Partial<AdminNotification> = {}): AdminNotification {
  return {
    id: 1,
    type: 'collab.applied',
    category: 'COLLAB',
    severity: 'INFO',
    title: 'New collaborator application',
    body: 'A brand applied to join.',
    entityType: 'collaborator',
    entityId: 'uuid-1',
    actorName: null,
    link: '/collaborators/uuid-1',
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
  cleanup();
});

describe('useAdminNotifications mark-read', () => {
  it('excludes a marked-read notification from unreadCount AND its own category count', async () => {
    mockList.mockResolvedValue({
      data: [n()],
      total: 1,
      unreadCount: 1,
      categoryCounts: { COLLAB: 1 },
    });
    mockMarkRead.mockResolvedValue({ ...n(), isRead: true });

    const { result } = renderHook(() => useAdminNotifications({ enabled: true }));

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.categoryCounts.COLLAB).toBe(1);

    await act(async () => {
      await result.current.markRead(1);
    });

    // This is the local state the drawer's "N unread" line and its filter
    // chips read from — it must reflect the read row immediately, not only
    // after the next full re-fetch.
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.categoryCounts.COLLAB).toBe(0);
    expect(result.current.items[0].isRead).toBe(true);
  });

  it('zeroes every known category on "mark all read", not just the total', async () => {
    mockList.mockResolvedValue({
      data: [n(), n({ id: 2, category: 'ORDER' })],
      total: 2,
      unreadCount: 2,
      categoryCounts: { COLLAB: 1, ORDER: 1 },
    });
    mockMarkAllRead.mockResolvedValue({ count: 2 });

    const { result } = renderHook(() => useAdminNotifications({ enabled: true }));
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.categoryCounts).toEqual({ COLLAB: 0, ORDER: 0 });
  });

  it('refreshes the shared singleton only after the mark-read PATCH settles, not before', async () => {
    mockList.mockResolvedValue({
      data: [n()],
      total: 1,
      unreadCount: 1,
      categoryCounts: { COLLAB: 1 },
    });

    const callOrder: string[] = [];
    mockMarkRead.mockImplementation(async () => {
      callOrder.push('patch:start');
      await Promise.resolve();
      await Promise.resolve();
      callOrder.push('patch:settled');
      return { ...n(), isRead: true };
    });
    mockRefresh.mockImplementation(() => {
      callOrder.push('refresh:called');
    });

    const { result } = renderHook(() => useAdminNotifications({ enabled: true }));
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.markRead(1);
    });

    // The refresh that reconciles the singleton against the server must not
    // fire until the PATCH that persisted the read has actually resolved —
    // firing earlier is the exact race that let a stale "still unread"
    // count win the reconciliation.
    expect(callOrder).toEqual(['patch:start', 'patch:settled', 'refresh:called']);
  });

  it('refreshes the shared singleton only after "mark all read" settles, not before', async () => {
    mockList.mockResolvedValue({
      data: [n()],
      total: 1,
      unreadCount: 1,
      categoryCounts: { COLLAB: 1 },
    });

    const callOrder: string[] = [];
    mockMarkAllRead.mockImplementation(async () => {
      callOrder.push('patch:start');
      await Promise.resolve();
      await Promise.resolve();
      callOrder.push('patch:settled');
      return { count: 1 };
    });
    mockRefresh.mockImplementation(() => {
      callOrder.push('refresh:called');
    });

    const { result } = renderHook(() => useAdminNotifications({ enabled: true }));
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(callOrder).toEqual(['patch:start', 'patch:settled', 'refresh:called']);
  });
});

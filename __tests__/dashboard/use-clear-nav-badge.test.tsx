import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useClearNavBadge } from '@/lib/hooks/use-clear-nav-badge';
import { useNotificationCounts, refreshNotificationCounts } from '@/lib/hooks/use-notification-counts';

jest.mock('@/lib/api/notifications', () => ({
  apiAdminListNotifications: jest.fn(),
  apiAdminMarkAllNotificationsRead: jest.fn(),
}));

import { apiAdminListNotifications, apiAdminMarkAllNotificationsRead } from '@/lib/api/notifications';

const mockList = apiAdminListNotifications as jest.Mock;
const mockMarkAllRead = apiAdminMarkAllNotificationsRead as jest.Mock;

function respond(unreadCount: number, categoryCounts: Record<string, number>) {
  mockList.mockResolvedValue({ data: [], total: 0, unreadCount, categoryCounts });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMarkAllRead.mockResolvedValue({ count: 0 });
});

afterEach(() => {
  // Unmounts every renderHook tree from this test, which drops the
  // singleton's listener count to 0 and stops its poll timer — the reset
  // the next test needs, since use-notification-counts.ts is a real
  // module-scoped singleton (see its own file comment) that this suite does
  // not otherwise get to reset between tests.
  cleanup();
});

describe('useClearNavBadge', () => {
  it('on mount marks its category read and calls refreshNotificationCounts exactly once', async () => {
    respond(3, { SUPPORT: 3 });
    // A persistent subscriber starts the singleton's poll and absorbs its
    // one bootstrap fetch, so the fetch counted below can only be the one
    // useClearNavBadge triggers itself via refreshNotificationCounts().
    const seed = renderHook(() => useNotificationCounts());
    await waitFor(() => expect(seed.result.current.byCategory).toEqual({ SUPPORT: 3 }));
    jest.clearAllMocks();
    mockMarkAllRead.mockResolvedValue({ count: 0 });
    respond(0, {});

    renderHook(() => useClearNavBadge('SUPPORT'));

    await waitFor(() => expect(mockMarkAllRead).toHaveBeenCalledWith(['SUPPORT']));
    expect(mockMarkAllRead).toHaveBeenCalledTimes(1);
    // The only apiAdminListNotifications call left possible is the one
    // refreshNotificationCounts() makes after the PATCH settles.
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(1));
  });

  it(
    'zeroes only its own category — clearing ORDER leaves an unrelated REFUND ' +
      'count untouched, and the bell drops by the cleared share, not to zero',
    async () => {
      // REFUND stands in for the brief's illustrative "REVIEWS" example:
      // REVIEWS is not a real NotificationCategory (no backend category, no
      // HREF_CATEGORIES entry — see the task report), so this exercises the
      // same cross-category isolation with a category that actually exists.
      respond(5, { ORDER: 2, REFUND: 3 });
      const { result } = renderHook(() => useNotificationCounts());
      await waitFor(() => expect(result.current.byCategory).toEqual({ ORDER: 2, REFUND: 3 }));

      renderHook(() => useClearNavBadge('ORDER'));

      await waitFor(() => expect(result.current.byCategory.ORDER).toBe(0));
      // The category this screen does not own must survive untouched.
      expect(result.current.byCategory.REFUND).toBe(3);
      // The bell total drops by ORDER's 2, not to 0.
      expect(result.current.unreadCount).toBe(3);
    },
  );

  it('does not double-PATCH across a re-render or on unmount', async () => {
    respond(1, { ORDER: 1 });

    const { rerender, unmount } = renderHook(({ cat }: { cat: 'ORDER' }) => useClearNavBadge(cat), {
      initialProps: { cat: 'ORDER' },
    });

    await waitFor(() => expect(mockMarkAllRead).toHaveBeenCalledTimes(1));

    // Re-render with the same category — must not re-fire the PATCH.
    rerender({ cat: 'ORDER' });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockMarkAllRead).toHaveBeenCalledTimes(1);

    unmount();
    await new Promise((r) => setTimeout(r, 0));
    expect(mockMarkAllRead).toHaveBeenCalledTimes(1);
  });

  it('is a no-op for an empty category list (e.g. a screen with no backing category yet)', async () => {
    respond(0, {});

    renderHook(() => useClearNavBadge([]));
    await new Promise((r) => setTimeout(r, 0));

    expect(mockMarkAllRead).not.toHaveBeenCalled();
  });

  it('re-clears when the category goes from 0 back above 0 while still mounted', async () => {
    respond(0, { SUPPORT: 0 });

    renderHook(() => useClearNavBadge('SUPPORT'));
    await waitFor(() => expect(mockMarkAllRead).toHaveBeenCalledTimes(1));
    jest.clearAllMocks();
    mockMarkAllRead.mockResolvedValue({ count: 0 });

    // A new SUPPORT notification arrives via the shared poll while the
    // screen is still open — the owner is looking straight at it.
    respond(1, { SUPPORT: 1 });
    refreshNotificationCounts();

    await waitFor(() => expect(mockMarkAllRead).toHaveBeenCalledWith(['SUPPORT']));
  });
});

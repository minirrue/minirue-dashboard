'use client';

import {
  setUnreadCountOptimistic,
  useNotificationCounts,
} from './use-notification-counts';

/**
 * The unread count behind the bell.
 *
 * Now a thin view over the shared notification-counts poll (see
 * use-notification-counts.ts) rather than its own fetch. Three things read
 * unread numbers — the sidebar bell, the mobile topbar bell, and every nav tab
 * — and each owning its own request meant three calls on mount and three
 * answers free to drift apart. It also only ever fetched once on mount, so the
 * bell went stale the moment anything arrived while the tab sat open; the
 * shared poll refreshes it and re-checks on focus.
 *
 * The `[count, setCount]` signature is unchanged so NotificationDrawer keeps
 * working as-is: setting the count publishes it immediately and triggers a
 * refresh, which also corrects the per-tab numbers the drawer cannot know.
 */
export function useUnreadNotificationCount(): [number, (n: number) => void] {
  const { unreadCount } = useNotificationCounts();
  return [unreadCount, setUnreadCountOptimistic];
}

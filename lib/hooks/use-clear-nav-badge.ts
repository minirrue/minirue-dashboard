'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { apiAdminMarkAllNotificationsRead, type NotificationCategory } from '@/lib/api/notifications';
import {
  clearCategoriesOptimistic,
  refreshNotificationCounts,
  useNotificationCounts,
} from './use-notification-counts';

/**
 * Clears a dashboard section's own nav badge the moment the section is on
 * screen, instead of leaving it lit for up to a minute until the shared
 * 60s poll (see use-notification-counts.ts) catches up.
 *
 * Scoped to exactly the category (or categories) passed in — nothing else.
 * That is the one rule this hook exists to enforce: opening Orders must
 * never clear Reviews' badge, or the owner stops trusting badges at all.
 * Pass the categories a screen owns straight from `HREF_CATEGORIES` in
 * lib/notifications/nav-counts.ts rather than listing them again here.
 *
 * On mount, and again any time this category's unread count goes from zero
 * back above zero while the screen stays mounted (a new notification of
 * that category arriving via the shared poll while the owner is already
 * looking at it), it:
 *   1. Marks that category's rows read via `PATCH /admin/notifications/
 *      read-all?category=...` (backend-scoped, see
 *      apps/minirue-backend/src/notifications/admin-notifications.controller.ts).
 *   2. Zeroes the category locally right away via `clearCategoriesOptimistic`,
 *      so the badge is gone before the round trip finishes.
 *   3. Calls `refreshNotificationCounts()` once the PATCH settles, to
 *      reconcile the optimistic guess against the real numbers.
 *
 * Does not touch the 60s poll — that stays as the backstop for notifications
 * that arrive while no section is mounted to catch them.
 */
export function useClearNavBadge(
  categories: NotificationCategory | readonly NotificationCategory[],
): void {
  // Stable across renders by content, not by reference: a caller may pass a
  // fresh array literal (e.g. `HREF_CATEGORIES[href] ?? []`) every render,
  // and comparing by reference would re-fire the mount effect on every
  // render, PATCHing the backend repeatedly for the same visit.
  const key = Array.isArray(categories) ? categories.join(',') : categories;
  const list = useMemo<readonly NotificationCategory[]>(
    () => (Array.isArray(categories) ? categories : [categories]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  const { byCategory } = useNotificationCounts();
  const prevTotalRef = useRef<number | null>(null);
  // True from the moment a clear starts until its PATCH + reconciling
  // refresh both settle. Guards against a stale response that was already
  // in flight before this clear started (e.g. the shared singleton's own
  // bootstrap fetch, racing the PATCH) landing afterwards and being
  // misread as a brand new arrival, which would fire a second, redundant
  // PATCH for rows the first call already marked read.
  const clearingRef = useRef(false);

  const clear = useCallback(() => {
    if (list.length === 0) return;
    clearingRef.current = true;
    clearCategoriesOptimistic(list);
    void apiAdminMarkAllNotificationsRead(list as NotificationCategory[])
      .catch(() => {
        // The optimistic zero above already cleared the badge; the refresh
        // below reconciles it against whatever the server actually has, so a
        // failed PATCH here degrades to "corrected on the next poll" rather
        // than crashing the section that owns this hook.
      })
      .finally(() => {
        refreshNotificationCounts();
        clearingRef.current = false;
      });
  }, [list]);

  // Mount (and re-mount, e.g. navigating away and back): clear once.
  useEffect(() => {
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  // While mounted: re-clear only on a genuine 0 -> positive transition, so a
  // render that leaves the count unchanged or drops it to 0 never re-PATCHes.
  useEffect(() => {
    const total = list.reduce((sum, category) => sum + (byCategory[category] ?? 0), 0);
    if (clearingRef.current) {
      // Our own clear is still settling — do not treat this snapshot as a
      // baseline to compare future ones against.
      return;
    }
    const prev = prevTotalRef.current;
    prevTotalRef.current = total;
    if (prev === 0 && total > 0) clear();
  }, [byCategory, list, clear]);
}

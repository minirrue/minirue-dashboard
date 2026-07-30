'use client';

import { useEffect, useState } from 'react';
import { apiAdminListNotifications } from '@/lib/api/notifications';

export interface NotificationCounts {
  /** Unread across the whole feed — what the bell badge shows. */
  unreadCount: number;
  /** Unread per category, e.g. { SUPPORT: 3, ORDER: 1 } — what the nav shows. */
  byCategory: Record<string, number>;
  /** False until the first response lands, so nothing renders a confident 0. */
  loaded: boolean;
}

/**
 * One request feeds every unread number in the dashboard.
 *
 * The bell and each nav tab all read from the same `/admin/notifications`
 * response: `unreadCount` for the bell, `categoryCounts` for the tabs. Both are
 * computed server-side over the whole feed and are independent of whatever
 * filter the notifications page happens to have on, so they cannot disagree.
 *
 * Module-scoped for the same reason as the server-health poll: the bell exists
 * in two places and every nav item wants a number, and a hook-local fetch would
 * fire one request per consumer and let them drift out of step with each other.
 *
 * `limit: 1` because none of this needs the rows — only the counts that come
 * alongside them.
 */
const POLL_MS = 60_000;

const listeners = new Set<(c: NotificationCounts) => void>();
let snapshot: NotificationCounts = { unreadCount: 0, byCategory: {}, loaded: false };
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

function publish(next: NotificationCounts): void {
  snapshot = next;
  for (const listener of listeners) listener(snapshot);
}

async function load(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const res = await apiAdminListNotifications({ limit: 1 });
    publish({
      unreadCount: res.unreadCount ?? 0,
      byCategory: res.categoryCounts ?? {},
      loaded: true,
    });
  } catch {
    // Keep the last known counts rather than blanking them: a flaky request is
    // not evidence that everything has been read. Only the very first failure
    // leaves this at zero, which is also when showing nothing is correct.
  } finally {
    inFlight = false;
  }
}

const onFocus = () => void load();

function startPolling(): void {
  if (timer) return;
  timer = setInterval(() => void load(), POLL_MS);
  window.addEventListener('focus', onFocus);
  void load();
}

function stopPolling(): void {
  if (listeners.size > 0 || !timer) return;
  clearInterval(timer);
  timer = null;
  window.removeEventListener('focus', onFocus);
}

/** Re-read the counts now — call after marking something read. */
export function refreshNotificationCounts(): void {
  void load();
}

/**
 * Publish a known-better unread total immediately, then reconcile.
 *
 * The drawer knows the new total the moment it marks things read, but not how
 * that splits per category. Showing the total at once keeps the bell honest
 * without waiting for a round trip; the refresh then corrects the per-tab
 * numbers a moment later.
 */
export function setUnreadCountOptimistic(unreadCount: number): void {
  publish({ ...snapshot, unreadCount, loaded: true });
  void load();
}

/**
 * Zero the given categories immediately, subtracting only their share from
 * the bell total — used by `useClearNavBadge` so a section's badge goes out
 * the instant it is opened, without waiting on the mark-read round trip.
 *
 * Deliberately does NOT touch any category not listed: clearing Orders must
 * never zero Reviews. Does not itself trigger a refetch — the caller marks
 * the rows read server-side and calls `refreshNotificationCounts()` once
 * that settles, which reconciles this guess against the real numbers.
 */
export function clearCategoriesOptimistic(categories: readonly string[]): void {
  if (categories.length === 0) return;
  let subtract = 0;
  const nextByCategory = { ...snapshot.byCategory };
  for (const category of categories) {
    subtract += nextByCategory[category] ?? 0;
    nextByCategory[category] = 0;
  }
  if (subtract === 0) return;
  publish({
    ...snapshot,
    byCategory: nextByCategory,
    unreadCount: Math.max(0, snapshot.unreadCount - subtract),
    loaded: true,
  });
}

/** Subscribe to the shared notification counts. */
export function useNotificationCounts(): NotificationCounts {
  const [counts, setCounts] = useState<NotificationCounts>(snapshot);

  useEffect(() => {
    listeners.add(setCounts);
    startPolling();
    return () => {
      listeners.delete(setCounts);
      stopPolling();
    };
  }, []);

  return counts;
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  apiAdminListNotifications,
  apiAdminMarkAllNotificationsRead,
  apiAdminMarkNotificationRead,
  apiAdminMarkNotificationUnread,
  type AdminNotification,
  type NotificationCategory,
  type NotificationSeverity,
  type NotificationSort,
} from '@/lib/api/notifications';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import {
  refreshNotificationCounts,
  setUnreadCountOptimistic,
} from '@/lib/hooks/use-notification-counts';

export interface NotificationFilterState {
  q: string;
  categories: NotificationCategory[];
  severities: NotificationSeverity[];
  unreadOnly: boolean;
  sort: NotificationSort;
}

export const DEFAULT_FILTERS: NotificationFilterState = {
  q: '',
  categories: [],
  severities: [],
  unreadOnly: false,
  sort: 'newest',
};

export function useAdminNotifications({
  enabled = true,
  limit = 50,
}: { enabled?: boolean; limit?: number } = {}) {
  const [filters, setFilters] = useState<NotificationFilterState>(DEFAULT_FILTERS);
  const [debouncedQ, setDebouncedQ] = useState('');
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 300);
    return () => clearTimeout(t);
  }, [filters.q]);

  const fetchPage = useCallback(
    async (isRefresh: boolean) => {
      if (!enabled) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await apiAdminListNotifications({
          q: debouncedQ || undefined,
          categories: filters.categories.length ? filters.categories : undefined,
          severities: filters.severities.length ? filters.severities : undefined,
          isRead: filters.unreadOnly ? false : undefined,
          sort: filters.sort,
          limit,
        });
        // Guarded the same way every other tab in this dashboard is: a
        // response missing `data` used to blank the whole panel.
        setItems(Array.isArray(res?.data) ? res.data : []);
        setTotal(res?.total ?? 0);
        setUnreadCount(res?.unreadCount ?? 0);
        setCategoryCounts(res?.categoryCounts ?? {});
      } catch (e) {
        setError((e as ApiError).message ?? 'Could not load notifications');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [enabled, debouncedQ, filters.categories, filters.severities, filters.unreadOnly, filters.sort, limit],
  );

  useMountedEffect(() => { void fetchPage(false); }, [fetchPage]);

  /** Explicit "go and re-read the database" — the requested refresh button. */
  const refresh = useCallback(() => fetchPage(true), [fetchPage]);

  const markRead = useCallback(async (id: number) => {
    // The target row's prior state is read from `items` BEFORE calling
    // setItems, not from inside its updater function — a setState updater
    // is queued and run by React during its own render pass, not invoked
    // synchronously at the call site, so anything assigned inside one is not
    // yet readable on the very next line.
    const target = items.find((n) => n.id === id);
    // Optimistic: the row greys out immediately, and a failure just refetches.
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    if (target && !target.isRead) {
      const next = Math.max(0, unreadCount - 1);
      setUnreadCount(next);
      // This hook's OWN categoryCounts feeds the drawer/full centre's filter
      // chips directly — those are a separate fetch from the shared
      // singleton (use-notification-counts.ts) and were never updated on a
      // single mark-read/unread, only on a full re-fetch. That is why a chip
      // kept showing a stale count even after the row greyed out.
      const category = target.category;
      setCategoryCounts((prev) => ({
        ...prev,
        [category]: Math.max(0, (prev[category] ?? 0) - 1),
      }));
      // Every consumer of this hook (the drawer, the full notification centre)
      // shares one bell and one set of nav badges — pushing the same number
      // into the singleton here, once, is what keeps them in step without
      // repeating this at each call site.
      setUnreadCountOptimistic(next);
    }
    try {
      await apiAdminMarkNotificationRead(id);
      // Refresh only AFTER the PATCH has actually settled. Firing this
      // before awaiting the mutation (the previous order) raced the write:
      // the GET this triggers could return before the PATCH committed,
      // reloading the OLD (still-unread) server counts on top of the correct
      // optimistic guess — which is exactly why a freshly-read notification
      // kept reappearing on the bell, the sidebar and the chip.
      refreshNotificationCounts();
    } catch {
      void fetchPage(true);
    }
  }, [fetchPage, items, unreadCount]);

  const markUnread = useCallback(async (id: number) => {
    const target = items.find((n) => n.id === id);
    // Optimistic: the row lights back up immediately; a failure just refetches.
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)));
    if (target && target.isRead) {
      const next = unreadCount + 1;
      setUnreadCount(next);
      const category = target.category;
      setCategoryCounts((prev) => ({
        ...prev,
        [category]: (prev[category] ?? 0) + 1,
      }));
      setUnreadCountOptimistic(next);
    }
    try {
      await apiAdminMarkNotificationUnread(id);
      // See markRead above: only refresh once the PATCH has settled.
      refreshNotificationCounts();
    } catch {
      void fetchPage(true);
    }
  }, [fetchPage, items, unreadCount]);

  /** Toggle from whatever the current state is — powers the per-row button. */
  const toggleRead = useCallback(
    (id: number, isRead: boolean) => (isRead ? markUnread(id) : markRead(id)),
    [markRead, markUnread],
  );

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    // Every category this hook knows about goes to 0 too — the same chip
    // staleness bug as markRead/markUnread, just for the whole feed at once.
    setCategoryCounts((prev) => {
      const zeroed: Record<string, number> = {};
      for (const key of Object.keys(prev)) zeroed[key] = 0;
      return zeroed;
    });
    setUnreadCountOptimistic(0);
    try {
      await apiAdminMarkAllNotificationsRead();
      // See markRead above: only refresh once the PATCH has settled.
      refreshNotificationCounts();
    } catch {
      void fetchPage(true);
    }
  }, [fetchPage]);

  return {
    items, total, unreadCount, categoryCounts,
    loading, refreshing, error,
    filters, setFilters,
    refresh, markRead, markUnread, toggleRead, markAllRead,
  };
}

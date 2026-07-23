'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  apiAdminListNotifications,
  apiAdminMarkAllNotificationsRead,
  apiAdminMarkNotificationRead,
  type AdminNotification,
  type NotificationCategory,
  type NotificationSeverity,
  type NotificationSort,
} from '@/lib/api/notifications';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

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
    // Optimistic: the row greys out immediately, and a failure just refetches.
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await apiAdminMarkNotificationRead(id);
    } catch {
      void fetchPage(true);
    }
  }, [fetchPage]);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await apiAdminMarkAllNotificationsRead();
    } catch {
      void fetchPage(true);
    }
  }, [fetchPage]);

  return {
    items, total, unreadCount, categoryCounts,
    loading, refreshing, error,
    filters, setFilters,
    refresh, markRead, markAllRead,
  };
}

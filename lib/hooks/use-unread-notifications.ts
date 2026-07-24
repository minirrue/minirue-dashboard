'use client';

import { useEffect, useState } from 'react';
import { apiAdminListNotifications } from '@/lib/api/notifications';

/**
 * The real unread-notification count behind the bell dot.
 *
 * The dot used to be hardcoded on (topbar) or only updated once the drawer was
 * opened (sidebar), so it read as stale — lit with nothing new behind it. This
 * fetches the true count on mount, so the dot reflects reality before the
 * drawer is ever opened, and returns a setter so the drawer keeps it fresh
 * after marking things read. Any failure yields 0 — a flaky request never
 * leaves a stale dot lit.
 *
 * Returns `[count, setCount]`.
 */
export function useUnreadNotificationCount(): [number, (n: number) => void] {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiAdminListNotifications({ limit: 1 })
      .then((res) => {
        if (!cancelled) setCount(res.unreadCount ?? 0);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return [count, setCount];
}

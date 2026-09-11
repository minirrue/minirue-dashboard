'use client';

import { useEffect } from 'react';
import type { AdminNotification } from '@/lib/api/notifications';

/**
 * Reading the thing is dismissing its notification.
 *
 * Opening a support conversation in the inbox — or any screen that puts one
 * entity fully on screen — should clear the notification that pointed at it,
 * rather than leaving the admin to dismiss the same message a second time in
 * the notification centre. `SupportInboxClient` has described this behaviour in
 * a comment since it was written and never implemented it (#15): `items` and
 * `markRead` came back from `useAdminNotifications` and were dropped.
 *
 * Matching is on `entityType` + `entityId`, which is what the server sets per
 * template (`notification-templates.ts` — support messages carry
 * `entityType: 'support'` and the conversation id). `link` is display and
 * `data` is free-form, so neither is the key.
 *
 * `markRead` is optimistic in `useAdminNotifications`, so the `isRead` guard is
 * what keeps this from re-marking rows as `items` changes identity underneath
 * it. Nothing else marks them, so a row that fails to save is simply retried on
 * the next list refresh — which is the behaviour worth having.
 *
 * @param entityType  the server's entity type, e.g. `'support'`
 * @param entityId    the entity on screen, or null when nothing is open
 */
export function useAutoDismissNotifications(
  entityType: string,
  entityId: string | null,
  items: AdminNotification[],
  markRead: (id: number) => void | Promise<unknown>,
): void {
  useEffect(() => {
    if (!entityId) return;
    for (const n of items) {
      if (!n.isRead && n.entityType === entityType && n.entityId === entityId) {
        void markRead(n.id);
      }
    }
  }, [entityType, entityId, items, markRead]);
}

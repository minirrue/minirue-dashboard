import type { NotificationCategory } from '@/lib/api/notifications';

/**
 * Which notification categories each nav destination is responsible for.
 *
 * Keyed by href rather than by category because the mapping is many-to-one and
 * not the same for every audience: an order and its payment are both read on
 * the Orders screen, and a collaborator's Orders screen lives at a different
 * path from an admin's.
 *
 * SYSTEM is deliberately absent. It has no screen of its own — the whole feed
 * is its screen — so it is carried by the bell and would otherwise have to be
 * pinned to an arbitrary tab.
 *
 * /notifications is also deliberately absent: it lists everything, and the bell
 * sitting directly above it in the sidebar already shows that total. Badging it
 * too would put two different numbers for the same thing side by side.
 */
export const HREF_CATEGORIES: Record<string, readonly NotificationCategory[]> = {
  // Admin
  '/orders': ['ORDER', 'PAYMENT'],
  '/customers': ['CUSTOMER'],
  '/support': ['SUPPORT'],
  '/fulfillment': ['FULFILLMENT'],
  '/refunds': ['REFUND'],
  '/inventory': ['INVENTORY'],
  '/collaborators': ['COLLAB'],
  // Collaborator portal — same categories, different screens.
  '/collab/orders': ['ORDER', 'PAYMENT'],
  '/collab/support': ['SUPPORT'],
};

/**
 * Unread notifications a given nav item should show, summed across every
 * category it owns. Unmapped destinations return 0 and render no badge.
 */
export function navUnreadCount(
  href: string,
  byCategory: Record<string, number>,
): number {
  const categories = HREF_CATEGORIES[href];
  if (!categories) return 0;
  let total = 0;
  for (const category of categories) total += byCategory[category] ?? 0;
  return total;
}

/** Badge text: counts past 99 stop being a number worth reading precisely. */
export function formatNavCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

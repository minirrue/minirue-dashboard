import { apiFetch } from './client';

// Mirrors the backend's list in
// src/notifications/interfaces/notification.interfaces.ts. SUPPORT is split out
// of CUSTOMER so the sidebar can count chat messages against the Support tab
// and account events against Customers, instead of showing both the same
// combined number.
export const NOTIFICATION_CATEGORIES = [
  'ORDER', 'PAYMENT', 'FULFILLMENT', 'REFUND',
  'INVENTORY', 'CUSTOMER', 'SUPPORT', 'COLLAB', 'SYSTEM',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_SEVERITIES = ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'] as const;
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

export type NotificationSort = 'newest' | 'oldest' | 'unread_first';

export interface AdminNotification {
  id: number;
  /** Stable machine key, e.g. 'customer.support'. */
  type: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  actorName: string | null;
  link: string | null;
  isRead: boolean;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminNotificationListResult {
  data: AdminNotification[];
  total: number;
  unreadCount: number;
  categoryCounts: Record<string, number>;
}

export interface AdminNotificationParams {
  q?: string;
  categories?: NotificationCategory[];
  severities?: NotificationSeverity[];
  isRead?: boolean;
  sort?: NotificationSort;
  page?: number;
  limit?: number;
}

export async function apiAdminListNotifications(
  params: AdminNotificationParams = {},
): Promise<AdminNotificationListResult> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.categories?.length) qs.set('category', params.categories.join(','));
  if (params.severities?.length) qs.set('severity', params.severities.join(','));
  if (params.isRead !== undefined) qs.set('isRead', String(params.isRead));
  if (params.sort) qs.set('sort', params.sort);
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`/admin/notifications${query}`, { auth: true });
}

export async function apiAdminMarkNotificationRead(id: number): Promise<AdminNotification> {
  return apiFetch(`/admin/notifications/${id}/read`, { method: 'PATCH', auth: true });
}

export async function apiAdminMarkNotificationUnread(id: number): Promise<AdminNotification> {
  return apiFetch(`/admin/notifications/${id}/unread`, { method: 'PATCH', auth: true });
}

/**
 * Omit `categories` to mark the whole feed read (the full notification
 * centre's "Mark all read"). Pass categories to scope the write to just
 * those — how a dashboard section clears its own badge without touching
 * any other section's unread rows.
 */
export async function apiAdminMarkAllNotificationsRead(
  categories?: NotificationCategory[],
): Promise<{ count: number }> {
  const qs = new URLSearchParams();
  if (categories?.length) qs.set('category', categories.join(','));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`/admin/notifications/read-all${query}`, { method: 'PATCH', auth: true });
}

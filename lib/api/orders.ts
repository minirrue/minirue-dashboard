import { apiFetch } from './client';
// Canonical Order contract now lives in @minirue/contracts
// (packages/contracts/src/orders.ts) — was byte-for-byte identical between
// frontend and dashboard already, just declared twice.
import type {
  OrderStatus,
  ProductSnapshot,
  OrderItem,
  OrderStatusHistoryEntry,
  ShippingAddressSnapshot,
  Order,
} from '@minirue/contracts';
export type {
  OrderStatus,
  ProductSnapshot,
  OrderItem,
  OrderStatusHistoryEntry,
  ShippingAddressSnapshot,
  Order,
};

export interface OrdersListResponse {
  data: Order[];
  total: number;
  page: number;
  limit: number;
}

export async function apiAdminListOrders(params?: {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  userId?: string;
}): Promise<OrdersListResponse> {
  const qs = new URLSearchParams();
  if (params?.page != null) qs.set('page', String(params.page));
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.status) qs.set('status', params.status);
  if (params?.userId) qs.set('userId', params.userId);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<OrdersListResponse>(`/orders/admin${query}`, { auth: true });
}

export async function apiAdminGetOrder(id: string): Promise<Order> {
  return apiFetch<Order>(`/orders/admin/${id}`, { auth: true });
}

export async function apiAdminTransitionStatus(
  id: string,
  status: OrderStatus,
  reason?: string,
): Promise<Order> {
  return apiFetch<Order>(`/orders/admin/${id}/status`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ status, reason }),
  });
}

export async function apiAdminCancelOrder(id: string, reason?: string): Promise<Order> {
  return apiFetch<Order>(`/orders/admin/${id}/status`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ status: 'CANCELLED', reason }),
  });
}

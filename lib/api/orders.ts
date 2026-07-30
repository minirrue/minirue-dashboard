import { apiFetch } from './client';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  /** Set when a refund is paid out (backend 0.40.0 / migration 0031). */
  | 'REFUNDED';

export type OrderChannel = 'ONLINE' | 'MANUAL';

export type FulfillmentMethod = 'MANUAL' | 'SHIPPING_SERVICE';
export type OrderFulfillmentStatus = 'UNFULFILLED' | 'FULFILLED';

export interface GuestContact {
  fullName: string;
  phone: string;
  email?: string;
}

export interface ProductSnapshot {
  name: string;
  brand: string;
  sizeMl: number;
  bottleType: string;
  sku: string;
  /** Product cover, resolved per line by the API (backend 0.38.0). */
  imageUrl?: string | null;
}

export interface OrderItem {
  id: string;
  variantId: string;
  productSnapshot: ProductSnapshot;
  qty: number;
  unitPriceAmount: string;
  unitPriceCurrency: string;
  lineTotalAmount: string;
}

export interface OrderStatusHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorUserId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface ShippingAddressSnapshot {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  governorate: string;
  postalCode?: string;
  phone: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  orderSeq: number;
  userId: string | null;
  channel: OrderChannel;
  guestContact: GuestContact | null;
  status: OrderStatus;
  subtotalAmount: string;
  subtotalCurrency: string;
  shippingAmount: string;
  totalAmount: string;
  totalCurrency: string;
  shippingAddressSnapshot: ShippingAddressSnapshot;
  notes: string | null;
  fulfillmentMethod: FulfillmentMethod | null;
  fulfillmentStatus: OrderFulfillmentStatus;
  fulfilledAt: string | null;
  /** Task 8 (backend): set once the order's single refund ticket exists. */
  refundedAt: string | null;
  refundedAmountCents: number;
  /**
   * Server-derived from payment_attempts (backend orders-payment-state.ts) —
   * only present on admin order reads (list + detail). True once a settled
   * payment attempt exists for the order, including one that has since been
   * refunded (the money did arrive). Never re-derive this on the client —
   * the refund gate lives on the server; this field is a courtesy so the
   * Refund button can reflect it without a second request.
   */
  paid?: boolean;
  /** Most recent payment attempt's method, or null with no attempts yet. */
  paymentMethod?: 'COD' | 'INSTAPAY' | 'GATEWAY' | 'MANUAL' | null;
  items: OrderItem[];
  statusHistory?: OrderStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

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
  channel?: OrderChannel;
  q?: string;
}): Promise<OrdersListResponse> {
  const qs = new URLSearchParams();
  if (params?.page != null) qs.set('page', String(params.page));
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.status) qs.set('status', params.status);
  if (params?.userId) qs.set('userId', params.userId);
  if (params?.channel) qs.set('channel', params.channel);
  if (params?.q) qs.set('q', params.q);
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

export interface ManualOrderItemInput {
  variantId: string;
  qty: number;
  /** Minor units (piastres). Omit to charge the variant's list price. */
  unitPriceOverrideMinor?: number;
}

export interface ManualOrderInput {
  guest: GuestContact;
  items: ManualOrderItemInput[];
  paymentMethod: 'INSTAPAY' | 'MANUAL' | 'COD';
  markPaid: boolean;
  instapayReference?: string;
  payerName?: string;
  transferredAt?: string;
  receiptDataUrl?: string;
  shippingAmountMinor?: number;
  notes?: string;
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    governorate: string;
    postalCode?: string;
  };
}

export async function apiAdminCreateManualOrder(
  input: ManualOrderInput,
): Promise<Order> {
  return apiFetch<Order>('/orders/admin/manual', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}

export async function apiAdminSetFulfillmentMethod(
  id: string,
  method: FulfillmentMethod,
): Promise<Order> {
  return apiFetch<Order>(`/orders/admin/${id}/fulfillment`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ method }),
  });
}

export async function apiAdminMarkFulfilled(id: string, note?: string): Promise<Order> {
  return apiFetch<Order>(`/orders/admin/${id}/fulfill`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(note ? { note } : {}),
  });
}

/**
 * Records that a Cash-on-Delivery order's cash was physically collected —
 * the action COD needs so the payment gate on refunds doesn't leave every
 * COD order permanently un-refundable. Idempotent server-side: calling this
 * again on an order that already has it recorded just returns the current
 * state.
 */
export async function apiAdminMarkCashCollected(id: string): Promise<Order> {
  return apiFetch<Order>(`/orders/admin/${id}/cash-collected`, {
    method: 'PATCH',
    auth: true,
  });
}

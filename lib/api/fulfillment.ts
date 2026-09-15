import { apiFetch } from './client';
import type { Order } from './orders';

export type ShipmentStatus =
  | 'CREATED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED_ATTEMPT'
  | 'RETURNED';

export interface TrackingEvent {
  id: string;
  status: ShipmentStatus;
  location: string | null;
  note: string | null;
  occurredAt: string;
}

export interface AdminShipmentRow {
  id: string;
  orderId: string;
  status: ShipmentStatus;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  events: TrackingEvent[];
  createdAt: string;
  updatedAt: string;
}

export async function apiAdminListShipments(params?: {
  page?: number;
  limit?: number;
  status?: ShipmentStatus;
}): Promise<{ data: AdminShipmentRow[]; total: number }> {
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : '';
  return apiFetch(`/fulfillment/shipments${qs}`, { auth: true });
}

export async function apiCreateShipment(data: {
  orderId: string;
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDeliveryAt?: string;
}): Promise<AdminShipmentRow> {
  return apiFetch('/fulfillment/shipments', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(data),
  });
}

export async function apiGetShipment(id: string): Promise<AdminShipmentRow> {
  return apiFetch(`/fulfillment/shipments/${id}`, { auth: true });
}

export async function apiUpdateShipmentStatus(
  id: string,
  status: ShipmentStatus,
  options?: { location?: string; note?: string },
): Promise<AdminShipmentRow> {
  return apiFetch(`/fulfillment/shipments/${id}/status`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ status, ...options }),
  });
}

/**
 * What an order is still eligible to return to stock.
 *
 * `shipped` is read from the stock movement log, not from the order lines — an
 * order placed before the SHIP movement existed (backend migration 0260) shows
 * 0 and cannot be returned into stock it never consumed.
 */
export interface ReturnableLine {
  variantId: string;
  productName: string;
  sku: string;
  ordered: number;
  shipped: number;
  alreadyReturned: number;
  /** shipped − alreadyReturned. The ceiling for this line. */
  returnable: number;
}

export async function getReturnableLines(orderId: string): Promise<ReturnableLine[]> {
  const res = await apiFetch<{ data: ReturnableLine[] }>(
    `/fulfillment/orders/${orderId}/returnable`,
    { auth: true },
  );
  return res?.data ?? [];
}

/**
 * Records what physically came back. This — not the refund — is what moves
 * stock: refunding money says nothing about where the goods are.
 *
 * Returns what was actually credited per line, which can be less than asked
 * for; the server caps each line at shipped-minus-already-returned, so a second
 * confirmation credits nothing.
 */
/**
 * The admin's real Uber fee for a SAME_DAY order (dashboard#84 /
 * backend#186's pinned contract) — `PATCH /v1/fulfillment/orders/:id/same-day-fee`,
 * ADMIN and STAFF. The order must be SAME_DAY and CONFIRMED or PROCESSING;
 * `feeMinor` must be between 0 and `feeRangeMinor.max * 2` (checked server-side
 * against the live setting, not a constant). Returns the updated order —
 * `shipping_amount`/`total_amount` already reflect the fee.
 */
export async function apiSetSameDayFee(orderId: string, feeMinor: number): Promise<Order> {
  return apiFetch<Order>(`/fulfillment/orders/${orderId}/same-day-fee`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ feeMinor }),
  });
}

export async function confirmReturnedToStock(
  orderId: string,
  lines: Array<{ variantId: string; qty: number }>,
): Promise<Array<{ variantId: string; returned: number }>> {
  const res = await apiFetch<{ data: Array<{ variantId: string; returned: number }> }>(
    `/fulfillment/orders/${orderId}/returned-to-stock`,
    { method: 'POST', auth: true, body: JSON.stringify({ lines }) },
  );
  return res?.data ?? [];
}

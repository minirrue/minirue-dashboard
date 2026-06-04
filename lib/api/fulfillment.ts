import { apiFetch } from './client';

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

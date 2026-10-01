import type { OrderStatus } from '@/lib/api/orders';

/** Valid forward transitions (mirrors backend BR-ORD-003). */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  // Terminal, and NOT reachable by hand: REFUNDED is set by paying out a refund,
  // never by picking it from the status menu — the money has to actually move.
  REFUNDED: [],
};

export function formatOrderStatus(status: OrderStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

/**
 * The status label for one order. A booth (Ground) sale is recorded as
 * DELIVERED because it is handed over in person, and loyalty, analytics and
 * refunds rely on that; "Delivered" reads as a courier drop-off, so the label
 * says what happened instead (dashboard#138). Label only: the status is unchanged.
 */
export function formatOrderStatusFor(order: {
  status: OrderStatus;
  salesMode?: 'GROUND' | 'ONLINE' | null;
}): string {
  if (order.salesMode === 'GROUND' && order.status === 'DELIVERED') return 'Collected at booth';
  return formatOrderStatus(order.status);
}

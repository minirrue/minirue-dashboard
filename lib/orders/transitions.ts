import type { OrderStatus } from '@/lib/api/orders';

/** Valid forward transitions (mirrors backend BR-ORD-003). */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function formatOrderStatus(status: OrderStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

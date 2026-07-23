import type { FulfillmentMethod, OrderFulfillmentStatus } from '@/lib/api/orders';

/**
 * The reference a human uses. orderNumber ('MR-20260723-00003') is the formal
 * receipt string; this is what goes on screen and into a search box, and it
 * has to survive orderSeq === 0 (a falsy number that a naive `||` would blank).
 */
export function formatOrderRef(order: { orderSeq: number }): string {
  return `#${order.orderSeq}`;
}

export const FULFILLMENT_LABELS: Record<FulfillmentMethod, string> = {
  MANUAL: 'Manual',
  SHIPPING_SERVICE: 'Shipping service',
};

export const FULFILLMENT_STATUS_LABELS: Record<OrderFulfillmentStatus, string> = {
  UNFULFILLED: 'Unfulfilled',
  FULFILLED: 'Fulfilled',
};

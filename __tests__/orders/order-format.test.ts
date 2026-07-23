import { describe, expect, it } from '@jest/globals';
import { formatOrderRef, FULFILLMENT_LABELS, FULFILLMENT_STATUS_LABELS } from '@/lib/orders/order-format';

describe('formatOrderRef', () => {
  it('renders the sequence with a hash so it reads as an order number', () => {
    expect(formatOrderRef({ orderSeq: 47 })).toBe('#47');
  });

  it('renders the very first order as #0, not as blank', () => {
    expect(formatOrderRef({ orderSeq: 0 })).toBe('#0');
  });
});

describe('fulfillment labels', () => {
  it('gives a plain-English label for every method', () => {
    expect(FULFILLMENT_LABELS.MANUAL).toBe('Manual');
    expect(FULFILLMENT_LABELS.SHIPPING_SERVICE).toBe('Shipping service');
  });

  it('gives a plain-English label for every status', () => {
    expect(FULFILLMENT_STATUS_LABELS.UNFULFILLED).toBe('Unfulfilled');
    expect(FULFILLMENT_STATUS_LABELS.FULFILLED).toBe('Fulfilled');
  });
});

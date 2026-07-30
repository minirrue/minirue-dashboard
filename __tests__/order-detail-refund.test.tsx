import React from 'react';
import { render, screen } from '@testing-library/react';
import OrderDetailClient from '@/app/dashboard/orders/[slug]/OrderDetailClient';
import * as ordersApi from '@/lib/api/orders';
import * as paymentsApi from '@/lib/api/payments';
import type { Order } from '@/lib/api/orders';

jest.mock('@/lib/api/orders');
jest.mock('@/lib/api/payments');

const mockedOrders = ordersApi as jest.Mocked<typeof ordersApi>;
const mockedPayments = paymentsApi as jest.Mocked<typeof paymentsApi>;

function makeOrder(overrides: Partial<Order>): Order {
  return {
    id: 'ord_1',
    orderNumber: 'MR-0001',
    orderSeq: 1,
    userId: null,
    channel: 'ONLINE',
    guestContact: null,
    status: 'DELIVERED',
    subtotalAmount: '450.00',
    subtotalCurrency: 'EGP',
    shippingAmount: '0.00',
    totalAmount: '450.00',
    totalCurrency: 'EGP',
    shippingAddressSnapshot: {
      fullName: 'Test Buyer',
      line1: 'Line 1',
      city: 'Cairo',
      governorate: 'Cairo',
      phone: '0100000000',
    },
    notes: null,
    fulfillmentMethod: null,
    fulfillmentStatus: 'UNFULFILLED',
    fulfilledAt: null,
    refundedAt: null,
    refundedAmountCents: 0,
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('OrderDetailClient refund display', () => {
  const base = makeOrder({});

  beforeEach(() => {
    jest.clearAllMocks();
    // jsdom lacks matchMedia; some shared components probe it.
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })) as unknown as typeof window.matchMedia;
    mockedPayments.apiAdminListOrderPayments.mockResolvedValue([]);
  });

  it('shows Refunded when the order carries a refund, whatever the status says', async () => {
    mockedOrders.apiAdminGetOrder.mockResolvedValue({
      ...base,
      status: 'DELIVERED',
      refundedAt: '2026-07-29T10:00:00Z',
      refundedAmountCents: 45000,
    });

    render(<OrderDetailClient id="ord_1" />);

    expect(await screen.findByText('Refunded')).toBeInTheDocument();
    expect(screen.getByText(/EGP\s?450\.00 refunded/)).toBeInTheDocument();
    // Node's ICU build determines month/day order for 'en-EG' — accept either.
    expect(screen.getByText(/29 Jul 2026|Jul 29, 2026/)).toBeInTheDocument();
  });

  it('still shows Delivered for an order with no refund', async () => {
    mockedOrders.apiAdminGetOrder.mockResolvedValue({
      ...base,
      status: 'DELIVERED',
      refundedAt: null,
    });

    render(<OrderDetailClient id="ord_1" />);

    expect(await screen.findByText('Delivered')).toBeInTheDocument();
  });
});

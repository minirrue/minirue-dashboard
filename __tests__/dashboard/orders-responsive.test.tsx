import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import OrdersClient from '@/app/dashboard/orders/OrdersClient';
import * as ordersApi from '@/lib/api/orders';
import type { Order } from '@/lib/api/orders';

jest.mock('@/lib/api/orders');
const list = ordersApi.apiAdminListOrders as jest.Mock;
const sample = (id: string, status: Order['status'] = 'CONFIRMED'): Order => ({
  id, orderNumber: `GVREC-${id}`, orderSeq: Number(id), userId: null,
  channel: 'ONLINE', guestContact: { fullName: `Customer ${id}`, phone: '01000000000' },
  status, subtotalAmount: '1325.00', subtotalCurrency: 'EGP', shippingAmount: '0.00',
  totalAmount: '1325.00', totalCurrency: 'EGP', shippingAddressSnapshot: { fullName: 'Fallback', line1: 'Street', city: 'Cairo', governorate: 'Cairo', phone: '01000000000' },
  notes: null, fulfillmentMethod: null, fulfillmentStatus: 'UNFULFILLED',
  fulfilledAt: null, refundedAt: null, refundedAmountCents: 0, items: [],
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
});

it('keeps each order status, customer, total, date, View and next action exposed at narrow container widths', async () => {
  list.mockResolvedValue({ data: [sample('1'), sample('2')], total: 2, page: 1, limit: 100 });
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({ matches: false, media: query, addEventListener: jest.fn(), removeEventListener: jest.fn() })) as unknown as typeof window.matchMedia;
  const previous = global.ResizeObserver;
  global.ResizeObserver = class {
    observe() { this.callback([{ contentRect: { width: 540 } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
    unobserve() {}
    disconnect() {}
    constructor(private callback: ResizeObserverCallback) {}
  } as unknown as typeof ResizeObserver;
  try {
    render(<OrdersClient />);
    const row = await screen.findByRole('article', { name: /GVREC-1/ });
    expect(within(row).getByText('Confirmed')).toBeInTheDocument();
    expect(within(row).getByText('Customer 1')).toBeInTheDocument();
    expect(within(row).getByText('EGP 1,325.00')).toBeInTheDocument();
    expect(within(row).getByText('Oct 1, 2026')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'View' })).toHaveAttribute('href', '/orders/1');
    expect(within(row).getByRole('button', { name: /Mark ready/ })).toBeInTheDocument();
    expect(within(row).queryByText('Storefront')).not.toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: /Details/ }));
    expect(within(row).getByText('Storefront')).toBeInTheDocument();
  } finally { global.ResizeObserver = previous; }
});

it('keeps booth collection and online delivery distinct in responsive cards', async () => {
  const booth = { ...sample('3', 'DELIVERED'), channel: 'MANUAL' as const, salesMode: 'GROUND' as const };
  const online = sample('4', 'DELIVERED');
  list.mockResolvedValue({ data: [booth, online], total: 2, page: 1, limit: 100 });
  const previous = global.ResizeObserver;
  global.ResizeObserver = class {
    observe() { this.callback([{ contentRect: { width: 540 } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
    unobserve() {}
    disconnect() {}
    constructor(private callback: ResizeObserverCallback) {}
  } as unknown as typeof ResizeObserver;
  try {
    render(<OrdersClient />);
    const boothCard = await screen.findByRole('article', { name: /GVREC-3/ });
    const onlineCard = screen.getByRole('article', { name: /GVREC-4/ });
    expect(within(boothCard).getByText('Collected at booth')).toBeInTheDocument();
    expect(within(onlineCard).getByText('Delivered')).toBeInTheDocument();
    expect(within(onlineCard).queryByText('Collected at booth')).not.toBeInTheDocument();
  } finally { global.ResizeObserver = previous; }
});

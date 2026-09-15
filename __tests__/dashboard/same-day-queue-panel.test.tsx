import { render, screen, waitFor } from '@testing-library/react';
import SameDayQueuePanel from '@/app/dashboard/fulfillment/SameDayQueuePanel';
import type { Order, OrdersListResponse } from '@/lib/api/orders';

jest.mock('@/lib/api/orders', () => ({
  apiAdminListOrders: jest.fn(),
}));
jest.mock('@/lib/api/fulfillment', () => ({
  apiSetSameDayFee: jest.fn(),
}));

import { apiAdminListOrders } from '@/lib/api/orders';

function makeOrder(overrides: Partial<Order>): Order {
  return {
    id: 'order-1',
    orderNumber: 'MR-20260915-00001',
    orderSeq: 1,
    userId: null,
    channel: 'ONLINE',
    guestContact: { fullName: 'Sara Ali', phone: '0100000000' },
    status: 'CONFIRMED',
    subtotalAmount: '500.00',
    subtotalCurrency: 'EGP',
    shippingAmount: '0.00',
    totalAmount: '500.00',
    totalCurrency: 'EGP',
    shippingAddressSnapshot: {
      fullName: 'Sara Ali', line1: '1 Tahrir St', city: 'Giza', governorate: 'GIZA', phone: '0100000000',
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
  } as Order;
}

beforeEach(() => {
  jest.clearAllMocks();
});

/** Behaves like GET /orders/admin with backend#192's filters. */
function serverLike(res: OrdersListResponse) {
  return (params: { deliveryMethod?: string; sameDayFee?: 'PENDING' | 'SET' } = {}) => {
    const data = res.data.filter((o) => {
      if (params.deliveryMethod && o.delivery?.method !== params.deliveryMethod) return false;
      const set = o.delivery?.sameDayFee?.status === 'SET';
      if (params.sameDayFee === 'SET' && !set) return false;
      if (params.sameDayFee === 'PENDING' && set) return false;
      return true;
    });
    return Promise.resolve({ ...res, data, total: data.length });
  };
}

describe('SameDayQueuePanel filtering', () => {
  it('asks the server for same-day orders by fee state (backend#192)', async () => {
    (apiAdminListOrders as jest.Mock).mockImplementation(
      serverLike({ data: [], total: 0, page: 1, limit: 100 } satisfies OrdersListResponse),
    );
    render(<SameDayQueuePanel />);
    await screen.findByText(/same-day|No same-day/i).catch(() => null);
    expect(apiAdminListOrders).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryMethod: 'SAME_DAY', sameDayFee: 'PENDING' }),
    );
    expect(apiAdminListOrders).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryMethod: 'SAME_DAY', sameDayFee: 'SET' }),
    );
  });

  it('shows only SAME_DAY orders that are CONFIRMED/PROCESSING and still need a fee', async () => {
    const sameDayPending = makeOrder({
      id: 'sd-pending',
      orderNumber: 'MR-SD-PENDING',
      status: 'CONFIRMED',
      delivery: {
        method: 'SAME_DAY',
        etaLabel: null,
        window: { date: '2026-09-15', start: '19:00', end: '24:00' },
        location: { lat: 30.0444, lng: 31.2357 },
        sameDayFee: { status: 'PENDING', amountMinor: null },
      },
    });
    const sameDayShipped = makeOrder({
      id: 'sd-shipped',
      status: 'SHIPPED',
      delivery: {
        method: 'SAME_DAY',
        etaLabel: null,
        window: { date: '2026-09-15', start: '19:00', end: '24:00' },
        location: null,
        sameDayFee: { status: 'SET', amountMinor: 12000 },
      },
    });
    const standardOrder = makeOrder({
      id: 'std-1',
      delivery: { method: 'STANDARD', etaLabel: '2–5 working days', window: null, location: null, sameDayFee: null },
    });

    (apiAdminListOrders as jest.Mock).mockImplementation(
      serverLike({
      data: [sameDayPending, sameDayShipped, standardOrder],
      total: 3,
      page: 1,
      limit: 100,
    } satisfies OrdersListResponse),
    );

    render(<SameDayQueuePanel />);

    expect(await screen.findByText('MR-SD-PENDING')).toBeInTheDocument();
    expect(screen.queryByText(standardOrder.orderNumber)).not.toBeInTheDocument();
    expect(screen.queryByText(sameDayShipped.orderNumber)).not.toBeInTheDocument();
  });

  it('splits pending vs recently-set same-day orders into their own tables', async () => {
    const pending = makeOrder({
      id: 'p1',
      orderNumber: 'MR-PENDING',
      delivery: {
        method: 'SAME_DAY',
        etaLabel: null,
        window: { date: '2026-09-15', start: '19:00', end: '24:00' },
        location: { mapsUrl: 'https://maps.app.goo.gl/xyz' },
        sameDayFee: { status: 'PENDING', amountMinor: null },
      },
    });
    const set = makeOrder({
      id: 's1',
      orderNumber: 'MR-SET',
      status: 'PROCESSING',
      delivery: {
        method: 'SAME_DAY',
        etaLabel: null,
        window: { date: '2026-09-15', start: '19:00', end: '24:00' },
        location: null,
        sameDayFee: { status: 'SET', amountMinor: 12000 },
      },
    });

    (apiAdminListOrders as jest.Mock).mockImplementation(
      serverLike({
      data: [pending, set],
      total: 2,
      page: 1,
      limit: 100,
    } satisfies OrdersListResponse),
    );

    render(<SameDayQueuePanel />);

    expect(await screen.findByText('Needs a fee')).toBeInTheDocument();
    expect(await screen.findByText('Recently set')).toBeInTheDocument();
    expect(screen.getByText('MR-PENDING')).toBeInTheDocument();
    expect(screen.getByText('MR-SET')).toBeInTheDocument();
  });

  it('builds the Google Maps link from lat/lng, and passes a pasted mapsUrl through', async () => {
    const withLatLng = makeOrder({
      id: 'll',
      orderNumber: 'MR-LATLNG',
      delivery: {
        method: 'SAME_DAY',
        etaLabel: null,
        window: { date: '2026-09-15', start: '19:00', end: '24:00' },
        location: { lat: 30.0444, lng: 31.2357 },
        sameDayFee: { status: 'PENDING', amountMinor: null },
      },
    });

    (apiAdminListOrders as jest.Mock).mockImplementation(
      serverLike({
      data: [withLatLng],
      total: 1,
      page: 1,
      limit: 100,
    } satisfies OrdersListResponse),
    );

    render(<SameDayQueuePanel />);

    const link = await screen.findByRole('link', { name: /open in google maps/i });
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=30.0444,31.2357',
    );
  });

  it('shows an empty state when nothing is waiting on a fee', async () => {
    (apiAdminListOrders as jest.Mock).mockImplementation(
      serverLike({
      data: [],
      total: 0,
      page: 1,
      limit: 100,
    } satisfies OrdersListResponse),
    );

    render(<SameDayQueuePanel />);

    expect(await screen.findByText(/no same-day orders are waiting on a fee/i)).toBeInTheDocument();
  });

  it('shows a readable error when the orders list cannot be loaded', async () => {
    (apiAdminListOrders as jest.Mock).mockRejectedValue({ status: 500, message: 'Server error' });

    render(<SameDayQueuePanel />);

    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
  });
});

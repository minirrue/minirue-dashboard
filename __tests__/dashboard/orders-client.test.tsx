import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import OrdersClient from '@/app/dashboard/orders/OrdersClient';
import * as ordersApi from '@/lib/api/orders';
import type { Order } from '@/lib/api/orders';

jest.mock('@/lib/api/orders');

const mockedOrders = ordersApi as jest.Mocked<typeof ordersApi>;

function makeOrder(overrides: Partial<Order>): Order {
  return {
    id: 'ord_1',
    orderNumber: 'MR-0001',
    orderSeq: 1,
    userId: null,
    channel: 'ONLINE',
    guestContact: null,
    status: 'PENDING',
    subtotalAmount: '100.00',
    subtotalCurrency: 'EGP',
    shippingAmount: '0.00',
    totalAmount: '100.00',
    totalCurrency: 'EGP',
    shippingAddressSnapshot: {
      fullName: 'Fallback Name',
      line1: 'Line 1',
      city: 'Cairo',
      governorate: 'Cairo',
      phone: '0100000000',
    },
    notes: null,
    fulfillmentMethod: null,
    fulfillmentStatus: 'UNFULFILLED',
    fulfilledAt: null,
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('OrdersClient channel column and customer fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // DashboardTable does mobile detection via matchMedia, which jsdom doesn't implement.
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
  });

  it('shows "Manual" for a manual order and "Storefront" for an online order, and prefers guest contact name', async () => {
    mockedOrders.apiAdminListOrders.mockResolvedValue({
      data: [
        makeOrder({
          id: 'ord_manual',
          orderNumber: 'MR-0002',
          channel: 'MANUAL',
          guestContact: { fullName: 'Guest Buyer', phone: '0111111111' },
        }),
        makeOrder({
          id: 'ord_online',
          orderNumber: 'MR-0003',
          channel: 'ONLINE',
          guestContact: null,
        }),
      ],
      total: 2,
      page: 1,
      limit: 100,
    });

    render(<OrdersClient />);

    expect(await screen.findByText('Manual')).toBeInTheDocument();
    expect(await screen.findByText('Storefront')).toBeInTheDocument();

    // Guest contact name shown for the manual order.
    expect(await screen.findByText('Guest Buyer')).toBeInTheDocument();
    // Falls back to the shipping address snapshot name when there is no guest contact.
    expect(await screen.findByText('Fallback Name')).toBeInTheDocument();
  });

  it('preserves channel filter when retrying a failed fetch', async () => {
    mockedOrders.apiAdminListOrders
      .mockResolvedValueOnce({
        data: [],
        total: 0,
        page: 1,
        limit: 100,
      })
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        data: [makeOrder({ id: 'ord_retry', orderNumber: 'MR-RETRY' })],
        total: 1,
        page: 1,
        limit: 100,
      });

    render(<OrdersClient />);

    // Wait for initial load to complete
    await screen.findByText('No orders yet.');

    // Select MANUAL channel filter - this triggers a new load that fails
    const channelSelect = screen.getByLabelText('Filter by channel');
    fireEvent.change(channelSelect, { target: { value: 'MANUAL' } });

    // Wait for the error state to appear
    expect(await screen.findByText('Network error')).toBeInTheDocument();

    // Click Retry button
    const retryButton = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retryButton);

    // Wait for the retry to succeed
    expect(await screen.findByText('MR-RETRY')).toBeInTheDocument();

    // Verify that the last call to apiAdminListOrders included channel: 'MANUAL'
    expect(mockedOrders.apiAdminListOrders).toHaveBeenLastCalledWith(
      expect.objectContaining({
        channel: 'MANUAL',
      })
    );
  });
});

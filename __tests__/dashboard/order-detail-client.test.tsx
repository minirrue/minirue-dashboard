import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrderDetailClient from '@/app/dashboard/orders/[slug]/OrderDetailClient';
import * as ordersApi from '@/lib/api/orders';
import * as paymentsApi from '@/lib/api/payments';
import type { Order } from '@/lib/api/orders';
import type { AdminPaymentAttempt } from '@/lib/api/payments';

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
    refundedAt: null,
    refundedAmountCents: 0,
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makePayment(overrides: Partial<AdminPaymentAttempt>): AdminPaymentAttempt {
  return {
    id: 'pay_1',
    orderId: 'ord_1',
    method: 'INSTAPAY',
    status: 'SUCCEEDED',
    amountCents: 10000,
    gatewayReference: null,
    createdAt: new Date().toISOString(),
    gatewayMeta: null,
    failureReason: null,
    receiptUrl: null,
    instapayReference: null,
    payerName: null,
    transferredAt: null,
    ...overrides,
  };
}

describe('OrderDetailClient buyer and payments detail', () => {
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
  });

  it('shows guest contact name and phone for a manual order', async () => {
    mockedOrders.apiAdminGetOrder.mockResolvedValue(
      makeOrder({
        channel: 'MANUAL',
        guestContact: { fullName: 'Guest Buyer', phone: '0111111111' },
      }),
    );
    mockedPayments.apiAdminListOrderPayments.mockResolvedValue([]);

    render(<OrderDetailClient id="ord_1" />);

    expect(await screen.findByText('Guest Buyer')).toBeInTheDocument();
    expect(screen.getByText('0111111111')).toBeInTheDocument();
    expect(screen.getByText('Registered manually from the dashboard')).toBeInTheDocument();
  });

  it('falls back to shippingAddressSnapshot.fullName when guestContact is null', async () => {
    mockedOrders.apiAdminGetOrder.mockResolvedValue(
      makeOrder({ channel: 'ONLINE', guestContact: null }),
    );
    mockedPayments.apiAdminListOrderPayments.mockResolvedValue([]);

    render(<OrderDetailClient id="ord_1" />);

    expect(await screen.findByText('Fallback Name')).toBeInTheDocument();
    expect(screen.getByText('Placed on the storefront')).toBeInTheDocument();
  });

  it('renders the empty-state message when there are no payment attempts', async () => {
    mockedOrders.apiAdminGetOrder.mockResolvedValue(makeOrder({}));
    mockedPayments.apiAdminListOrderPayments.mockResolvedValue([]);

    render(<OrderDetailClient id="ord_1" />);

    expect(await screen.findByText('Payments')).toBeInTheDocument();
    expect(
      await screen.findByText('No payment recorded against this order.'),
    ).toBeInTheDocument();
  });

  it('renders a receipt thumbnail for an attempt with a receiptUrl, and none for one without', async () => {
    mockedOrders.apiAdminGetOrder.mockResolvedValue(makeOrder({}));
    mockedPayments.apiAdminListOrderPayments.mockResolvedValue([
      makePayment({
        id: 'pay_with_receipt',
        receiptUrl: 'https://example.com/receipt.png',
        instapayReference: 'IPY-123',
        payerName: 'John Doe',
        transferredAt: new Date().toISOString(),
      }),
      makePayment({ id: 'pay_no_receipt', receiptUrl: null }),
    ]);

    render(<OrderDetailClient id="ord_1" />);

    const receiptButton = await screen.findByRole('button', { name: 'View Instapay receipt' });
    expect(receiptButton).toBeInTheDocument();

    // Only one receipt button should render (for the attempt that has a receiptUrl).
    expect(screen.getAllByRole('button', { name: 'View Instapay receipt' })).toHaveLength(1);

    expect(screen.getByText('IPY-123')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();

    await userEvent.click(receiptButton);
    expect(await screen.findByRole('dialog', { name: 'Image preview' })).toBeInTheDocument();
  });
});

/*
 * Order emails (backend#135). Guests have no order page, so the dashboard is
 * where the shop follows their orders — and where an admin checks whether the
 * guest was actually told.
 */
describe('OrderDetailClient order emails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it("shows a guest's checkout email and each order email as sent or failed", async () => {
    mockedOrders.apiAdminGetOrder.mockResolvedValue(
      makeOrder({
        guestContact: { fullName: 'Guest Buyer', phone: '0111111111', email: 'guest@example.com' },
      }),
    );
    mockedOrders.apiAdminGetOrderEmails.mockResolvedValue({
      transport: 'SMTP',
      recipient: 'GUEST',
      emails: [
        {
          template: 'order.confirmed',
          status: 'SENT',
          toGuest: true,
          errorText: null,
          sentAt: '2026-09-14T10:00:00.000Z',
          attemptedAt: '2026-09-14T10:00:00.000Z',
          createdAt: '2026-09-14T10:00:00.000Z',
        },
        {
          template: 'order.shipped',
          status: 'FAILED',
          toGuest: true,
          errorText: 'Invalid login: 535-5.7.8 Username and Password not accepted',
          sentAt: null,
          attemptedAt: '2026-09-15T10:00:00.000Z',
          createdAt: '2026-09-15T10:00:00.000Z',
        },
      ],
    });

    render(<OrderDetailClient id="ord_1" />);

    expect(await screen.findByText('guest@example.com')).toBeInTheDocument();
    const section = await screen.findByRole('region', { name: 'Customer emails' });
    expect(section).toHaveTextContent('Order confirmed');
    expect(section).toHaveTextContent('Sent');
    expect(section).toHaveTextContent('Order shipped');
    expect(section).toHaveTextContent('Failed');
    expect(section).toHaveTextContent('Username and Password not accepted');
    expect(section).toHaveTextContent("guest's checkout email");
    expect(mockedOrders.apiAdminGetOrderEmails).toHaveBeenCalledWith('ord_1');
  });

  it('explains an empty list when the server has no mail transport', async () => {
    mockedOrders.apiAdminGetOrder.mockResolvedValue(makeOrder({}));
    mockedOrders.apiAdminGetOrderEmails.mockResolvedValue({
      transport: 'NOT_CONFIGURED',
      recipient: 'NONE',
      emails: [],
    });

    render(<OrderDetailClient id="ord_1" />);

    const section = await screen.findByRole('region', { name: 'Customer emails' });
    expect(section).toHaveTextContent('Email is not configured on the server');
    expect(section).toHaveTextContent('no email address');
  });

  it('still renders the order when the email log cannot be loaded', async () => {
    mockedOrders.apiAdminGetOrder.mockResolvedValue(makeOrder({}));
    mockedOrders.apiAdminGetOrderEmails.mockRejectedValue(new Error('boom'));

    render(<OrderDetailClient id="ord_1" />);

    expect(await screen.findByText('Fallback Name')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Customer emails' })).not.toBeInTheDocument();
  });
});

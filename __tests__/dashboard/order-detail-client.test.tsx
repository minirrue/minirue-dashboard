import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrderDetailClient from '@/app/dashboard/orders/[slug]/OrderDetailClient';
import RefundableOrdersPanel from '@/app/dashboard/refunds/RefundableOrdersPanel';
import * as ordersApi from '@/lib/api/orders';
import * as paymentsApi from '@/lib/api/payments';
import type { Order } from '@/lib/api/orders';
import type { AdminPaymentAttempt } from '@/lib/api/payments';

jest.mock('@/lib/api/orders');
jest.mock('@/lib/api/payments');
jest.mock('@/lib/api/fulfillment', () => ({
  apiSetSameDayFee: jest.fn(),
}));

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

  it('renders one clear empty-payment message when there are no payment attempts', async () => {
    mockedOrders.apiAdminGetOrder.mockResolvedValue(makeOrder({}));
    mockedPayments.apiAdminListOrderPayments.mockResolvedValue([]);

    render(<OrderDetailClient id="ord_1" />);

    expect(await screen.findByText('Payments')).toBeInTheDocument();
    expect(
      await screen.findByText('No captured payment exists to refund yet.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('No payment recorded against this order.')).not.toBeInTheDocument();
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

  it('marks delivered COD cash collected and exposes the refund without a reload', async () => {
    const uncollected = makeOrder({
      status: 'DELIVERED',
      paid: false,
      paymentMethod: 'COD',
    });
    const collected = makeOrder({
      status: 'DELIVERED',
      paid: true,
      paymentMethod: 'COD',
      statusHistory: [{
        id: 'history_cash',
        fromStatus: 'DELIVERED',
        toStatus: 'DELIVERED',
        actorUserId: 'staff_1',
        reason: 'Cash collected on delivery (COD)',
        createdAt: '2026-09-16T12:00:00.000Z',
      }],
    });
    mockedOrders.apiAdminGetOrder.mockResolvedValue(uncollected);
    mockedOrders.apiAdminMarkCashCollected.mockResolvedValue(collected);
    mockedPayments.apiAdminListOrderPayments
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makePayment({ method: 'COD', status: 'SUCCEEDED', createdAt: '2026-09-16T12:00:00.000Z' }),
      ]);

    render(<OrderDetailClient id="ord_1" />);

    const collect = await screen.findByRole('button', { name: 'Mark cash collected' });
    expect(screen.queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument();
    expect(screen.getByText('No captured payment exists to refund yet.')).toBeInTheDocument();

    await userEvent.click(collect);

    expect(mockedOrders.apiAdminMarkCashCollected).toHaveBeenCalledWith('ord_1');
    expect(await screen.findByText('Cash collected. This order can now be refunded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refund' })).toBeInTheDocument();
    expect(screen.getByText('Cash collected on delivery (COD)')).toBeInTheDocument();
    expect(screen.getByText('Succeeded')).toBeInTheDocument();
  });

  it('does not offer cash collection before a COD order is delivered', async () => {
    mockedOrders.apiAdminGetOrder.mockResolvedValue(
      makeOrder({ status: 'SHIPPED', paid: false, paymentMethod: 'COD' }),
    );
    mockedPayments.apiAdminListOrderPayments.mockResolvedValue([]);

    render(<OrderDetailClient id="ord_1" />);

    expect(await screen.findByText(/Cash can be marked collected after delivery/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark cash collected' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refund' })).not.toBeInTheDocument();
  });
});

describe('RefundableOrdersPanel COD collection eligibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('offers cash collection only for delivered COD orders', async () => {
    mockedOrders.apiAdminListOrders.mockResolvedValue({
      data: [
        makeOrder({ id: 'ord_shipped', orderNumber: 'MR-SHIPPED', status: 'SHIPPED', paid: false, paymentMethod: 'COD' }),
        makeOrder({ id: 'ord_delivered', orderNumber: 'MR-DELIVERED', status: 'DELIVERED', paid: false, paymentMethod: 'COD' }),
      ],
      total: 2,
      page: 1,
      limit: 100,
    });

    render(<RefundableOrdersPanel onRefunded={jest.fn()} />);

    expect(await screen.findAllByText('Not paid yet')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Mark cash collected' })).toHaveLength(1);
    expect(screen.getByText('Available after delivery')).toBeInTheDocument();
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

/*
 * Same-day delivery block (dashboard#84 / backend#186): the "Choose
 * method…" fulfilment select is replaced by fee entry for a SAME_DAY order,
 * and a Delivery card shows the method/window/location link.
 */
describe('OrderDetailClient same-day delivery', () => {
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

  it('shows the fulfillment pipeline alongside same-day fee entry', async () => {
    mockedOrders.apiAdminGetOrder.mockResolvedValue(
      makeOrder({
        status: 'CONFIRMED',
        delivery: {
          method: 'SAME_DAY',
          etaLabel: null,
          window: { date: '2026-09-15', start: '19:00', end: '24:00' },
          location: { lat: 30.0444, lng: 31.2357 },
          sameDayFee: { status: 'PENDING', amountMinor: null },
        },
      }),
    );

    render(<OrderDetailClient id="ord_1" />);

    expect(await screen.findByLabelText(/same-day fee/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/fulfillment method/i)).not.toBeInTheDocument();
    const pipeline = screen.getByRole('list', { name: 'Fulfillment progress' });
    expect(pipeline).toHaveTextContent('Confirmed');
    expect(pipeline).toHaveTextContent('Ready to ship');
    expect(pipeline).toHaveTextContent('Out for delivery');
    expect(pipeline).toHaveTextContent('Delivered');
    const link = screen.getByRole('link', { name: /open in google maps/i });
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=30.0444,31.2357',
    );
  });

  it('replaces the ordinary fulfilment select with the status pipeline', async () => {
    mockedOrders.apiAdminGetOrder.mockResolvedValue(
      makeOrder({
        delivery: { method: 'STANDARD', etaLabel: '2–5 working days', window: null, location: null, sameDayFee: null },
      }),
    );

    render(<OrderDetailClient id="ord_1" />);

    expect(await screen.findByRole('list', { name: 'Fulfillment progress' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/fulfillment method/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/same-day fee/i)).not.toBeInTheDocument();
  });

  it('advances one stage at a time through the pipeline action', async () => {
    const confirmed = makeOrder({
      status: 'CONFIRMED',
      delivery: { method: 'STANDARD', etaLabel: '2–5 working days', window: null, location: null, sameDayFee: null },
    });
    const processing = makeOrder({ ...confirmed, status: 'PROCESSING' });
    mockedOrders.apiAdminGetOrder.mockResolvedValue(confirmed);
    mockedOrders.apiAdminTransitionStatus.mockResolvedValue(processing);

    render(<OrderDetailClient id="ord_1" />);

    expect(await screen.findByText('Current')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mark ready to ship' }));

    expect(mockedOrders.apiAdminTransitionStatus).toHaveBeenCalledWith('ord_1', 'PROCESSING');
    expect(await screen.findByRole('button', { name: 'Mark out for delivery' })).toBeInTheDocument();
  });

  it('does not offer a fulfillment transition for cancelled orders', async () => {
    mockedOrders.apiAdminGetOrder.mockResolvedValue(makeOrder({ status: 'CANCELLED' }));

    render(<OrderDetailClient id="ord_1" />);

    expect(await screen.findByText('Fulfillment stopped because this order is cancelled.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark|confirm order/i })).not.toBeInTheDocument();
  });
});

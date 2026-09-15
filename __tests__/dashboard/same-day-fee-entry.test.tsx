import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SameDayFeeEntry from '@/components/dashboard/SameDayFeeEntry';
import type { Order } from '@/lib/api/orders';

jest.mock('@/lib/api/fulfillment', () => ({
  apiSetSameDayFee: jest.fn(),
}));

import { apiSetSameDayFee } from '@/lib/api/fulfillment';

function makeOrder(overrides: Partial<Order> = {}): Order {
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
    delivery: {
      method: 'SAME_DAY',
      etaLabel: null,
      window: { date: '2026-09-15', start: '19:00', end: '24:00' },
      location: { lat: 30.0444, lng: 31.2357 },
      sameDayFee: { status: 'PENDING', amountMinor: null },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Order;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SameDayFeeEntry', () => {
  it('sends feeMinor = EGP × 100 to the same-day-fee endpoint', async () => {
    const updated = makeOrder({
      delivery: {
        method: 'SAME_DAY',
        etaLabel: null,
        window: { date: '2026-09-15', start: '19:00', end: '24:00' },
        location: { lat: 30.0444, lng: 31.2357 },
        sameDayFee: { status: 'SET', amountMinor: 12000 },
      },
      totalAmount: '620.00',
    });
    (apiSetSameDayFee as jest.Mock).mockResolvedValue(updated);
    const onUpdated = jest.fn();

    render(<SameDayFeeEntry order={makeOrder()} onUpdated={onUpdated} />);

    const input = screen.getByLabelText(/same-day fee/i);
    await userEvent.type(input, '120');
    await userEvent.click(screen.getByRole('button', { name: /save fee/i }));

    await waitFor(() => expect(apiSetSameDayFee).toHaveBeenCalledWith('order-1', 12000));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
  });

  it('shows the new total and cash-on-delivery once a fee is set', () => {
    render(
      <SameDayFeeEntry
        order={makeOrder({
          totalAmount: '620.00',
          delivery: {
            method: 'SAME_DAY',
            etaLabel: null,
            window: { date: '2026-09-15', start: '19:00', end: '24:00' },
            location: { lat: 30.0444, lng: 31.2357 },
            sameDayFee: { status: 'SET', amountMinor: 12000 },
          },
        })}
        onUpdated={jest.fn()}
      />,
    );

    expect(screen.getByText(/fee set/i)).toBeInTheDocument();
    expect(screen.getByText(/cash on delivery/i)).toBeInTheDocument();
  });

  it('shows the readable 409/422 error message instead of swallowing it', async () => {
    (apiSetSameDayFee as jest.Mock).mockRejectedValue({
      status: 422,
      message: 'feeMinor: must be at most 32000',
    });
    render(<SameDayFeeEntry order={makeOrder()} onUpdated={jest.fn()} />);

    await userEvent.type(screen.getByLabelText(/same-day fee/i), '999');
    await userEvent.click(screen.getByRole('button', { name: /save fee/i }));

    expect(await screen.findByText(/must be at most 32000/i)).toBeInTheDocument();
  });

  it('does not offer fee entry before the order is confirmed', () => {
    render(
      <SameDayFeeEntry
        order={makeOrder({
          status: 'PENDING',
          delivery: {
            method: 'SAME_DAY',
            etaLabel: null,
            window: { date: '2026-09-15', start: '19:00', end: '24:00' },
            location: null,
            sameDayFee: { status: 'PENDING', amountMinor: null },
          },
        })}
        onUpdated={jest.fn()}
      />,
    );
    expect(screen.queryByLabelText(/same-day fee/i)).not.toBeInTheDocument();
    expect(screen.getByText(/opens once the order is confirmed/i)).toBeInTheDocument();
  });
});

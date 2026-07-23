import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RefundOrderModal from '@/components/dashboard/RefundOrderModal';
import type { Order } from '@/lib/api/orders';

jest.mock('@/lib/api/refunds', () => ({ apiAdminRefundOrder: jest.fn() }));
import { apiAdminRefundOrder } from '@/lib/api/refunds';

function makeOrder(): Order {
  return {
    id: 'order-1',
    orderNumber: 'MR-20260723-00001',
    orderSeq: 7,
    userId: 'user-1',
    channel: 'ONLINE',
    guestContact: null,
    status: 'CONFIRMED',
    subtotalAmount: '100.00',
    subtotalCurrency: 'EGP',
    shippingAmount: '50.00',
    totalAmount: '150.00',
    totalCurrency: 'EGP',
    shippingAddressSnapshot: { fullName: 'A', line1: 'B', city: 'C', governorate: 'D', phone: 'E' },
    notes: null,
    fulfillmentMethod: null,
    fulfillmentStatus: 'UNFULFILLED',
    fulfilledAt: null,
    refundedAt: null,
    refundedAmountCents: 0,
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Order;
}

beforeEach(() => jest.clearAllMocks());

describe('RefundOrderModal', () => {
  it('defaults the amount to the full order total', () => {
    render(<RefundOrderModal order={makeOrder()} onClose={jest.fn()} onRefunded={jest.fn()} />);
    expect(screen.getByLabelText(/refund amount/i)).toHaveValue(150);
  });

  it('submits without an image, because proof is optional', async () => {
    (apiAdminRefundOrder as jest.Mock).mockResolvedValue({ id: 't1' });
    const onRefunded = jest.fn();
    render(<RefundOrderModal order={makeOrder()} onClose={jest.fn()} onRefunded={onRefunded} />);

    await userEvent.type(screen.getByLabelText(/reason/i), 'Damaged bottle');
    await userEvent.click(screen.getByRole('button', { name: /^refund/i }));

    await waitFor(() =>
      expect(apiAdminRefundOrder).toHaveBeenCalledWith(
        'order-1',
        expect.objectContaining({ amountCents: 15000, reason: 'Damaged bottle' }),
      ),
    );
    expect((apiAdminRefundOrder as jest.Mock).mock.calls[0][1]).not.toHaveProperty('proofDataUrl');
    await waitFor(() => expect(onRefunded).toHaveBeenCalled());
  });

  it('refuses an amount greater than the order total before calling the API', async () => {
    render(<RefundOrderModal order={makeOrder()} onClose={jest.fn()} onRefunded={jest.fn()} />);

    const amount = screen.getByLabelText(/refund amount/i);
    await userEvent.clear(amount);
    await userEvent.type(amount, '500');
    await userEvent.type(screen.getByLabelText(/reason/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /^refund/i }));

    expect(await screen.findByText(/cannot be more than/i)).toBeInTheDocument();
    expect(apiAdminRefundOrder).not.toHaveBeenCalled();
  });

  it('requires a reason', async () => {
    render(<RefundOrderModal order={makeOrder()} onClose={jest.fn()} onRefunded={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /^refund/i }));
    expect(await screen.findByText(/reason is required/i)).toBeInTheDocument();
    expect(apiAdminRefundOrder).not.toHaveBeenCalled();
  });

  it('surfaces an API failure instead of closing silently', async () => {
    (apiAdminRefundOrder as jest.Mock).mockRejectedValue({ status: 400, message: 'already refunded' });
    const onClose = jest.fn();
    render(<RefundOrderModal order={makeOrder()} onClose={onClose} onRefunded={jest.fn()} />);

    await userEvent.type(screen.getByLabelText(/reason/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /^refund/i }));

    expect(await screen.findByText(/already refunded/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

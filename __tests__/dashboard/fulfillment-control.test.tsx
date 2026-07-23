import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FulfillmentControl from '@/components/dashboard/FulfillmentControl';
import type { Order } from '@/lib/api/orders';

jest.mock('@/lib/api/orders', () => ({
  apiAdminSetFulfillmentMethod: jest.fn(),
  apiAdminMarkFulfilled: jest.fn(),
}));

import { apiAdminSetFulfillmentMethod, apiAdminMarkFulfilled } from '@/lib/api/orders';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    orderNumber: 'MR-20260723-00001',
    orderSeq: 0,
    userId: 'user-1',
    status: 'CONFIRMED',
    subtotalAmount: '100.00',
    subtotalCurrency: 'EGP',
    shippingAmount: '50.00',
    totalAmount: '150.00',
    totalCurrency: 'EGP',
    shippingAddressSnapshot: {
      fullName: 'A', line1: 'B', city: 'C', governorate: 'D', phone: 'E',
    },
    notes: null,
    fulfillmentMethod: null,
    fulfillmentStatus: 'UNFULFILLED',
    fulfilledAt: null,
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Order;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('FulfillmentControl', () => {
  it('asks for a method before it will offer to fulfil', () => {
    render(<FulfillmentControl order={makeOrder()} onUpdated={jest.fn()} onError={jest.fn()} />);
    expect(screen.getByLabelText(/fulfillment method/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark fulfilled/i })).not.toBeInTheDocument();
  });

  it('offers Mark fulfilled once manual is chosen', () => {
    render(
      <FulfillmentControl
        order={makeOrder({ fulfillmentMethod: 'MANUAL' })}
        onUpdated={jest.fn()}
        onError={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /mark fulfilled/i })).toBeInTheDocument();
  });

  it('does not offer Mark fulfilled for shipping service, because there is no backend', () => {
    render(
      <FulfillmentControl
        order={makeOrder({ fulfillmentMethod: 'SHIPPING_SERVICE' })}
        onUpdated={jest.fn()}
        onError={jest.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /mark fulfilled/i })).not.toBeInTheDocument();
    expect(screen.getByText(/not connected yet/i)).toBeInTheDocument();
  });

  it('shows a fulfilled order as done with no controls', () => {
    render(
      <FulfillmentControl
        order={makeOrder({
          fulfillmentMethod: 'MANUAL',
          fulfillmentStatus: 'FULFILLED',
          fulfilledAt: new Date().toISOString(),
        })}
        onUpdated={jest.fn()}
        onError={jest.fn()}
      />,
    );
    expect(screen.getByText(/fulfilled/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark fulfilled/i })).not.toBeInTheDocument();
  });

  it('saves the chosen method and hands the updated order back', async () => {
    const updated = makeOrder({ fulfillmentMethod: 'MANUAL' });
    (apiAdminSetFulfillmentMethod as jest.Mock).mockResolvedValue(updated);
    const onUpdated = jest.fn();
    render(<FulfillmentControl order={makeOrder()} onUpdated={onUpdated} onError={jest.fn()} />);

    await userEvent.selectOptions(screen.getByLabelText(/fulfillment method/i), 'MANUAL');

    await waitFor(() => expect(apiAdminSetFulfillmentMethod).toHaveBeenCalledWith('order-1', 'MANUAL'));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
  });

  it('reports a failure through onError instead of swallowing it', async () => {
    (apiAdminMarkFulfilled as jest.Mock).mockRejectedValue({ status: 400, message: 'nope' });
    const onError = jest.fn();
    render(
      <FulfillmentControl
        order={makeOrder({ fulfillmentMethod: 'MANUAL' })}
        onUpdated={jest.fn()}
        onError={onError}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /mark fulfilled/i }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith('nope'));
  });
});

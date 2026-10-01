/**
 * Owner request 2026-07-30: the Customers list was showing a customer's
 * chosen display name only ("Youssef") instead of their real first + last
 * name ("Youssef Abdelrahman"), and the search box matched only that display
 * name — so typing a surname that wasn't part of it found nothing.
 *
 * Guards:
 *  1. The Name column renders "First Last", not the display name.
 *  2. Searching by surname alone finds the row.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomersClient from '@/app/dashboard/customers/CustomersClient';
import * as customersApi from '@/lib/api/customers';
import type { CustomerListItem } from '@/lib/api/customers';

jest.mock('@/lib/api/customers');

const mockedCustomers = customersApi as jest.Mocked<typeof customersApi>;

function makeCustomer(overrides: Partial<CustomerListItem> = {}): CustomerListItem {
  return {
    customerId: 'cus_youssef_1',
    firstName: 'Youssef',
    lastName: 'Abdelrahman',
    displayName: 'Youssef',
    emailVerified: true,
    // No photo — the list renders the shared silhouette for this case.
    avatarUrl: null,
    tier: 'BRONZE',
    lifetimeSpendAmount: '0.00',
    lifetimeSpendCurrency: 'EGP',
    gdprEraseRequestedAt: null,
    createdAt: new Date().toISOString(),
    addressCount: 0,
    ...overrides,
  };
}

describe('CustomersClient name + search', () => {
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

    mockedCustomers.apiAdminListCustomers.mockResolvedValue({
      data: [
        makeCustomer(),
        makeCustomer({
          customerId: 'cus_other_2',
          firstName: 'Mona',
          lastName: 'Khaled',
          displayName: null,
        }),
      ],
      total: 2,
      page: 1,
      limit: 200,
    });
  });

  it('shows first name then last name, not the display name', async () => {
    render(<CustomersClient />);

    await waitFor(() =>
      expect(screen.getByText('Youssef Abdelrahman')).toBeInTheDocument(),
    );
    // The bare display name must never appear as the row text on its own.
    expect(screen.queryByText('Youssef', { selector: 'a' })).not.toBeInTheDocument();
  });

  it('finds a customer by surname alone, not just the display name', async () => {
    render(<CustomersClient />);
    const user = userEvent.setup();

    await waitFor(() =>
      expect(screen.getByText('Youssef Abdelrahman')).toBeInTheDocument(),
    );

    const search = screen.getByPlaceholderText(/search by name or id/i);
    await user.type(search, 'Abdelrahman');

    expect(screen.getByText('Youssef Abdelrahman')).toBeInTheDocument();
    expect(screen.queryByText('Mona Khaled')).not.toBeInTheDocument();
  });

  it('lists an unregistered buyer and opens their orders, not a profile', async () => {
    const buyerKey = `phone:${'a'.repeat(64)}`;
    const guest: customersApi.GuestCustomerListItem = {
      registered: false,
      kind: 'GUEST',
      buyerKey,
      customerId: null,
      displayName: 'Booth Buyer',
      phoneTail: '567',
      sources: ['BOOTH', 'ONLINE'],
      tier: null,
      orderCount: 2,
      totalSpendAmount: '150.00',
      totalSpendCurrency: 'EGP',
      firstOrderAt: '2026-10-01T10:00:00.000Z',
      lastOrderAt: '2026-10-02T10:00:00.000Z',
    };
    mockedCustomers.apiAdminListCustomers.mockResolvedValue({
      data: [{ ...makeCustomer(), registered: true }, guest],
      total: 2,
      page: 1,
      limit: 100,
    });
    mockedCustomers.apiAdminGetGuestCustomer.mockResolvedValue({
      ...guest,
      pendingPoints: 300,
      orders: [{
        id: 'order-1', orderNumber: 'MR-1001', createdAt: '2026-10-01T10:00:00.000Z',
        status: 'DELIVERED', salesMode: 'GROUND', source: 'BOOTH',
        totalAmount: '100.00', totalCurrency: 'EGP', refundedAmountCents: 0,
      }],
    });
    render(<CustomersClient />);

    expect(await screen.findByText('Booth Buyer')).toBeInTheDocument();
    expect(screen.getByText('Not registered')).toBeInTheDocument();
    expect(screen.getByText('2 orders')).toBeInTheDocument();
    expect(mockedCustomers.apiAdminListCustomers).toHaveBeenCalledWith(
      expect.objectContaining({ includeGuests: true, limit: 100 }),
    );
    // Registered rows still open the account profile.
    expect(screen.getByRole('link', { name: /youssef abdelrahman/i })).toHaveAttribute('href', '/customers/cus_youssef_1');

    await userEvent.setup().click(screen.getByRole('button', { name: /view orders/i }));
    expect(mockedCustomers.apiAdminGetGuestCustomer).toHaveBeenCalledWith(buyerKey);
    expect(await screen.findByText('MR-1001')).toBeInTheDocument();
    expect(await screen.findByText('300 pts')).toBeInTheDocument();
  });
});

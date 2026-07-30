/**
 * Owner request 2026-07-30: the customer detail page must show the
 * customer's uploaded photo (tap to preview, same pattern as the
 * collaborator brand-avatar tile), and a generic silhouette — NEVER an
 * initial letter — when they have not uploaded one.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomerDetailClient from '@/app/dashboard/customers/[userId]/CustomerDetailClient';
import * as customersApi from '@/lib/api/customers';
import type { CustomerDetail } from '@/lib/api/customers';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/lib/api/customers');

const mockedCustomers = customersApi as jest.Mocked<typeof customersApi>;

function makeCustomer(overrides: Partial<CustomerDetail> = {}): CustomerDetail {
  return {
    customerId: 'cus_1',
    firstName: 'Jane',
    lastName: 'Doe',
    displayName: null,
    phone: '+201001234567',
    phoneSearchHash: null,
    avatarUrl: null,
    email: 'jane@example.com',
    emailVerified: true,
    status: 'ACTIVE',
    name: 'Jane Doe',
    tier: 'BRONZE',
    lifetimeSpendAmount: '0.00',
    lifetimeSpendCurrency: 'EGP',
    gdprEraseRequestedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    addresses: [],
    ...overrides,
  };
}

function mockMatchMedia() {
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
}

describe('CustomerDetailClient avatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMatchMedia();
    mockedCustomers.apiAdminGetCustomerOrders.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
    } as never);
    mockedCustomers.apiAdminGetCustomerRefunds.mockResolvedValue({
      items: [],
      totalCents: 0,
      count: 0,
    });
  });

  it('shows the generic silhouette, never an initial letter, when there is no photo', async () => {
    mockedCustomers.apiAdminGetCustomer.mockResolvedValue(
      makeCustomer({ avatarUrl: null }),
    );

    render(<CustomerDetailClient userId="cus_1" />);

    await waitFor(() => expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0));

    expect(screen.getByTestId('customer-avatar-generic')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-generic')).toBeInTheDocument();
    // Nothing in the fallback reads as an initial letter (e.g. a bare "J").
    expect(screen.queryByText('J')).not.toBeInTheDocument();
  });

  it('shows the uploaded photo, and it opens a full-size preview on tap', async () => {
    mockedCustomers.apiAdminGetCustomer.mockResolvedValue(
      makeCustomer({ avatarUrl: 'https://cdn.example.com/customers/cus_1/avatar.webp' }),
    );

    render(<CustomerDetailClient userId="cus_1" />);
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0));

    expect(screen.queryByTestId('customer-avatar-generic')).not.toBeInTheDocument();
    const photo = screen.getByAltText('Jane Doe photo');
    expect(photo).toHaveAttribute('src', expect.stringContaining('avatar.webp'));

    // Tap to enlarge — the modal is not open until the button is pressed.
    expect(screen.queryByRole('dialog', { name: /image preview/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /view full size/i }));
    expect(screen.getByRole('dialog', { name: /image preview/i })).toBeInTheDocument();
  });
});

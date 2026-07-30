/**
 * Pins the phone/country layout intent on the admin customer-detail form
 * (app/dashboard/customers/[userId]/CustomerDetailClient.tsx).
 *
 * The bug this guards against: the country dial-code <select> is the SHORT
 * field (a few characters, e.g. "EG +20") and must stay a small fixed basis;
 * the phone number is the LONG field and must flex to fill the rest of the
 * row. A flex child left at the browser default `min-width: auto` refuses to
 * shrink below its own content width and shoves its neighbour out of the
 * row — that's what happened here before, and it's what regressed the
 * sibling form in apps/minirue-frontend's signup page too.
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

describe('CustomerDetailClient phone/country row', () => {
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

    mockedCustomers.apiAdminGetCustomer.mockResolvedValue(makeCustomer());
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

  it('keeps the country select a fixed narrow basis and lets the phone input flex', async () => {
    render(<CustomerDetailClient userId="cus_1" />);
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0));
    await user.click(screen.getByRole('button', { name: /^edit$/i }));

    const select = await screen.findByTestId('phone-country-select');
    const input = screen.getByTestId('phone-number-input');

    // Country: short, fixed-basis, must NOT grow or shrink away from its
    // assigned width.
    expect(select.style.flex).toBe('0 0 128px');

    // Phone: flexes to absorb the remaining space...
    expect(input.style.flex).toMatch(/^1 1 /);
    // ...and critically is NOT left at the browser default `min-width: auto`,
    // which is what let the input's own content width win and push the
    // select out of the row. This is the one-line regression to catch.
    expect(input.style.minWidth).toBe('0');
    expect(select.style.minWidth).toBe('0');

    // The row itself must be allowed to wrap rather than overflow if a
    // viewport is ever too narrow for both fields side by side.
    const row = screen.getByTestId('phone-country-row');
    expect(row.style.flexWrap).toBe('wrap');
  });
});

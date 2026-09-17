import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
// The Lane 12 rewrite (2026-07-31) replaced `AnalyticsClient` with the
// widget-registry Overview screen and moved the order-derived figures this
// suite actually exercises (revenue/refunds/orders/top-products/funnel via
// `@/lib/api/analytics`) to `SalesClient` at `/analytics/sales` — see
// `AnalyticsSubnav.tsx`'s "Sales" tab comment. Point this suite at the
// screen that still calls those four API functions.
import SalesClient from '@/app/dashboard/analytics/sales/SalesClient';
import LoyaltyClient from '@/app/dashboard/loyalty/LoyaltyClient';
import * as analyticsApi from '@/lib/api/analytics';
import * as loyaltyApi from '@/lib/api/loyalty';

/**
 * A brand-new shop with no data at all.
 *
 * This is the state the live shop is actually in, and it is where these screens
 * break: an endpoint returns an empty list or leaves a key off entirely, and an
 * unguarded .reduce() or .find() takes the whole page down with "Cannot read
 * properties of undefined". Settings had exactly that bug.
 *
 * Each test asserts the page still renders something a human can read.
 */

jest.mock('@/lib/api/analytics');
jest.mock('@/lib/api/loyalty');

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/analytics',
  useSearchParams: () => new URLSearchParams(),
}));

const mockedAnalytics = analyticsApi as jest.Mocked<typeof analyticsApi>;
const mockedLoyalty = loyaltyApi as jest.Mocked<typeof loyaltyApi>;

const EMPTY_OVERVIEW = {
  revenue: { today_cents: 0, week_cents: 0, month_cents: 0, net_month_cents: 0 },
  refunds: { today_cents: 0, week_cents: 0, month_cents: 0, count: 0 },
  orders: {
    pending_count: 0,
    confirmed_count: 0,
    processing_count: 0,
    shipped_count: 0,
    delivered_count: 0,
    cancelled_count: 0,
  },
  customers: { new_today: 0, new_week: 0, new_month: 0, total_active: 0 },
};

const EMPTY_FUNNEL = {
  carts_created: 0,
  orders_placed: 0,
  orders_paid: 0,
  orders_fulfilled: 0,
  conversion_to_paid: 0,
  conversion_to_fulfilled: 0,
};

describe('Analytics on an empty shop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAnalytics.apiGetAnalyticsOverview.mockResolvedValue(EMPTY_OVERVIEW);
    mockedAnalytics.apiGetRevenueSeries.mockResolvedValue([]);
    mockedAnalytics.apiGetTopProducts.mockResolvedValue([]);
    mockedAnalytics.apiGetOrdersFunnel.mockResolvedValue(EMPTY_FUNNEL);
  });

  it('renders with zeroes rather than crashing', async () => {
    render(<SalesClient />);

    // "Sales" appears twice (the subnav tab link and the page's own <h1>) —
    // the heading role disambiguates.
    expect(await screen.findByRole('heading', { name: 'Sales' })).toBeInTheDocument();
    expect(await screen.findByText(/no product sales data yet/i)).toBeInTheDocument();
  });

  it('survives an endpoint that omits whole sections', async () => {
    // A backend that has never had settings written returns partial objects —
    // this is exactly how the Settings page broke.
    mockedAnalytics.apiGetAnalyticsOverview.mockResolvedValue(
      {} as unknown as typeof EMPTY_OVERVIEW,
    );

    render(<SalesClient />);

    // "Sales" appears twice (the subnav tab link and the page's own <h1>) —
    // the heading role disambiguates.
    expect(await screen.findByRole('heading', { name: 'Sales' })).toBeInTheDocument();
  });

  it('survives a list endpoint returning nothing at all', async () => {
    mockedAnalytics.apiGetTopProducts.mockResolvedValue(
      undefined as unknown as [],
    );
    mockedAnalytics.apiGetRevenueSeries.mockResolvedValue(
      undefined as unknown as [],
    );

    render(<SalesClient />);

    // "Sales" appears twice (the subnav tab link and the page's own <h1>) —
    // the heading role disambiguates.
    expect(await screen.findByRole('heading', { name: 'Sales' })).toBeInTheDocument();
  });

  it('shows the error and a retry when the API fails', async () => {
    mockedAnalytics.apiGetAnalyticsOverview.mockRejectedValue({
      status: 500,
      message: 'Analytics is unavailable',
    });

    render(<SalesClient />);

    expect(await screen.findByText(/analytics is unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

describe('Loyalty on an empty shop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLoyalty.apiAdminListLoyaltyAccounts.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    });
  });

  it('renders with zero totals rather than crashing', async () => {
    render(<LoyaltyClient />);

    expect(await screen.findByText('Loyalty')).toBeInTheDocument();
    expect(await screen.findByText(/no matching customers/i)).toBeInTheDocument();
  });

  it('survives a response with no data key', async () => {
    // The reduce() over accounts is unguarded, so an absent data key turned the
    // whole page into a blank screen.
    mockedLoyalty.apiAdminListLoyaltyAccounts.mockResolvedValue(
      {} as unknown as { data: []; total: number; page: number; limit: number },
    );

    render(<LoyaltyClient />);

    // Waiting for the loaded state, not just the header: the header renders on
    // the first pass with an empty list, so asserting on it alone would pass
    // even if the update that follows blows up.
    expect(await screen.findByText(/no matching customers/i)).toBeInTheDocument();
    expect(await screen.findByText(/0 customers/i)).toBeInTheDocument();
  });

  it('shows the error when the API fails', async () => {
    mockedLoyalty.apiAdminListLoyaltyAccounts.mockRejectedValue({
      status: 500,
      message: 'Loyalty is unavailable',
    });

    render(<LoyaltyClient />);

    expect(await screen.findByText(/loyalty is unavailable/i)).toBeInTheDocument();
  });

  it('searches and filters customers using the support contract', async () => {
    render(<LoyaltyClient />);
    await screen.findByText(/no matching customers/i);

    fireEvent.change(screen.getByPlaceholderText(/search name, id, phone or email/i), { target: { value: 'Mona' } });
    fireEvent.change(screen.getByLabelText('Tier'), { target: { value: 'GOLD' } });
    fireEvent.click(screen.getByLabelText('Has balance'));

    await waitFor(() => expect(mockedLoyalty.apiAdminListLoyaltyAccounts).toHaveBeenLastCalledWith(expect.objectContaining({
      q: 'Mona', tier: 'GOLD', hasBalance: true, page: 1, limit: 20,
    })), { timeout: 1500 });
  });

  it('requires a note for Other and refreshes the ledger after a compensation', async () => {
    const account: loyaltyApi.LoyaltyAccountDto = {
      id: 'account-1', customerId: 'customer-123456', name: 'Mona Ali', email: 'mona@example.test',
      tier: 'GOLD', avatarUrl: null, balance: 120, lifetimeEarned: 150, lifetimeRedeemed: 0,
      lifetimeReversed: 30, lifetimeAdjusted: 0, earnedLast30Days: 20, adjustedLast30Days: 0,
      lastActivity: '2026-09-16T10:00:00.000Z',
    };
    mockedLoyalty.apiAdminListLoyaltyAccounts.mockResolvedValue({ data: [account], total: 1, page: 1, limit: 20 });
    mockedLoyalty.apiAdminGetLoyaltyCustomer.mockResolvedValue({ ...account, history: [], total: 0, page: 1, limit: 50 });
    mockedLoyalty.apiAdminManualAdjust.mockResolvedValue({ ...account, balance: 170 });
    render(<LoyaltyClient />);

    fireEvent.click(await screen.findByRole('button', { name: /mona ali/i }));
    await screen.findByRole('heading', { name: /points ledger/i });
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'OTHER' } });
    fireEvent.click(screen.getByRole('button', { name: /add 50 points/i }));
    expect(await screen.findByText(/add a note when the reason is other/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'COMPENSATION_LATE_DELIVERY' } });
    fireEvent.click(screen.getByRole('button', { name: /add 50 points/i }));
    await waitFor(() => expect(mockedLoyalty.apiAdminManualAdjust).toHaveBeenCalledWith({
      customerId: 'customer-123456', delta: 50, reason: 'COMPENSATION_LATE_DELIVERY', note: undefined,
    }));
    await waitFor(() => expect(mockedLoyalty.apiAdminGetLoyaltyCustomer).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/\+50 points applied/i)).toBeInTheDocument();
  });
});

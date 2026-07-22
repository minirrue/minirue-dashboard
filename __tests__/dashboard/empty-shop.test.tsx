import React from 'react';
import { render, screen } from '@testing-library/react';
import AnalyticsClient from '@/app/dashboard/analytics/AnalyticsClient';
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

const mockedAnalytics = analyticsApi as jest.Mocked<typeof analyticsApi>;
const mockedLoyalty = loyaltyApi as jest.Mocked<typeof loyaltyApi>;

const EMPTY_OVERVIEW = {
  revenue: { today_cents: 0, week_cents: 0, month_cents: 0 },
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
    render(<AnalyticsClient />);

    expect(await screen.findByText('Analytics')).toBeInTheDocument();
    expect(await screen.findByText(/no product sales data yet/i)).toBeInTheDocument();
  });

  it('survives an endpoint that omits whole sections', async () => {
    // A backend that has never had settings written returns partial objects —
    // this is exactly how the Settings page broke.
    mockedAnalytics.apiGetAnalyticsOverview.mockResolvedValue(
      {} as unknown as typeof EMPTY_OVERVIEW,
    );

    render(<AnalyticsClient />);

    expect(await screen.findByText('Analytics')).toBeInTheDocument();
  });

  it('survives a list endpoint returning nothing at all', async () => {
    mockedAnalytics.apiGetTopProducts.mockResolvedValue(
      undefined as unknown as [],
    );
    mockedAnalytics.apiGetRevenueSeries.mockResolvedValue(
      undefined as unknown as [],
    );

    render(<AnalyticsClient />);

    expect(await screen.findByText('Analytics')).toBeInTheDocument();
  });

  it('shows the error and a retry when the API fails', async () => {
    mockedAnalytics.apiGetAnalyticsOverview.mockRejectedValue({
      status: 500,
      message: 'Analytics is unavailable',
    });

    render(<AnalyticsClient />);

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
    });
  });

  it('renders with zero totals rather than crashing', async () => {
    render(<LoyaltyClient />);

    expect(await screen.findByText('Loyalty')).toBeInTheDocument();
    expect(await screen.findByText(/total outstanding/i)).toBeInTheDocument();
  });

  it('survives a response with no data key', async () => {
    // The reduce() over accounts is unguarded, so an absent data key turned the
    // whole page into a blank screen.
    mockedLoyalty.apiAdminListLoyaltyAccounts.mockResolvedValue(
      {} as unknown as { data: []; total: number },
    );

    render(<LoyaltyClient />);

    // Waiting for the loaded state, not just the header: the header renders on
    // the first pass with an empty list, so asserting on it alone would pass
    // even if the update that follows blows up.
    expect(await screen.findByText(/total outstanding/i)).toBeInTheDocument();
    // "Lifetime Earned" appears both as a stat card and a table column, so
    // assert on the stat value instead of the ambiguous label.
    expect(await screen.findAllByText('0')).not.toHaveLength(0);
  });

  it('shows the error when the API fails', async () => {
    mockedLoyalty.apiAdminListLoyaltyAccounts.mockRejectedValue({
      status: 500,
      message: 'Loyalty is unavailable',
    });

    render(<LoyaltyClient />);

    expect(await screen.findByText(/loyalty is unavailable/i)).toBeInTheDocument();
  });
});

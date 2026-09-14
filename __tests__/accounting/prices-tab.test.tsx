import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import type { AccountingOverview } from '@/lib/api/accounting';

/**
 * PG-DASHBOARD-ACCTG-005 (minirue-dashboard#57). The Prices tab lists every
 * house variant and set with its floors, price, margin, profit and warning
 * count; a row opens the pricing drawer whose "why" is built from the trace.
 */

jest.mock('@/lib/api/accounting', () => ({ apiAccountingOverview: jest.fn() }));

import { apiAccountingOverview } from '@/lib/api/accounting';
import PricesTab from '@/app/dashboard/accounting/PricesTab';
import { whyFromTrace } from '@/app/dashboard/accounting/PricingDrawer';
import { NAV_ITEMS } from '@/components/dashboard/DashboardSidebar';
import { canAccessDashboardRoute } from '@/lib/auth/roles';

const mockOverview = apiAccountingOverview as jest.Mock;

/** The epic's worked example: REVOX PLEX Step 6 at a 30% slider. */
const revoxTrace = [
  { step: 'COST', valueMinor: 65000, note: 'cost' },
  { step: 'FULFILLMENT', valueMinor: 4750, note: 'box & trip' },
  { step: 'LAW1', valueMinor: 69750, note: 'Law 1 floor' },
  { step: 'LAW1_SHOWN', valueMinor: 69900, note: 'Law 1 floor, shown' },
  { step: 'NO_LOSS', valueMinor: 65000, note: 'no-loss floor' },
  { step: 'NO_LOSS_SHOWN', valueMinor: 65900, note: 'no-loss floor, shown' },
  { step: 'MARKET', valueMinor: 86000, note: 'median of 3 competitor prices' },
  { step: 'BAND_LO', valueMinor: 79120, note: '8% under market' },
  { step: 'BAND_HI', valueMinor: 86000, note: 'market' },
  { step: 'TARGET', valueMinor: 81184, note: '30% of the way' },
  { step: 'PRICE', valueMinor: 80900, note: 'rounded to the nearest …9' },
];

const settings = {
  fulfillmentItems: [
    { id: 'box', label: 'Box', amountMinor: 1500 },
    { id: 'bag', label: 'Bag', amountMinor: 250 },
    { id: 'trip', label: 'Trip', amountMinor: 3000 },
  ],
  strategyBp: 3000,
  usdRate: null,
  guardrails: { minMarginBp: 1000, maxMarginBp: 8000 },
  classes: {
    KNOWN_PRICE: { undercutBp: 800, premiumBp: 0, noMarketMinBp: 1500, noMarketMaxBp: 2500 },
    KNOWN_BRAND: { undercutBp: 500, premiumBp: 500, noMarketMinBp: 2500, noMarketMaxBp: 4000 },
    UNCOMPARABLE: { undercutBp: 0, premiumBp: 1500, noMarketMinBp: 4000, noMarketMaxBp: 6500 },
  },
  rounding: 'END_9',
  staleDays: 30,
  paybackOrders: 3,
} as const;

const overview: AccountingOverview = {
  pricing: { ...settings, fulfillmentItems: [...settings.fulfillmentItems] },
  lastRun: null,
  sets: [],
  variants: [
    {
      variantId: 'v-revox',
      productId: 'p-revox',
      productName: 'REVOX PLEX',
      variantLabel: 'Step 6',
      sku: 'RVX-6',
      mode: 'SYSTEM',
      costAmountMinor: 65000,
      costCurrency: 'EGP',
      followsUsd: false,
      knowledge: 'KNOWN_PRICE',
      competitorPrices: [
        { id: 'c1', source: 'Noon', url: null, priceMinor: 85000, checkedAt: '2026-09-10T10:00:00Z' },
        { id: 'c2', source: 'Amazon', url: null, priceMinor: 86000, checkedAt: '2026-09-10T10:00:00Z' },
        { id: 'c3', source: 'Jumia', url: null, priceMinor: 89900, checkedAt: '2026-09-10T10:00:00Z' },
      ],
      livePriceMinor: 80900,
      result: {
        priceMinor: 80900,
        floors: { law1Minor: 69750, noLossMinor: 65000, law1ShownMinor: 69900, noLossShownMinor: 65900 },
        band: { loMinor: 79120, hiMinor: 86000 },
        marketMinor: 86000,
        marginBp: 1965,
        markupBp: 2446,
        productProfitMinor: 11150,
        orderProfitMinor: 21150,
        flags: [],
        trace: revoxTrace,
      },
      warnings: [],
    },
    {
      variantId: 'v-mist',
      productId: 'p-mist',
      productName: 'Lumen Mist',
      variantLabel: '50 ml',
      sku: null,
      mode: 'MANUAL',
      costAmountMinor: 42000,
      costCurrency: 'EGP',
      followsUsd: false,
      knowledge: 'KNOWN_BRAND',
      competitorPrices: [],
      livePriceMinor: 41900,
      result: {
        priceMinor: 57900,
        floors: { law1Minor: 46750, noLossMinor: 42000, law1ShownMinor: 46900, noLossShownMinor: 42900 },
        band: { loMinor: 56000, hiMinor: 70000 },
        marketMinor: null,
        marginBp: 2746,
        markupBp: 3785,
        productProfitMinor: 11150,
        orderProfitMinor: 21150,
        flags: [],
        trace: [],
      },
      warnings: [
        {
          key: 'LOSES_MONEY:v-mist',
          kind: 'LOSES_MONEY',
          title: 'Loses money',
          detail: 'My price 419 is below the no-loss floor 429.',
          variantId: 'v-mist',
          link: '/accounting?tab=prices',
        },
        {
          key: 'BELOW_LAW1:v-mist',
          kind: 'BELOW_LAW1',
          title: 'Below Law 1',
          detail: 'My price 419 is below the Law 1 floor 469.',
          variantId: 'v-mist',
          link: '/accounting?tab=prices',
        },
      ],
    },
    {
      variantId: 'v-tote',
      productId: 'p-tote',
      productName: 'Atelier Tote',
      variantLabel: 'Sand',
      sku: null,
      mode: 'MANUAL',
      costAmountMinor: null,
      costCurrency: null,
      followsUsd: false,
      knowledge: 'UNCOMPARABLE',
      competitorPrices: [],
      livePriceMinor: 29900,
      result: null,
      warnings: [
        {
          key: 'NO_COST:v-tote',
          kind: 'NO_COST',
          title: 'No cost',
          detail: 'Discounts on this item are unprotected.',
          variantId: 'v-tote',
          link: '/accounting?tab=prices',
        },
      ],
    },
  ],
};

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('PricesTab', () => {
  it('renders one row per variant with the pricing columns', async () => {
    mockOverview.mockResolvedValue(overview);
    render(<PricesTab />);

    const table = await screen.findByRole('table', { name: /prices/i });
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual([
      'Item',
      'Mode',
      'Cost',
      'Market',
      'Law 1 / no-loss floor',
      'Price',
      'Margin',
      'Profit',
      'Warnings',
    ]);

    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);

    const revox = rows[0];
    expect(revox).toHaveTextContent('REVOX PLEX');
    expect(revox).toHaveTextContent('System price');
    expect(revox).toHaveTextContent('EGP 650.00');
    expect(revox).toHaveTextContent('EGP 860.00');
    expect(revox).toHaveTextContent('EGP 699.00');
    expect(revox).toHaveTextContent('EGP 659.00');
    expect(revox).toHaveTextContent('EGP 809.00');
    expect(revox).toHaveTextContent('19.7%');
    expect(revox).toHaveTextContent('EGP 111.50');

    // My price below the no-loss floor: margin and profit follow the live price.
    const mist = rows[1];
    expect(mist).toHaveTextContent('My price');
    expect(mist).toHaveTextContent('EGP 419.00');
    expect(mist).toHaveTextContent('−0.2%');
    expect(mist).toHaveTextContent('−EGP 48.50');
    expect(within(mist).getByLabelText('2 warnings')).toBeInTheDocument();

    const tote = rows[2];
    expect(tote).toHaveTextContent('No cost');
    expect(within(tote).getByLabelText('1 warning')).toBeInTheDocument();
  });

  it('opens the drawer for a row with the five headings and the why', async () => {
    mockOverview.mockResolvedValue(overview);
    render(<PricesTab />);

    fireEvent.click(await screen.findByRole('button', { name: /REVOX PLEX/ }));

    const drawer = screen.getByRole('dialog', { name: /REVOX PLEX/ });
    const headings = within(drawer).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual([
      'What it cost you',
      'What customers know',
      'Competitor prices',
      'How this price was set',
      'Mode',
    ]);
    expect(drawer).toHaveTextContent('the Law 1 floor is EGP 697.50');
    expect(drawer).toHaveTextContent('EGP 809.00');

    // Edits wait for the backend routes; nothing pretends to save.
    expect(within(drawer).getAllByText('Available soon').length).toBeGreaterThan(0);
    for (const input of within(drawer).getAllByRole('radio')) expect(input).toBeDisabled();
    for (const input of within(drawer).getAllByRole('textbox')) expect(input).toBeDisabled();

    fireEvent.keyDown(drawer, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the error when the overview cannot load', async () => {
    mockOverview.mockRejectedValue({ status: 500, message: 'boom' });
    render(<PricesTab />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  });
});

describe('whyFromTrace', () => {
  it('reads the worked example in plain English', () => {
    expect(whyFromTrace(revoxTrace)).toBe(
      'It costs you EGP 650.00, plus EGP 47.50 for the box & trip, so the Law 1 floor is EGP 697.50 (shown as EGP 699.00). ' +
        'Competitors charge EGP 860.00 (median of 3 competitor prices). ' +
        'The price can sit between EGP 791.20 (8% under market) and EGP 860.00 (market). ' +
        'The strategy puts it 30% of the way, at EGP 811.84, rounded to the nearest …9: EGP 809.00.',
    );
  });

  it('explains a missing cost', () => {
    expect(whyFromTrace([{ step: 'FLAG', valueMinor: null, note: 'NO_COST' }])).toBe(
      'No cost is entered, so there is no System price and discounts on it are unprotected.',
    );
  });
});

describe('sidebar', () => {
  it('lists Accounting in the Store section, for admins only', () => {
    const store = NAV_ITEMS.find((g) => g.section === 'Store');
    const item = store?.items.find((i) => i.label === 'Accounting');
    expect(item?.href).toBe('/accounting');
    expect(canAccessDashboardRoute('ADMIN', '/accounting')).toBe(true);
    expect(canAccessDashboardRoute('STAFF', '/accounting')).toBe(false);
  });
});

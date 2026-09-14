import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import type { AccountingOverview, SetRow, VariantRow } from '@/lib/api/accounting';

/**
 * PG-DASHBOARD-ACCTG-005 (minirue-dashboard#57, #66). The Prices tab lists every
 * house variant with its floors, price, margin, profit and engine flags, in the
 * row shape the live backend sends (`OverviewVariantRow`). A row opens the
 * pricing drawer, whose inputs save through the item routes (backend#160) and
 * refetch the overview. `apiFetch` is mocked, not the accounting client, so the
 * wire bodies are asserted against the backend DTOs.
 */

jest.mock('@/lib/api/client', () => ({ apiFetch: jest.fn() }));

import { apiFetch } from '@/lib/api/client';
import PricesTab from '@/app/dashboard/accounting/PricesTab';
import { whyFromTrace } from '@/app/dashboard/accounting/PricingDrawer';
import { NAV_ITEMS } from '@/components/dashboard/DashboardSidebar';
import { canAccessDashboardRoute } from '@/lib/auth/roles';

const mockFetch = apiFetch as jest.Mock;

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

const pricing: AccountingOverview['pricing'] = {
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
};

const revox: VariantRow = {
  variantId: 'v-revox',
  productId: 'p-revox',
  productName: 'REVOX PLEX',
  productSlug: 'revox-plex',
  sku: 'SKN-RVX-PLEX-STEP6',
  isActive: true,
  mode: 'SYSTEM',
  priceKnowledge: 'KNOWN_PRICE',
  cost: { amountMinor: 65000, currency: 'EGP', followsUsd: false, rateAtEntry: null },
  costMinor: 65000,
  competitorPrices: [
    { id: 'c1', source: 'Noon', url: null, priceMinor: 85000, checkedAt: '2026-09-10T10:00:00.000Z' },
    { id: 'c2', source: 'Amazon', url: null, priceMinor: 86000, checkedAt: '2026-09-10T10:00:00.000Z' },
    { id: 'c3', source: 'Jumia', url: null, priceMinor: 89900, checkedAt: '2026-09-10T10:00:00.000Z' },
  ],
  currentPriceMinor: 80900,
  system: {
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
  why: 'Cost EGP 650.00 + box & trip EGP 47.50 = Law 1 floor EGP 697.50 (shown EGP 699.00).',
  current: { marginBp: 1965, markupBp: 2446, productProfitMinor: 11150, orderProfitMinor: 21150 },
};

const mist: VariantRow = {
  variantId: 'v-mist',
  productId: 'p-mist',
  productName: 'Lumen Mist',
  productSlug: 'lumen-mist',
  sku: 'FRG-LUM-MIST-50',
  isActive: true,
  mode: 'MANUAL',
  priceKnowledge: 'KNOWN_BRAND',
  cost: { amountMinor: 42000, currency: 'EGP', followsUsd: false, rateAtEntry: null },
  costMinor: 42000,
  competitorPrices: [],
  currentPriceMinor: 41900,
  system: {
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
  why: '',
  // What the backend's economicsAt() returns at 419 with a 420 cost and 47.50 box & trip.
  current: { marginBp: -24, markupBp: -24, productProfitMinor: -4850, orderProfitMinor: 5150 },
};

const tote: VariantRow = {
  variantId: 'v-tote',
  productId: 'p-tote',
  productName: 'Atelier Tote',
  productSlug: 'atelier-tote',
  sku: 'BAG-ATL-TOTE-SAND',
  isActive: false,
  mode: 'MANUAL',
  priceKnowledge: null,
  cost: { amountMinor: null, currency: null, followsUsd: false, rateAtEntry: null },
  costMinor: null,
  competitorPrices: [],
  currentPriceMinor: 29900,
  system: {
    priceMinor: null,
    floors: null,
    band: null,
    marketMinor: null,
    marginBp: null,
    markupBp: null,
    productProfitMinor: null,
    orderProfitMinor: null,
    flags: ['NO_COST'],
    trace: [{ step: 'FLAG', valueMinor: null, note: 'NO_COST' }],
  },
  why: 'No cost is entered, so there is no System price.',
  current: { marginBp: null, markupBp: null, productProfitMinor: null, orderProfitMinor: null },
};

function overviewOf(variants: VariantRow[]): AccountingOverview {
  return {
    pricing,
    fees: { fulfillmentMinor: 4750, deliveryFeeMinor: 10000 },
    variants,
    sets: [],
    lastRun: null,
    undoableRunId: null,
  };
}

const run = { id: 'run-1', cause: 'ITEM', changedCount: 1, averageChangeBp: 150, createdAt: '2026-09-14T12:00:00.000Z', undoneAt: null, changes: [] };

/** Serves the overview (the next queued one after each write) and records every write. */
function serve(first: AccountingOverview, afterWrite: AccountingOverview = first, fail?: { status: number; message: string }) {
  let current = first;
  mockFetch.mockImplementation((path: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (path === '/accounting/overview' && method === 'GET') return Promise.resolve(current);
    if (fail) return Promise.reject(fail);
    current = afterWrite;
    return Promise.resolve({ run, overview: afterWrite });
  });
}

function writes() {
  return mockFetch.mock.calls
    .filter(([, init]) => (init?.method ?? 'GET') !== 'GET')
    .map(([path, init]) => ({ method: init.method, path, body: init.body ? JSON.parse(init.body) : undefined }));
}

function overviewGets() {
  return mockFetch.mock.calls.filter(([p, init]) => p === '/accounting/overview' && (init?.method ?? 'GET') === 'GET').length;
}

async function openDrawer(name: RegExp) {
  fireEvent.click(await screen.findByRole('button', { name }));
  return screen.getByRole('dialog', { name });
}

beforeEach(() => mockFetch.mockReset());
afterEach(() => cleanup());

describe('PricesTab', () => {
  it('renders one row per variant from the live row shape', async () => {
    serve(overviewOf([revox, mist, tote]));
    render(<PricesTab />);

    const table = await screen.findByRole('table', { name: /prices/i });
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Item', 'Mode', 'Cost', 'Market', 'Law 1 / no-loss floor', 'Price', 'Margin', 'Profit', 'Flags']);

    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);

    const [r, m, t] = rows;
    expect(r).toHaveTextContent('REVOX PLEX');
    expect(r).toHaveTextContent('SKN-RVX-PLEX-STEP6');
    expect(r).toHaveTextContent('System price');
    expect(r).toHaveTextContent('EGP 650.00');
    expect(r).toHaveTextContent('EGP 860.00');
    expect(r).toHaveTextContent('EGP 699.00');
    expect(r).toHaveTextContent('EGP 659.00');
    expect(r).toHaveTextContent('EGP 809.00');
    expect(r).toHaveTextContent('19.7%');
    expect(r).toHaveTextContent('EGP 111.50');
    expect(within(r).getByLabelText('No flags')).toBeInTheDocument();

    // My price below the no-loss floor: margin and profit are the backend's `current`.
    expect(m).toHaveTextContent('My price');
    expect(m).toHaveTextContent('EGP 419.00');
    expect(m).toHaveTextContent('Below no-loss');
    expect(m).toHaveTextContent('−0.2%');
    expect(m).toHaveTextContent('−EGP 48.50');

    expect(t).toHaveTextContent('No cost');
    expect(t).toHaveTextContent('Inactive');
    expect(within(t).getByLabelText('1 flag: No cost')).toBeInTheDocument();

    expect(screen.getByText(/Profit is after/)).toHaveTextContent('EGP 47.50');
  });

  it('opens the drawer with the five headings, the why and live inputs', async () => {
    serve(overviewOf([revox]));
    render(<PricesTab />);
    const drawer = await openDrawer(/REVOX PLEX/);

    const headings = within(drawer).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['What it cost you', 'What customers know', 'Competitor prices', 'How this price was set', 'Mode']);
    expect(drawer).toHaveTextContent('the Law 1 floor is EGP 697.50');
    expect(within(drawer).queryByText('Available soon')).not.toBeInTheDocument();
    for (const input of within(drawer).getAllByRole('textbox')) expect(input).toBeEnabled();
    expect(within(drawer).getByRole('radio', { name: /exact price/ })).toBeChecked();

    fireEvent.keyDown(drawer, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('saves a System-price cost with the PUT body the backend accepts, then refetches the row', async () => {
    const saved: VariantRow = {
      ...revox,
      cost: { ...revox.cost, amountMinor: 66000 },
      costMinor: 66000,
      current: { ...revox.current, marginBp: 1841, productProfitMinor: 10150 },
    };
    serve(overviewOf([revox]), overviewOf([saved]));
    render(<PricesTab />);
    const drawer = await openDrawer(/REVOX PLEX/);

    fireEvent.change(within(drawer).getByLabelText('Cost per unit'), { target: { value: '660' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save cost' }));

    await waitFor(() => expect(within(drawer).getByRole('status')).toHaveTextContent('Saved. 1 price changed.'));
    expect(writes()).toEqual([
      {
        method: 'PUT',
        path: '/accounting/variants/v-revox',
        body: { mode: 'SYSTEM', costAmountMinor: 66000, costCurrency: 'EGP', followsUsd: false },
      },
    ]);
    expect(overviewGets()).toBe(2);
    const row = screen.getAllByRole('row')[1];
    expect(row).toHaveTextContent('EGP 660.00');
    expect(row).toHaveTextContent('EGP 101.50');
  });

  it('keeps the My price when saving a cost on a My price row', async () => {
    serve(overviewOf([mist]));
    render(<PricesTab />);
    const drawer = await openDrawer(/Lumen Mist/);

    fireEvent.change(within(drawer).getByLabelText('Cost per unit'), { target: { value: '400' } });
    fireEvent.click(within(drawer).getByRole('checkbox', { name: /follows the dollar/i }));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save cost' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0].body).toEqual({
      mode: 'MANUAL',
      manualPriceMinor: 41900,
      costAmountMinor: 40000,
      costCurrency: 'EGP',
      followsUsd: true,
    });
  });

  it('refuses a blank System-price cost without saving', async () => {
    serve(overviewOf([revox]));
    render(<PricesTab />);
    const drawer = await openDrawer(/REVOX PLEX/);

    fireEvent.change(within(drawer).getByLabelText('Cost per unit'), { target: { value: '' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save cost' }));

    expect(within(drawer).getByRole('alert')).toHaveTextContent('Enter the cost. A System price needs one.');
    expect(writes()).toEqual([]);
  });

  it('shows the backend message when a save fails', async () => {
    serve(overviewOf([revox]), undefined, { status: 400, message: 'Set the USD rate in Accounting first' });
    render(<PricesTab />);
    const drawer = await openDrawer(/REVOX PLEX/);

    fireEvent.change(within(drawer).getByLabelText('Currency'), { target: { value: 'USD' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save cost' }));

    await waitFor(() =>
      expect(within(drawer).getByRole('alert')).toHaveTextContent('Could not save: Set the USD rate in Accounting first'),
    );
    expect(writes()[0].body).toEqual({ mode: 'SYSTEM', costAmountMinor: 65000, costCurrency: 'USD', followsUsd: false });
    expect(overviewGets()).toBe(1);
  });

  it('saves what customers know on choosing it', async () => {
    serve(overviewOf([revox]), overviewOf([{ ...revox, priceKnowledge: 'KNOWN_BRAND' }]));
    render(<PricesTab />);
    const drawer = await openDrawer(/REVOX PLEX/);

    fireEvent.click(within(drawer).getByRole('radio', { name: /know the brand/ }));

    await waitFor(() => expect(overviewGets()).toBe(2));
    expect(writes()).toEqual([
      { method: 'PUT', path: '/accounting/products/p-revox/knowledge', body: { knowledge: 'KNOWN_BRAND' } },
    ]);
  });

  it('adds and removes a competitor price', async () => {
    serve(overviewOf([revox]));
    render(<PricesTab />);
    const drawer = await openDrawer(/REVOX PLEX/);

    fireEvent.change(within(drawer).getByLabelText('Shop'), { target: { value: 'Faces' } });
    fireEvent.change(within(drawer).getByLabelText('Their price (EGP)'), { target: { value: '875.50' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Add price' }));
    await waitFor(() => expect(overviewGets()).toBe(2));

    fireEvent.click(within(drawer).getByRole('button', { name: 'Remove the Noon price' }));
    await waitFor(() => expect(overviewGets()).toBe(3));

    expect(writes()).toEqual([
      {
        method: 'POST',
        path: '/accounting/variants/v-revox/competitor-prices',
        body: { source: 'Faces', priceMinor: 87550 },
      },
      { method: 'DELETE', path: '/accounting/competitor-prices/c1', body: undefined },
    ]);
  });

  it('switches to My price with the price, and needs a cost for System price', async () => {
    serve(overviewOf([revox, tote]));
    render(<PricesTab />);
    let drawer = await openDrawer(/REVOX PLEX/);

    fireEvent.click(within(drawer).getByRole('radio', { name: /^My price/ }));
    fireEvent.change(within(drawer).getByLabelText('My price (EGP)'), { target: { value: '799' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save mode' }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toEqual({
      method: 'PUT',
      path: '/accounting/variants/v-revox',
      body: { mode: 'MANUAL', manualPriceMinor: 79900 },
    });

    fireEvent.keyDown(drawer, { key: 'Escape' });
    drawer = await openDrawer(/Atelier Tote/);
    fireEvent.click(within(drawer).getByRole('radio', { name: /^System price/ }));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save mode' }));
    expect(within(drawer).getByRole('alert')).toHaveTextContent('Enter a cost first. A System price is worked out from it.');
    expect(writes()).toHaveLength(1);
  });

  it('lists sets below the variants with mode, price, floors and warnings (backend#166)', async () => {
    const set: SetRow = {
      bundleId: 'b-evening',
      slug: 'evening-set',
      name: 'Evening Set',
      isActive: true,
      mode: 'MANUAL',
      savingBp: null,
      effectiveSavingBp: 1000,
      currentPriceMinor: 120000,
      members: [
        { productId: 'p-a', productName: 'A', variantId: 'v-a', sku: 'A-1', quantity: 1, unitPriceMinor: 80900, costMinor: 65000 },
        { productId: 'p-b', productName: 'B', variantId: 'v-b', sku: 'B-1', quantity: 1, unitPriceMinor: 86900, costMinor: 70000 },
      ],
      listTotalMinor: 167800,
      costMinor: 135000,
      system: { ...revox.system, priceMinor: 155900, floors: { law1Minor: 139750, noLossMinor: 135000, law1ShownMinor: 139900, noLossShownMinor: 135900 } },
      why: 'The pieces cost 1,678.00, less a saving of 10%.',
      current: { marginBp: -1250, markupBp: null, productProfitMinor: -19750, orderProfitMinor: -9750 },
      warnings: [{ key: 'LOSES_MONEY:b-evening', kind: 'LOSES_MONEY', variantId: null, productId: null, title: 'Evening Set loses money', detail: '', bundleId: 'b-evening' }],
    };
    serve({ ...overviewOf([revox]), sets: [set] });
    render(<PricesTab />);

    const table = await screen.findByRole('table', { name: /prices/i });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const setRow = rows[1];
    expect(within(setRow).getByRole('link', { name: /evening set/i })).toHaveAttribute('href', '/catalogue/bundles/b-evening/edit');
    expect(setRow).toHaveTextContent('My price');
    expect(setRow).toHaveTextContent('1,399.00');
    expect(setRow).toHaveTextContent('1,200.00');
    expect(setRow).toHaveTextContent('Below no-loss');
    expect(within(setRow).getByLabelText('1 warning: Evening Set loses money')).toBeInTheDocument();
    expect(document.querySelector('.acct-prices-summary')).toHaveTextContent('1 item · 1 set');
  });

  it('shows the error when the overview cannot load', async () => {
    mockFetch.mockRejectedValue({ status: 500, message: 'boom' });
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

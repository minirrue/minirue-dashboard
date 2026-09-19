import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VariantsSection from '@/app/dashboard/products/[slug]/edit/VariantsSection';
import type { ProductVariant } from '@/lib/catalog/types';
import type { AccountingOverview, VariantRow } from '@/lib/api/accounting';

/**
 * minirue-dashboard#62 (accounting DA-6, epic minirue-backend#155).
 *
 * A house product's variant form offers two paths under their own headings:
 * System price (cost in, the engine's price out, via
 * `POST /accounting/products/:id/variants`) and My price (the catalog create,
 * then `PUT /accounting/variants/:id` only when a cost is given). A partner
 * product keeps today's form. Existing rows show their mode, and only My price
 * rows keep the inline price edit: backend#167 flips a SYSTEM variant to
 * MANUAL on any catalog price write.
 *
 * `apiFetch` is mocked, not the clients, so the wire bodies are asserted
 * against the backend DTOs (`SystemVariantSchema`, `VariantPricingSchema`,
 * `CreateVariantSchema`).
 */

jest.mock('@/lib/api/client', () => ({
  ...jest.requireActual('@/lib/api/client'),
  apiFetch: jest.fn(),
}));

import { apiFetch } from '@/lib/api/client';

const mockFetch = apiFetch as jest.Mock;

const trace = [
  { step: 'COST', valueMinor: 65000, note: 'cost' },
  { step: 'FULFILLMENT', valueMinor: 4750, note: 'box & trip' },
  { step: 'LAW1', valueMinor: 69750, note: 'Law 1 floor' },
  { step: 'LAW1_SHOWN', valueMinor: 69900, note: 'Law 1 floor, shown' },
  { step: 'MARKET', valueMinor: 86000, note: 'median of 3 competitor prices' },
  { step: 'BAND_LO', valueMinor: 79120, note: '8% under market' },
  { step: 'BAND_HI', valueMinor: 86000, note: 'market' },
  { step: 'TARGET', valueMinor: 81184, note: '30% of the way' },
  { step: 'PRICE', valueMinor: 80900, note: 'rounded to the nearest …9' },
];

function row(over: Partial<VariantRow>): VariantRow {
  return {
    variantId: 'v-1',
    productId: 'product-1',
    productName: 'REVOX PLEX',
    productSlug: 'revox-plex',
    sku: 'SKN-1',
    isActive: true,
    mode: 'MANUAL',
    priceKnowledge: null,
    cost: { amountMinor: null, currency: null, followsUsd: false, rateAtEntry: null },
    costMinor: null,
    competitorPrices: [],
    currentPriceMinor: 120000,
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
      trace: [],
    },
    why: '',
    current: { marginBp: null, markupBp: null, productProfitMinor: null, orderProfitMinor: null },
    ...over,
  };
}

function overview(variants: VariantRow[]): AccountingOverview {
  return {
    pricing: {
      fulfillmentItems: [],
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
    },
    fees: { fulfillmentMinor: 4750, deliveryFeeMinor: 5250 },
    variants,
    sets: [],
    lastRun: null,
    undoableRunId: null,
  };
}

const run = {
  id: 'run-1',
  cause: 'ITEM',
  changedCount: 1,
  averageChangeBp: null,
  createdAt: '2026-09-14T10:00:00.000Z',
  undoneAt: null,
};

function variant(over: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: 'v-1',
    productId: 'product-1',
    sku: 'SKN-1',
    size: null,
    sizeMl: null,
    values: [],
    customValues: {},
    price: 1200,
    priceAmount: 1200,
    currency: 'EGP',
    stock: 4,
    isActive: true,
    ...over,
  };
}

function backendVariant(id: string, price: string) {
  return {
    id,
    productId: 'product-1',
    sku: `SKN-${id}`,
    sizeMl: null,
    values: [],
    customValues: {},
    priceAmount: price,
    priceCurrency: 'EGP',
    isActive: true,
  };
}

type Route = (init: RequestInit & { auth?: boolean }) => unknown;

/** Answers each route by `METHOD path`; anything unexpected fails loudly. */
function serve(routes: Record<string, Route>) {
  mockFetch.mockImplementation((path: string, init: RequestInit = {}) => {
    const key = `${init.method ?? 'GET'} ${path}`;
    const handler = routes[key];
    if (!handler) return Promise.reject(new Error(`unexpected ${key}`));
    return Promise.resolve(handler(init));
  });
}

function calls(key: string) {
  return mockFetch.mock.calls.filter(
    ([path, init]: [string, RequestInit | undefined]) => `${init?.method ?? 'GET'} ${path}` === key,
  );
}

function bodyOf(key: string, index = 0) {
  return JSON.parse(calls(key)[index][1].body as string);
}

/** The component's own trace ids, PG-DASHBOARD-CAT-003::<element>. */
function byTrace(element: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-trace-id="PG-DASHBOARD-CAT-003::${element}"]`);
  if (!el) throw new Error(`no element ${element}`);
  return el;
}

function Harness({
  variants: initial,
  isHouse,
  onChange,
}: {
  variants: ProductVariant[];
  isHouse?: boolean;
  onChange?: (v: ProductVariant[]) => void;
}) {
  const [variants, setVariants] = React.useState(initial);
  return (
    <VariantsSection
      productId="product-1"
      categoryId="category-1"
      isHouse={isHouse}
      variants={variants}
      onVariantsChange={(v) => {
        setVariants(v);
        onChange?.(v);
      }}
      media={[]}
      onMediaChange={() => {}}
      selectedVariantId={null}
      onSelectVariant={() => {}}
    />
  );
}

const baseRoutes: Record<string, Route> = {
  'GET /catalog/attributes?categoryId=category-1': () => ({ data: [] }),
};

beforeEach(() => {
  mockFetch.mockReset();
});

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /add variant/i }));
}

describe('VariantsSection — partner products keep today’s form', () => {
  it('shows one price and currency, no pricing paths, and never reads Accounting', async () => {
    serve({
      ...baseRoutes,
      'POST /catalog/admin/products/product-1/variants': () => backendVariant('v-new', '950.0000'),
    });
    const user = userEvent.setup();
    render(<Harness variants={[]} />);
    await openForm(user);

    expect(screen.queryByRole('heading', { name: 'System price' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My price' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/^price/i), '950');
    await user.click(screen.getByRole('button', { name: /^add variant$/i }));

    await waitFor(() => expect(calls('POST /catalog/admin/products/product-1/variants')).toHaveLength(1));
    expect(bodyOf('POST /catalog/admin/products/product-1/variants')).toEqual({
      values: {},
      custom_values: {},
      price_amount: '950.0000',
      price_currency: 'EGP',
    });
    expect(mockFetch.mock.calls.some(([p]: [string]) => p.startsWith('/accounting'))).toBe(false);
  });
});

describe('VariantsSection — house products: two headed paths', () => {
  it('offers System price and My price, each under its own heading with its line', async () => {
    serve({ ...baseRoutes, 'GET /accounting/overview': () => overview([]) });
    const user = userEvent.setup();
    render(<Harness variants={[]} isHouse />);
    await openForm(user);

    const system = screen.getByRole('region', { name: 'System price' });
    const mine = screen.getByRole('region', { name: 'My price' });
    expect(
      within(system).getByText('Type what one unit cost you; the shop sets and updates the price.'),
    ).toBeInTheDocument();
    expect(
      within(mine).getByText(
        "You set it; the slider and USD rate won't change it. Add the cost to see profit and get floor protection.",
      ),
    ).toBeInTheDocument();
    expect(within(system).getByLabelText(/cost per unit/i)).toBeInTheDocument();
    expect(within(system).getByLabelText(/currency/i)).toBeInTheDocument();
    expect(within(mine).getByLabelText(/^price/i)).toBeInTheDocument();
    expect(within(mine).getByLabelText(/cost per unit \(optional\)/i)).toBeInTheDocument();
  });

  it('System price calls POST accounting/products/:id/variants and shows the computed price read-only with its why', async () => {
    const created = row({
      variantId: 'v-new',
      sku: 'SKN-v-new',
      mode: 'SYSTEM',
      cost: { amountMinor: 65000, currency: 'EGP', followsUsd: false, rateAtEntry: null },
      costMinor: 65000,
      currentPriceMinor: 80900,
      system: {
        priceMinor: 80900,
        floors: { law1Minor: 69750, noLossMinor: 65000, law1ShownMinor: 69900, noLossShownMinor: 65900 },
        band: { loMinor: 79120, hiMinor: 86000 },
        marketMinor: 86000,
        marginBp: 1965,
        markupBp: 2446,
        productProfitMinor: 11150,
        orderProfitMinor: 16400,
        flags: [],
        trace,
      },
    });
    serve({
      ...baseRoutes,
      'GET /accounting/overview': () => overview([]),
      'POST /accounting/products/product-1/variants': () => ({
        variant: { ...backendVariant('v-new', '809.0000'), price_amount: '809.00' },
        run,
        overview: overview([created]),
      }),
    });
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<Harness variants={[]} isHouse onChange={onChange} />);
    await openForm(user);

    const system = screen.getByRole('region', { name: 'System price' });
    await user.type(within(system).getByLabelText(/cost per unit/i), '650');
    await user.click(within(system).getByRole('button', { name: /add on system price/i }));

    await waitFor(() => expect(calls('POST /accounting/products/product-1/variants')).toHaveLength(1));
    expect(bodyOf('POST /accounting/products/product-1/variants')).toEqual({
      values: {},
      custom_values: {},
      costAmountMinor: 65000,
      costCurrency: 'EGP',
      followsUsd: false,
    });
    expect(calls('POST /catalog/admin/products/product-1/variants')).toHaveLength(0);
    expect(calls('PUT /accounting/variants/v-new')).toHaveLength(0);

    const result = await screen.findByRole('status');
    expect(result).toHaveTextContent('EGP 809.00');
    expect(result).toHaveTextContent('It costs you EGP 650.00');
    expect(within(result).queryByRole('textbox')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ id: 'v-new', priceAmount: 809 })]);
  });

  it('System price sends a USD cost in cents, and EGP that follows the dollar as followsUsd', async () => {
    serve({
      ...baseRoutes,
      'GET /accounting/overview': () => overview([]),
      'POST /accounting/products/product-1/variants': () => ({
        variant: backendVariant('v-new', '809.0000'),
        run,
        overview: overview([]),
      }),
    });
    const user = userEvent.setup();
    render(<Harness variants={[]} isHouse />);
    await openForm(user);

    let system = screen.getByRole('region', { name: 'System price' });
    await user.selectOptions(within(system).getByLabelText(/currency/i), 'USD');
    await user.type(within(system).getByLabelText(/cost per unit/i), '12.5');
    await user.click(within(system).getByRole('button', { name: /add on system price/i }));
    await waitFor(() => expect(calls('POST /accounting/products/product-1/variants')).toHaveLength(1));
    expect(bodyOf('POST /accounting/products/product-1/variants')).toEqual({
      values: {},
      custom_values: {},
      costAmountMinor: 1250,
      costCurrency: 'USD',
      followsUsd: false,
    });

    await openForm(user);
    system = screen.getByRole('region', { name: 'System price' });
    await user.selectOptions(within(system).getByLabelText(/currency/i), 'EGP_USD');
    await user.type(within(system).getByLabelText(/cost per unit/i), '650');
    await user.click(within(system).getByRole('button', { name: /add on system price/i }));
    await waitFor(() => expect(calls('POST /accounting/products/product-1/variants')).toHaveLength(2));
    expect(bodyOf('POST /accounting/products/product-1/variants', 1)).toEqual({
      values: {},
      custom_values: {},
      costAmountMinor: 65000,
      costCurrency: 'EGP',
      followsUsd: true,
    });
  });

  it('refuses a blank System cost without a request', async () => {
    serve({ ...baseRoutes, 'GET /accounting/overview': () => overview([]) });
    const user = userEvent.setup();
    render(<Harness variants={[]} isHouse />);
    await openForm(user);

    const system = screen.getByRole('region', { name: 'System price' });
    await user.click(within(system).getByRole('button', { name: /add on system price/i }));

    expect(await within(system).findByText(/enter what one unit cost you/i)).toBeInTheDocument();
    expect(calls('POST /accounting/products/product-1/variants')).toHaveLength(0);
  });

  it('My price with a cost calls the catalog create, then PUT accounting/variants/:id', async () => {
    serve({
      ...baseRoutes,
      'GET /accounting/overview': () => overview([]),
      'POST /catalog/admin/products/product-1/variants': () => backendVariant('v-new', '950.0000'),
      'PUT /accounting/variants/v-new': () => ({
        run,
        overview: overview([row({ variantId: 'v-new', currentPriceMinor: 95000, costMinor: 65000 })]),
      }),
    });
    const user = userEvent.setup();
    render(<Harness variants={[]} isHouse />);
    await openForm(user);

    const mine = screen.getByRole('region', { name: 'My price' });
    await user.type(within(mine).getByLabelText(/^price/i), '950');
    await user.type(within(mine).getByLabelText(/cost per unit \(optional\)/i), '650');
    await user.click(within(mine).getByRole('button', { name: /add on my price/i }));

    await waitFor(() => expect(calls('PUT /accounting/variants/v-new')).toHaveLength(1));
    expect(bodyOf('POST /catalog/admin/products/product-1/variants')).toEqual({
      values: {},
      custom_values: {},
      price_amount: '950.0000',
      price_currency: 'EGP',
    });
    expect(bodyOf('PUT /accounting/variants/v-new')).toEqual({
      mode: 'MANUAL',
      manualPriceMinor: 95000,
      costAmountMinor: 65000,
      costCurrency: 'EGP',
      followsUsd: false,
    });
    const order = mockFetch.mock.calls.map(([p, i]: [string, RequestInit | undefined]) => `${i?.method ?? 'GET'} ${p}`);
    expect(order.indexOf('POST /catalog/admin/products/product-1/variants')).toBeLessThan(
      order.indexOf('PUT /accounting/variants/v-new'),
    );
    expect(calls('POST /accounting/products/product-1/variants')).toHaveLength(0);
  });

  it('My price without a cost is the catalog create alone', async () => {
    serve({
      ...baseRoutes,
      'GET /accounting/overview': () => overview([]),
      'POST /catalog/admin/products/product-1/variants': () => backendVariant('v-new', '950.0000'),
    });
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(<Harness variants={[]} isHouse onChange={onChange} />);
    await openForm(user);

    const mine = screen.getByRole('region', { name: 'My price' });
    await user.type(within(mine).getByLabelText(/^price/i), '950');
    await user.click(within(mine).getByRole('button', { name: /add on my price/i }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(calls('POST /catalog/admin/products/product-1/variants')).toHaveLength(1);
    expect(mockFetch.mock.calls.some(([p]: [string]) => p.startsWith('/accounting/variants'))).toBe(false);
  });
});

describe('VariantsSection — existing house variants', () => {
  const existing = [
    variant({ id: 'v-sys', sku: 'SKN-SYS', priceAmount: 809, price: 809 }),
    variant({ id: 'v-man', sku: 'SKN-MAN', priceAmount: 1200, price: 1200 }),
  ];

  function serveExisting() {
    serve({
      ...baseRoutes,
      'GET /accounting/overview': () =>
        overview([
          row({ variantId: 'v-sys', sku: 'SKN-SYS', mode: 'SYSTEM', currentPriceMinor: 80900 }),
          row({ variantId: 'v-man', sku: 'SKN-MAN', mode: 'MANUAL' }),
          row({ variantId: 'v-other', productId: 'product-2', mode: 'SYSTEM' }),
        ]),
      'PATCH /catalog/admin/products/product-1/variants/v-sys': () => backendVariant('v-sys', '809.0000'),
      'PATCH /catalog/admin/products/product-1/variants/v-man': () => backendVariant('v-man', '1250.0000'),
    });
  }

  it('shows each row’s mode with a Change in Accounting link', async () => {
    serveExisting();
    render(<Harness variants={existing} isHouse />);

    const sys = await waitFor(() => byTrace('EL-TEXT-variant-mode@v-sys'));
    await waitFor(() => expect(sys).toHaveTextContent('System price'));
    expect(byTrace('EL-TEXT-variant-mode@v-man')).toHaveTextContent('My price');
    const links = screen.getAllByRole('link', { name: /change in accounting/i });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/accounting?tab=prices&open=v-sys');
    expect(links[1]).toHaveAttribute('href', '/accounting?tab=prices&open=v-man');
  });

  it('shows stock read-only with a Change in Inventory link scoped to the SKU (#101)', async () => {
    serveExisting();
    render(<Harness variants={existing} isHouse />);
    await waitFor(() => expect(byTrace('EL-TEXT-variant-mode@v-man')).toHaveTextContent('My price'));

    expect(screen.queryByRole('spinbutton', { name: /available quantity/i })).not.toBeInTheDocument();
    const inv = byTrace('EL-LINK-variant-change-in-inventory@v-man');
    expect(inv).toHaveAttribute('href', '/inventory?q=SKN-MAN');
  });

  it('never offers the inline price edit on a System price row, and never writes its price', async () => {
    serveExisting();
    const user = userEvent.setup();
    render(<Harness variants={existing} isHouse />);
    await waitFor(() => expect(byTrace('EL-TEXT-variant-mode@v-sys')).toHaveTextContent('System price'));

    const sysRow = screen.getByText('SKN-SYS').closest('tr') as HTMLElement;
    await user.click(within(sysRow).getByRole('button', { name: /^edit$/i }));
    const form = byTrace('EL-FORM-edit-variant-form@v-sys');
    expect(within(form).queryByLabelText(/^price/i)).not.toBeInTheDocument();
    expect(within(form).queryByLabelText(/^currency/i)).not.toBeInTheDocument();
    expect(within(form).getByText(/set by the system/i)).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(calls('PATCH /catalog/admin/products/product-1/variants/v-sys')).toHaveLength(1),
    );
    const body = bodyOf('PATCH /catalog/admin/products/product-1/variants/v-sys');
    expect(body).not.toHaveProperty('price_amount');
    expect(body).not.toHaveProperty('price_currency');
  });

  it('never offers the inline price edit on a My price row either — it links to Accounting (#101)', async () => {
    serveExisting();
    const user = userEvent.setup();
    render(<Harness variants={existing} isHouse />);
    await waitFor(() => expect(byTrace('EL-TEXT-variant-mode@v-man')).toHaveTextContent('My price'));

    const manRow = screen.getByText('SKN-MAN').closest('tr') as HTMLElement;
    await user.click(within(manRow).getByRole('button', { name: /^edit$/i }));
    const form = byTrace('EL-FORM-edit-variant-form@v-man');
    expect(within(form).queryByLabelText(/^price/i)).not.toBeInTheDocument();
    expect(within(form).getByText(/is your price/i)).toBeInTheDocument();
    expect(within(form).getByRole('link', { name: /change in accounting/i })).toHaveAttribute(
      'href',
      '/accounting?tab=prices&open=v-man',
    );
    await user.click(within(form).getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(calls('PATCH /catalog/admin/products/product-1/variants/v-man')).toHaveLength(1),
    );
    expect(bodyOf('PATCH /catalog/admin/products/product-1/variants/v-man')).not.toHaveProperty(
      'price_amount',
    );
  });

  it('withholds the price edit while the mode is unknown (Accounting unreadable)', async () => {
    serve({
      ...baseRoutes,
      'GET /accounting/overview': () => Promise.reject({ statusCode: 403, message: 'Forbidden' }),
    });
    const user = userEvent.setup();
    render(<Harness variants={existing} isHouse />);

    await waitFor(() =>
      expect(byTrace('EL-TEXT-variant-mode@v-man')).toHaveTextContent(/mode unavailable/i),
    );
    const manRow = screen.getByText('SKN-MAN').closest('tr') as HTMLElement;
    await user.click(within(manRow).getByRole('button', { name: /^edit$/i }));
    const form = byTrace('EL-FORM-edit-variant-form@v-man');
    expect(within(form).queryByLabelText(/^price/i)).not.toBeInTheDocument();
  });
});

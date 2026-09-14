import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SetRow } from '@/lib/api/accounting';

/**
 * Set pricing on the bundle form (minirue-dashboard#65). System price takes a
 * saving and shows the backend's price, floor, margin and why read-only; My
 * price takes a typed price with a floor warning. Both save through
 * `PUT /v1/accounting/sets/:id` (backend#166). `apiFetch` is mocked, so the
 * wire bodies are asserted as the backend receives them.
 */

jest.mock('@/lib/api/client', () => ({
  apiFetch: jest.fn(),
  errorMessageToText: (_e: unknown, fallback: string) => fallback,
}));
const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: jest.fn() }) }));
jest.mock('@/components/dashboard/CatalogSubnav', () => () => null);
jest.mock('@/components/dashboard/ImageField', () => () => null);
jest.mock('@/lib/catalog/api', () => ({
  listProducts: jest.fn(async () => ({ items: [], total: 0 })),
  getProduct: jest.fn(),
}));

import { apiFetch } from '@/lib/api/client';
import BundleForm from '@/app/dashboard/bundles/BundleForm';

const mockFetch = apiFetch as jest.Mock;

const bundle = {
  id: 'b-1',
  slug: 'evening-set',
  name: 'Evening Set',
  description: null,
  imageUrl: null,
  imageMediaId: null,
  priceMinor: 120000,
  currency: 'EGP',
  listTotalMinor: 167800,
  savingMinor: 47800,
  isActive: true,
  ownerCustomerId: null,
  expiresAt: null,
  usedCount: 0,
  inStock: true,
  members: [
    { productId: 'p-a', variantId: 'v-a', quantity: 1 },
    { productId: 'p-b', variantId: 'v-b', quantity: 1 },
  ],
};

const floors = { law1Minor: 139750, noLossMinor: 135000, law1ShownMinor: 139900, noLossShownMinor: 135900 };

function setRow(over: Partial<SetRow> = {}): SetRow {
  return {
    bundleId: 'b-1',
    slug: 'evening-set',
    name: 'Evening Set',
    isActive: true,
    mode: 'MANUAL',
    savingBp: null,
    effectiveSavingBp: 1000,
    currentPriceMinor: 120000,
    members: [],
    listTotalMinor: 167800,
    costMinor: 135000,
    system: {
      priceMinor: 155900,
      floors,
      band: null,
      marketMinor: null,
      marginBp: 1340,
      markupBp: null,
      productProfitMinor: 16150,
      orderProfitMinor: 26150,
      flags: [],
      trace: [],
    },
    why: 'The pieces cost 1,678.00 bought separately, less a saving of 10%.',
    current: { marginBp: -1250, markupBp: null, productProfitMinor: -19750, orderProfitMinor: -9750 },
    warnings: [],
    ...over,
  };
}

function serve(first: SetRow, afterPut: SetRow) {
  let current = first;
  mockFetch.mockImplementation((path: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (path === '/admin/bundles/b-1' && method === 'GET') return Promise.resolve(bundle);
    if (path === '/accounting/overview') return Promise.resolve({ sets: [current], variants: [] });
    if (path === '/accounting/sets/b-1' && method === 'PUT') {
      current = afterPut;
      return Promise.resolve({ run: {}, overview: { sets: [afterPut], variants: [] } });
    }
    return Promise.reject({ status: 404, message: `unmocked ${method} ${path}` });
  });
}

function puts() {
  return mockFetch.mock.calls
    .filter(([, init]) => init?.method === 'PUT')
    .map(([path, init]) => ({ path, body: JSON.parse(init.body) }));
}

beforeEach(() => mockFetch.mockReset());
afterEach(() => cleanup());

describe('BundleForm set pricing', () => {
  it('switches a set to System price with the saving, then shows the price, floor, margin and why', async () => {
    const saved = setRow({
      mode: 'SYSTEM',
      savingBp: 1500,
      effectiveSavingBp: 1500,
      currentPriceMinor: 142900,
      current: { marginBp: 553, markupBp: null, productProfitMinor: 3150, orderProfitMinor: 13150 },
      why: 'The pieces cost 1,678.00, less a saving of 15%.',
    });
    serve(setRow(), saved);
    const user = userEvent.setup();
    render(<BundleForm mode="edit" bundleId="b-1" />);

    expect(await screen.findByRole('heading', { name: 'System price' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My price' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'My price' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'System price' }));
    const saving = screen.getByLabelText('Saving off the pieces (%)');
    await user.clear(saving);
    await user.type(saving, '15');
    await user.click(screen.getByRole('button', { name: 'Save System price' }));

    await waitFor(() => expect(puts()).toEqual([{ path: '/accounting/sets/b-1', body: { mode: 'SYSTEM', savingBp: 1500 } }]));
    const result = await screen.findByLabelText('System price, read-only');
    expect(result).toHaveTextContent('EGP 1,429.00');
    expect(result).toHaveTextContent('EGP 1,399.00');
    expect(result).toHaveTextContent('5.5%');
    expect(result).toHaveTextContent('less a saving of 15%');
  });

  it('saves a typed My price and warns when it is under the floor', async () => {
    serve(setRow({ mode: 'SYSTEM', currentPriceMinor: 155900 }), setRow({ currentPriceMinor: 130000 }));
    const user = userEvent.setup();
    render(<BundleForm mode="edit" bundleId="b-1" />);

    await user.click(await screen.findByRole('radio', { name: 'My price' }));
    const price = screen.getByLabelText(/price for the whole set/i);
    await user.clear(price);
    await user.type(price, '1300');
    expect(screen.getByText(/below the no-loss floor of EGP 1,359\.00/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save My price' }));
    await waitFor(() =>
      expect(puts()).toEqual([{ path: '/accounting/sets/b-1', body: { mode: 'MANUAL', manualPriceMinor: 130000 } }]),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Saved on My price — EGP 1,300.00.');
  });
});

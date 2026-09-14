import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import type { PricingWarning } from '@/lib/api/accounting';

/**
 * DA-5b (minirue-dashboard#61). The Warnings tab lists the `warnings/check`
 * items grouped by kind, each linking to the row that needs fixing, and the
 * product edit page carries a yellow badge with that product's count.
 */

const replace = jest.fn();
let search = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
  usePathname: () => '/accounting',
  useSearchParams: () => search,
  useParams: () => ({ slug: 'p1' }),
}));
jest.mock('@/lib/hooks/use-pricing-warnings', () => ({ usePricingWarnings: jest.fn() }));

import { usePricingWarnings } from '@/lib/hooks/use-pricing-warnings';
import WarningsTab, { groupWarnings, warningHref } from '@/app/dashboard/accounting/WarningsTab';

const mockWarnings = usePricingWarnings as jest.Mock;
const recheck = jest.fn();

/** Shaped exactly like backend deriveWarnings() output. */
function variantWarning(kind: string, variantId: string, productId: string, title: string): PricingWarning {
  return { key: `${kind}:${variantId}`, kind, variantId, productId, title, detail: `${title} detail` };
}
const ITEMS: PricingWarning[] = [
  variantWarning('THIN_MARGIN', 'v2', 'p2', 'Billie Eilish 50ml has a thin margin (8%)'),
  variantWarning('LOSES_MONEY', 'v1', 'p1', 'REVOX PLEX 250ml loses money at 649 EGP'),
  variantWarning('NO_COST', 'v3', 'p1', 'REVOX PLEX 500ml has no cost'),
  // A set warning: variantId and productId null, bundle id only in the key.
  { key: 'LOSES_MONEY:b1', kind: 'LOSES_MONEY', variantId: null, productId: null, title: 'Glow set loses money', detail: 'd' },
  {
    key: 'OFFER_BELOW_LAW1:shop',
    kind: 'OFFER_BELOW_LAW1',
    variantId: null,
    productId: null,
    title: 'The running offer puts 2 products below Law 1',
    detail: 'd',
    count: 2,
  },
];

function withItems(items: PricingWarning[], byProduct: Record<string, number> = { p1: 2, p2: 1 }) {
  mockWarnings.mockReturnValue({ total: items.length, byProduct, items, isLoading: false, isError: false, recheck });
}

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  search = new URLSearchParams();
});

describe('warningHref', () => {
  it('opens a variant in the Prices tab', () => {
    expect(warningHref(ITEMS[1])).toBe('/accounting?tab=prices&open=v1');
  });
  it('opens a set in the Prices tab, reading the bundle id from the key', () => {
    expect(warningHref(ITEMS[3])).toBe('/accounting?tab=prices&openSet=b1');
  });
  it('sends a shop-wide offer warning to Discounts', () => {
    expect(warningHref(ITEMS[4])).toBe('/discounts');
  });
});

describe('groupWarnings', () => {
  it('groups by kind, worst first, keeping item order inside a group', () => {
    const groups = groupWarnings(ITEMS);
    expect(groups.map((g) => g.kind)).toEqual(['LOSES_MONEY', 'OFFER_BELOW_LAW1', 'THIN_MARGIN', 'NO_COST']);
    expect(groups[0].items.map((i) => i.key)).toEqual(['LOSES_MONEY:v1', 'LOSES_MONEY:b1']);
  });
  it('keeps an unknown kind from a newer backend, last', () => {
    const groups = groupWarnings([variantWarning('NEW_KIND', 'v9', 'p9', 'x'), ITEMS[1]]);
    expect(groups.map((g) => g.kind)).toEqual(['LOSES_MONEY', 'NEW_KIND']);
  });
});

describe('WarningsTab', () => {
  it('shows each kind as a titled group with what to do, and every item as a link', () => {
    withItems(ITEMS);
    render(<WarningsTab />);

    const loses = screen.getByRole('region', { name: /Loses money/ });
    expect(within(loses).getByText(/raise the price/i)).toBeInTheDocument();
    const link = within(loses).getByRole('link', { name: /REVOX PLEX 250ml loses money at 649 EGP/ });
    expect(link).toHaveAttribute('href', '/accounting?tab=prices&open=v1');
    expect(within(loses).getByRole('link', { name: /Glow set loses money/ })).toHaveAttribute(
      'href',
      '/accounting?tab=prices&openSet=b1',
    );

    const offer = screen.getByRole('region', { name: /Offer puts products below Law 1/ });
    expect(within(offer).getByRole('link', { name: /running offer/ })).toHaveAttribute('href', '/discounts');

    expect(screen.getAllByRole('link')).toHaveLength(ITEMS.length);
    expect(screen.getByText('5 warnings')).toBeInTheDocument();
  });

  it('filters to one product from ?product=, and can show all again', () => {
    search = new URLSearchParams('tab=warnings&product=p1');
    withItems(ITEMS);
    render(<WarningsTab />);

    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.queryByText(/Billie Eilish/)).toBeNull();
    expect(screen.getByText(/2 warnings for this product/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show all warnings' }));
    expect(replace).toHaveBeenCalledWith('/accounting?tab=warnings', { scroll: false });
  });

  it('says so plainly when there is nothing to fix', () => {
    withItems([], {});
    render(<WarningsTab />);
    expect(screen.getByText(/No pricing warnings/)).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('checks again on request', () => {
    withItems(ITEMS);
    render(<WarningsTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(recheck).toHaveBeenCalledTimes(1);
  });
});

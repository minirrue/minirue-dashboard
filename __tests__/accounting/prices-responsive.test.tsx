import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AccountingOverview, SetRow, VariantRow } from '@/lib/api/accounting';
import type { GroundPrices } from '@/lib/api/ground-pricing';
import PricesTab from '@/app/dashboard/accounting/PricesTab';

jest.mock('@/lib/api/accounting', () => ({ apiAccountingOverview: jest.fn() }));
jest.mock('@/lib/catalog/api', () => ({ listProducts: jest.fn() }));
jest.mock('@/lib/api/ground-pricing', () => ({
  getGroundPrices: jest.fn(), undoGroundPrices: jest.fn(),
  groundItemKey: (item: { kind: string; id: string }) => `${item.kind}:${item.id}`,
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  usePathname: () => '/accounting',
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/components/dashboard/AnimatedControls', () => ({
  MenuSelect: ({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) =>
    <select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>,
}));
jest.mock('@/app/dashboard/accounting/PricingDrawer', () => ({
  __esModule: true, default: ({ row, onClose }: { row: VariantRow; onClose: () => void }) => <div role="dialog" aria-label={`Online editor · ${row.productName}`}><button onClick={onClose}>Close online editor</button></div>,
  FLAG_LABELS: {}, MODE: { SYSTEM: { label: 'System price' }, MANUAL: { label: 'My price' } },
  formatSignedEgp: (value: number) => `${value}`,
}));
jest.mock('@/app/dashboard/accounting/GroundPriceEditor', () => ({
  __esModule: true, default: ({ onClose }: { onClose: () => void }) => <div role="dialog" aria-label="Ground editor"><button onClick={onClose}>Close Ground editor</button></div>,
}));
jest.mock('@/app/dashboard/accounting/DownScrollHeader', () => ({ __esModule: true, default: () => null }));

import { apiAccountingOverview } from '@/lib/api/accounting';
import { listProducts } from '@/lib/catalog/api';
import { getGroundPrices } from '@/lib/api/ground-pricing';

const longSku = 'SKN-REVOX-VERY-LONG-IDENTIFIER-STEP-SIX-EXCLUSIVE-2026';
const variant = {
  variantId: 'v1', productId: 'p1', productName: 'REVOX PLEX', sku: longSku, isActive: true, mode: 'SYSTEM',
  costMinor: 65000, currentPriceMinor: 80900,
  current: { marginBp: -250, productProfitMinor: -5000 },
  system: { marketMinor: 86000, floors: { law1ShownMinor: 69900, noLossShownMinor: 65900 }, flags: ['NO_COST'] },
} as unknown as VariantRow;
const set = {
  bundleId: 'b1', name: 'Evening Set', isActive: true, mode: 'MANUAL', effectiveSavingBp: 1000,
  members: [{ productId: 'p1' }], costMinor: 135000, currentPriceMinor: 120000,
  current: { marginBp: -1250, productProfitMinor: -19750 },
  system: { floors: { law1ShownMinor: 139900, noLossShownMinor: 135900 } },
  warnings: [{ title: 'Evening Set loses money' }],
} as unknown as SetRow;
const ground: GroundPrices = {
  revision: 1, rule: { type: 'PERCENT', value: 1000 }, items: [
    { id: 'v1', kind: 'VARIANT', name: 'REVOX PLEX', sku: longSku, onlinePriceMinor: 72810, groundPriceMinor: 80091, costMinor: 65000, marginBp: -100, mode: 'SYSTEM', rule: null },
    { id: 'b1', kind: 'BUNDLE', name: 'Evening Set', sku: 'BND-EVENING-SET-EXTENDED-SKU-2026', onlinePriceMinor: 119000, groundPriceMinor: 145000, costMinor: 135000, marginBp: 690, mode: 'MANUAL', rule: null },
  ],
};

beforeEach(() => {
  (apiAccountingOverview as jest.Mock).mockResolvedValue({ variants: [variant], sets: [set], fees: { fulfillmentMinor: 4750 } } as AccountingOverview);
  (listProducts as jest.Mock).mockResolvedValue({ items: [] });
  (getGroundPrices as jest.Mock).mockResolvedValue(ground);
  Element.prototype.scrollIntoView = jest.fn();
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(() => jest.clearAllMocks());

it('keeps list, current online and Ground values distinct in each record summary', async () => {
  render(<PricesTab />);
  const table = await screen.findByRole('table', { name: 'Prices' });
  await screen.findAllByText(/Current online:/);
  const [variantRow, setRow] = within(table).getAllByRole('row').slice(1);
  expect(within(variantRow).getByText(/Online list price/).closest('td')).toHaveTextContent('809.00');
  expect(within(variantRow).getByText('Ground price', { exact: true }).closest('td')).toHaveTextContent('800.91');
  expect(variantRow).toHaveTextContent('Current online: EGP 728.10');
  expect(within(setRow).getByText(/Online list price/).closest('td')).toHaveTextContent('1,200.00');
  expect(within(setRow).getByText('Ground price', { exact: true }).closest('td')).toHaveTextContent('1,450.00');
  expect(setRow).toHaveTextContent('Current online: EGP 1,190.00');
  expect(setRow).toHaveTextContent('SKU: BND-EVENING-SET-EXTENDED-SKU-2026');
});

it('reveals full SKU and secondary economics for variants and sets without changing editors', async () => {
  render(<PricesTab />);
  const table = await screen.findByRole('table', { name: 'Prices' });
  await screen.findAllByText(/Current online:/);
  const [variantRow, setRow] = within(table).getAllByRole('row').slice(1);
  const sku = within(variantRow).getByRole('button', { name: /show full sku/i });
  expect(sku).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(sku);
  expect(sku).toHaveAttribute('aria-expanded', 'true');
  expect(within(variantRow).getByText(longSku, { exact: true })).toBeInTheDocument();
  for (const row of [variantRow, setRow]) {
    const details = within(row).getByRole('button', { name: /show details/i });
    fireEvent.click(details);
    expect(details).toHaveAttribute('aria-expanded', 'true');
    expect(row).toHaveTextContent('Cost');
    expect(row).toHaveTextContent('Margin');
    expect(row).toHaveTextContent('Profit');
    fireEvent.click(details);
    expect(details).toHaveAttribute('aria-expanded', 'false');
  }
  expect(variantRow).toHaveTextContent('−2.5%');
  expect(setRow).toHaveTextContent('Below no-loss');
  fireEvent.click(within(variantRow).getByRole('button', { name: 'Edit online' }));
  expect(screen.getByRole('dialog', { name: /Online editor/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close online editor' }));
  fireEvent.click(within(variantRow).getByRole('button', { name: 'Edit Ground' }));
  expect(screen.getByRole('dialog', { name: 'Ground editor' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close Ground editor' }));
});

it('preserves selection across pagination and filtering while Ground sorting uses server values', async () => {
  const variants = Array.from({ length: 21 }, (_, index) => ({ ...variant, variantId: `v${index + 1}`, productName: `Product ${index + 1}`, sku: `SKU-${index + 1}` }));
  (apiAccountingOverview as jest.Mock).mockResolvedValue({ variants, sets: [], fees: { fulfillmentMinor: 4750 } });
  (getGroundPrices as jest.Mock).mockResolvedValue({ ...ground, items: variants.map((row, index) => ({ ...ground.items[0], id: row.variantId, name: row.productName, groundPriceMinor: 90000 + index * 100 })) });
  render(<div className="dash-shell"><div className="dash-main"><PricesTab /></div></div>);
  const table = await screen.findByRole('table', { name: 'Prices' });
  await screen.findAllByText(/Current online:/);
  fireEvent.click(within(table).getAllByRole('row')[1].querySelector('input[type="checkbox"]')!);
  expect(screen.getByText('1 selected')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(within(table).getAllByRole('row')).toHaveLength(2);
  expect(screen.getByText('1 selected')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'GROUND_DESC' } });
  expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Product 21');
  fireEvent.change(screen.getByLabelText('Search prices by product, SKU or set name'), { target: { value: 'Product 1' } });
  await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(12));
  expect(screen.getByText('1 selected')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select this page for Ground pricing' }));
  expect(screen.getByText('11 selected')).toBeInTheDocument();
});

it('keeps Ground unavailable and selection disabled while the Ground read fails', async () => {
  (getGroundPrices as jest.Mock).mockRejectedValue(new Error('offline'));
  render(<PricesTab />);
  const table = await screen.findByRole('table', { name: 'Prices' });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Ground prices could not load'));
  const row = within(table).getAllByRole('row')[1];
  expect(row).toHaveTextContent('Unavailable');
  expect(within(row).getByRole('button', { name: 'Edit Ground' })).toBeDisabled();
  expect(within(row).getByRole('checkbox')).toBeDisabled();
});

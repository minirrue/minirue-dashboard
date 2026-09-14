import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import type { GrowthReport, SpendEntry } from '@/lib/api/accounting';

/**
 * PG-DASHBOARD-ACCTG-008 (minirue-dashboard#64). The Growth tab renders the
 * backend `GrowthReport` (backend#165) with every figure's n and low-data note,
 * and the spend log writes through `POST/PATCH/DELETE /v1/accounting/spend`,
 * refetching growth after each write. `apiFetch` is mocked, so wire bodies are
 * asserted against the backend schema.
 */

jest.mock('@/lib/api/client', () => ({ apiFetch: jest.fn() }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { apiFetch } from '@/lib/api/client';
import GrowthTab from '@/app/dashboard/accounting/GrowthTab';

const mockFetch = apiFetch as jest.Mock;

/** backend#165's fixture figures. */
const report: GrowthReport = {
  period: { from: '2026-03-01', to: '2026-03-31' },
  lowDataThreshold: 20,
  paybackOrders: 3,
  orderProfit: { n: 5, knownN: 4, unknownN: 1, totalMinor: 86900, avgMinor: 21725, negativeN: 0, lowData: true },
  delivery: {
    deliveryFeeMinor: 10000,
    fulfillmentMinor: 4750,
    surplusMinor: 5250,
    freeDeliveryBreakEvenLiftPct: 85.3,
    n: 5,
    lowData: true,
  },
  channels: [
    {
      channel: 'META',
      spendMinor: 332000,
      newCustomers: 2,
      cacMinor: 166000,
      firstOrderProfit: { avgMinor: 16150, n: 1, unknownN: 1 },
      paybackOrders: 10.28,
      leak: true,
      n: 2,
      lowData: true,
    },
    {
      channel: 'TIKTOK',
      spendMinor: 100000,
      newCustomers: 1,
      cacMinor: 100000,
      firstOrderProfit: { avgMinor: 45250, n: 1, unknownN: 0 },
      paybackOrders: 2.21,
      leak: false,
      n: 1,
      lowData: true,
    },
  ],
  newCustomers: { count: 3, n: 4, lowData: true },
  repeat: { orders: 1, n: 4, rate: 0.25, lowData: true },
  refused: { count: 1, n: 5, rate: 0.2, lowData: true },
  cancelled: { count: 1, n: 6, rate: 0.1667, lowData: true },
};

const entry: SpendEntry = {
  id: '11111111-1111-4111-8111-111111111111',
  channel: 'META',
  campaign: 'Eid reels',
  utmCampaign: 'eid-reels',
  discountCode: null,
  spentFrom: '2026-03-01',
  spentTo: '2026-03-10',
  amountMinor: 300000,
  note: null,
  createdBy: null,
  createdAt: '2026-03-01T10:00:00Z',
};

let spend: SpendEntry[];

beforeEach(() => {
  spend = [entry];
  mockFetch.mockReset();
  mockFetch.mockImplementation((path: string, init?: { method?: string; body?: string }) => {
    const method = init?.method ?? 'GET';
    if (path.startsWith('/accounting/growth')) return Promise.resolve(report);
    if (path === '/accounting/spend' && method === 'GET') return Promise.resolve(spend);
    if (path === '/accounting/spend' && method === 'POST') {
      const created = { ...entry, ...JSON.parse(init!.body!), id: 'new' };
      spend = [created, ...spend];
      return Promise.resolve(created);
    }
    if (path.startsWith('/accounting/spend/') && method === 'PATCH') {
      spend = spend.map((s) => (s.id === entry.id ? { ...s, ...JSON.parse(init!.body!) } : s));
      return Promise.resolve(spend[0]);
    }
    if (path.startsWith('/accounting/spend/') && method === 'DELETE') {
      spend = [];
      return Promise.resolve(undefined);
    }
    return Promise.reject(new Error(`unexpected ${method} ${path}`));
  });
});

const calls = (method: string) =>
  mockFetch.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method);
const growthGets = () => mockFetch.mock.calls.filter(([p]) => String(p).startsWith('/accounting/growth')).length;

describe('GrowthTab', () => {
  it('shows the cards and channels with their n, low-data notes and the explainers', async () => {
    render(<GrowthTab />);
    expect(await screen.findByText('EGP 869')).toBeInTheDocument();
    expect(screen.getByText(/n 5 · avg EGP 217.25 · 1 with an unknown cost, left out · Low data, under 20/)).toBeInTheDocument();
    expect(screen.getByText(/85.3% more orders to break even · n 5/)).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText(/1 of n 5 shipments failed or came back/)).toBeInTheDocument();

    const table = screen.getByRole('table');
    const meta = within(table).getByRole('row', { name: /Meta/ });
    expect(within(meta).getByText('EGP 3,320')).toBeInTheDocument();
    expect(within(meta).getByText('EGP 1,660')).toBeInTheDocument();
    expect(within(meta).getByText('10.3 orders')).toBeInTheDocument();
    expect(within(meta).getByText('Leaking')).toBeInTheDocument();
    expect(within(meta).getByText(/n 1 · 1 unknown/)).toBeInTheDocument();
    expect(within(meta).getByText('Low data')).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /TikTok/ })).toHaveTextContent('Pays back');

    expect(screen.getByText(/costs more than 3 first orders earn/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Analytics → Products' })).toHaveAttribute(
      'href',
      '/analytics/products',
    );
  });

  it('adds spend with the backend body and refetches growth', async () => {
    render(<GrowthTab />);
    await screen.findByText('Eid reels');
    fireEvent.click(screen.getByRole('button', { name: 'Log spend' }));
    const form = screen.getByRole('form', { name: 'Log spend' });
    fireEvent.change(within(form).getByLabelText('Channel'), { target: { value: 'TIKTOK' } });
    fireEvent.change(within(form).getByLabelText('Campaign'), { target: { value: ' Lip oil ' } });
    fireEvent.change(within(form).getByLabelText('Amount spent (EGP)'), { target: { value: '1500.50' } });
    fireEvent.change(within(form).getByLabelText('First day'), { target: { value: '2026-03-02' } });
    fireEvent.change(within(form).getByLabelText('Last day'), { target: { value: '2026-03-05' } });
    fireEvent.change(within(form).getByLabelText('Discount code (optional)'), { target: { value: 'LIP10' } });
    const before = growthGets();
    fireEvent.click(within(form).getByRole('button', { name: 'Add spend' }));

    await screen.findByText('Spend added. Growth is updated.');
    expect(JSON.parse(calls('POST')[0][1].body)).toEqual({
      channel: 'TIKTOK',
      campaign: 'Lip oil',
      amountMinor: 150050,
      spentFrom: '2026-03-02',
      spentTo: '2026-03-05',
      utmCampaign: null,
      discountCode: 'LIP10',
      note: null,
    });
    await waitFor(() => expect(growthGets()).toBe(before + 1));
  });

  it('refuses an invalid spend without a request', async () => {
    render(<GrowthTab />);
    await screen.findByText('Eid reels');
    fireEvent.click(screen.getByRole('button', { name: 'Log spend' }));
    const form = screen.getByRole('form', { name: 'Log spend' });
    fireEvent.change(within(form).getByLabelText('First day'), { target: { value: '2026-03-05' } });
    fireEvent.change(within(form).getByLabelText('Last day'), { target: { value: '2026-03-01' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add spend' }));
    expect(await screen.findByText('Name the campaign.')).toBeInTheDocument();
    expect(screen.getByText('The last day is before the first.')).toBeInTheDocument();
    expect(calls('POST')).toHaveLength(0);
  });

  it('edits spend by sending only the changed fields', async () => {
    render(<GrowthTab />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Eid reels' }));
    const form = screen.getByRole('form', { name: 'Edit spend' });
    expect(within(form).getByLabelText('Amount spent (EGP)')).toHaveValue('3000');
    fireEvent.change(within(form).getByLabelText('Amount spent (EGP)'), { target: { value: '3200' } });
    fireEvent.change(within(form).getByLabelText('utm_campaign (optional)'), { target: { value: '' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save spend' }));

    await screen.findByText('Spend saved. Growth is updated.');
    const [path, init] = calls('PATCH')[0];
    expect(path).toBe(`/accounting/spend/${entry.id}`);
    expect(JSON.parse(init.body)).toEqual({ amountMinor: 320000, utmCampaign: null });
  });

  it('deletes spend after a confirm step', async () => {
    render(<GrowthTab />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Eid reels' }));
    expect(calls('DELETE')).toHaveLength(0);
    fireEvent.click(within(screen.getByRole('group', { name: 'Delete Eid reels?' })).getByRole('button', { name: 'Delete' }));
    await screen.findByText('Spend deleted. Growth is updated.');
    expect(calls('DELETE')[0][0]).toBe(`/accounting/spend/${entry.id}`);
    expect(await screen.findByText(/Nothing logged yet/)).toBeInTheDocument();
  });

  it('builds a tagged link once source, medium and campaign are filled', async () => {
    render(<GrowthTab />);
    await screen.findByText('EGP 869');
    expect(screen.getByText('Fill in source, medium and campaign to get the link.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Shop page'), { target: { value: '/products/revox-plex' } });
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'facebook' } });
    fireEvent.change(screen.getByLabelText('Campaign'), { target: { value: 'Eid Reels' } });
    expect(
      screen.getByText(
        'https://minirueshop.com/products/revox-plex?utm_source=facebook&utm_medium=paid_social&utm_campaign=eid-reels',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GiveawayClient, {
  egpToMinor,
  fromTwelveHourTime,
  minorToEgp,
  toTwelveHourTime,
} from '@/app/dashboard/giveaway/GiveawayClient';
import { NAV_ITEMS, isNavItemVisible } from '@/components/dashboard/DashboardSidebar';
import { Role } from '@/lib/auth/role';
import { apiFetch } from '@/lib/api/client';
import type { GiveawayView } from '@/lib/api/giveaway';

jest.mock('@/lib/api/client', () => ({
  ...jest.requireActual('@/lib/api/client'),
  apiFetch: jest.fn(),
}));

jest.mock('@/components/dashboard/GalleryPickerModal', () => () => null);

const mockFetch = apiFetch as jest.Mock;

const config = {
  id: 'giveaway-1',
  pool: 'BOOTH' as const,
  day: '2026-09-30',
  enabled: true,
  minSpendMinor: 100000,
  countShipping: false,
  revealTime: '22:00',
  revealAt: '2026-09-30T19:00:00.000Z',
  title: 'Tonight’s giveaway',
  prizeTitle: 'MiniRue bundle',
  prizeDescription: 'A complete skincare bundle.',
  prizeGalleryItemId: null,
  terms: 'One entry per qualifying buyer.',
  version: 1,
  updatedAt: '2026-09-30T10:00:00.000Z',
};

const entrant = {
  key: 'customer-1',
  registered: true,
  fullName: 'Mariam Adel',
  firstName: 'Mariam',
  lastName: 'Adel',
  phone: '01000001234',
  email: 'mariam@example.test',
  totalMinor: 125050,
  orders: [{ orderId: 'order-1', orderNumber: 'MR-42', spendMinor: 125050 }],
  eligible: true,
  qualifiedAt: '2026-09-30T11:00:00.000Z',
  hidden: false,
  publicName: 'Mariam A.',
  phoneTail: '1234',
};

function view(overrides: Partial<GiveawayView> = {}): GiveawayView {
  return {
    pool: 'BOOTH',
    day: '2026-09-30',
    today: '2026-09-30',
    timezone: 'Africa/Cairo',
    serverTime: '2026-09-30T12:00:00.000Z',
    giveaway: config,
    prize: null,
    defaults: null,
    publicState: 'OPEN',
    entrants: [entrant],
    frozenKeys: null,
    draw: null,
    audit: [],
    ...overrides,
  };
}

function renderClient(response: GiveawayView) {
  mockFetch.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith('/admin/giveaways?')) return Promise.resolve(response);
    if (init?.method === 'PUT') return Promise.resolve(config);
    if (init?.method === 'POST') return Promise.resolve({ ok: true });
    return Promise.reject({ status: 404, message: `unmocked ${init?.method ?? 'GET'} ${path}` });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GiveawayClient />
    </QueryClientProvider>,
  );
}

beforeEach(() => mockFetch.mockReset());
afterEach(() => cleanup());

describe('giveaway value conversions', () => {
  it('converts EGP and piastres without losing two-decimal values', () => {
    expect(egpToMinor('1000')).toBe(100000);
    expect(egpToMinor('1234.56')).toBe(123456);
    expect(minorToEgp(123456)).toBe('1234.56');
  });

  it('converts between the 12-hour control and backend HH:mm values', () => {
    expect(toTwelveHourTime('00:05')).toEqual({ hour: '12', minute: '05', period: 'AM' });
    expect(toTwelveHourTime('22:30')).toEqual({ hour: '10', minute: '30', period: 'PM' });
    expect(fromTwelveHourTime('12', '05', 'AM')).toBe('00:05');
    expect(fromTwelveHourTime('10', '30', 'PM')).toBe('22:30');
  });
});

describe('GiveawayClient', () => {
  it('sends the exact PUT body from the editable form', async () => {
    const user = userEvent.setup();
    renderClient(view());

    const minimum = await screen.findByLabelText('Minimum spend (EGP)');
    await user.clear(minimum);
    await user.type(minimum, '1250.50');
    await user.click(screen.getByRole('button', { name: 'Save giveaway' }));

    await waitFor(() => {
      const put = mockFetch.mock.calls.find(([, init]) => init?.method === 'PUT');
      expect(put).toBeDefined();
      expect(put![0]).toBe('/admin/giveaways/BOOTH/2026-09-30');
      expect(JSON.parse(put![1].body)).toEqual({
        enabled: true,
        minSpendMinor: 125050,
        countShipping: false,
        revealTime: '22:00',
        title: 'Tonight’s giveaway',
        prizeTitle: 'MiniRue bundle',
        prizeDescription: 'A complete skincare bundle.',
        prizeGalleryItemId: null,
        terms: 'One entry per qualifying buyer.',
      });
    });
  });

  it('calls the random draw endpoint only after confirmation', async () => {
    const user = userEvent.setup();
    renderClient(view());

    await user.click(await screen.findByRole('button', { name: 'Draw a random winner' }));
    expect(mockFetch).not.toHaveBeenCalledWith('/admin/giveaways/giveaway-1/draw', expect.anything());
    await user.click(screen.getByRole('button', { name: 'Confirm draw' }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      '/admin/giveaways/giveaway-1/draw',
      expect.objectContaining({ method: 'POST', auth: true }),
    ));
  });

  it('sends the void reason to the right endpoint after confirmation', async () => {
    const user = userEvent.setup();
    renderClient(view({
      publicState: 'DRAWN',
      draw: {
        method: 'RANDOM',
        drawnAt: '2026-09-30T12:05:00.000Z',
        drawnBy: 'Admin',
        entrantCount: 1,
        listHash: 'hash',
        winner: {
          key: 'customer-1',
          ref: 'MR-42',
          publicName: 'Mariam A.',
          phoneTail: '1234',
          fullName: 'Mariam Adel',
          phone: '01000001234',
          email: 'mariam@example.test',
          registered: true,
          totalMinor: 125050,
          orders: [{ orderId: 'order-1', orderNumber: 'MR-42', spendMinor: 125050 }],
        },
        winnerStillEligible: true,
      },
    }));

    await user.click(await screen.findByRole('button', { name: 'Void draw' }));
    await user.type(screen.getByLabelText('Reason for voiding'), 'Winner could not be contacted.');
    await user.click(screen.getByRole('button', { name: 'Confirm void' }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      '/admin/giveaways/giveaway-1/void',
      expect.objectContaining({
        method: 'POST',
        auth: true,
        body: JSON.stringify({ reason: 'Winner could not be contacted.' }),
      }),
    ));
  });

  it('keeps entrant identity, total, secondary details, and keyboard-accessible actions together', async () => {
    const user = userEvent.setup();
    renderClient(view());

    const row = (await screen.findByText('Mariam Adel')).closest('li');
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent('EGP 1,250.50');
    const details = screen.getByRole('button', { name: 'Details for Mariam Adel' });
    expect(details).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('01000001234')).not.toBeInTheDocument();
    details.focus();
    await user.keyboard('[Enter]');
    expect(details).toHaveAttribute('aria-expanded', 'true');
    expect(row).toHaveTextContent('01000001234');
    expect(row).toHaveTextContent('MR-42');
    expect(row).toHaveTextContent('Mariam A.');
    await user.click(details);
    expect(details).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('01000001234')).not.toBeInTheDocument();
    const visibility = screen.getByRole('checkbox', { name: 'Hide Mariam Adel' });
    const pick = screen.getByRole('button', { name: 'Pick Mariam Adel as winner' });
    expect(row).toContainElement(visibility);
    expect(row).toContainElement(pick);
    await user.tab();
    visibility.focus();
    await user.keyboard('[Space]');
    expect(await screen.findByRole('dialog', { name: 'Hide Mariam Adel publicly?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    pick.focus();
    await user.keyboard('[Enter]');
    expect(await screen.findByRole('dialog', { name: 'Pick Mariam Adel as the winner?' })).toBeInTheDocument();
  });

  it('replaces HIDE and SHOW identity keys with a known masked public name and omits unknown keys', async () => {
    renderClient(view({
      audit: [
        { id: 'hide', action: 'HIDE', actor: 'Admin', at: config.updatedAt, detail: { key: entrant.key, hidden: true } },
        { id: 'show', action: 'SHOW', actor: 'Admin', at: config.updatedAt, detail: { key: 'phone:secret-hash', hidden: false } },
      ],
    }));
    const activity = (await screen.findByRole('heading', { name: 'Activity' })).closest('section');
    expect(activity).toHaveTextContent('Mariam A.');
    expect(activity).toHaveTextContent('hidden: true');
    expect(activity).toHaveTextContent('hidden: false');
    expect(activity).not.toHaveTextContent('customer-1');
    expect(activity).not.toHaveTextContent('phone:secret-hash');
  });

  it('keeps Giveaway out of the STAFF navigation while showing it to admins', () => {
    const item = NAV_ITEMS.flatMap((group) => group.items).find((entry) => entry.href === '/giveaway');
    expect(item).toBeDefined();
    expect(isNavItemVisible(Role.STAFF, item!)).toBe(false);
    expect(isNavItemVisible(Role.ADMIN, item!)).toBe(true);
    expect(isNavItemVisible(Role.SUPERADMIN, item!)).toBe(true);
  });
});

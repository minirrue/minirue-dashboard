import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GiveawayClient, {
  egpToMinor,
  fromTwelveHourTime,
  isFutureReveal,
  latestFirst,
  minorToEgp,
  toTwelveHourTime,
} from '@/app/dashboard/giveaway/GiveawayClient';
import { NAV_ITEMS, isNavItemVisible } from '@/components/dashboard/DashboardSidebar';
import { Role } from '@/lib/auth/role';
import { apiFetch } from '@/lib/api/client';
import type { GiveawayDraw, GiveawayEntrant, GiveawayStats, GiveawayView } from '@/lib/api/giveaway';

jest.mock('@/lib/api/client', () => ({
  ...jest.requireActual('@/lib/api/client'),
  apiFetch: jest.fn(),
}));

jest.mock('@/components/dashboard/GalleryPickerModal', () => () => null);
jest.mock('qrcode', () => ({ toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,x') }));

let mockRole = 'ADMIN';
jest.mock('@/lib/hooks/use-auth', () => ({ useUser: () => ({ data: { role: mockRole } }) }));

const mockFetch = apiFetch as jest.Mock;

// 30 September 2026 in Cairo is UTC+3: 12:00Z is 3:00 PM and the 22:00 reveal is 19:00Z.
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
  prizeProductId: null as string | null,
  prizeTitle: 'MiniRue bundle',
  prizeDescription: 'A complete skincare bundle.',
  prizeGalleryItemId: null as string | null,
  terms: 'One entry per qualifying buyer.',
  version: 1,
  updatedAt: '2026-09-30T10:00:00.000Z',
};

const mariam: GiveawayEntrant = {
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
  excluded: false,
};

const omar: GiveawayEntrant = {
  key: 'customer-2',
  registered: false,
  fullName: 'Omar Fathy',
  firstName: 'Omar',
  lastName: 'Fathy',
  phone: '01000005678',
  email: null,
  totalMinor: 210000,
  orders: [{ orderId: 'order-2', orderNumber: 'MR-51', spendMinor: 210000 }],
  eligible: true,
  qualifiedAt: '2026-09-30T13:30:00.000Z',
  excluded: false,
};

// As the backend sends a removed entrant: still qualified, no longer eligible.
const salma: GiveawayEntrant = {
  key: 'customer-3',
  registered: true,
  fullName: 'Salma Nabil',
  firstName: 'Salma',
  lastName: 'Nabil',
  phone: '01000009999',
  email: null,
  totalMinor: 150000,
  orders: [{ orderId: 'order-3', orderNumber: 'MR-47', spendMinor: 150000 }],
  eligible: false,
  qualifiedAt: '2026-09-30T12:00:00.000Z',
  excluded: true,
};

const hana: GiveawayEntrant = {
  ...omar,
  key: 'customer-4',
  fullName: 'Hana Ali',
  firstName: 'Hana',
  lastName: 'Ali',
  eligible: false,
  totalMinor: 40000,
  qualifiedAt: null,
};

const stats: GiveawayStats = {
  entrantCount: 7,
  eligibleCount: 6,
  excludedCount: 1,
  buyerCount: 9,
  totalSpendMinor: 1234500,
  averageSpendMinor: 137167,
  topSpenders: [
    { key: 'a', fullName: 'Nour Hassan', totalMinor: 420000, orderCount: 3 },
    { key: 'b', fullName: 'Omar Fathy', totalMinor: 210000, orderCount: 1 },
    { key: 'c', fullName: 'Salma Nabil', totalMinor: 150000, orderCount: 2 },
    { key: 'd', fullName: 'Mariam Adel', totalMinor: 125050, orderCount: 1 },
    { key: 'e', fullName: 'Youssef Kamal', totalMinor: 110000, orderCount: 1 },
    { key: 'f', fullName: 'Laila Samir', totalMinor: 100000, orderCount: 1 },
  ],
};

const draw: GiveawayDraw = {
  method: 'RANDOM',
  drawnAt: '2026-09-30T12:05:00.000Z',
  drawnBy: 'Admin',
  entrantCount: 1,
  listHash: 'hash',
  winner: {
    key: 'customer-1',
    ref: 'MR-42',
    fullName: 'Mariam Adel',
    phone: '01000001234',
    email: 'mariam@example.test',
    registered: true,
    totalMinor: 125050,
    orders: [{ orderId: 'order-1', orderNumber: 'MR-42', spendMinor: 125050 }],
  },
  winnerStillEligible: true,
};

const products = [
  {
    id: 'product-9',
    slug: 'vitamin-c-booster-shot',
    name: 'Vitamin C Booster Shot',
    description: 'Brightening vitamin C in single-use shots.',
    brandId: 'brand-1',
    brandName: 'Arencia',
    categoryId: 'cat-1',
    categoryName: 'Serums',
    publishedState: 'PUBLISHED',
    variants: [],
    media: [{ id: 'm1', productId: 'product-9', role: 'COVER', kind: 'image', url: 'https://img.test/vitamin-c.jpg', sortOrder: 0 }],
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'product-4',
    slug: 'retinal-booster-shot',
    name: 'Retinal Booster Shot',
    description: '',
    brandId: 'brand-1',
    brandName: 'Arencia',
    categoryId: 'cat-1',
    categoryName: 'Serums',
    publishedState: 'PUBLISHED',
    variants: [],
    media: [],
    createdAt: '2026-09-01T00:00:00.000Z',
  },
];

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
    entrants: [mariam],
    frozenKeys: null,
    draw: null,
    audit: [],
    stats,
    ...overrides,
  };
}

function renderClient(response: GiveawayView, handlers: {
  put?: () => Promise<unknown>;
  post?: (path: string) => Promise<unknown>;
} = {}) {
  mockFetch.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith('/admin/giveaways?')) return Promise.resolve(response);
    if (path.startsWith('/catalog/admin/products/')) {
      const product = products.find((item) => item.id === path.split('/').pop());
      return product ? Promise.resolve(product) : Promise.reject({ status: 404, message: 'Product not found' });
    }
    if (path.startsWith('/catalog/admin/products')) {
      const search = new URLSearchParams(path.split('?')[1] ?? '').get('search')?.toLowerCase() ?? '';
      const data = products.filter((product) => product.name.toLowerCase().includes(search));
      return Promise.resolve({ data, meta: { total: data.length } });
    }
    if (init?.method === 'PUT') return handlers.put ? handlers.put() : Promise.resolve(config);
    if (init?.method === 'POST') return handlers.post ? handlers.post(path) : Promise.resolve({ ok: true });
    return Promise.reject({ status: 404, message: `unmocked ${init?.method ?? 'GET'} ${path}` });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GiveawayClient />
    </QueryClientProvider>,
  );
}

function putBody() {
  const put = mockFetch.mock.calls.find(([, init]) => init?.method === 'PUT');
  return put ? { path: put[0] as string, body: JSON.parse(put[1].body) } : null;
}

function section(name: string | RegExp): HTMLElement {
  const heading = screen.getByRole('heading', { name });
  const card = heading.closest('section');
  if (!card) throw new Error(`No section for ${String(name)}`);
  return card;
}

beforeEach(() => {
  mockFetch.mockReset();
  mockRole = 'ADMIN';
});
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

  it('orders entrants by the latest qualification first', () => {
    expect(latestFirst([mariam, omar, salma]).map((entrant) => entrant.key)).toEqual(['customer-2', 'customer-3', 'customer-1']);
  });

  it('judges a reveal time against Cairo’s clock, to the minute', () => {
    const now = new Date('2026-09-30T12:00:30.000Z'); // 3:00 PM in Cairo
    expect(isFutureReveal('2026-09-30', '15:01', now)).toBe(true);
    expect(isFutureReveal('2026-09-30', '15:00', now)).toBe(false);
    expect(isFutureReveal('2026-09-30', '12:30', now)).toBe(false);
    expect(isFutureReveal('2026-10-01', '09:00', now)).toBe(true);
  });
});

describe('GiveawayClient settings', () => {
  it('sends the exact PUT body for a custom prize', async () => {
    const user = userEvent.setup();
    renderClient(view());

    const minimum = await screen.findByLabelText('Minimum spend (EGP)');
    await user.clear(minimum);
    await user.type(minimum, '1250.50');
    await user.click(screen.getByRole('button', { name: 'Save giveaway' }));

    await waitFor(() => expect(putBody()).not.toBeNull());
    expect(putBody()).toEqual({
      path: '/admin/giveaways/BOOTH/2026-09-30',
      body: {
        enabled: true,
        minSpendMinor: 125050,
        countShipping: false,
        revealTime: '22:00',
        title: 'Tonight’s giveaway',
        prizeProductId: null,
        prizeTitle: 'MiniRue bundle',
        prizeDescription: 'A complete skincare bundle.',
        prizeGalleryItemId: null,
        terms: 'One entry per qualifying buyer.',
      },
    });
  });

  it('keeps today’s details editable before the reveal and shows a 409 inline', async () => {
    const user = userEvent.setup();
    renderClient(view(), {
      put: () => Promise.reject({ status: 409, message: 'A winner is already drawn. Reset or void the draw before changing who qualifies.' }),
    });

    const minimum = await screen.findByLabelText('Minimum spend (EGP)');
    expect(screen.getByRole('checkbox', { name: 'Page on' })).toBeChecked();
    expect(minimum).toBeEnabled();
    expect(screen.getByLabelText('Title')).toBeEnabled();
    expect(screen.getByLabelText('Prize title')).toBeEnabled();
    expect(screen.getByLabelText('Reveal hour')).toBeEnabled();
    expect(section('Settings')).toHaveTextContent('You can change the prize, reveal time, and minimum spend until the reveal at 10:00 PM.');
    expect(screen.queryByText(/read only/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save giveaway' }));
    expect(await within(section('Settings')).findByRole('alert')).toHaveTextContent(
      'A winner is already drawn. Reset or void the draw before changing who qualifies.',
    );
  });

  it('refuses a new reveal time that has already passed in Cairo, before calling the server', async () => {
    const user = userEvent.setup();
    renderClient(view());

    await user.selectOptions(await screen.findByLabelText('Reveal hour'), '2');
    await user.click(screen.getByRole('button', { name: 'Save giveaway' }));

    expect(await within(section('Settings')).findByRole('alert')).toHaveTextContent('Choose a reveal time later than now. It is 3:00 PM in Cairo.');
    expect(putBody()).toBeNull();

    await user.selectOptions(screen.getByLabelText('Reveal hour'), '11');
    await user.click(screen.getByRole('button', { name: 'Save giveaway' }));
    await waitFor(() => expect(putBody()?.body.revealTime).toBe('23:00'));
  });

  it('locks who qualifies once a winner is drawn, but not the prize', async () => {
    renderClient(view({ draw, publicState: 'DRAWN' }));

    expect(await screen.findByLabelText('Minimum spend (EGP)')).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Count delivery fees toward the minimum' })).toBeDisabled();
    expect(screen.getByLabelText('Prize title')).toBeEnabled();
    expect(screen.getByLabelText('Reveal hour')).toBeEnabled();
    expect(section('Settings')).toHaveTextContent('reset the draw to change who qualifies');
  });

  it('locks the prize, reveal time, and minimum spend after the reveal, leaving only the page switch', async () => {
    const user = userEvent.setup();
    renderClient(view({ serverTime: '2026-09-30T19:30:00.000Z', draw, publicState: 'REVEALED' }));

    expect(await screen.findByLabelText('Minimum spend (EGP)')).toBeDisabled();
    expect(screen.getByLabelText('Title')).toBeDisabled();
    expect(screen.getByLabelText('Prize title')).toBeDisabled();
    expect(screen.getByLabelText('Reveal hour')).toBeDisabled();
    expect(screen.getByText('Revealed · locked')).toBeInTheDocument();
    expect(section('Settings')).toHaveTextContent('The reveal has passed');

    const page = screen.getByRole('checkbox', { name: 'Page on' });
    expect(page).toBeEnabled();
    await user.click(page);
    await user.click(screen.getByRole('button', { name: 'Save giveaway' }));
    await waitFor(() => expect(putBody()).not.toBeNull());
    expect(putBody()!.body).toEqual(expect.objectContaining({ enabled: false, revealTime: '22:00', minSpendMinor: 100000 }));
  });

  it('has no prize preview block and explains that the prize stays hidden', async () => {
    renderClient(view({
      prize: { title: 'MiniRue bundle', description: 'A complete skincare bundle.', imageUrl: null, mediaKind: 'image' },
    }));

    await screen.findByRole('heading', { name: 'Settings' });
    const settings = section('Settings');
    expect(within(settings).getByText(/^Hidden on the storefront until the reveal\./)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Custom prize' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Add image from Gallery' })).toBeInTheDocument();
    expect(screen.queryByText(/Today.s prize/i)).not.toBeInTheDocument();
    expect(screen.queryByAltText('Prize preview')).not.toBeInTheDocument();
    expect(document.querySelector('.giveaway-media-preview')).toBeNull();
  });

  it('fills the prize from a chosen catalogue product and lets the product supply what was not changed', async () => {
    const user = userEvent.setup();
    renderClient(view());

    await user.click(await screen.findByRole('radio', { name: 'From catalogue' }));
    expect(screen.queryByLabelText('Prize title')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Search the catalogue'), 'vitamin');
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/catalog/admin/products?search=vitamin'),
      expect.objectContaining({ auth: true }),
    ));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Retinal Booster Shot/ })).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Vitamin C Booster Shot/ }));

    const chosen = screen.getByTestId('giveaway-chosen-product');
    expect(chosen).toHaveTextContent('Vitamin C Booster Shot');
    expect(chosen.querySelector('img')).toHaveAttribute('src', 'https://img.test/vitamin-c.jpg');
    expect(screen.getByLabelText('Prize title')).toHaveValue('Vitamin C Booster Shot');
    await waitFor(() => expect(screen.getByLabelText('Prize description')).toHaveValue('Brightening vitamin C in single-use shots.'));
    expect(screen.getByTestId('giveaway-product-image').querySelector('img')).toHaveAttribute('src', 'https://img.test/vitamin-c.jpg');
    expect(screen.getAllByText('From the product')).not.toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Save giveaway' }));
    await waitFor(() => expect(putBody()).not.toBeNull());
    expect(putBody()!.body).toEqual(expect.objectContaining({
      prizeProductId: 'product-9',
      prizeTitle: '',
      prizeDescription: '',
      prizeGalleryItemId: null,
    }));
  });

  it('saves the admin’s own title over the product’s, and can go back to the product’s', async () => {
    const user = userEvent.setup();
    renderClient(view());

    await user.click(await screen.findByRole('radio', { name: 'From catalogue' }));
    await user.click(await screen.findByRole('button', { name: /Vitamin C Booster Shot/ }));
    const title = screen.getByLabelText('Prize title');
    await user.clear(title);
    await user.type(title, 'Vitamin C shot and pouch');
    expect(screen.getByRole('button', { name: 'Use the product’s name' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save giveaway' }));
    await waitFor(() => expect(putBody()).not.toBeNull());
    expect(putBody()!.body).toEqual(expect.objectContaining({
      prizeProductId: 'product-9',
      prizeTitle: 'Vitamin C shot and pouch',
      prizeDescription: '',
    }));

    await user.click(screen.getByRole('button', { name: 'Use the product’s name' }));
    expect(screen.getByLabelText('Prize title')).toHaveValue('Vitamin C Booster Shot');
  });

  it('opens a saved product prize with its overrides intact and saves them unchanged', async () => {
    const user = userEvent.setup();
    renderClient(view({
      giveaway: { ...config, prizeProductId: 'product-9', prizeTitle: 'Grand prize: Vitamin C', prizeDescription: '', prizeGalleryItemId: '7d1c0e1e-0000-4000-8000-000000000001' },
      prize: { title: 'Grand prize: Vitamin C', description: 'Brightening vitamin C in single-use shots.', imageUrl: 'https://img.test/booth-photo.jpg', mediaKind: 'image', productId: 'product-9' },
    }));

    expect(await screen.findByRole('radio', { name: 'From catalogue' })).toBeChecked();
    await waitFor(() => expect(screen.getByTestId('giveaway-chosen-product')).toHaveTextContent('Vitamin C Booster Shot'));
    expect(screen.getByLabelText('Prize title')).toHaveValue('Grand prize: Vitamin C');
    expect(screen.getByLabelText('Prize description')).toHaveValue('Brightening vitamin C in single-use shots.');
    const image = screen.getByTestId('giveaway-chosen-image');
    expect(image).toHaveTextContent('Shown instead of the product photo');
    expect(image.querySelector('img')).toHaveAttribute('src', 'https://img.test/booth-photo.jpg');
    expect(screen.queryByLabelText('Search the catalogue')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save giveaway' }));
    await waitFor(() => expect(putBody()).not.toBeNull());
    expect(putBody()!.body).toEqual(expect.objectContaining({
      prizeProductId: 'product-9',
      prizeTitle: 'Grand prize: Vitamin C',
      prizeDescription: '',
      prizeGalleryItemId: '7d1c0e1e-0000-4000-8000-000000000001',
    }));
  });

  it('switches a saved product prize to a custom prize, carrying the text over', async () => {
    const user = userEvent.setup();
    renderClient(view({
      giveaway: { ...config, prizeProductId: 'product-9', prizeTitle: '', prizeDescription: '' },
      prize: { title: 'Vitamin C Booster Shot', description: 'Brightening vitamin C in single-use shots.', imageUrl: 'https://img.test/vitamin-c.jpg', mediaKind: 'image', productId: 'product-9' },
    }));

    expect(await screen.findByRole('radio', { name: 'From catalogue' })).toBeChecked();
    expect(screen.getByLabelText('Prize title')).toHaveValue('Vitamin C Booster Shot');

    await user.click(screen.getByRole('radio', { name: 'Custom prize' }));
    const title = screen.getByLabelText('Prize title');
    expect(title).toHaveValue('Vitamin C Booster Shot');
    await user.clear(title);
    await user.type(title, 'Mystery box');
    const description = screen.getByLabelText('Prize description');
    await user.clear(description);
    await user.type(description, 'Three surprises.');
    await user.click(screen.getByRole('button', { name: 'Save giveaway' }));

    await waitFor(() => expect(putBody()).not.toBeNull());
    expect(putBody()!.body).toEqual(expect.objectContaining({
      prizeProductId: null,
      prizeTitle: 'Mystery box',
      prizeDescription: 'Three surprises.',
      prizeGalleryItemId: null,
    }));
  });

  it('refuses to save the catalogue mode until a product is chosen', async () => {
    const user = userEvent.setup();
    renderClient(view());

    await user.click(await screen.findByRole('radio', { name: 'From catalogue' }));
    await user.click(screen.getByRole('button', { name: 'Save giveaway' }));

    expect(await within(section('Settings')).findByRole('alert')).toHaveTextContent('Choose a product from the catalogue, or switch to a custom prize.');
    expect(putBody()).toBeNull();
  });
});

describe('GiveawayClient analytics', () => {
  it('shows entrants, eligible, removed, spend per buyer, and the top five spenders with the first highlighted', async () => {
    renderClient(view());

    await screen.findByRole('heading', { name: "Today's analytics" });
    const analytics = section("Today's analytics");
    // The card holds its place with a skeleton until the figures arrive.
    await within(analytics).findByText('Entrants');
    const metric = (label: string) => within(analytics).getByText(label).nextElementSibling;
    expect(metric('Entrants')).toHaveTextContent('7');
    expect(metric('Eligible')).toHaveTextContent('6');
    expect(metric('Removed')).toHaveTextContent('1');
    expect(metric('Total spend')).toHaveTextContent('EGP 12,345.00');
    expect(metric('Average spend')).toHaveTextContent('EGP 1,371.67');
    expect(analytics).toHaveTextContent('per buyer · 9 buyers');

    const top = within(analytics).getByRole('list', { name: 'Top spenders today' });
    const rows = within(top).getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent('Nour Hassan');
    expect(rows[0]).toHaveTextContent('EGP 4,200.00');
    expect(rows[0]).toHaveTextContent('3 orders');
    expect(rows[0]).toHaveTextContent('Top spender');
    expect(rows[0]).toHaveAttribute('data-top', 'true');
    expect(rows[1]).not.toHaveAttribute('data-top');
    expect(rows[1]).toHaveTextContent('1 order');
    expect(analytics).not.toHaveTextContent('Laila Samir');
  });

  it('explains missing analytics from an older backend and keeps the rest of the page working', async () => {
    const { stats: _stats, ...older } = view();
    renderClient(older as GiveawayView);

    await screen.findByRole('heading', { name: "Today's analytics" });
    expect(await within(section("Today's analytics")).findByText(/Analytics are not available from the server yet\./)).toBeInTheDocument();
    expect(screen.getByText('Mariam Adel')).toBeInTheDocument();
  });

  it('survives malformed and missing fields without crashing the page', async () => {
    const broken = {
      ...view(),
      stats: { entrantCount: '7', eligibleCount: null, topSpenders: null } as unknown as GiveawayStats,
      entrants: [
        { key: 'customer-9', firstName: 'Nadia', lastName: 'Fouad', eligible: true, qualifiedAt: 'not a date' },
        null,
        { fullName: 'No key' },
      ] as unknown as GiveawayEntrant[],
      audit: undefined as unknown as GiveawayView['audit'],
    };
    renderClient(broken);

    const analytics = (await screen.findByRole('heading', { name: "Today's analytics" })).closest('section')!;
    expect((await within(analytics).findByText('Entrants')).nextElementSibling).toHaveTextContent('—');
    expect(analytics).toHaveTextContent('No spend yet.');
    const row = screen.getByText('Nadia Fouad').closest('li')!;
    expect(row).toHaveTextContent('EGP 0.00');
    expect(row).toHaveTextContent('—');
    expect(screen.getByRole('heading', { name: 'Activity' })).toBeInTheDocument();
  });

  it('is not shown to a non-admin', async () => {
    mockRole = 'STAFF';
    renderClient(view());

    expect(await screen.findByText('Mariam Adel')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /analytics/i })).not.toBeInTheDocument();
  });
});

describe('GiveawayClient entrants', () => {
  it('lists full names latest first with the entry date and time, the spend, and the applicant count', async () => {
    const { excluded: _excluded, ...olderMariam } = mariam;
    renderClient(view({ entrants: [olderMariam, omar, salma, hana] }));

    const heading = await screen.findByRole('heading', { name: 'Entrants 3 applicants' });
    const card = heading.closest('section')!;
    expect(card).toHaveTextContent('3 applicants · 2 in the draw · 1 removed');
    const list = within(card).getAllByRole('list')[0];
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('strong')?.textContent)).toEqual(['Omar Fathy', 'Mariam Adel']);
    expect(rows[0]).toHaveTextContent('2');
    expect(rows[0]).toHaveTextContent('Sep 30, 4:30 PM');
    expect(rows[0]).toHaveTextContent('EGP 2,100.00');
    expect(rows[1]).toHaveTextContent('Sep 30, 2:00 PM');
    expect(rows[1].querySelector('time')).toHaveAttribute('dateTime', '2026-09-30T11:00:00.000Z');
    expect(screen.getByText('Not qualified yet · 1')).toBeInTheDocument();
  });

  it('keeps removed entrants in view, grouped and marked, with their entry time and spend', async () => {
    renderClient(view({ entrants: [mariam, salma] }));

    const group = (await screen.findByRole('heading', { name: 'Removed from draw 1' })).closest('section')!;
    expect(group).toHaveTextContent('Kept here for the record. They cannot win unless you put them back.');
    const row = within(group).getByText('Salma Nabil').closest('li')!;
    expect(row).toHaveAttribute('data-removed', 'true');
    expect(within(row).getByText('Removed from draw')).toBeInTheDocument();
    expect(row).toHaveTextContent('Sep 30, 3:00 PM');
    expect(row).toHaveTextContent('EGP 1,500.00');
    expect(within(screen.getByRole('list', { name: /^Entrants/ })).queryByText('Salma Nabil')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Mariam Adel/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Salma Nabil/ })).not.toBeInTheDocument();
  });

  it('keeps identity, total, details, and the row action together and keyboard-accessible', async () => {
    const user = userEvent.setup();
    renderClient(view());

    const details = await screen.findByRole('button', { name: 'Details for Mariam Adel' });
    const row = details.closest('li');
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent('Mariam Adel');
    expect(row).toHaveTextContent('EGP 1,250.50');
    expect(details).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('01000001234')).not.toBeInTheDocument();
    details.focus();
    await user.keyboard('[Enter]');
    expect(details).toHaveAttribute('aria-expanded', 'true');
    expect(row).toHaveTextContent('01000001234');
    expect(row).toHaveTextContent('mariam@example.test');
    expect(row).toHaveTextContent('MR-42');
    await user.click(details);
    expect(details).toHaveAttribute('aria-expanded', 'false');
    const remove = screen.getByRole('button', { name: 'Remove from draw: Mariam Adel' });
    expect(row).toContainElement(remove);
    remove.focus();
    await user.keyboard('[Enter]');
    expect(await screen.findByRole('dialog', { name: 'Remove Mariam Adel from the draw?' })).toBeInTheDocument();
  });

  it('removes an entrant from the draw through the excluded endpoint after confirmation', async () => {
    const user = userEvent.setup();
    renderClient(view());

    await user.click(await screen.findByRole('button', { name: 'Remove from draw: Mariam Adel' }));
    expect(mockFetch).not.toHaveBeenCalledWith('/admin/giveaways/giveaway-1/excluded', expect.anything());
    await user.click(screen.getByRole('button', { name: 'Remove from draw' }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      '/admin/giveaways/giveaway-1/excluded',
      expect.objectContaining({ method: 'POST', auth: true, body: JSON.stringify({ key: 'customer-1', excluded: true }) }),
    ));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows the server’s 409 in the dialog when a draw already exists', async () => {
    const user = userEvent.setup();
    renderClient(view(), {
      post: () => Promise.reject({ status: 409, message: 'Reset the draw before changing who is in it' }),
    });

    await user.click(await screen.findByRole('button', { name: 'Remove from draw: Mariam Adel' }));
    await user.click(screen.getByRole('button', { name: 'Remove from draw' }));

    const dialog = await screen.findByRole('dialog', { name: 'Remove Mariam Adel from the draw?' });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Reset the draw before changing who is in it');
  });

  it('puts a removed entrant back in the draw after confirmation', async () => {
    const user = userEvent.setup();
    renderClient(view({ entrants: [mariam, salma] }));

    await user.click(await screen.findByRole('button', { name: 'Put back in draw: Salma Nabil' }));
    expect(screen.getByRole('dialog', { name: 'Put Salma Nabil back in the draw?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Put back in draw' }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      '/admin/giveaways/giveaway-1/excluded',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ key: 'customer-3', excluded: false }) }),
    ));
    // Only the excluded route: the legacy hidden route is an alias, never called.
    expect(mockFetch.mock.calls.some(([path]) => String(path).endsWith('/hidden'))).toBe(false);
  });

  it('disables removing and putting back with an explanation once a winner is drawn', async () => {
    renderClient(view({ entrants: [mariam, salma], draw, publicState: 'DRAWN' }));

    const remove = await screen.findByRole('button', { name: 'Remove from draw: Mariam Adel' });
    expect(remove).toBeDisabled();
    expect(remove).toHaveAccessibleDescription('A winner is drawn. Reset the draw before changing who is in it.');
    expect(screen.getByRole('button', { name: 'Put back in draw: Salma Nabil' })).toBeDisabled();
  });

  it('reads a removed entrant from excluded, not from the legacy hidden flag', async () => {
    // Backend 0.140.2 sends hidden as a mirror of excluded; an older one used it to mask names only.
    renderClient(view({ entrants: [{ ...mariam, hidden: true }, { ...salma, hidden: true }] }));

    expect(await screen.findByRole('button', { name: 'Remove from draw: Mariam Adel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Put back in draw: Salma Nabil' })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/name hidden|hidden publicly/i);
  });
});

describe('GiveawayClient draw', () => {
  it('offers a random winner and calls the draw endpoint only after confirmation', async () => {
    const user = userEvent.setup();
    renderClient(view({ entrants: [mariam, omar, salma] }));

    expect(await screen.findByRole('heading', { name: 'Random winner' })).toBeInTheDocument();
    expect(section('Random winner')).toHaveTextContent('1 removed entrant is left out.');
    await user.click(screen.getByRole('button', { name: 'Draw random winner' }));
    expect(screen.getByRole('dialog', { name: 'Draw a random winner?' })).toHaveTextContent('2 eligible entrants');
    expect(mockFetch).not.toHaveBeenCalledWith('/admin/giveaways/giveaway-1/draw', expect.anything());
    await user.click(screen.getByRole('button', { name: 'Confirm draw' }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      '/admin/giveaways/giveaway-1/draw',
      expect.objectContaining({ method: 'POST', auth: true }),
    ));
    expect(mockFetch).not.toHaveBeenCalledWith('/admin/giveaways/giveaway-1/pick', expect.anything());
  });

  it('chooses a selected eligible entrant as the winner after confirmation', async () => {
    const user = userEvent.setup();
    renderClient(view({ entrants: [mariam, omar, salma] }));

    expect(await screen.findByRole('heading', { name: 'Choose winner' })).toBeInTheDocument();
    const select = screen.getByLabelText('Winner');
    const options = within(select).getAllByRole('option').map((option) => option.textContent?.replace(/\s+/g, ' '));
    expect(options).toEqual(['Select an entrant', 'Omar Fathy · EGP 2,100.00', 'Mariam Adel · EGP 1,250.50']);
    const choose = screen.getByRole('button', { name: 'Choose winner' });
    expect(choose).toBeDisabled();

    await user.selectOptions(select, 'customer-2');
    await user.click(choose);
    expect(screen.getByRole('dialog', { name: 'Choose Omar Fathy as the winner?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm winner' }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      '/admin/giveaways/giveaway-1/pick',
      expect.objectContaining({ method: 'POST', auth: true, body: JSON.stringify({ key: 'customer-2' }) }),
    ));
    expect(mockFetch).not.toHaveBeenCalledWith('/admin/giveaways/giveaway-1/draw', expect.anything());
  });

  it('sends the void reason to the right endpoint after confirmation', async () => {
    const user = userEvent.setup();
    renderClient(view({ publicState: 'DRAWN', draw }));

    expect(await screen.findByText('Drawn at random from 1 entrant')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Void draw' }));
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
});

describe('GiveawayClient activity and navigation', () => {
  it('names removals and restorations, replaces entrant keys with a known full name, and omits unknown keys', async () => {
    renderClient(view({
      audit: [
        { id: 'exclude', action: 'EXCLUDE', actor: 'Admin', at: config.updatedAt, detail: { key: mariam.key } },
        { id: 'include', action: 'INCLUDE', actor: 'Admin', at: config.updatedAt, detail: { key: 'phone:secret-hash', excluded: false } },
        { id: 'future', action: 'ARCHIVE', actor: 'Admin', at: config.updatedAt, detail: null },
      ],
    }));
    const activity = (await screen.findByRole('heading', { name: 'Activity' })).closest('section')!;
    const items = within(activity).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Removed');
    expect(items[0]).toHaveTextContent('entrant: Mariam Adel');
    expect(items[1]).toHaveTextContent('Put back');
    expect(items[1]).toHaveTextContent('excluded: false');
    expect(items[2]).toHaveTextContent('ARCHIVE');
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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QRCode from 'qrcode';
import GiveawayClient from '@/app/dashboard/giveaway/GiveawayClient';
import { giveawayPublicUrl } from '@/app/dashboard/giveaway/GiveawayQrCard';
import { apiFetch } from '@/lib/api/client';
import type { GiveawayView } from '@/lib/api/giveaway';

jest.mock('@/lib/api/client', () => ({
  ...jest.requireActual('@/lib/api/client'),
  apiFetch: jest.fn(),
}));
jest.mock('@/components/dashboard/GalleryPickerModal', () => () => null);
jest.mock('@/lib/hooks/use-auth', () => ({ useUser: () => ({ data: { role: 'ADMIN' } }) }));
jest.mock('qrcode', () => ({
  toDataURL: jest.fn((text: string) => Promise.resolve(`data:image/png;base64,${Buffer.from(text).toString('base64')}`)),
}));

// The real origin rule, fed the hostname each test sets, instead of jsdom's fixed localhost.
let mockHostname = 'dashboard.minirueshop.com';
jest.mock('@/lib/storefront/origin', () => {
  const actual = jest.requireActual('@/lib/storefront/origin');
  return { ...actual, assistedReviewOrigin: () => actual.assistedReviewOrigin(mockHostname) };
});

const mockFetch = apiFetch as jest.Mock;
const mockToDataURL = QRCode.toDataURL as unknown as jest.Mock;

function view(overrides: Partial<GiveawayView> = {}): GiveawayView {
  return {
    pool: 'BOOTH',
    day: '2026-09-30',
    today: '2026-09-30',
    timezone: 'Africa/Cairo',
    serverTime: '2026-09-30T12:00:00.000Z',
    giveaway: {
      id: 'giveaway-1',
      pool: 'BOOTH',
      day: '2026-09-30',
      enabled: true,
      minSpendMinor: 100000,
      countShipping: false,
      revealTime: '22:00',
      revealAt: '2026-09-30T19:00:00.000Z',
      title: 'Tonight’s giveaway',
      prizeProductId: null,
      prizeTitle: 'MiniRue bundle',
      prizeDescription: '',
      prizeGalleryItemId: null,
      terms: '',
      version: 1,
      updatedAt: '2026-09-30T10:00:00.000Z',
    },
    prize: null,
    defaults: null,
    publicState: 'OPEN',
    entrants: [],
    frozenKeys: null,
    draw: null,
    audit: [],
    ...overrides,
  };
}

function renderClient(response: GiveawayView | Error) {
  mockFetch.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith('/admin/giveaways?')) {
      if (response instanceof Error) return Promise.reject({ status: 500, message: response.message });
      const pool = new URLSearchParams(path.split('?')[1]).get('pool') as GiveawayView['pool'];
      return Promise.resolve({ ...response, pool });
    }
    return Promise.reject({ status: 404, message: `unmocked ${init?.method ?? 'GET'} ${path}` });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GiveawayClient />
    </QueryClientProvider>,
  );
}

function panel(name: 'Booth QR code' | 'Online QR code'): HTMLElement {
  return screen.getByRole('group', { name });
}

function encoded(url: string): string {
  return `data:image/png;base64,${Buffer.from(url).toString('base64')}`;
}

beforeEach(() => {
  mockFetch.mockReset();
  mockToDataURL.mockClear();
  mockHostname = 'dashboard.minirueshop.com';
});
afterEach(() => cleanup());

describe('giveaway QR codes', () => {
  it('builds the public page URL for each pool in the dashboard’s own environment', () => {
    expect(giveawayPublicUrl('BOOTH', 'https://minirueshop.com')).toBe('https://minirueshop.com/giveaway/booth');
    expect(giveawayPublicUrl('ONLINE', 'https://pre.minirueshop.com')).toBe('https://pre.minirueshop.com/giveaway/online');
  });

  it('shows one code per pool at once, each a dark-on-white code with a quiet zone, whichever pool is open', async () => {
    const user = userEvent.setup();
    renderClient(view());

    expect(await screen.findByRole('heading', { name: 'QR codes' })).toBeInTheDocument();
    expect(screen.getByTestId('giveaway-qr-url-booth')).toHaveTextContent('https://minirueshop.com/giveaway/booth');
    expect(screen.getByTestId('giveaway-qr-url-online')).toHaveTextContent('https://minirueshop.com/giveaway/online');
    await waitFor(() => expect(mockToDataURL).toHaveBeenCalledWith('https://minirueshop.com/giveaway/booth', expect.anything()));
    await waitFor(() => expect(mockToDataURL).toHaveBeenCalledWith('https://minirueshop.com/giveaway/online', expect.anything()));
    const options = mockToDataURL.mock.calls[0][1];
    expect(['M', 'Q', 'H']).toContain(options.errorCorrectionLevel);
    expect(options.margin).toBeGreaterThanOrEqual(4);
    expect(options.color).toEqual({ dark: '#0B0B0B', light: '#FFFFFF' });
    const booth = await within(panel('Booth QR code')).findByAltText('QR code for minirueshop.com/giveaway/booth');
    expect(booth.getAttribute('src')).toBe(encoded('https://minirueshop.com/giveaway/booth'));
    const online = await within(panel('Online QR code')).findByAltText('QR code for minirueshop.com/giveaway/online');
    expect(online.getAttribute('src')).toBe(encoded('https://minirueshop.com/giveaway/online'));

    await user.click(screen.getByRole('button', { name: 'Online' }));
    expect(screen.getByTestId('giveaway-qr-url-booth')).toHaveTextContent('https://minirueshop.com/giveaway/booth');
    expect(screen.getByTestId('giveaway-qr-url-online')).toHaveTextContent('https://minirueshop.com/giveaway/online');
  });

  it('points both codes and the public page link at the pre storefront from the pre dashboard', async () => {
    mockHostname = 'pre-dashboard.minirueshop.com';
    renderClient(view());

    expect(await screen.findByTestId('giveaway-qr-url-booth')).toHaveTextContent('https://pre.minirueshop.com/giveaway/booth');
    expect(screen.getByTestId('giveaway-qr-url-online')).toHaveTextContent('https://pre.minirueshop.com/giveaway/online');
    await waitFor(() => expect(mockToDataURL).toHaveBeenCalledWith('https://pre.minirueshop.com/giveaway/booth', expect.anything()));
    expect(screen.getByRole('link', { name: 'View public page' })).toHaveAttribute('href', 'https://pre.minirueshop.com/giveaway/booth');
  });

  it('stays available while the pool is off, and even when the giveaway cannot load', async () => {
    renderClient(view({ publicState: 'OFF', giveaway: { ...view().giveaway!, enabled: false } }));

    expect(await within(panel('Booth QR code')).findByText(/This page is off right now/)).toBeInTheDocument();
    expect(within(panel('Online QR code')).queryByText(/This page is off right now/)).not.toBeInTheDocument();
    expect(await within(panel('Booth QR code')).findByRole('button', { name: 'Show full screen' })).toBeEnabled();
    cleanup();

    renderClient(new Error('Backend down'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Backend down');
    expect(screen.getByRole('heading', { name: 'Booth QR code' })).toBeInTheDocument();
    expect(await within(panel('Online QR code')).findByRole('button', { name: 'Show full screen' })).toBeEnabled();
  });

  it('shows the code full screen for the customer, traps focus, and restores it on Close and Escape', async () => {
    const user = userEvent.setup();
    renderClient(view());

    const trigger = await within(panel('Booth QR code')).findByRole('button', { name: 'Show full screen' });
    await waitFor(() => expect(trigger).toBeEnabled());
    await user.click(trigger);

    const stage = screen.getByRole('dialog', { name: "Scan to see today's giveaway" });
    expect(stage).toHaveAttribute('aria-modal', 'true');
    expect(within(stage).getByAltText('QR code for minirueshop.com/giveaway/booth')).toBeInTheDocument();
    expect(stage).toHaveTextContent('minirueshop.com/giveaway/booth');
    const close = within(stage).getByRole('button', { name: 'Close' });
    expect(close).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(close).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('asks the browser for real full screen, and closes when the browser leaves it', async () => {
    const user = userEvent.setup();
    let fullscreenElement: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
    const exitFullscreen = jest.fn(() => {
      fullscreenElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exitFullscreen });
    const requestFullscreen = jest.fn(function (this: Element) {
      fullscreenElement = this;
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: requestFullscreen });

    try {
      renderClient(view());
      const trigger = await within(panel('Online QR code')).findByRole('button', { name: 'Show full screen' });
      await waitFor(() => expect(trigger).toBeEnabled());
      await user.click(trigger);

      const stage = screen.getByRole('dialog', { name: "Scan to see today's giveaway" });
      expect(requestFullscreen).toHaveBeenCalledTimes(1);
      expect(fullscreenElement).toBe(stage);

      // The browser handles Esc itself in full screen: it leaves full screen and fires fullscreenchange.
      act(() => {
        fullscreenElement = null;
        document.dispatchEvent(new Event('fullscreenchange'));
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();

      // Closing with the button leaves full screen too.
      await user.click(trigger);
      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(exitFullscreen).toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    } finally {
      delete (HTMLElement.prototype as { requestFullscreen?: unknown }).requestFullscreen;
      delete (document as { exitFullscreen?: unknown }).exitFullscreen;
      delete (document as { fullscreenElement?: unknown }).fullscreenElement;
    }
  });

  it('copies each pool’s link and reports it', async () => {
    const user = userEvent.setup();
    renderClient(view());

    const online = panel('Online QR code');
    await user.click(await within(online).findByRole('button', { name: 'Copy link' }));
    await expect(navigator.clipboard.readText()).resolves.toBe('https://minirueshop.com/giveaway/online');
    expect(within(online).getByRole('status')).toHaveTextContent('Link copied.');
    expect(within(online).getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(within(panel('Booth QR code')).getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });

  it('tells the operator how to copy by hand when the clipboard is refused', async () => {
    const user = userEvent.setup();
    renderClient(view());
    jest.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));

    const booth = panel('Booth QR code');
    await user.click(await within(booth).findByRole('button', { name: 'Copy link' }));
    expect(within(booth).getByRole('status')).toHaveTextContent('Could not copy. Select the link above and copy it.');
  });

  it('downloads each code as a PNG named after its pool', async () => {
    renderClient(view());

    const booth = await within(panel('Booth QR code')).findByRole('link', { name: 'Download PNG' });
    expect(booth).toHaveAttribute('download', 'minirue-giveaway-booth-qr.png');
    expect(booth.getAttribute('href')).toBe(encoded('https://minirueshop.com/giveaway/booth'));
    const online = await within(panel('Online QR code')).findByRole('link', { name: 'Download PNG' });
    expect(online).toHaveAttribute('download', 'minirue-giveaway-online-qr.png');
  });
});

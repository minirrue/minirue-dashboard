import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const setQueryData = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ setQueryData }),
}));

jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: () => ({
    data: { userId: 'u1', role: 'ADMIN', email: 'a@a.com', name: 'A', avatarUrl: null },
    isLoading: false,
  }),
}));

jest.mock('@/lib/api/auth', () => ({
  apiUpdateMyProfile: jest.fn(),
  apiUploadMyAvatar: jest.fn(),
}));

jest.mock('@/lib/api/settings', () => ({
  apiGetSettings: jest.fn(),
  apiUpdateSettings: jest.fn(),
  apiUploadBrandLogo: jest.fn(),
}));

jest.mock('@/components/dashboard/ImageCropProvider', () => ({
  useImageCrop: () => jest.fn(),
}));

jest.mock('@/components/dashboard/DataResetPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/dashboard/SuperAdminPanel', () => ({
  __esModule: true,
  default: () => null,
}));

/*
 * The real ImageField opens the Gallery picker, which talks to the Gallery
 * API. What this file pins is what the Settings page does with the PICKED item
 * — so the stub hands back one item, the way the picker's onSelect does.
 */
jest.mock('@/components/dashboard/ImageField', () => ({
  __esModule: true,
  default: ({
    label,
    imageUrl,
    onChange,
  }: {
    label: string;
    imageUrl: string | null;
    onChange: (id: string | null, item: { id: string; url: string } | null) => void;
  }) => (
    <div>
      <span>{label}</span>
      <span data-testid={`${label}-current`}>{imageUrl ?? ''}</span>
      <button
        type="button"
        onClick={() => onChange('g1', { id: 'g1', url: `https://img.example/${label}.png` })}
      >
        Choose {label}
      </button>
      <button type="button" onClick={() => onChange(null, null)}>
        Remove {label}
      </button>
    </div>
  ),
}));

import SettingsClient, {
  codLimitFromInput,
  codLimitToInput,
  instapayFromForm,
} from '@/app/dashboard/settings/SettingsClient';
import { apiGetSettings, apiUpdateSettings } from '@/lib/api/settings';
import type { StoreSettings } from '@/lib/api/settings';

const mockGet = apiGetSettings as jest.Mock;
const mockUpdate = apiUpdateSettings as jest.Mock;

/**
 * The cash-on-delivery limit field (minirue-backend#105).
 *
 * There was no field: the limit was a hard-coded EGP 500 in the backend, so
 * every COD order over 500 was refused and nothing here could change it. The
 * owner's rule is that COD is allowed by default and a limit exists only when
 * set — so the one thing this mapping must never do is turn "blank" into 0,
 * which would refuse cash on delivery on every order.
 */
describe('COD limit field mapping', () => {
  it('sends a blank field as no limit (null), never as 0', () => {
    expect(codLimitFromInput('')).toBeNull();
    expect(codLimitFromInput('   ')).toBeNull();
  });

  it('sends a typed limit as whole minor units', () => {
    expect(codLimitFromInput('3000')).toBe(300_000);
    expect(codLimitFromInput('2499.99')).toBe(249_999);
  });

  it('keeps 0 as a real limit, distinct from blank', () => {
    expect(codLimitFromInput('0')).toBe(0);
    expect(codLimitToInput(0)).toBe('0.00');
  });

  it('shows no limit as an empty field', () => {
    expect(codLimitToInput(null)).toBe('');
    expect(codLimitToInput(undefined)).toBe('');
  });

  it('round-trips a stored limit through the field', () => {
    expect(codLimitFromInput(codLimitToInput(300_000))).toBe(300_000);
    expect(codLimitFromInput(codLimitToInput(null))).toBeNull();
  });

  it('treats a negative or unreadable entry as no limit rather than blocking COD', () => {
    expect(codLimitFromInput('-5')).toBeNull();
    expect(codLimitFromInput('abc')).toBeNull();
  });
});

/**
 * The InstaPay payment guide (minirue-dashboard#68, backend#170).
 *
 * The server's contract: when `payments.instapay` is sent, all four keys go
 * with it, each nullable. A blank field is `null`, never `''` — `''` is not a
 * valid https link, and "blank" means "the storefront uses its defaults".
 */
describe('InstaPay field mapping', () => {
  it('sends every blank field as null, with all four keys present', () => {
    expect(instapayFromForm({ payLink: '', handle: '  ', qrMediaUrl: '', exampleMediaUrl: '' })).toEqual({
      payLink: null,
      handle: null,
      qrMediaUrl: null,
      exampleMediaUrl: null,
    });
  });

  it('trims what was typed', () => {
    expect(
      instapayFromForm({
        payLink: ' https://ipn.eg/S/shop/instapay/abc ',
        handle: ' shop@instapay ',
        qrMediaUrl: 'https://img.example/qr.png',
        exampleMediaUrl: '',
      }),
    ).toEqual({
      payLink: 'https://ipn.eg/S/shop/instapay/abc',
      handle: 'shop@instapay',
      qrMediaUrl: 'https://img.example/qr.png',
      exampleMediaUrl: null,
    });
  });
});

function settings(over: Partial<StoreSettings> = {}): StoreSettings {
  return {
    currency: 'EGP',
    locale: 'en-EG',
    shippingZones: [],
    shipping: { flatRateCents: 7000, currency: 'EGP', freeOverCents: 0 },
    taxRules: [{ country: 'EG', vatPct: 14, enabled: true }],
    brand: { logoUrl: null, contactEmail: 'a@a.com', contactPhone: null, displayName: 'MiniRue' },
    maintenanceMode: false,
    payments: {
      codMaxOrderMinor: 300_000,
      instapay: { payLink: null, handle: null, qrMediaUrl: null, exampleMediaUrl: null },
    },
    ...over,
  } as StoreSettings;
}

async function renderSettings(initial: StoreSettings) {
  mockGet.mockResolvedValue(initial);
  mockUpdate.mockImplementation(async (patch: Partial<StoreSettings>) => ({ ...initial, ...patch }));
  render(<SettingsClient />);
  await screen.findByLabelText('InstaPay pay link');
}

const save = () => userEvent.click(screen.getByRole('button', { name: /save settings/i }));

describe('InstaPay on the Settings page', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends the exact payments block: COD limit plus all four InstaPay keys', async () => {
    await renderSettings(settings());
    await userEvent.type(screen.getByLabelText('InstaPay pay link'), 'https://ipn.eg/S/shop/instapay/abc');
    await userEvent.type(screen.getByLabelText('InstaPay handle'), 'shop@instapay');
    await userEvent.click(screen.getByRole('button', { name: 'Choose QR code' }));
    await save();

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][0].payments).toStrictEqual({
      codMaxOrderMinor: 300_000,
      instapay: {
        payLink: 'https://ipn.eg/S/shop/instapay/abc',
        handle: 'shop@instapay',
        qrMediaUrl: 'https://img.example/QR code.png',
        exampleMediaUrl: null,
      },
    });
  });

  it('shows stored values, and clearing them sends null rather than an empty string', async () => {
    await renderSettings(
      settings({
        payments: {
          codMaxOrderMinor: null,
          instapay: {
            payLink: 'https://ipn.eg/S/shop/instapay/abc',
            handle: 'shop@instapay',
            qrMediaUrl: 'https://img.example/qr.png',
            exampleMediaUrl: 'https://img.example/receipt.png',
          },
        },
      }),
    );
    expect(screen.getByLabelText('InstaPay pay link')).toHaveValue('https://ipn.eg/S/shop/instapay/abc');
    expect(screen.getByTestId('QR code-current')).toHaveTextContent('https://img.example/qr.png');

    await userEvent.clear(screen.getByLabelText('InstaPay pay link'));
    await userEvent.clear(screen.getByLabelText('InstaPay handle'));
    await userEvent.click(screen.getByRole('button', { name: 'Remove QR code' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove Example receipt' }));
    await save();

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][0].payments).toStrictEqual({
      codMaxOrderMinor: null,
      instapay: { payLink: null, handle: null, qrMediaUrl: null, exampleMediaUrl: null },
    });
  });

  it('refuses to save a pay link that is not https, instead of losing the whole save', async () => {
    await renderSettings(settings());
    await userEvent.type(screen.getByLabelText('InstaPay pay link'), 'http://ipn.eg/x');
    await save();

    expect(await screen.findByText(/pay link must start with https:\/\//i)).toBeInTheDocument();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('opens the pay link in a new tab from "Test link"', async () => {
    const open = jest.spyOn(window, 'open').mockReturnValue(null);
    await renderSettings(settings());
    const test = screen.getByRole('button', { name: 'Test link' });
    expect(test).toBeDisabled();

    await userEvent.type(screen.getByLabelText('InstaPay pay link'), 'https://ipn.eg/S/shop/instapay/abc');
    await userEvent.click(test);

    expect(open).toHaveBeenCalledWith('https://ipn.eg/S/shop/instapay/abc', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });
});

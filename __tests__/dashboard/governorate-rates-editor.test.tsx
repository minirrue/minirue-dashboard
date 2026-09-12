import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The governorate rates editor, on the page and on the wire
 * (minirue-backend#83).
 *
 * `__tests__/dashboard/governorate-rates.test.ts` pins the rules. This file
 * pins that the Settings page actually applies them — including the one thing
 * that cannot be checked anywhere else, which is WHAT GOES OUT ON THE WIRE.
 *
 * `shipping.rates` is `.optional()` and NOT `.default([])` on the server: an
 * ABSENT `rates` means "leave the stored table alone" and `[]` means "clear
 * it". Those are different requests and the dashboard has to send the one it
 * means, so the payload assertions below are the point of the file, not
 * decoration around it.
 */

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

// Both ask the server whether they may render and hide themselves on a 403.
// Neither has anything to do with delivery fees.
jest.mock('@/components/dashboard/DataResetPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/dashboard/SuperAdminPanel', () => ({
  __esModule: true,
  default: () => null,
}));

import SettingsClient from '@/app/dashboard/settings/SettingsClient';
import GovernorateRatesEditor from '@/app/dashboard/settings/GovernorateRatesEditor';
import { apiGetSettings, apiUpdateSettings } from '@/lib/api/settings';
import type { StoreSettings, GovernorateRate } from '@/lib/api/settings';
import {
  newGovernorateDraft,
  ratesToDrafts,
  type GovernorateRateDraft,
} from '@/lib/shipping/governorate-rates';

const mockGet = apiGetSettings as jest.Mock;
const mockUpdate = apiUpdateSettings as jest.Mock;

function settings(rates?: GovernorateRate[], over: Partial<StoreSettings> = {}): StoreSettings {
  return {
    currency: 'EGP',
    locale: 'en-EG',
    shippingZones: [],
    shipping: { flatRateCents: 7000, currency: 'EGP', freeOverCents: 0, ...(rates ? { rates } : {}) },
    taxRules: [{ country: 'EG', vatPct: 14, enabled: true }],
    brand: { logoUrl: null, contactEmail: 'a@a.com', contactPhone: null, displayName: 'MiniRue' },
    maintenanceMode: false,
    ...over,
  } as StoreSettings;
}

/** The shipping block of the single PATCH the page sent. */
function sentShipping(): NonNullable<StoreSettings['shipping']> | undefined {
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  return (mockUpdate.mock.calls[0][0] as Partial<StoreSettings>).shipping;
}

async function renderSettings(initial: StoreSettings) {
  mockGet.mockResolvedValue(initial);
  mockUpdate.mockImplementation(async (patch: Partial<StoreSettings>) => ({ ...initial, ...patch }));
  const view = render(<SettingsClient />);
  await screen.findByText('Delivery fees by governorate');
  return view;
}

const save = () => userEvent.click(screen.getByRole('button', { name: /save settings/i }));

beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// Empty state
// ===========================================================================

describe('an empty table means the global rate, never free shipping', () => {
  it('says so on screen rather than showing nothing', async () => {
    await renderSettings(settings());
    const empty = screen.getByTestId('gov-rates-empty');
    expect(within(empty).getByText(/no governorate rates/i)).toBeInTheDocument();
    expect(empty.textContent).toMatch(/global delivery rate of EGP 70\.00/);
    expect(empty.textContent).toMatch(/not.{0,3} free delivery/i);
  });

  it('sends an EXPLICIT empty array, not an absent key', async () => {
    // Absent would mean "leave whatever is stored alone" — which for a shop
    // that has just deleted its last governorate is the opposite of what the
    // admin did.
    await renderSettings(settings());
    await save();
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    const shipping = sentShipping();
    expect(shipping).toBeDefined();
    expect(shipping!.rates).toEqual([]);
    expect('rates' in shipping!).toBe(true);
    // And the global rate goes with it, because it is what the empty table falls back to.
    expect(shipping!.flatRateCents).toBe(7000);
  });

  it('still sends the stored flat rate when the admin never retypes it', async () => {
    // Before #83 a blank field omitted the whole shipping block. It cannot now:
    // `flatRateCents` is required by the server schema and the table rides
    // alongside it.
    await renderSettings(settings(undefined, { shipping: { flatRateCents: 4200, currency: 'EGP', freeOverCents: 0 } }));
    // The global-rate input; its <label> is not associated in SettingsClient.
    await userEvent.clear(screen.getByPlaceholderText('50.00'));
    await save();
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(sentShipping()!.flatRateCents).toBe(4200);
  });
});

// ===========================================================================
// Add / edit / remove, and the round trip
// ===========================================================================

describe('adding governorates', () => {
  it('sends every row with the fee the admin typed', async () => {
    await renderSettings(settings());

    await userEvent.click(screen.getByRole('button', { name: /add governorate/i }));
    await userEvent.type(screen.getByLabelText(/^governorate$/i), 'Cairo');
    await userEvent.type(screen.getByLabelText(/^delivery fee/i), '50');

    await userEvent.click(screen.getByRole('button', { name: /add governorate/i }));
    const labels = screen.getAllByLabelText(/^governorate$/i);
    const fees = screen.getAllByLabelText(/^delivery fee/i);
    await userEvent.type(labels[1], 'Aswan');
    await userEvent.type(fees[1], '120');

    await save();
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(sentShipping()!.rates).toEqual([
      { key: 'cairo', label: 'Cairo', feeCents: 5000, enabled: true, aliases: [] },
      { key: 'aswan', label: 'Aswan', feeCents: 12000, enabled: true, aliases: [] },
    ]);
  });

  it('REFUSES to save a row whose fee was never typed', async () => {
    // The whole feature in one test. A numeric input defaulted to 0 would have
    // shipped this governorate free, silently, forever.
    await renderSettings(settings());
    await userEvent.click(screen.getByRole('button', { name: /add governorate/i }));
    await userEvent.type(screen.getByLabelText(/^governorate$/i), 'Aswan');

    await save();

    expect(mockUpdate).not.toHaveBeenCalled();
    // Once on the row, once in the save error at the foot of the form.
    expect(screen.getAllByText(/not free delivery/i).length).toBeGreaterThan(0);
  });

  it('reads a saved table back out of the server response', async () => {
    const stored: GovernorateRate[] = [
      { key: 'cairo', label: 'Cairo', feeCents: 5000, enabled: true, aliases: ['Kahira'] },
      { key: 'aswan', label: 'Aswan', feeCents: 12000, enabled: true, aliases: [] },
    ];
    await renderSettings(settings(stored));
    expect(screen.getAllByTestId('gov-rate-row')).toHaveLength(2);
    expect(screen.getAllByLabelText(/^governorate$/i).map((el) => (el as HTMLInputElement).value)).toEqual([
      'Cairo',
      'Aswan',
    ]);
    expect(screen.getAllByLabelText(/^delivery fee/i).map((el) => (el as HTMLInputElement).value)).toEqual([
      '50.00',
      '120.00',
    ]);
    expect(screen.getByText('Kahira')).toBeInTheDocument();
  });
});

describe('removing a governorate', () => {
  it('drops just that row and sends the rest', async () => {
    const stored: GovernorateRate[] = [
      { key: 'cairo', label: 'Cairo', feeCents: 5000, enabled: true, aliases: [] },
      { key: 'giza', label: 'Giza', feeCents: 6000, enabled: true, aliases: [] },
      { key: 'aswan', label: 'Aswan', feeCents: 12000, enabled: true, aliases: [] },
    ];
    await renderSettings(settings(stored));

    await userEvent.click(screen.getByRole('button', { name: /remove giza/i }));
    expect(screen.getAllByTestId('gov-rate-row')).toHaveLength(2);

    await save();
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(sentShipping()!.rates!.map((r) => r.key)).toEqual(['cairo', 'aswan']);
  });

  it('removing the LAST row sends [] — an empty table, not an absent one', async () => {
    await renderSettings(settings([{ key: 'cairo', label: 'Cairo', feeCents: 5000, enabled: true, aliases: [] }]));
    await userEvent.click(screen.getByRole('button', { name: /remove cairo/i }));
    await save();
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(sentShipping()!.rates).toEqual([]);
  });
});

// ===========================================================================
// Keys
// ===========================================================================

describe('the ID is generated once and then frozen', () => {
  it('derives an ID from the name while the row is new', async () => {
    await renderSettings(settings());
    await userEvent.click(screen.getByRole('button', { name: /add governorate/i }));
    await userEvent.type(screen.getByLabelText(/^governorate$/i), 'North Sinai');
    expect((screen.getByLabelText(/^id$/i) as HTMLInputElement).value).toBe('north-sinai');
  });

  it('stops deriving the moment the admin edits the ID by hand', async () => {
    await renderSettings(settings());
    await userEvent.click(screen.getByRole('button', { name: /add governorate/i }));
    const label = screen.getByLabelText(/^governorate$/i);
    await userEvent.type(label, 'Cairo');
    const key = screen.getByLabelText(/^id$/i) as HTMLInputElement;
    await userEvent.clear(key);
    await userEvent.type(key, 'cai');
    await userEvent.type(label, ' Governorate');
    expect(key.value).toBe('cai');
  });

  it('a SAVED row has no ID input at all — renaming it cannot move the key', async () => {
    // The backend snapshots the resolved key onto every order. A label rename
    // that re-keyed the row would detach those orders from the governorate
    // they were placed in.
    await renderSettings(settings([{ key: 'cairo', label: 'Cairo', feeCents: 5000, enabled: true, aliases: [] }]));
    expect(screen.queryByLabelText(/^id$/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('gov-rate-frozen-key')).toHaveTextContent('cairo');

    const label = screen.getByLabelText(/^governorate$/i);
    await userEvent.clear(label);
    await userEvent.type(label, 'Cairo Governorate');

    await save();
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(sentShipping()!.rates).toEqual([
      { key: 'cairo', label: 'Cairo Governorate', feeCents: 5000, enabled: true, aliases: [] },
    ]);
  });
});

// ===========================================================================
// Aliases — the migration tool, explained
// ===========================================================================

describe('spellings', () => {
  it('explains why they exist, naming the spellings that are actually live', async () => {
    await renderSettings(settings([{ key: 'cairo', label: 'Cairo', feeCents: 5000, enabled: true, aliases: [] }]));
    await userEvent.click(screen.getByRole('button', { name: /why spellings matter/i }));
    const intro = screen.getByText(/until this table existed/i, { selector: 'p' });
    expect(intro.textContent).toMatch(/typed/i);
    expect(intro.textContent).toContain('القاهرة');
    expect(
      screen.getByText(/charged the global rate, quietly/i, { selector: 'p' }),
    ).toBeInTheDocument();
  });

  it('adds a pasted, comma-separated list in one go', async () => {
    await renderSettings(settings([{ key: 'cairo', label: 'Cairo', feeCents: 5000, enabled: true, aliases: [] }]));
    await userEvent.type(
      screen.getByLabelText(/other spellings that mean Cairo/i),
      'Kahira, القاهرة',
    );
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
    await save();
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(sentShipping()!.rates![0].aliases).toEqual(['Kahira', 'القاهرة']);
  });

  it('tests a real spelling against the table and reports a MISS out loud', async () => {
    await renderSettings(settings([{ key: 'cairo', label: 'Cairo', feeCents: 5000, enabled: true, aliases: [] }]));
    await userEvent.click(screen.getByRole('button', { name: /why spellings matter/i }));
    await userEvent.type(screen.getByLabelText(/test a spelling/i), 'Kahira');
    const result = screen.getByTestId('gov-rate-probe-result');
    expect(result.textContent).toMatch(/no match/i);
    expect(result.textContent).toMatch(/global rate of EGP 70\.00/);
  });

  it('confirms a spelling that already lands, and on which field', async () => {
    await renderSettings(settings([{ key: 'cairo', label: 'Cairo', feeCents: 5000, enabled: true, aliases: [] }]));
    await userEvent.click(screen.getByRole('button', { name: /why spellings matter/i }));
    await userEvent.type(screen.getByLabelText(/test a spelling/i), 'CAIRO GOVERNORATE');
    expect(screen.getByTestId('gov-rate-probe-result').textContent).toMatch(/matches/i);
  });

  it('names the "—" a phone order writes as unfixable by any spelling', async () => {
    await renderSettings(settings([{ key: 'cairo', label: 'Cairo', feeCents: 5000, enabled: true, aliases: [] }]));
    await userEvent.click(screen.getByRole('button', { name: /why spellings matter/i }));
    await userEvent.type(screen.getByLabelText(/test a spelling/i), '—');
    expect(screen.getByTestId('gov-rate-probe-result').textContent).toMatch(/names nowhere/i);
  });

  it('blocks a spelling that would select two different fees', async () => {
    await renderSettings(
      settings([
        { key: 'cairo', label: 'Cairo', feeCents: 5000, enabled: true, aliases: [] },
        { key: 'giza', label: 'Giza', feeCents: 6000, enabled: true, aliases: [] },
      ]),
    );
    await userEvent.type(screen.getByLabelText(/other spellings that mean Giza/i), 'cairo');
    await userEvent.click(screen.getAllByRole('button', { name: /^add$/i })[1]);
    await save();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(screen.getAllByText(/one spelling cannot select two fees/i).length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// Showing the effect
// ===========================================================================

describe('the admin can see what the fees do', () => {
  it('shows the global fallback and the price the storefront will quote', async () => {
    await renderSettings(
      settings([
        { key: 'cairo', label: 'Cairo', feeCents: 5000, enabled: true, aliases: [] },
        { key: 'aswan', label: 'Aswan', feeCents: 12000, enabled: true, aliases: [] },
      ]),
    );
    expect(screen.getByText('EGP 70.00')).toBeInTheDocument();
    expect(screen.getByText('from EGP 50.00')).toBeInTheDocument();
    expect(screen.getByText('EGP 120.00')).toBeInTheDocument();
    expect(screen.getByText('Aswan')).toBeInTheDocument();
  });

  it('says free shipping overrides every governorate rate, because it does', async () => {
    await renderSettings(
      settings([{ key: 'aswan', label: 'Aswan', feeCents: 12000, enabled: true, aliases: [] }], {
        shipping: { flatRateCents: 7000, currency: 'EGP', freeOverCents: 150000 },
      }),
    );
    const banner = screen.getByText(/^Free delivery over/i, { selector: 'p' });
    expect(banner.textContent).toMatch(/overrides every rate below/i);
    expect(banner.textContent).toMatch(/EGP 1,?500\.00/);
  });

  it('says plainly that not offering a governorate does not stop it being charged', async () => {
    render(
      <GovernorateRatesEditor
        drafts={ratesToDrafts([{ key: 'sinai', label: 'North Sinai', feeCents: 12000, enabled: false, aliases: [] }])}
        onChange={() => {}}
        flatRateCents={7000}
        freeOverCents={0}
        currency="EGP"
      />,
    );
    expect(screen.getByText(/still charged this fee/i)).toBeInTheDocument();
  });

  it('warns when the global rate has not been set at all', async () => {
    // `null`, not 0. Drawing "EGP 0.00" as the fallback would read as free
    // delivery for every unlisted governorate.
    const drafts: GovernorateRateDraft[] = [newGovernorateDraft()];
    render(
      <GovernorateRatesEditor
        drafts={drafts}
        onChange={() => {}}
        flatRateCents={null}
        freeOverCents={0}
        currency="EGP"
      />,
    );
    expect(screen.getByText('Not set')).toBeInTheDocument();
    expect(screen.getByText(/cannot be saved without it/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// The wire, defensively
// ===========================================================================

describe('what the shipping block looks like on the wire', () => {
  it('never sends a currency the server would reject', async () => {
    // The Currency field is free text. A lowercase code fails `^[A-Z]{3}$` and
    // zod rejects the ENTIRE settings document — currency, VAT, brand and the
    // governorate table with it.
    await renderSettings(settings());
    const currency = screen.getByPlaceholderText('EGP');
    await userEvent.clear(currency);
    await userEvent.type(currency, 'usd');
    await save();
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(sentShipping()!.currency).toBe('USD');
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeliverySettingsPanel from '@/app/dashboard/fulfillment/DeliverySettingsPanel';
import type { StoreSettings } from '@/lib/api/settings';

jest.mock('@/lib/api/settings', () => ({
  apiGetSettings: jest.fn(),
  apiUpdateSettings: jest.fn(),
}));

import { apiGetSettings, apiUpdateSettings } from '@/lib/api/settings';

function baseSettings(): StoreSettings {
  return {
    currency: 'EGP',
    locale: 'en',
    shippingZones: [],
    brand: { logoUrl: null, contactEmail: 'a@b.com', contactPhone: null, displayName: null },
    maintenanceMode: false,
    fulfillment: {
      delivery: {
        standard: { enabled: true, etaLabel: '2–5 working days' },
        sameDay: {
          enabled: true,
          governorates: ['CAIRO', 'GIZA'],
          windowStart: '19:00',
          windowEnd: '24:00',
          cutoff: '17:00',
          feeRangeMinor: { min: 9000, max: 16000 },
          disclaimer: 'Fees confirmed after your order is confirmed.',
        },
      },
    },
  } as StoreSettings;
}

beforeEach(() => {
  jest.clearAllMocks();
  (apiGetSettings as jest.Mock).mockResolvedValue(baseSettings());
});

describe('DeliverySettingsPanel', () => {
  it('loads the current delivery settings and renders the governorate checkboxes', async () => {
    render(<DeliverySettingsPanel />);
    expect(await screen.findByLabelText('Cairo')).toBeChecked();
    expect(screen.getByLabelText('Giza')).toBeChecked();
    expect(screen.getByLabelText('Alexandria')).not.toBeChecked();
  });

  it('sends the whole fulfillment.delivery block on save, with feeRangeMinor in piastres', async () => {
    (apiUpdateSettings as jest.Mock).mockResolvedValue(baseSettings());
    render(<DeliverySettingsPanel />);
    await screen.findByLabelText('Cairo');

    await userEvent.click(screen.getByRole('button', { name: /save delivery settings/i }));

    await waitFor(() => expect(apiUpdateSettings).toHaveBeenCalledTimes(1));
    const payload = (apiUpdateSettings as jest.Mock).mock.calls[0][0];
    expect(payload).toEqual({
      fulfillment: {
        delivery: {
          standard: { enabled: true, etaLabel: '2–5 working days' },
          sameDay: {
            enabled: true,
            governorates: ['CAIRO', 'GIZA'],
            windowStart: '19:00',
            windowEnd: '24:00',
            cutoff: '17:00',
            feeRangeMinor: { min: 9000, max: 16000 },
            disclaimer: 'Fees confirmed after your order is confirmed.',
          },
        },
      },
    });
  });

  it('blocks the save and shows the readable message when cutoff is too close to windowEnd', async () => {
    render(<DeliverySettingsPanel />);
    const cutoffInput = await screen.findByLabelText(/cut-off/i);
    await userEvent.clear(cutoffInput);
    await userEvent.type(cutoffInput, '23:30');

    await userEvent.click(screen.getByRole('button', { name: /save delivery settings/i }));

    expect(
      await screen.findByText(/cut-off must be at least 60 minutes before the window ends/i),
    ).toBeInTheDocument();
    expect(apiUpdateSettings).not.toHaveBeenCalled();
  });

  it('blocks the save when the min fee is above the max fee', async () => {
    render(<DeliverySettingsPanel />);
    const minInput = await screen.findByLabelText(/fee range min/i);
    await userEvent.clear(minInput);
    await userEvent.type(minInput, '999');

    await userEvent.click(screen.getByRole('button', { name: /save delivery settings/i }));

    expect(
      await screen.findByText(/minimum fee must be at or below the maximum/i),
    ).toBeInTheDocument();
    expect(apiUpdateSettings).not.toHaveBeenCalled();
  });

  it("shows the backend's 400 message readably on a failed save", async () => {
    (apiUpdateSettings as jest.Mock).mockRejectedValue({
      status: 400,
      message: 'cutoff: must be at least 60 minutes before windowEnd',
    });
    render(<DeliverySettingsPanel />);
    await screen.findByLabelText('Cairo');

    await userEvent.click(screen.getByRole('button', { name: /save delivery settings/i }));

    expect(
      await screen.findByText(/must be at least 60 minutes before windowend/i),
    ).toBeInTheDocument();
  });
});

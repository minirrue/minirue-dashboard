import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import StaffDeviceControl from '@/app/dashboard/analytics/StaffDeviceControl';
import * as analyticsApi from '@/lib/api/analytics';
import * as flagsApi from '@/lib/api/traffic-flags';

jest.mock('@/lib/api/analytics');
jest.mock('@/lib/api/traffic-flags', () => ({
  ...jest.requireActual('@/lib/api/traffic-flags'),
  apiListTrafficFlags: jest.fn(),
}));

const mockedAnalytics = analyticsApi as jest.Mocked<typeof analyticsApi>;
const mockedFlags = flagsApi as jest.Mocked<typeof flagsApi>;

describe('StaffDeviceControl — the Exclusions strip (dashboard#111)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFlags.apiListTrafficFlags.mockResolvedValue({ items: [] });
  });

  it('clears the marker and explains that an active dashboard session remains excluded', async () => {
    mockedAnalytics.apiGetStaffDeviceStatus.mockResolvedValue({
      staffDevice: true,
      excluded: true,
      reasons: ['STAFF_DEVICE_COOKIE', 'DASHBOARD_SESSION'],
    });
    mockedAnalytics.apiClearStaffDevice.mockResolvedValue({
      staffDevice: false,
      excluded: true,
      reasons: ['DASHBOARD_SESSION'],
    });

    render(<StaffDeviceControl />);
    fireEvent.click(await screen.findByRole('button', { name: 'Count it again' }));

    expect(mockedAnalytics.apiClearStaffDevice).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/sign out before visiting the shop/i)).toBeInTheDocument();
    expect(screen.getByText(/signing in to the dashboard again/i)).toBeInTheDocument();
  });

  // Decision changed on purpose (dashboard#111): the strip is always shown,
  // because it is where another device and flagged accounts are excluded.
  it('always shows the exclusion tools, and says a counted device is counted', async () => {
    mockedAnalytics.apiGetStaffDeviceStatus.mockResolvedValue({
      staffDevice: false,
      excluded: false,
      reasons: [],
    });
    mockedFlags.apiListTrafficFlags.mockResolvedValue({ items: [{} as never, {} as never] });

    render(<StaffDeviceControl />);

    expect(await screen.findByText('Counted.')).toBeInTheDocument();
    expect(await screen.findByText(/2 accounts or visitors with a verdict/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exclude another device/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /manage/i })).toHaveAttribute('href', '/analytics/flags');
  });
});

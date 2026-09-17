import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StaffDeviceControl from '@/app/dashboard/analytics/StaffDeviceControl';
import * as analyticsApi from '@/lib/api/analytics';

jest.mock('@/lib/api/analytics');

const mockedAnalytics = analyticsApi as jest.Mocked<typeof analyticsApi>;

describe('StaffDeviceControl', () => {
  beforeEach(() => jest.clearAllMocks());

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
    fireEvent.click(await screen.findByRole('button', { name: 'Count this device again' }));

    expect(mockedAnalytics.apiClearStaffDevice).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/sign out before visiting the shop/i)).toBeInTheDocument();
    expect(screen.getByText(/signing in to the dashboard again/i)).toBeInTheDocument();
  });

  it('stays hidden when this browser has no staff-device marker', async () => {
    mockedAnalytics.apiGetStaffDeviceStatus.mockResolvedValue({
      staffDevice: false,
      excluded: true,
      reasons: ['DASHBOARD_ORIGIN'],
    });

    const { container } = render(<StaffDeviceControl />);

    await waitFor(() => expect(mockedAnalytics.apiGetStaffDeviceStatus).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });
});

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WhoCountsSheet, { deviceLine, whoCountsLabel } from '@/app/dashboard/analytics/_ui/sheets/WhoCountsSheet';
import * as analyticsApi from '@/lib/api/analytics';
import * as flagsApi from '@/lib/api/traffic-flags';
import type { TrafficFlag } from '@/lib/api/traffic-flags';
import { Harness, shellApi } from './shell-harness';
import { person } from './people-fixture';

jest.mock('@/lib/api/analytics');
jest.mock('@/lib/api/traffic-flags', () => ({
  ...jest.requireActual('@/lib/api/traffic-flags'),
  apiListTrafficFlags: jest.fn(),
  apiRevokeTrafficFlag: jest.fn(),
  apiMintDeviceLink: jest.fn(),
}));

const mockedAnalytics = analyticsApi as jest.Mocked<typeof analyticsApi>;
const mockedFlags = flagsApi as jest.Mocked<typeof flagsApi>;

const marked = person({ visitorNumber: 1042 });
const flag = (o: Partial<TrafficFlag>): TrafficFlag => ({
  id: 'f1',
  subjectType: 'VISITOR',
  subjectId: marked.visitorId,
  trafficClass: 'OWNER',
  reason: 'My phone',
  createdBy: 'u1',
  createdAt: '2026-09-12T13:20:00.000Z',
  revokedAt: null,
  revokedBy: null,
  affected: { visitors: 1, events: 64, orders: 0, fromDay: '2026-09-02' },
  ...o,
});

/**
 * Who counts (dashboard#111, #128): the settings sheet the "This is us" pill
 * opens. Ported from the Exclusions strip's own tests, which it replaces.
 */
describe('Who counts sheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFlags.apiListTrafficFlags.mockResolvedValue({
      items: [flag({}), flag({ id: 'f2', trafficClass: 'BOT', subjectId: 'x', reason: null }), flag({ id: 'f3', revokedAt: '2026-09-14T10:00:00.000Z', subjectId: 'y' })],
    });
  });

  it('clears this browser’s marker and explains that an active dashboard session remains excluded', async () => {
    mockedAnalytics.apiGetStaffDeviceStatus.mockResolvedValue({ staffDevice: true, excluded: true, reasons: ['STAFF_DEVICE_COOKIE', 'DASHBOARD_SESSION'] });
    mockedAnalytics.apiClearStaffDevice.mockResolvedValue({ staffDevice: false, excluded: true, reasons: ['DASHBOARD_SESSION'] });
    render(
      <Harness api={shellApi([marked])}>
        <WhoCountsSheet onClose={jest.fn()} onScope={jest.fn()} />
      </Harness>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Count this device again' }));
    expect(mockedAnalytics.apiClearStaffDevice).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/sign out before visiting the shop/i)).toBeInTheDocument();
    expect(screen.getByText(/signing in to the dashboard again marks it again/i)).toBeInTheDocument();
  });

  it('lists the people marked as us by name, restores one, and keeps the history', async () => {
    mockedAnalytics.apiGetStaffDeviceStatus.mockResolvedValue({ staffDevice: false, excluded: false, reasons: [] });
    mockedFlags.apiRevokeTrafficFlag.mockResolvedValue(flag({ revokedAt: '2026-09-22T10:00:00.000Z' }));
    const api = shellApi([marked]);
    render(
      <Harness api={api}>
        <WhoCountsSheet onClose={jest.fn()} onScope={jest.fn()} />
      </Harness>,
    );
    expect(await screen.findByText('Counted.')).toBeInTheDocument();
    expect(screen.getAllByText('Visitor #1042').length).toBeGreaterThan(0);
    expect(screen.getByText(/1 more verdict/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage every verdict' })).toHaveAttribute('href', '/analytics/flags');
    expect(screen.getByRole('button', { name: /exclude another device/i })).toBeInTheDocument();
    expect(screen.getByText(/counted again/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(mockedFlags.apiRevokeTrafficFlag).toHaveBeenCalledWith('f1'));
    await waitFor(() => expect(api.toast).toHaveBeenCalledWith('Visitor #1042 counts again'));
  });

  it('saves the traffic scope only when it changed', async () => {
    mockedAnalytics.apiGetStaffDeviceStatus.mockResolvedValue({ staffDevice: false, excluded: false, reasons: [] });
    const onScope = jest.fn();
    const onClose = jest.fn();
    render(
      <Harness api={shellApi([])}>
        <WhoCountsSheet onClose={onClose} onScope={onScope} />
      </Harness>,
    );
    fireEvent.click(screen.getByRole('radio', { name: /Everyone, bots included/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onScope).toHaveBeenCalledWith('all');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('the pill and the device line', () => {
  it('say who is left out', () => {
    expect(whoCountsLabel('real', { staffDevice: true, excluded: true, reasons: [] })).toBe('Excluding you, staff & bots');
    expect(whoCountsLabel('real', null)).toBe('Excluding staff & bots');
    expect(whoCountsLabel('all', null)).toBe('Counting everyone, bots included');
    expect(deviceLine({ staffDevice: false, excluded: false, reasons: [] })).toBe('Counted.');
  });
});

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrafficFlagPanel from '@/components/dashboard/analytics/TrafficFlagPanel';

jest.mock('@/lib/api/client', () => ({ apiFetch: jest.fn() }));
import { apiFetch } from '@/lib/api/client';

const mockFetch = apiFetch as jest.Mock;
const USER = '3f6b8d2a-1c4e-4a8b-9f10-2b7c5d9e0a11';

function flag(over: Record<string, unknown> = {}) {
  return {
    id: 'f-1',
    subjectType: 'USER',
    subjectId: USER,
    trafficClass: 'OWNER',
    reason: 'my phone',
    createdBy: null,
    createdAt: '2026-09-19T10:00:00Z',
    revokedAt: null,
    revokedBy: null,
    affected: { visitors: 3, events: 412, orders: 3, fromDay: '2026-09-02' },
    ...over,
  };
}

beforeEach(() => mockFetch.mockReset());

describe('TrafficFlagPanel (dashboard#111)', () => {
  it('tags an account as owner/test and shows what it excluded', async () => {
    mockFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path.startsWith('/analytics/flags/subject/')) return Promise.resolve({ flag: null });
      if (path === '/analytics/flags' && init?.method === 'POST') return Promise.resolve(flag());
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    const user = userEvent.setup();
    render(<TrafficFlagPanel subjectType="USER" subjectId={USER} />);

    await user.click(await screen.findByRole('button', { name: /exclude or verify/i }));
    await user.click(screen.getByRole('radio', { name: /owner \/ test account/i }));
    await user.click(screen.getByRole('button', { name: /^apply$/i }));

    await waitFor(() => expect(screen.getByText(/excluded from every count/i)).toBeInTheDocument());
    expect(screen.getByText(/412 events · 3 orders · 3 devices since 2 Sep/)).toBeInTheDocument();
    const post = mockFetch.mock.calls.find(([p, i]) => p === '/analytics/flags' && i?.method === 'POST');
    expect(JSON.parse(post![1].body)).toEqual({
      subjectType: 'USER',
      subjectId: USER,
      trafficClass: 'OWNER',
      reason: null,
    });
  });

  it('"Count again" lifts the verdict instead of writing a new one', async () => {
    mockFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path.startsWith('/analytics/flags/subject/')) return Promise.resolve({ flag: flag() });
      if (path === '/analytics/flags/f-1' && init?.method === 'DELETE') return Promise.resolve(flag({ revokedAt: 'x' }));
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    const user = userEvent.setup();
    render(<TrafficFlagPanel subjectType="USER" subjectId={USER} />);

    await user.click(await screen.findByRole('button', { name: /^change$/i }));
    await user.click(screen.getByRole('radio', { name: /counts normally/i }));
    await user.click(screen.getByRole('button', { name: /count again/i }));

    await waitFor(() => expect(screen.getByText(/^counts normally$/i)).toBeInTheDocument());
    expect(mockFetch.mock.calls.some(([p, i]) => p === '/analytics/flags/f-1' && i?.method === 'DELETE')).toBe(true);
    expect(mockFetch.mock.calls.some(([p, i]) => p === '/analytics/flags' && i?.method === 'POST')).toBe(false);
  });

  it('asks for a reason before marking something suspicious', async () => {
    mockFetch.mockResolvedValue({ flag: null });
    const user = userEvent.setup();
    render(<TrafficFlagPanel subjectType="VISITOR" subjectId={USER} />);
    await user.click(await screen.findByRole('button', { name: /exclude or verify/i }));
    await user.click(screen.getByRole('radio', { name: /suspicious/i }));
    expect(screen.getByRole('button', { name: /^apply$/i })).toBeDisabled();
  });
});

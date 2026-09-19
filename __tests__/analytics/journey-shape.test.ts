import { describe, expect, it } from '@jest/globals';

jest.mock('@/lib/api/client', () => ({ apiFetch: jest.fn() }));
import { apiFetch } from '@/lib/api/client';
import { apiGetVisitorJourney } from '@/lib/api/analytics-insights';

const mock = apiFetch as jest.Mock;
const env = (data: unknown) => ({ range: { from: 'a', to: 'b' }, freshness: { rollupLastOkAt: null, staleBuckets: 0 }, data });
const ev = { eventId: 'e1', eventName: 'page_view', occurredAt: '2026-09-19T10:00:00Z' };

describe('apiGetVisitorJourney (#123 shape change)', () => {
  it('reads the old bare-array journey', async () => {
    mock.mockResolvedValueOnce(env([ev]));
    const r = await apiGetVisitorJourney('v1', { from: 'a', to: 'b' });
    expect(r.data).toEqual([ev]);
    expect(r.identity).toBeNull();
  });

  it('reads the new identity-wrapped journey', async () => {
    mock.mockResolvedValueOnce(env({ visitorId: 'v1', visitorNumber: 1042, customer: { id: 'c1', name: 'Mariam' }, events: [ev] }));
    const r = await apiGetVisitorJourney('v1', { from: 'a', to: 'b' });
    expect(r.data).toEqual([ev]);
    expect(r.identity).toEqual({ visitorNumber: 1042, customer: { id: 'c1', name: 'Mariam' } });
  });
});

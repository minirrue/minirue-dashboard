import {
  apiCreateEmailCampaign,
  apiEmailEvents,
  apiEmailThreads,
  apiReplyToEmailThread,
  apiSendEmailCampaign,
  collectionItems,
} from '@/lib/api/email-operations';

const fetchMock = jest.fn();

beforeAll(() => {
  Object.defineProperty(global, 'fetch', { value: fetchMock, writable: true });
});

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ items: [] }),
  });
});

it('builds encoded email inbox and event filters', async () => {
  await apiEmailThreads({ search: 'order #42', status: 'CLOSED' });
  await apiEmailEvents(500);
  expect(fetchMock.mock.calls[0][0]).toContain('/v1/admin/emails/threads?q=order+%2342&status=CLOSED');
  expect(fetchMock.mock.calls[1][0]).toContain('/v1/admin/emails/events?limit=500');
});

it('uses the pinned reply and campaign endpoints with JSON payloads', async () => {
  await apiReplyToEmailThread('thread/a', { text: 'Thanks' });
  await apiCreateEmailCampaign({ name: 'VIP', subject: 'Thank you', text: 'Hello {{unsubscribe_url}}', html: '<p>Hello</p><a href="{{unsubscribe_url}}">Unsubscribe</a>', audience: { customerIds: ['03ba1ba5-d417-4f28-85f3-3c404eeda96b'] } });
  await apiSendEmailCampaign('campaign/a');

  expect(fetchMock.mock.calls[0][0]).toContain('/v1/admin/emails/threads/thread%2Fa/reply');
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ text: 'Thanks' }) });
  expect(fetchMock.mock.calls[1][0]).toContain('/v1/admin/email-campaigns');
  expect(fetchMock.mock.calls[2][0]).toContain('/v1/admin/email-campaigns/campaign%2Fa/send');
});

it('normalizes supported collection response envelopes without fake data', () => {
  const row = { id: 'one' };
  expect(collectionItems([row])).toEqual([row]);
  expect(collectionItems({ items: [row] })).toEqual([row]);
  expect(collectionItems({ data: [row] })).toEqual([row]);
  expect(collectionItems({ results: [row] })).toEqual([row]);
  expect(collectionItems({})).toEqual([]);
});

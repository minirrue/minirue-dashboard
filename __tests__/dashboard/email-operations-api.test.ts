import {
  apiCreateEmailTemplate,
  apiDuplicateEmailTemplate,
  apiEmailBranding,
  apiCustomerEmailActivity,
  apiCreateEmailCampaign,
  apiEmailEvents,
  apiEmailTemplates,
  apiEmailThreads,
  apiReplyToEmailThread,
  apiSendDirectEmail,
  apiSendEmailCampaign,
  apiUpdateEmailBranding,
  apiUpdateEmailTemplate,
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

it('uses the pinned direct-send, templates and branding contracts', async () => {
  await apiSendDirectEmail({
    to: 'customer@example.test',
    customerId: 'customer-1',
    orderId: 'order-1',
    templateKey: 'order.follow_up',
    subject: 'About {{orderNumber}}',
    text: 'Hello {{customerName}}',
    variables: { customerName: 'Mariam', orderNumber: 'MR-42' },
  });
  await apiEmailTemplates();
  await apiCreateEmailTemplate({ key: 'order.follow_up', name: 'Order follow-up', subject: 'Update', textBody: 'Hello' });
  await apiUpdateEmailTemplate('template/a', { name: 'Updated', subject: 'Update', textBody: 'Hello' });
  await apiDuplicateEmailTemplate('template/a');
  await apiEmailBranding();
  await apiUpdateEmailBranding({ logoUrl: null, logoShape: 'ROUNDED' });

  expect(fetchMock.mock.calls[0][0]).toContain('/v1/admin/emails/send');
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
  expect(fetchMock.mock.calls[1][0]).toContain('/v1/admin/email-templates');
  expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: 'POST' });
  expect(fetchMock.mock.calls[3][0]).toContain('/v1/admin/email-templates/template%2Fa');
  expect(fetchMock.mock.calls[3][1]).toMatchObject({ method: 'PATCH' });
  expect(fetchMock.mock.calls[4][0]).toContain('/v1/admin/email-templates/template%2Fa/duplicate');
  expect(fetchMock.mock.calls[5][0]).toContain('/v1/admin/email-branding');
  expect(fetchMock.mock.calls[6][1]).toMatchObject({ method: 'PATCH' });
});

it('composes a customer email log from real thread and event endpoints, including failure reasons', async () => {
  fetchMock.mockImplementation(async (url: string) => {
    const json = url.includes('/threads/thread-1')
      ? { thread: { id: 'thread-1', customerId: 'customer-1', participantEmail: 'mariam@example.test', subject: 'Delivery', status: 'OPEN', unread: false, lastMessageAt: '2026-09-17T10:00:00Z', createdAt: '2026-09-17T10:00:00Z', updatedAt: '2026-09-17T10:00:00Z' }, messages: [{ id: 'message-1', threadId: 'thread-1', direction: 'OUTBOUND', sender: 'contact@minirueshop.com', recipient: 'mariam@example.test', subject: 'Delivery', textBody: 'Update', createdAt: '2026-09-17T10:00:00Z' }] }
      : url.includes('/threads')
        ? [{ id: 'thread-1', customerId: 'customer-1', participantEmail: 'mariam@example.test', subject: 'Delivery', status: 'OPEN', unread: false, lastMessageAt: '2026-09-17T10:00:00Z', createdAt: '2026-09-17T10:00:00Z', updatedAt: '2026-09-17T10:00:00Z' }]
        : [{ id: 'event-1', messageId: 'message-1', eventType: 'FAILED', severity: 'ERROR', occurredAt: '2026-09-17T10:01:00Z', provider: 'RESEND', metadata: { reason: 'Mailbox rejected' } }];
    return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => json };
  });

  const activity = await apiCustomerEmailActivity({ customerId: 'customer-1', email: 'mariam@example.test' });
  expect(activity).toHaveLength(1);
  expect(activity[0]).toMatchObject({ status: 'FAILED', failureReason: 'Mailbox rejected' });
});

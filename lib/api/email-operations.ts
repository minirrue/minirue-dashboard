import { apiFetch } from './client';

export type EmailDeliveryStatus =
  | 'RECEIVED' | 'ACCEPTED' | 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED'
  | 'BOUNCED' | 'COMPLAINED' | 'DEFERRED' | 'FAILED';

export interface EmailThreadSummary {
  id: string;
  customerId?: string | null;
  customerName?: string | null;
  participantEmail: string;
  subject: string;
  status: 'OPEN' | 'CLOSED';
  unread: boolean;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  provider?: string | null;
  sender: string;
  recipient: string;
  subject: string;
  textBody?: string | null;
  htmlBody?: string | null;
  createdAt: string;
}

export interface EmailEvent {
  id: string;
  messageId: string;
  eventType: EmailDeliveryStatus;
  severity: 'INFO' | 'WARN' | 'ERROR';
  occurredAt: string;
  provider: string;
  metadata?: Record<string, unknown> | null;
}

export interface EmailThreadDetail {
  thread: EmailThreadSummary & {
    orders?: Array<{ id: string; orderNumber: string; status: string; createdAt: string }>;
  };
  messages: EmailMessage[];
}

export interface EmailTemplate {
  id: string;
  key: string;
  name: string;
  subject: string;
  textBody: string;
  htmlBody?: string | null;
  variables?: string[];
  createdAt: string;
  updatedAt: string;
}

export type EmailLogoShape = 'RECTANGLE' | 'ROUNDED' | 'CIRCLE';

export interface EmailBranding {
  logoUrl: string | null;
  logoShape: EmailLogoShape;
}

export interface DirectEmailInput {
  to: string;
  customerId?: string;
  orderId?: string;
  templateKey?: string;
  subject: string;
  text: string;
  variables: Record<string, string>;
}

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  audience: { customerIds: string[] };
  status: 'DRAFT' | 'SENDING' | 'SENT' | 'FAILED';
  recipientCount?: number | null;
  sentAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

type Collection<T> = T[] | { items?: T[]; data?: T[]; results?: T[] };

export function collectionItems<T>(value: Collection<T>): T[] {
  if (Array.isArray(value)) return value;
  return value.items ?? value.data ?? value.results ?? [];
}

export function apiEmailThreads(params: { search?: string; status?: string; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('q', params.search);
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));
  const suffix = query.size ? `?${query.toString()}` : '';
  return apiFetch<Collection<EmailThreadSummary>>(`/admin/emails/threads${suffix}`, { auth: true });
}

export const apiEmailThread = (id: string) =>
  apiFetch<EmailThreadDetail>(`/admin/emails/threads/${encodeURIComponent(id)}`, { auth: true });

export const apiReplyToEmailThread = (id: string, payload: { text: string; html?: string }) =>
  apiFetch<EmailMessage>(`/admin/emails/threads/${encodeURIComponent(id)}/reply`, {
    auth: true,
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const apiEmailEvents = (limit = 100) =>
  apiFetch<Collection<EmailEvent>>(`/admin/emails/events?limit=${limit}`, { auth: true });

export const apiEmailCampaigns = () =>
  apiFetch<Collection<EmailCampaign>>('/admin/email-campaigns', { auth: true });

export const apiCreateEmailCampaign = (payload: {
  name: string;
  subject: string;
  html: string;
  text: string;
  audience: { customerIds: string[] };
}) =>
  apiFetch<EmailCampaign>('/admin/email-campaigns', {
    auth: true,
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const apiSendEmailCampaign = (id: string) =>
  apiFetch<{ campaignId: string; status: 'SENT' | 'FAILED'; recipientCount: number }>(`/admin/email-campaigns/${encodeURIComponent(id)}/send`, {
    auth: true,
    method: 'POST',
  });

/**
 * The direct-send, template and branding endpoints are the smallest remaining
 * backend contract for dashboard#81. Keeping them here makes unsupported
 * servers fail explicitly through apiFetch instead of simulating success.
 */
export const apiSendDirectEmail = (payload: DirectEmailInput) =>
  apiFetch<{ id: string; status: 'SENT' | 'FAILED' }>('/admin/emails/send', {
    auth: true,
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const apiEmailTemplates = () =>
  apiFetch<Collection<EmailTemplate>>('/admin/email-templates', { auth: true });

export const apiCreateEmailTemplate = (payload: Pick<EmailTemplate, 'key' | 'name' | 'subject' | 'textBody'> & { htmlBody?: string | null }) =>
  apiFetch<EmailTemplate>('/admin/email-templates', {
    auth: true,
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const apiUpdateEmailTemplate = (id: string, payload: Pick<EmailTemplate, 'name' | 'subject' | 'textBody'> & { htmlBody?: string | null }) =>
  apiFetch<EmailTemplate>(`/admin/email-templates/${encodeURIComponent(id)}`, {
    auth: true,
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const apiDuplicateEmailTemplate = (id: string) =>
  apiFetch<EmailTemplate>(`/admin/email-templates/${encodeURIComponent(id)}/duplicate`, {
    auth: true,
    method: 'POST',
  });

export const apiEmailBranding = () =>
  apiFetch<EmailBranding>('/admin/email-branding', { auth: true });

export const apiUpdateEmailBranding = (payload: EmailBranding) =>
  apiFetch<EmailBranding>('/admin/email-branding', {
    auth: true,
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export interface CustomerEmailActivityItem {
  thread: EmailThreadSummary;
  message: EmailMessage;
  events: EmailEvent[];
  status: EmailDeliveryStatus;
  failureReason: string | null;
}

/** Composes customer history from the shipped thread/detail/event APIs. */
export async function apiCustomerEmailActivity(input: { customerId: string; email?: string | null }): Promise<CustomerEmailActivityItem[]> {
  const [threadEnvelope, eventEnvelope] = await Promise.all([apiEmailThreads({ limit: 100 }), apiEmailEvents(500)]);
  const normalizedEmail = input.email?.trim().toLowerCase();
  const threads = collectionItems(threadEnvelope).filter((thread) =>
    thread.customerId === input.customerId || (!!normalizedEmail && thread.participantEmail.toLowerCase() === normalizedEmail),
  );
  const details = await Promise.all(threads.map((thread) => apiEmailThread(thread.id)));
  const events = collectionItems(eventEnvelope);
  return details.flatMap((detail) => detail.messages.map((message) => {
    const messageEvents = events.filter((event) => event.messageId === message.id).sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
    const latest = messageEvents.at(-1);
    const metadata = latest?.metadata ?? {};
    const reason = [metadata['reason'], metadata['error'], metadata['message']].find((value) => typeof value === 'string') as string | undefined;
    return {
      thread: detail.thread,
      message,
      events: messageEvents,
      status: message.direction === 'INBOUND' ? 'RECEIVED' : latest?.eventType ?? 'SENT',
      failureReason: reason ?? null,
    };
  })).sort((a, b) => new Date(b.message.createdAt).getTime() - new Date(a.message.createdAt).getTime());
}

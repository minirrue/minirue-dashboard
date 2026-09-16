import { apiFetch } from './client';

export type EmailDeliveryStatus =
  | 'RECEIVED' | 'ACCEPTED' | 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED'
  | 'BOUNCED' | 'COMPLAINED' | 'DEFERRED' | 'FAILED';

export interface EmailThreadSummary {
  id: string;
  customerId?: string | null;
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
  thread: EmailThreadSummary;
  messages: EmailMessage[];
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

export function apiEmailThreads(params: { search?: string; status?: string } = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('q', params.search);
  if (params.status) query.set('status', params.status);
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

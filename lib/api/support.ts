import { apiFetch, apiUpload } from './client';

export interface ConversationDto {
  id: string;
  type: 'ITEM' | 'GENERAL';
  status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
  customerId: string | null;
  customerEmail?: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhoneCountry?: string | null;
  guestPhone?: string | null;
  collaboratorId: string | null;
  productId: string | null;
  subjectSnapshot: Record<string, unknown> | null;
  lastMessageAt: string;
  customerReadAt: string | null;
  teamReadAt: string | null;
}

export interface MessageAttachmentDto {
  url: string;
  kind: 'image';
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderType: 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'COLLAB' | 'SYSTEM';
  senderUserId: string | null;
  senderName?: string | null;
  body: string;
  attachments?: MessageAttachmentDto[];
  createdAt: string;
}

export interface PresenceDto {
  id: number;
  status: 'ONLINE' | 'IDLE' | 'AWAY' | 'OFFLINE';
  replyTimeText?: string | null;
  updatedAt: string;
}

export const apiSupportConversations = (status?: string) =>
  apiFetch<ConversationDto[]>(`/support/conversations${status ? `?status=${status}` : ''}`, { auth: true });

export const apiSupportThread = (id: string, after?: string) =>
  apiFetch<{ conversation: ConversationDto; messages: MessageDto[] }>(
    `/support/conversations/${id}${after ? `?after=${after}` : ''}`,
    { auth: true },
  );

export const apiSupportSend = (id: string, body: string, attachments?: MessageAttachmentDto[]) =>
  apiFetch<MessageDto>(`/support/conversations/${id}/messages`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ body, ...(attachments?.length ? { attachments } : {}) }),
  });

/** Uploads a single image for a support message and returns its hosted URL. */
export const apiSupportUpload = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload<{ url: string }>('/support/uploads', formData);
};

export const apiSupportMarkRead = (id: string) =>
  apiFetch<void>(`/support/conversations/${id}/read`, { method: 'POST', auth: true });

export const apiSupportPresence = () => apiFetch<PresenceDto>('/support/presence', { auth: true });

export const apiSupportSetPresence = (patch: { status?: string; replyTimeText?: string }) =>
  apiFetch<PresenceDto>('/support/presence', {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(patch),
  });

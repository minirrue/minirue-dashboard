import { apiFetch } from './client';

export interface ConversationDto {
  id: string;
  type: 'ITEM' | 'GENERAL';
  status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
  customerId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  collaboratorId: string | null;
  productId: string | null;
  subjectSnapshot: Record<string, unknown> | null;
  lastMessageAt: string;
  customerReadAt: string | null;
  teamReadAt: string | null;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderType: 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'COLLAB' | 'SYSTEM';
  senderUserId: string | null;
  body: string;
  createdAt: string;
}

export interface PresenceDto {
  id: number;
  status: 'ONLINE' | 'IDLE' | 'AWAY' | 'OFFLINE';
  updatedAt: string;
}

export const apiSupportConversations = (status?: string) =>
  apiFetch<ConversationDto[]>(`/support/conversations${status ? `?status=${status}` : ''}`, { auth: true });

export const apiSupportThread = (id: string, after?: string) =>
  apiFetch<{ conversation: ConversationDto; messages: MessageDto[] }>(
    `/support/conversations/${id}${after ? `?after=${after}` : ''}`,
    { auth: true },
  );

export const apiSupportSend = (id: string, body: string) =>
  apiFetch<MessageDto>(`/support/conversations/${id}/messages`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ body }),
  });

export const apiSupportMarkRead = (id: string) =>
  apiFetch<void>(`/support/conversations/${id}/read`, { method: 'POST', auth: true });

export const apiSupportPresence = () => apiFetch<PresenceDto>('/support/presence', { auth: true });

export const apiSupportSetPresence = (status: string) =>
  apiFetch<PresenceDto>('/support/presence', {
    method: 'PUT',
    auth: true,
    body: JSON.stringify({ status }),
  });

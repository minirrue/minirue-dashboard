import { apiFetch, apiUpload } from './client';

export interface ConversationDto {
  id: string;
  type: 'ITEM' | 'GENERAL';
  status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
  customerId: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
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
  /** Whether the customer is currently active on the storefront. Legacy boolean
   * kept as a fallback for `customerPresence`; treated as offline when absent. */
  customerOnline?: boolean;
  /** Three-state live presence of the customer on the storefront. Backend field
   * added in parallel; falls back to `customerOnline` when absent. */
  customerPresence?: 'ONLINE' | 'IDLE' | 'OFFLINE';
  /** Real latest-message text, already truncated by the backend, or '📷 Photo'
   * for an image-only message. Null when the thread has no messages yet. */
  lastMessagePreview?: string | null;
  /** Who sent the latest message — used to prefix the preview with "You:" when
   * it was a team member. Null when there is no latest message. */
  lastMessageSenderType?: 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'COLLAB' | 'SYSTEM' | null;
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

/** Admin action: merges `sourceId` INTO `intoId` — the source conversation is
 * absorbed (all its messages move over) and removed; `intoId` survives. Returns
 * the enriched surviving conversation. */
export const apiSupportMergeConversation = (sourceId: string, intoId: string) =>
  apiFetch<ConversationDto>(`/support/conversations/${sourceId}/merge`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ intoId }),
  });

export const apiSupportPresence = () => apiFetch<PresenceDto>('/support/presence', { auth: true });

export const apiSupportSetPresence = (patch: { status?: string; replyTimeText?: string }) =>
  apiFetch<PresenceDto>('/support/presence', {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(patch),
  });

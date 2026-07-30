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
  /** The brand this thread is addressed to; null means MiniRue direct. */
  brandName?: string | null;
  /** Set when the thread was resolved or closed; cleared when it reopens. */
  closedAt?: string | null;
  closedBy?: string | null;
  /**
   * When the team allowed this GUEST conversation to attach images. Null means
   * not allowed — an unclaimed thread is anonymous, so files from it are refused
   * until someone knows who they are talking to.
   */
  guestAttachmentsAllowedAt?: string | null;
  /** Set when the conversation was archived (moved to trash); null = live/visible
   * in the normal inbox. Cleared on restore. */
  archivedAt?: string | null;
  archivedBy?: string | null;
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
  /** Resolved server-side: personal avatar -> (COLLAB) brand logo -> null.
   * Null means the client shows the sender's initial letter, never a broken
   * image or an empty gap. */
  senderAvatarUrl?: string | null;
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

/**
 * `brand` slices the team inbox by the brand a thread is tagged to: a collaborator
 * id, or the literal 'direct' for untagged MiniRue threads. Ignored for a COLLAB
 * viewer, whose list is already scoped to their own brand.
 *
 * `customerId` is the W2.1 middle pane: every room ONE customer has on this
 * desk — `support.repository.ts:52`'s filter has existed since it was written
 * and this is the first caller. `view: 'trash'` is the archived group; omitted
 * (the default) is the live/history inbox.
 */
export const apiSupportConversations = (opts: {
  status?: string;
  brand?: string;
  customerId?: string;
  view?: 'trash';
} = {}) => {
  const qs = new URLSearchParams();
  if (opts.status) qs.set('status', opts.status);
  if (opts.brand) qs.set('brand', opts.brand);
  if (opts.customerId) qs.set('customerId', opts.customerId);
  if (opts.view) qs.set('view', opts.view);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<ConversationDto[]>(`/support/conversations${suffix}`, { auth: true });
};

/**
 * GET /support/people (W1.6/W2.1) — one row per customer, unread rolled up
 * across every one of their (non-archived) rooms, most recent activity
 * first. `collaboratorId` scopes to one desk; ignored for a COLLAB viewer,
 * whose rows are already scoped to their own desk server-side.
 */
export interface SupportPersonDto {
  customerId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  presence: 'ONLINE' | 'IDLE' | 'OFFLINE' | null;
  /** Non-archived rooms only. */
  conversationCount: number;
  /** Rolled up across every room counted in `conversationCount`. */
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessageSnippet: string | null;
  lastMessageSenderType: 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'SUPERADMIN' | 'COLLAB' | 'SYSTEM' | null;
}

export const apiSupportPeople = (opts: {
  collaboratorId?: string;
  status?: string;
  view?: 'trash';
} = {}) => {
  const qs = new URLSearchParams();
  if (opts.collaboratorId) qs.set('collaboratorId', opts.collaboratorId);
  if (opts.status) qs.set('status', opts.status);
  if (opts.view) qs.set('view', opts.view);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<SupportPersonDto[]>(`/support/people${suffix}`, { auth: true });
};

/**
 * Team-only conversation patch: status (which is what resolve-and-close means) and
 * the guest attachment grant. Closing is enforced server-side — a closed thread
 * refuses new messages from everyone, including us — so this is a real state
 * change, not a UI toggle.
 */
export const apiSupportUpdateConversation = (
  id: string,
  patch: {
    status?: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
    assignedStaffId?: string | null;
    guestAttachmentsAllowed?: boolean;
  },
) =>
  apiFetch<ConversationDto>(`/support/conversations/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(patch),
  });

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

/**
 * Archive / restore / hard-delete — live on the server since this batch
 * (`archivedAt`/`archivedBy` columns, `?view=trash`) but never called from the
 * dashboard until now (W2.1). Archiving and restoring are open to STAFF/ADMIN
 * and a COLLAB tidying their own desk (the server's `requireVisible` already
 * stops them reaching anyone else's); hard delete is ADMIN-only and requires
 * the conversation to already be archived.
 */
export const apiSupportArchiveConversation = (id: string) =>
  apiFetch<void>(`/support/conversations/${id}/archive`, { method: 'POST', auth: true });

export const apiSupportRestoreConversation = (id: string) =>
  apiFetch<void>(`/support/conversations/${id}/restore`, { method: 'POST', auth: true });

export const apiSupportDeleteConversation = (id: string) =>
  apiFetch<void>(`/support/conversations/${id}`, { method: 'DELETE', auth: true });

export const apiSupportPresence = () => apiFetch<PresenceDto>('/support/presence', { auth: true });

export const apiSupportSetPresence = (patch: { status?: string; replyTimeText?: string }) =>
  apiFetch<PresenceDto>('/support/presence', {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(patch),
  });

/* ── Support desks ──
   One per space since backend 0.54.0. Fetched properly rather than derived
   from loaded conversations, which meant a partner with no threads had no
   option and their desk could not be opened at all. */

export interface SupportChannel {
  id: string;
  /** null = MiniRue's own desk. */
  collaboratorId: string | null;
  name: string;
  presenceStatus: string;
}

export async function apiSupportChannels(): Promise<{ data: SupportChannel[] }> {
  return apiFetch('/support/channels', { auth: true });
}

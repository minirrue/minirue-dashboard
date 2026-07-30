'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/lib/hooks/use-auth';
import {
  apiSupportConversations,
  apiSupportPeople,
  apiSupportThread,
  apiSupportSend,
  apiSupportPresence,
  apiSupportSetPresence,
  apiSupportUpload,
  apiSupportMarkRead,
  apiSupportUpdateConversation,
  apiSupportArchiveConversation,
  apiSupportRestoreConversation,
} from '@/lib/api/support';
import type { ConversationDto, MessageAttachmentDto, SupportPersonDto } from '@/lib/api/support';

/**
 * The signed-in viewer's own id, read from the same cached `/auth/me` query
 * every other screen already shares (`useUser`) — this adds no extra
 * request. `undefined` while that identity is still loading/unknown.
 *
 * Every query key below is built from this, and every query is gated on it,
 * because the cache is otherwise keyed purely on filter *values*
 * (status/brand/customerId) — and a collaborator's desk filter defaults to
 * the same 'direct' sentinel the team's own MiniRue-desk view uses. Two
 * different signed-in viewers making the "same" request (identical params)
 * would land on the exact same cache entry, so a result cached under one
 * identity could be served to a different one the instant a second identity
 * queries with matching params — the fix is to make identity part of the
 * key, not to trust that request params alone are unique per viewer.
 */
function useViewerId(): string | undefined {
  const { data: user } = useUser();
  return user?.userId;
}

export const SUPPORT_KEYS = {
  people: (viewerId: string, status?: string, collaboratorId?: string) =>
    ['support', 'people', viewerId, status ?? 'all', collaboratorId ?? 'all'] as const,
  conversations: (viewerId: string, status?: string, brand?: string, customerId?: string) =>
    ['support', 'conversations', viewerId, status ?? 'all', brand ?? 'all', customerId ?? 'all'] as const,
  archivedConversations: (viewerId: string, customerId: string, brand?: string) =>
    ['support', 'conversations', 'trash', viewerId, customerId, brand ?? 'all'] as const,
  thread: (viewerId: string, id: string) => ['support', 'thread', viewerId, id] as const,
  presence: (viewerId: string) => ['support', 'presence', viewerId] as const,
};

/** Placeholder segment for a query key belonging to nobody yet — always
 * paired with `enabled: false` below, so it is never actually used to read
 * or write a cache entry; it only keeps the key shape stable while React
 * Query evaluates `enabled`. */
const NO_VIEWER = '__unknown_viewer__';

/**
 * Every non-archived room for the whole team inbox, or (with `customerId`)
 * just one customer's rooms — the W2.1 middle pane. `enabled` defaults to
 * true; pass false while no customer is selected so the query does not fire
 * with `customerId: undefined` (which would be the whole-inbox list, not
 * "this person has no rooms yet"). Also gated on the viewer's own id being
 * known — see `useViewerId` above.
 */
export function useSupportConversations(
  opts: { status?: string; brand?: string; customerId?: string; enabled?: boolean } = {},
) {
  const { status, brand, customerId, enabled = true } = opts;
  const viewerId = useViewerId();
  return useQuery({
    queryKey: SUPPORT_KEYS.conversations(viewerId ?? NO_VIEWER, status, brand, customerId),
    queryFn: () => apiSupportConversations({ status, brand, customerId }),
    enabled: enabled && !!viewerId,
    refetchOnWindowFocus: true,
  });
}

/** The archived (trashed) rooms for one customer — the collapsed "Archived
 * (n)" group in the rooms pane. Only fetched once a person is selected AND
 * the viewer's own id is known. `brand` scopes to one desk, exactly like
 * `useSupportConversations` — without it, this list bled every desk's
 * archived rooms for the selected customer regardless of which desk was
 * picked. */
export function useSupportArchivedConversations(customerId: string | null, brand?: string) {
  const viewerId = useViewerId();
  return useQuery({
    queryKey: SUPPORT_KEYS.archivedConversations(viewerId ?? NO_VIEWER, customerId ?? '', brand),
    queryFn: () => apiSupportConversations({ customerId: customerId as string, view: 'trash', brand }),
    enabled: !!customerId && !!viewerId,
    refetchOnWindowFocus: true,
  });
}

/**
 * GET /support/people (W1.6) — one row per customer, the inbox's first
 * pane. `collaboratorId` scopes to one desk; ignored server-side for a
 * COLLAB viewer, whose rows are already scoped to their own desk
 * (support.service.ts `listPeopleForViewer`). Gated on the viewer's own id
 * being known, same as every other query here.
 */
export function useSupportPeople(opts: { status?: string; collaboratorId?: string } = {}) {
  const viewerId = useViewerId();
  return useQuery({
    queryKey: SUPPORT_KEYS.people(viewerId ?? NO_VIEWER, opts.status, opts.collaboratorId),
    queryFn: () => apiSupportPeople(opts),
    enabled: !!viewerId,
    refetchOnWindowFocus: true,
  });
}

/**
 * Team-only conversation patch: the status (resolve / close / reopen) and the
 * guest attachment grant. Both are enforced server-side — a closed thread refuses
 * new messages from everyone including us, and an ungranted guest cannot upload —
 * so these are real state changes, not UI toggles.
 *
 * Invalidates the list AND the open thread, because a close changes both the row
 * and whether the composer should be there at all.
 */
export function useUpdateConversation() {
  const qc = useQueryClient();
  const viewerId = useViewerId();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Parameters<typeof apiSupportUpdateConversation>[1];
    }) => apiSupportUpdateConversation(id, patch),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['support', 'conversations'] });
      void qc.invalidateQueries({ queryKey: ['support', 'people'] });
      void qc.invalidateQueries({ queryKey: SUPPORT_KEYS.thread(viewerId ?? NO_VIEWER, id) });
    },
  });
}

/**
 * Archive / restore a room — the feature shipped on the server with zero
 * callers (W2.1). Invalidates every conversation list variant (live, trash,
 * per-customer) plus the people rollup, since archiving changes a person's
 * `conversationCount`/`unreadCount` too.
 */
export function useArchiveConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiSupportArchiveConversation(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['support', 'conversations'] });
      void qc.invalidateQueries({ queryKey: ['support', 'people'] });
    },
  });
}

export function useRestoreConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiSupportRestoreConversation(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['support', 'conversations'] });
      void qc.invalidateQueries({ queryKey: ['support', 'people'] });
    },
  });
}

export function useSupportThread(id: string | null) {
  const viewerId = useViewerId();
  return useQuery({
    queryKey: SUPPORT_KEYS.thread(viewerId ?? NO_VIEWER, id ?? ''),
    queryFn: () => apiSupportThread(id as string),
    enabled: !!id && !!viewerId,
    refetchOnWindowFocus: true,
  });
}

/**
 * Single unified live-sync loop for the whole support inbox. One timer drives
 * the people rollup, the currently-open person's rooms (live + archived) and
 * the currently-open thread together — no competing intervals. Pauses while
 * the tab is hidden and does one immediate refresh when it becomes visible
 * again. (No sockets — the storefront is on Vercel; the backend SSE is
 * role-guarded.)
 */
export function useSupportLiveSync(activeId: string | null, activePersonId: string | null, intervalMs = 5_000) {
  const qc = useQueryClient();
  const viewerId = useViewerId();
  useEffect(() => {
    // No signed-in viewer yet: there is nothing of theirs cached to refresh,
    // and firing this against the placeholder key would be a no-op query
    // key mismatch anyway — skip the whole loop rather than start it against
    // an identity that might still change.
    if (!viewerId) return;
    const refresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void qc.invalidateQueries({ queryKey: ['support', 'people'] });
      void qc.invalidateQueries({ queryKey: ['support', 'conversations'] });
      if (activeId) void qc.invalidateQueries({ queryKey: SUPPORT_KEYS.thread(viewerId, activeId) });
    };
    const timer = window.setInterval(refresh, intervalMs);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // activePersonId isn't read above (the broad 'support','conversations'
    // invalidation already covers the per-customer query key's prefix) but is
    // taken as a param so callers don't have to think about that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, activeId, activePersonId, intervalMs, viewerId]);
}

export function useSendSupportMessage(id: string) {
  const qc = useQueryClient();
  const viewerId = useViewerId();
  return useMutation({
    mutationFn: ({ body, attachments }: { body: string; attachments?: MessageAttachmentDto[] }) =>
      apiSupportSend(id, body, attachments),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SUPPORT_KEYS.thread(viewerId ?? NO_VIEWER, id) });
    },
  });
}

/** Marks a conversation read for the team, optimistically zeroing its
 * unread badge in the cached conversation list so it clears the instant
 * the conversation is opened, then reconciles with the server. */
export function useSupportMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiSupportMarkRead(id),
    onMutate: (id: string) => {
      const now = new Date().toISOString();
      qc.setQueriesData<ConversationDto[]>(
        { queryKey: ['support', 'conversations'] },
        (old) =>
          old?.map((c) => (c.id === id ? { ...c, teamReadAt: now } : c)),
      );
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['support', 'conversations'] });
      void qc.invalidateQueries({ queryKey: ['support', 'people'] });
    },
  });
}

export function useSupportUpload() {
  return useMutation({
    mutationFn: (file: File) => apiSupportUpload(file),
  });
}

export function useSupportPresence() {
  const viewerId = useViewerId();
  return useQuery({
    queryKey: SUPPORT_KEYS.presence(viewerId ?? NO_VIEWER),
    queryFn: apiSupportPresence,
    enabled: !!viewerId,
    refetchInterval: 30_000,
  });
}

export function useSetPresence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { status?: string; replyTimeText?: string }) => apiSupportSetPresence(patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['support', 'presence'] });
    },
  });
}

export type { SupportPersonDto };

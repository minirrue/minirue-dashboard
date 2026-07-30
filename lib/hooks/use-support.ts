'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export const SUPPORT_KEYS = {
  people: (status?: string, collaboratorId?: string) =>
    ['support', 'people', status ?? 'all', collaboratorId ?? 'all'] as const,
  conversations: (status?: string, brand?: string, customerId?: string) =>
    ['support', 'conversations', status ?? 'all', brand ?? 'all', customerId ?? 'all'] as const,
  archivedConversations: (customerId: string, brand?: string) =>
    ['support', 'conversations', 'trash', customerId, brand ?? 'all'] as const,
  thread: (id: string) => ['support', 'thread', id] as const,
  presence: () => ['support', 'presence'] as const,
};

/**
 * Every non-archived room for the whole team inbox, or (with `customerId`)
 * just one customer's rooms — the W2.1 middle pane. `enabled` defaults to
 * true; pass false while no customer is selected so the query does not fire
 * with `customerId: undefined` (which would be the whole-inbox list, not
 * "this person has no rooms yet").
 */
export function useSupportConversations(
  opts: { status?: string; brand?: string; customerId?: string; enabled?: boolean } = {},
) {
  const { status, brand, customerId, enabled = true } = opts;
  return useQuery({
    queryKey: SUPPORT_KEYS.conversations(status, brand, customerId),
    queryFn: () => apiSupportConversations({ status, brand, customerId }),
    enabled,
    refetchOnWindowFocus: true,
  });
}

/** The archived (trashed) rooms for one customer — the collapsed "Archived
 * (n)" group in the rooms pane. Only fetched once a person is selected.
 * `brand` scopes to one desk, exactly like `useSupportConversations` — without
 * it, this list bled every desk's archived rooms for the selected customer
 * regardless of which desk was picked. */
export function useSupportArchivedConversations(customerId: string | null, brand?: string) {
  return useQuery({
    queryKey: SUPPORT_KEYS.archivedConversations(customerId ?? '', brand),
    queryFn: () => apiSupportConversations({ customerId: customerId as string, view: 'trash', brand }),
    enabled: !!customerId,
    refetchOnWindowFocus: true,
  });
}

/**
 * GET /support/people (W2.1) — one row per customer, the inbox's new first
 * pane. `collaboratorId` scopes to one desk; ignored server-side for a
 * COLLAB viewer, whose rows are already scoped to their own desk.
 */
export function useSupportPeople(opts: { status?: string; collaboratorId?: string } = {}) {
  return useQuery({
    queryKey: SUPPORT_KEYS.people(opts.status, opts.collaboratorId),
    queryFn: () => apiSupportPeople(opts),
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
      void qc.invalidateQueries({ queryKey: SUPPORT_KEYS.thread(id) });
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
  return useQuery({
    queryKey: SUPPORT_KEYS.thread(id ?? ''),
    queryFn: () => apiSupportThread(id as string),
    enabled: !!id,
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
  useEffect(() => {
    const refresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void qc.invalidateQueries({ queryKey: ['support', 'people'] });
      void qc.invalidateQueries({ queryKey: ['support', 'conversations'] });
      if (activeId) void qc.invalidateQueries({ queryKey: SUPPORT_KEYS.thread(activeId) });
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
  }, [qc, activeId, activePersonId, intervalMs]);
}

export function useSendSupportMessage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, attachments }: { body: string; attachments?: MessageAttachmentDto[] }) =>
      apiSupportSend(id, body, attachments),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SUPPORT_KEYS.thread(id) });
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
  return useQuery({
    queryKey: SUPPORT_KEYS.presence(),
    queryFn: apiSupportPresence,
    refetchInterval: 30_000,
  });
}

export function useSetPresence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { status?: string; replyTimeText?: string }) => apiSupportSetPresence(patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SUPPORT_KEYS.presence() });
    },
  });
}

export type { SupportPersonDto };

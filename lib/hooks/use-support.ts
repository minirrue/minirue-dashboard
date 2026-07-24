'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiSupportConversations,
  apiSupportThread,
  apiSupportSend,
  apiSupportPresence,
  apiSupportSetPresence,
  apiSupportUpload,
  apiSupportMarkRead,
} from '@/lib/api/support';
import type { ConversationDto, MessageAttachmentDto } from '@/lib/api/support';

export const SUPPORT_KEYS = {
  conversations: (status?: string) => ['support', 'conversations', status ?? 'all'] as const,
  thread: (id: string) => ['support', 'thread', id] as const,
  presence: () => ['support', 'presence'] as const,
};

export function useSupportConversations(status?: string) {
  return useQuery({
    queryKey: SUPPORT_KEYS.conversations(status),
    queryFn: () => apiSupportConversations(status),
    refetchOnWindowFocus: true,
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
 * BOTH the conversation list and the currently-open thread so they always
 * refresh together — no two competing intervals. Pauses while the tab is
 * hidden and does one immediate refresh when it becomes visible again.
 * (No sockets — the storefront is on Vercel; the backend SSE is role-guarded.)
 */
export function useSupportLiveSync(activeId: string | null, intervalMs = 5_000) {
  const qc = useQueryClient();
  useEffect(() => {
    const refresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
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
  }, [qc, activeId, intervalMs]);
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

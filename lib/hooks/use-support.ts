'use client';

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
    refetchInterval: 15_000,
  });
}

export function useSupportThread(id: string | null) {
  return useQuery({
    queryKey: SUPPORT_KEYS.thread(id ?? ''),
    queryFn: () => apiSupportThread(id as string),
    enabled: !!id,
  });
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

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiSupportConversations,
  apiSupportThread,
  apiSupportSend,
  apiSupportPresence,
  apiSupportSetPresence,
} from '@/lib/api/support';

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
    mutationFn: (body: string) => apiSupportSend(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SUPPORT_KEYS.thread(id) });
    },
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
    mutationFn: apiSupportSetPresence,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SUPPORT_KEYS.presence() });
    },
  });
}

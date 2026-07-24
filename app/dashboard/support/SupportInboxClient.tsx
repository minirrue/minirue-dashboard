'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { DashChatView, type Conversation, type Message, type MessageAttachment } from '@/components/DashChatView';
import {
  useSupportConversations,
  useSupportThread,
  useSupportLiveSync,
  useSendSupportMessage,
  useSupportPresence,
  useSetPresence,
  useSupportUpload,
  useSupportMarkRead,
} from '@/lib/hooks/use-support';
import { useUser } from '@/lib/hooks/use-auth';
import { Role } from '@/lib/auth/role';
import type { PresenceDto } from '@/lib/api/support';
import type { ConversationDto, MessageDto } from '@/lib/api/support';
import { useAdminNotifications } from '@/components/dashboard/notifications/useAdminNotifications';

function initials(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

function guestPhoneDisplay(dto: ConversationDto): string | undefined {
  if (!dto.guestPhone) return undefined;
  return dto.guestPhoneCountry ? `${dto.guestPhoneCountry} ${dto.guestPhone}` : dto.guestPhone;
}

const TEAM_SENDER_TYPES = new Set(['STAFF', 'ADMIN', 'SUPERADMIN', 'COLLAB', 'SYSTEM']);

function toConversation(dto: ConversationDto): Conversation {
  const name = dto.customerName || dto.guestName || 'Customer';
  const unread = dto.teamReadAt && dto.teamReadAt >= dto.lastMessageAt ? 0 : 1;
  const rawPreview = dto.lastMessagePreview ?? null;
  const preview = rawPreview
    ? (dto.lastMessageSenderType && TEAM_SENDER_TYPES.has(dto.lastMessageSenderType) ? `You: ${rawPreview}` : rawPreview)
    : '';
  const presence = dto.customerPresence ?? (dto.customerOnline ? 'ONLINE' : 'OFFLINE');
  return {
    id: dto.id,
    name,
    preview,
    time: new Date(dto.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    unread,
    avatar: initials(name),
    presence,
    kind: dto.type === 'ITEM' ? 'ITEM' : 'GENERAL',
    customerId: dto.customerId ?? undefined,
    contact: {
      name: dto.customerName ?? dto.guestName ?? undefined,
      email: dto.customerEmail ?? dto.guestEmail ?? undefined,
      phone: dto.customerPhone ?? guestPhoneDisplay(dto),
    },
  };
}

/** Friendly day label from a full timestamp, for in-thread date separators.
 * Uses the real message date only — never a fabricated one. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

function toMessage(dto: MessageDto): Message {
  const isCustomer = dto.senderType === 'CUSTOMER';
  return {
    from: isCustomer ? 'cx' : 'agent',
    name: dto.senderName ?? (isCustomer ? 'Customer' : 'MiniRue'),
    text: dto.body,
    time: new Date(dto.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    day: dayLabel(dto.createdAt),
    attachments: dto.attachments as MessageAttachment[] | undefined,
  };
}

export interface SupportInboxClientProps {
  /** Show the presence status area in the thread header. Admin/superadmin get
   * an editable switcher + reply-time input; staff get a read-only dot. Off
   * (default) for the collaborator inbox, which has no presence concept. */
  showPresence?: boolean;
}

const PRESENCE_OPTIONS: PresenceDto['status'][] = ['ONLINE', 'IDLE', 'AWAY', 'OFFLINE'];

const presenceDotColor: Record<PresenceDto['status'], string> = {
  ONLINE: '#4CAF50',
  IDLE: '#FFC107',
  AWAY: '#FF9800',
  OFFLINE: '#9E9E9E',
};

function presenceReadOnly(presence: PresenceDto | undefined): ReactNode {
  if (!presence) return null;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Inter Tight, sans-serif', fontSize: 12, color: 'var(--mr-ink-400)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: presenceDotColor[presence.status] }} />
      {presence.status.charAt(0) + presence.status.slice(1).toLowerCase()}
    </span>
  );
}

function PresenceControls({ presence }: { presence: PresenceDto | undefined }) {
  const setPresence = useSetPresence();
  const [replyTimeText, setReplyTimeText] = useState('');

  useEffect(() => {
    setReplyTimeText(presence?.replyTimeText ?? '');
  }, [presence?.replyTimeText]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <select
        value={presence?.status ?? 'OFFLINE'}
        onChange={(e) => setPresence.mutate({ status: e.target.value })}
        aria-label="Set presence status"
        style={{
          fontFamily: 'Inter Tight, sans-serif', fontSize: 12, color: 'var(--mr-ink-900)',
          border: '1px solid var(--mr-dash-hair)', borderRadius: 8, padding: '6px 10px',
          background: 'var(--mr-dash-bg)', cursor: 'pointer', flexShrink: 0,
        }}
      >
        {PRESENCE_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {status.charAt(0) + status.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
      <input
        value={replyTimeText}
        onChange={(e) => setReplyTimeText(e.target.value)}
        onBlur={() => {
          if (replyTimeText !== (presence?.replyTimeText ?? '')) {
            setPresence.mutate({ replyTimeText });
          }
        }}
        placeholder="Typical reply time (e.g. within an hour)"
        aria-label="Typical reply time"
        style={{
          fontFamily: 'Inter Tight, sans-serif', fontSize: 12, color: 'var(--mr-ink-900)',
          border: '1px solid var(--mr-dash-hair)', borderRadius: 8, padding: '6px 10px',
          background: 'var(--mr-dash-bg)', flex: '1 1 200px', minWidth: 0,
        }}
      />
    </div>
  );
}

export default function SupportInboxClient({ showPresence = false }: SupportInboxClientProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { data: conversationDtos, refetch: refetchConversations } = useSupportConversations();
  const { data: threadData, refetch: refetchThread } = useSupportThread(activeId);
  // Single unified live loop: one timer refreshes both the list and the open
  // thread together (replaces the two separate query intervals).
  useSupportLiveSync(activeId);
  const sendMessage = useSendSupportMessage(activeId ?? '');
  const { data: presence } = useSupportPresence();
  const uploadImage = useSupportUpload();
  const { data: user } = useUser();
  const markRead = useSupportMarkRead();

  // Powers the rail's refresh button: refetches the conversation list and,
  // if a thread is open, that thread too.
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchConversations(), activeId ? refetchThread() : Promise.resolve()]);
    } finally {
      setRefreshing(false);
    }
  };

  // Admin notifications, used only to auto-mark-read any notification that
  // points at the conversation currently open in this inbox (so the admin
  // doesn't have to separately dismiss it in the notification centre).
  const { items: notifications, markRead: markNotificationRead } = useAdminNotifications({ enabled: true });

  useEffect(() => {
    if (!activeId) return;
    const matches = notifications.filter((n) => {
      if (n.isRead) return false;
      const isSupportNotification = n.entityType === 'support' || n.type.startsWith('customer.support');
      if (!isSupportNotification) return false;
      const conversationId = typeof n.data?.conversationId === 'string' ? n.data.conversationId : undefined;
      return conversationId === activeId;
    });
    matches.forEach((n) => void markNotificationRead(n.id));
    // Re-runs as new messages poll in (every 5s) so a notification that
    // arrives while the conversation is already open also gets auto-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, threadData?.messages, notifications, markNotificationRead]);

  // Deep link from a notification: /support?c=<conversationId> auto-opens that
  // conversation. Read from the URL (client-only) to avoid a Suspense boundary.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const c = new URLSearchParams(window.location.search).get('c');
    if (c) {
      setActiveId((prev) => prev ?? c);
      markRead.mutate(c);
    }
    // Run once on mount; markRead is a stable mutation handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canEditPresence = user?.role === Role.SUPERADMIN || user?.role === Role.ADMIN;

  const conversations = (conversationDtos ?? []).map(toConversation);
  const messages = (threadData?.messages ?? []).map(toMessage);

  const headerSlot = showPresence
    ? canEditPresence
      ? <PresenceControls presence={presence} />
      : presenceReadOnly(presence)
    : null;

  return (
    <DashChatView
      conversations={conversations}
      activeId={activeId}
      onSelect={(id) => {
        setActiveId(id || null);
        if (id) markRead.mutate(id);
      }}
      messages={messages}
      onSend={(text, attachments) => {
        if (!activeId) return;
        sendMessage.mutate({ body: text, attachments });
      }}
      onUploadImage={async (file) => {
        const result = await uploadImage.mutateAsync(file);
        return result.url;
      }}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      headerSlot={headerSlot}
    />
  );
}

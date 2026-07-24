'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { DashChatView, type Conversation, type Message, type MessageAttachment } from '@/components/DashChatView';
import {
  useSupportConversations,
  useSupportThread,
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

function toConversation(dto: ConversationDto): Conversation {
  const name = dto.customerName || dto.guestName || 'Customer';
  const unread = dto.teamReadAt && dto.teamReadAt >= dto.lastMessageAt ? 0 : 1;
  return {
    id: dto.id,
    name,
    preview: (dto.subjectSnapshot?.['preview'] as string) ?? dto.type,
    time: new Date(dto.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    unread,
    avatar: initials(name),
    status: dto.status === 'OPEN' ? 'online' : dto.status === 'PENDING' ? 'away' : 'offline',
    contact: {
      name: dto.customerName ?? dto.guestName ?? undefined,
      email: dto.customerEmail ?? dto.guestEmail ?? undefined,
      phone: dto.customerPhone ?? guestPhoneDisplay(dto),
    },
  };
}

function toMessage(dto: MessageDto): Message {
  const isCustomer = dto.senderType === 'CUSTOMER';
  return {
    from: isCustomer ? 'cx' : 'agent',
    name: dto.senderName ?? (isCustomer ? 'Customer' : 'MiniRue'),
    text: dto.body,
    time: new Date(dto.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <select
        value={presence?.status ?? 'OFFLINE'}
        onChange={(e) => setPresence.mutate({ status: e.target.value })}
        aria-label="Set presence status"
        style={{
          fontFamily: 'Inter Tight, sans-serif', fontSize: 12, color: 'var(--mr-ink-900)',
          border: '1px solid var(--mr-dash-hair)', borderRadius: 8, padding: '6px 10px',
          background: 'var(--mr-dash-bg)', cursor: 'pointer',
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
          background: 'var(--mr-dash-bg)', width: 220,
        }}
      />
    </div>
  );
}

export default function SupportInboxClient({ showPresence = false }: SupportInboxClientProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const { data: conversationDtos } = useSupportConversations();
  const { data: threadData } = useSupportThread(activeId);
  const sendMessage = useSendSupportMessage(activeId ?? '');
  const { data: presence } = useSupportPresence();
  const uploadImage = useSupportUpload();
  const { data: user } = useUser();
  const markRead = useSupportMarkRead();

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
      headerSlot={headerSlot}
    />
  );
}

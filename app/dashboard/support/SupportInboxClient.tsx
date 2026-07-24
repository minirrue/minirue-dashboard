'use client';

import { useState, type ReactNode } from 'react';
import { DashChatView, type Conversation, type Message } from '@/components/DashChatView';
import {
  useSupportConversations,
  useSupportThread,
  useSendSupportMessage,
  useSupportPresence,
} from '@/lib/hooks/use-support';
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

function toConversation(dto: ConversationDto): Conversation {
  const name = dto.guestName ?? dto.customerId ?? 'Customer';
  const unread = dto.teamReadAt && dto.teamReadAt >= dto.lastMessageAt ? 0 : 1;
  return {
    id: dto.id,
    name,
    preview: (dto.subjectSnapshot?.['preview'] as string) ?? dto.type,
    time: new Date(dto.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    unread,
    avatar: initials(name),
    status: dto.status === 'OPEN' ? 'online' : dto.status === 'PENDING' ? 'away' : 'offline',
  };
}

function toMessage(dto: MessageDto): Message {
  return {
    from: dto.senderType === 'CUSTOMER' ? 'cx' : 'agent',
    name: dto.senderType === 'CUSTOMER' ? 'Customer' : 'Sophie M.',
    text: dto.body,
    time: new Date(dto.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export interface SupportInboxClientProps {
  /** Show current agent presence status in the thread header. A PresenceSwitcher
   * control (admin-only) replaces this plain text in a follow-up task. */
  showPresence?: boolean;
}

function presenceLabel(presence: PresenceDto | undefined): ReactNode {
  if (!presence) return null;
  return (
    <span style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 12, color: 'var(--mr-ink-400)' }}>
      Status: {presence.status.charAt(0) + presence.status.slice(1).toLowerCase()}
    </span>
  );
}

export default function SupportInboxClient({ showPresence = false }: SupportInboxClientProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const { data: conversationDtos } = useSupportConversations();
  const { data: threadData } = useSupportThread(activeId);
  const sendMessage = useSendSupportMessage(activeId ?? '');
  const { data: presence } = useSupportPresence();

  const conversations = (conversationDtos ?? []).map(toConversation);
  const messages = (threadData?.messages ?? []).map(toMessage);

  return (
    <DashChatView
      conversations={conversations}
      activeId={activeId}
      onSelect={(id) => setActiveId(id || null)}
      messages={messages}
      onSend={(text) => {
        if (!activeId) return;
        sendMessage.mutate(text);
      }}
      headerSlot={showPresence ? presenceLabel(presence) : null}
    />
  );
}

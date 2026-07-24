'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DashChatView, type Conversation, type Message, type MessageAttachment } from '@/components/DashChatView';
import {
  useSupportConversations,
  useSupportThread,
  useSupportLiveSync,
  useSupportPresence,
  useSetPresence,
  useSupportUpload,
  useSupportMarkRead,
  useMergeConversations,
  SUPPORT_KEYS,
} from '@/lib/hooks/use-support';
import { useUser } from '@/lib/hooks/use-auth';
import { Role } from '@/lib/auth/role';
import { apiSupportSend } from '@/lib/api/support';
import type { PresenceDto, MessageAttachmentDto } from '@/lib/api/support';
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

/** A locally-tracked outgoing reply that appears in the thread instantly,
 * before (and independently of) the server round-trip. Keyed to a
 * conversation so switching threads never leaks pending bubbles across. */
interface PendingOutgoing {
  tempId: string;
  conversationId: string;
  body: string;
  attachments?: MessageAttachmentDto[];
  status: 'sending' | 'sent' | 'failed';
  /** The real message id once the POST returns — used to drop this pending
   * item the moment the same message arrives via the ~5s poll (no duplicate). */
  realId?: string;
  createdAt: string;
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

/**
 * Admin-only "Merge into…" action shown in the thread header. Absorbs the
 * currently-open conversation (`sourceId`) into a target conversation the admin
 * pastes in, then removes the source. Destructive + irreversible, so it is
 * gated behind an explicit in-place confirm dialog. On success it hands the
 * survivor id back to the inbox so it can select it.
 */
function MergeConversationAction({
  sourceId,
  onMerged,
}: {
  sourceId: string;
  onMerged: (survivorId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [intoId, setIntoId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const merge = useMergeConversations();

  const close = () => {
    if (merge.isPending) return;
    setOpen(false);
    setIntoId('');
    setError(null);
  };

  const confirm = () => {
    const target = intoId.trim();
    if (!target) {
      setError('Enter the ID of the conversation to keep.');
      return;
    }
    if (target === sourceId) {
      setError('That is this conversation. Enter a different target ID.');
      return;
    }
    setError(null);
    merge.mutate(
      { sourceId, intoId: target },
      {
        onSuccess: (survivor) => {
          setOpen(false);
          setIntoId('');
          onMerged(survivor.id ?? target);
        },
        onError: () => {
          setError('Merge failed — check the target ID exists and try again.');
        },
      },
    );
  };

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'Inter Tight, sans-serif',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--mr-ink-700)',
    border: '1px solid var(--mr-dash-hair)',
    borderRadius: 8,
    padding: '6px 10px',
    background: 'var(--mr-dash-bg)',
    cursor: 'pointer',
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={btnStyle} title="Merge this conversation into another">
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 3v6a5 5 0 0 0 5 5 5 5 0 0 0 5-5V3M12 14v7" />
        </svg>
        Merge into…
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mrc-merge-title"
          onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 60, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 16,
            background: 'rgba(20, 16, 10, 0.42)',
          }}
          onClick={close}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(440px, 100%)', background: 'var(--mr-dash-surface)',
              border: '1px solid var(--mr-dash-hair)', borderRadius: 'var(--mr-radius-lg, 14px)',
              boxShadow: 'var(--mr-shadow-lg, 0 20px 50px rgba(0,0,0,0.25))',
              padding: 22, display: 'flex', flexDirection: 'column', gap: 14,
            }}
          >
            <h2 id="mrc-merge-title" style={{ fontFamily: 'var(--mr-font-serif)', fontSize: 19, fontWeight: 500, color: 'var(--mr-ink-900)', margin: 0, lineHeight: 1.2 }}>
              Merge into another conversation
            </h2>
            <p style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 12.5, lineHeight: 1.55, color: 'var(--mr-ink-500)', margin: 0 }}>
              This moves all messages from <strong>this</strong> conversation into the target conversation and removes this one — cannot be undone. Paste the ID of the conversation you want to <strong>keep</strong>.
            </p>
            <label style={{ fontFamily: 'var(--mr-font-label)', fontSize: 9, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mr-ink-400)' }}>
              Target conversation ID (survivor)
              <input
                autoFocus
                value={intoId}
                onChange={(e) => { setIntoId(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
                placeholder="Paste the conversation ID to keep"
                aria-label="Target conversation ID"
                style={{
                  marginTop: 6, width: '100%', boxSizing: 'border-box',
                  fontFamily: 'var(--mr-font-mono, monospace)', fontSize: 12.5, letterSpacing: 'normal',
                  textTransform: 'none', color: 'var(--mr-ink-900)',
                  border: '1px solid var(--mr-dash-hair)', borderRadius: 8, padding: '9px 11px',
                  background: 'var(--mr-dash-bg)',
                }}
              />
            </label>
            {error && (
              <span role="alert" style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 12, color: 'var(--mr-crimson-500)' }}>
                {error}
              </span>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={close}
                disabled={merge.isPending}
                style={{
                  fontFamily: 'Inter Tight, sans-serif', fontSize: 12.5, fontWeight: 500,
                  color: 'var(--mr-ink-700)', border: '1px solid var(--mr-dash-hair)',
                  borderRadius: 8, padding: '8px 14px', background: 'var(--mr-dash-bg)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={merge.isPending}
                style={{
                  fontFamily: 'Inter Tight, sans-serif', fontSize: 12.5, fontWeight: 600,
                  color: 'var(--mr-cream-100)', border: 0, borderRadius: 8, padding: '8px 14px',
                  background: 'var(--mr-ink-900)', cursor: merge.isPending ? 'default' : 'pointer',
                  opacity: merge.isPending ? 0.7 : 1,
                }}
              >
                {merge.isPending ? 'Merging…' : 'Merge conversations'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function SupportInboxClient({ showPresence = false }: SupportInboxClientProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mergeNotice, setMergeNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingOutgoing[]>([]);
  const qc = useQueryClient();
  const { data: conversationDtos, refetch: refetchConversations } = useSupportConversations();
  const { data: threadData, refetch: refetchThread } = useSupportThread(activeId);
  // Single unified live loop: one timer refreshes both the list and the open
  // thread together (replaces the two separate query intervals).
  useSupportLiveSync(activeId);
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
  const { items: notifications, markRead: markNotificationRead, refresh: refreshNotifications } = useAdminNotifications({ enabled: true });

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

  // The notifications list is fetched once on mount and does NOT poll, so a
  // notification created while this conversation is already open would never
  // enter `notifications` — and thus never get auto-read. Refresh the list
  // whenever we open a conversation or its thread gains a message; the effect
  // above then marks any notification for the open conversation read at once,
  // so it never shows as unread while you're viewing that conversation.
  useEffect(() => {
    if (activeId) void refreshNotifications();
  }, [activeId, threadData?.messages, refreshNotifications]);

  // Keep the open conversation marked read on the server as new messages arrive
  // while you're viewing it, so its unread badge stays cleared everywhere (not
  // just via the local override above) and doesn't re-appear on the next poll.
  useEffect(() => {
    if (activeId) markRead.mutate(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, threadData?.messages]);

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
  // Same admin gate the presence controls use — merging is an admin-only action.
  const isAdmin = canEditPresence;

  // Auto-dismisses the "merged" inline confirmation after a few seconds.
  useEffect(() => {
    if (!mergeNotice) return;
    const t = window.setTimeout(() => setMergeNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [mergeNotice]);

  // Fires the POST for a pending item and moves it to 'sent' (recording the
  // real id, so the poll can dedup it) or 'failed'. Uses the item's OWN
  // conversationId — never the current activeId — so a retry after switching
  // threads still targets the right conversation.
  const postPending = (item: PendingOutgoing) => {
    apiSupportSend(item.conversationId, item.body, item.attachments)
      .then((dto: MessageDto) => {
        setPending((prev) =>
          prev.map((p) => (p.tempId === item.tempId ? { ...p, status: 'sent', realId: dto.id } : p)),
        );
        void qc.invalidateQueries({ queryKey: SUPPORT_KEYS.thread(item.conversationId) });
        void qc.invalidateQueries({ queryKey: ['support', 'conversations'] });
      })
      .catch(() => {
        setPending((prev) => prev.map((p) => (p.tempId === item.tempId ? { ...p, status: 'failed' } : p)));
      });
  };

  const sendOptimistic = (conversationId: string, body: string, attachments?: MessageAttachmentDto[]) => {
    const item: PendingOutgoing = {
      tempId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      conversationId,
      body,
      attachments,
      status: 'sending',
      createdAt: new Date().toISOString(),
    };
    setPending((prev) => [...prev, item]);
    postPending(item);
  };

  const retryPending = (tempId: string) => {
    const item = pending.find((p) => p.tempId === tempId);
    if (!item) return;
    setPending((prev) => prev.map((p) => (p.tempId === tempId ? { ...p, status: 'sending' } : p)));
    postPending({ ...item, status: 'sending' });
  };

  const conversations = (conversationDtos ?? []).map(toConversation).map(
    // The conversation you're currently viewing never shows a red unread badge —
    // you're already looking at it, so a message arriving in it isn't "unread".
    (c) => (c.id === activeId ? { ...c, unread: 0 } : c),
  );

  // Display = server messages CONCAT this conversation's pending items that
  // aren't yet in the server list. Dedup rule: once a pending item has a
  // realId AND that id is present in the polled server messages, drop it —
  // the server copy takes over with no flicker and no duplicate.
  const messages = useMemo<Message[]>(() => {
    const serverMessages = threadData?.messages ?? [];
    const serverIds = new Set(serverMessages.map((m) => m.id));
    const senderName = user?.name ?? 'MiniRue';
    const activePending = pending.filter(
      (p) => p.conversationId === activeId && !(p.realId && serverIds.has(p.realId)),
    );
    return [
      ...serverMessages.map(toMessage),
      ...activePending.map<Message>((p) => ({
        from: 'agent',
        name: senderName,
        text: p.body,
        time: new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        day: dayLabel(p.createdAt),
        attachments: p.attachments as MessageAttachment[] | undefined,
        status: p.status,
        onRetry: p.status === 'failed' ? () => retryPending(p.tempId) : undefined,
      })),
    ];
    // retryPending is stable enough for render; pending drives the recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadData?.messages, pending, activeId, user?.name]);

  const headerSlot = showPresence
    ? canEditPresence
      ? <PresenceControls presence={presence} />
      : presenceReadOnly(presence)
    : null;

  return (
    <>
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
          sendOptimistic(activeId, text, attachments);
        }}
        onUploadImage={async (file) => {
          const result = await uploadImage.mutateAsync(file);
          return result.url;
        }}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        headerSlot={headerSlot}
        threadActions={
          isAdmin && activeId ? (
            <MergeConversationAction
              sourceId={activeId}
              onMerged={(survivorId) => {
                setActiveId(survivorId);
                markRead.mutate(survivorId);
                setMergeNotice('Conversations merged. Now viewing the surviving conversation.');
              }}
            />
          ) : null
        }
      />
      {mergeNotice && (
        <div
          role="status"
          style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 70, maxWidth: 'min(420px, calc(100% - 32px))',
            fontFamily: 'Inter Tight, sans-serif', fontSize: 12.5, lineHeight: 1.45,
            color: 'var(--mr-cream-100)', background: 'var(--mr-ink-900)',
            border: '1px solid var(--mr-dash-hair)', borderRadius: 10,
            padding: '11px 16px', boxShadow: 'var(--mr-shadow-lg, 0 16px 40px rgba(0,0,0,0.28))',
          }}
        >
          {mergeNotice}
        </div>
      )}
    </>
  );
}

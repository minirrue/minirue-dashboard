'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DashChatView, type Conversation, type Message, type MessageAttachment, type Person } from '@/components/DashChatView';
import {
  useSupportPeople,
  useSupportConversations,
  useSupportArchivedConversations,
  useSupportThread,
  useSupportLiveSync,
  useSupportPresence,
  useSetPresence,
  useSupportUpload,
  useSupportMarkRead,
  useUpdateConversation,
  useArchiveConversation,
  useRestoreConversation,
} from '@/lib/hooks/use-support';
import { useUser } from '@/lib/hooks/use-auth';
import { apiCollabOverview } from '@/lib/api/collab-portal';
import { apiSupportChannels, type SupportChannel } from '@/lib/api/support';
import { Role } from '@/lib/auth/role';
import { apiSupportSend } from '@/lib/api/support';
import type { PresenceDto, MessageAttachmentDto } from '@/lib/api/support';
import type { ConversationDto, MessageDto, SupportPersonDto } from '@/lib/api/support';
import { useAdminNotifications } from '@/components/dashboard/notifications/useAdminNotifications';
import { useClearNavBadge } from '@/lib/hooks/use-clear-nav-badge';
import { HREF_CATEGORIES } from '@/lib/notifications/nav-counts';

/** Last-activity stamp: clock time for today, a short date otherwise — used
 * for both the people rail and the rooms pane, so "12:27 AM" only ever means
 * "today" and anything older reads as a date, never a stale-looking clock. */
function relativeStamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function guestPhoneDisplay(dto: ConversationDto): string | undefined {
  if (!dto.guestPhone) return undefined;
  return dto.guestPhoneCountry ? `${dto.guestPhoneCountry} ${dto.guestPhone}` : dto.guestPhone;
}

const TEAM_SENDER_TYPES = new Set(['STAFF', 'ADMIN', 'SUPERADMIN', 'COLLAB', 'SYSTEM']);

/** What a rooms-pane row headlines with: the product for an ITEM room
 * ("About No.1"), otherwise the latest message preview. `subjectSnapshot`
 * is an untyped record straight off the wire — same shape the storefront's
 * NewChatComposer/SubjectPicker already read `name` off of. */
function roomSubject(dto: ConversationDto): string {
  if (dto.type === 'ITEM') {
    const name = typeof dto.subjectSnapshot?.['name'] === 'string' ? (dto.subjectSnapshot['name'] as string) : null;
    return name ? `About ${name}` : dto.lastMessagePreview || 'Product enquiry';
  }
  return dto.lastMessagePreview || 'New conversation';
}

function toConversation(dto: ConversationDto): Conversation {
  const name = dto.customerName || dto.guestName || 'Customer';
  // A conversation whose newest message is the team's own reply is never
  // unread to the team — you cannot have "not read" something you just sent.
  // Sending a reply pushes lastMessageAt past teamReadAt, so a thread you had
  // just read popped back up as unread the moment you navigated away and
  // returned (and after the customer-profile round trip in particular).
  const lastFromTeam =
    !!dto.lastMessageSenderType && TEAM_SENDER_TYPES.has(dto.lastMessageSenderType);
  const unread =
    lastFromTeam || (dto.teamReadAt && dto.teamReadAt >= dto.lastMessageAt) ? 0 : 1;
  const presence = dto.customerPresence ?? (dto.customerOnline ? 'ONLINE' : 'OFFLINE');
  return {
    id: dto.id,
    name,
    preview: dto.lastMessagePreview ?? '',
    subject: roomSubject(dto),
    time: relativeStamp(dto.lastMessageAt),
    unread,
    presence,
    kind: dto.type === 'ITEM' ? 'ITEM' : 'GENERAL',
    customerId: dto.customerId ?? undefined,
    contact: {
      name: dto.customerName ?? dto.guestName ?? undefined,
      email: dto.customerEmail ?? dto.guestEmail ?? undefined,
      phone: dto.customerPhone ?? guestPhoneDisplay(dto),
    },
    brandName: dto.brandName ?? undefined,
    collaboratorId: dto.collaboratorId ?? undefined,
    status: dto.status,
    archivedAt: dto.archivedAt ?? null,
  };
}

function toPerson(dto: SupportPersonDto): Person {
  return {
    id: dto.customerId,
    name: dto.name || dto.email || 'Customer',
    avatarUrl: dto.avatarUrl,
    time: dto.lastMessageAt ? relativeStamp(dto.lastMessageAt) : '',
    unread: dto.unreadCount,
    presence: dto.presence ?? 'OFFLINE',
    chatCount: dto.conversationCount,
  };
}

/**
 * Resolve / reopen, and the guest attachment grant.
 *
 * Both are real server-side states, not display toggles: a closed thread refuses
 * new messages from everyone including the team, and an unclaimed guest cannot
 * upload until this grant exists. Rendered together because they are the two
 * things you decide once you have read a thread.
 */
function ThreadStateActions({
  conversation,
  onNotice,
}: {
  conversation: ConversationDto;
  onNotice: (message: string) => void;
}) {
  const update = useUpdateConversation();
  const closed =
    conversation.status === 'RESOLVED' || conversation.status === 'CLOSED';

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {closed ? (
        <button
          type="button"
          className="dash-btn-secondary"
          disabled={update.isPending}
          onClick={() =>
            update.mutate(
              { id: conversation.id, patch: { status: 'OPEN' } },
              { onSuccess: () => onNotice('Conversation reopened.') },
            )
          }
        >
          {update.isPending ? 'Reopening…' : 'Reopen'}
        </button>
      ) : (
        <button
          type="button"
          className="dash-btn-secondary"
          disabled={update.isPending}
          onClick={() =>
            update.mutate(
              { id: conversation.id, patch: { status: 'RESOLVED' } },
              {
                onSuccess: () =>
                  onNotice('Marked resolved. The customer cannot reply — they will start a new conversation.'),
              },
            )
          }
        >
          {update.isPending ? 'Resolving…' : 'Resolve & close'}
        </button>
      )}
    </div>
  );
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
    senderAvatarUrl: dto.senderAvatarUrl ?? null,
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

/**
 * Presence as a segmented control rather than a <select>.
 *
 * Four mutually-exclusive states that all fit on one row is exactly what a
 * radio group is for: a <select> hides three of the four behind a click and
 * leaves no room to show what each one means. This renders them as a real
 * radiogroup (aria-checked is honest, each option is directly clickable) and
 * carries the status colour on a dot beside each label.
 *
 * Styling lives entirely in the variant's scoped CSS via these class names, so
 * the same component lays out inline or stacked without a second copy.
 */
function PresenceControls({ presence }: { presence: PresenceDto | undefined }) {
  const setPresence = useSetPresence();
  const [replyTimeText, setReplyTimeText] = useState('');

  useEffect(() => {
    setReplyTimeText(presence?.replyTimeText ?? '');
  }, [presence?.replyTimeText]);

  const current = presence?.status ?? 'OFFLINE';
  const busy = setPresence.isPending;

  return (
    <div className="mrc-presence-bar-controls">
      <div className="mrc-presence-seg" role="radiogroup" aria-label="Set presence status">
        {PRESENCE_OPTIONS.map((status) => {
          const selected = status === current;
          return (
            <button
              key={status}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={busy}
              className="mrc-presence-opt"
              data-selected={selected ? 'true' : 'false'}
              data-status={status}
              // Re-selecting the current status would fire a pointless write.
              onClick={() => { if (!selected) setPresence.mutate({ status }); }}
            >
              <span className="mrc-presence-opt-dot" aria-hidden="true" />
              <span className="mrc-presence-opt-text">
                {status.charAt(0) + status.slice(1).toLowerCase()}
              </span>
            </button>
          );
        })}
      </div>
      <label className="mrc-presence-field">
        <span className="mrc-presence-field-label">Reply time</span>
        <input
          className="mrc-presence-input"
          value={replyTimeText}
          onChange={(e) => setReplyTimeText(e.target.value)}
          onBlur={() => {
            if (replyTimeText !== (presence?.replyTimeText ?? '')) {
              setPresence.mutate({ replyTimeText });
            }
          }}
          placeholder="Typical reply time (e.g. within an hour)"
          aria-label="Typical reply time"
        />
      </label>
    </div>
  );
}

export default function SupportInboxClient({ showPresence = false }: SupportInboxClientProps) {
  const [activePersonId, setActivePersonId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Two filters: work state, and which desk the room belongs to.
  const [statusFilter, setStatusFilter] = useState('');
  // Defaults to MiniRue's own desk ('direct' is the sentinel for the
  // untagged/house channel — see support.service.ts). An empty string used to
  // mean "All desks" by default, so the owner's own inbox opened on a mixed
  // view of every partner's conversations instead of MiniRue's own.
  const [deskFilter, setDeskFilter] = useState('direct');
  const [refreshing, setRefreshing] = useState(false);
  /**
   * A partner's own module grants, used only to decide whether to draw the
   * presence controls. Empty for admins, who never need them — the role alone
   * answers for them.
   */
  const [collabModules, setCollabModules] = useState<string[]>([]);
  /** Every desk this user may open — including ones with no threads yet. */
  const [channels, setChannels] = useState<SupportChannel[]>([]);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  /** Phone only — see the presence strip below. Closed by default: the summary
   * row already says whether the shop is open, so opening it is for changing
   * that, not for reading it. */
  const [presenceExpanded, setPresenceExpanded] = useState(false);
  const [pending, setPending] = useState<PendingOutgoing[]>([]);
  const qc = useQueryClient();

  const { data: peopleDtos } = useSupportPeople({
    status: statusFilter || undefined,
    collaboratorId: deskFilter || undefined,
  });
  const { data: roomDtos } = useSupportConversations({
    customerId: activePersonId ?? undefined,
    brand: deskFilter || undefined,
    enabled: !!activePersonId,
  });
  const { data: archivedRoomDtos } = useSupportArchivedConversations(
    activePersonId,
    deskFilter || undefined,
  );
  const { data: threadData, refetch: refetchThread } = useSupportThread(activeId);
  // Single unified live loop: one timer refreshes the people rollup, this
  // person's rooms and the open thread together (replaces the two separate
  // query intervals the two-pane inbox had).
  useSupportLiveSync(activeId, activePersonId);
  const { data: presence } = useSupportPresence();
  const uploadImage = useSupportUpload();
  const { data: user } = useUser();
  const markRead = useSupportMarkRead();
  const archiveMutation = useArchiveConversation();
  const restoreMutation = useRestoreConversation();

  // Powers the rail's refresh button: refetches the people rail, this
  // person's rooms (live + archived), and, if a thread is open, that thread too.
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['support', 'people'] }),
        qc.invalidateQueries({ queryKey: ['support', 'conversations'] }),
        activeId ? refetchThread() : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  // Admin notifications, used only to auto-mark-read any notification that
  // points at the conversation currently open in this inbox (so the admin
  // doesn't have to separately dismiss it in the notification centre).
  const { items: notifications, markRead: markNotificationRead, refresh: refreshNotifications } = useAdminNotifications({ enabled: true });

  useEffect(() => {
    let cancelled = false;
    apiSupportChannels()
      .then((r) => {
        if (!cancelled) setChannels(r.data ?? []);
      })
      .catch(() => {
        // Falls back to the desks visible in the loaded conversations, which
        // is what this screen did before there was a channel list at all.
        if (!cancelled) setChannels([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Only a partner needs this: the grant decides whether they can set their
  // own desk's status. An admin's role already answers, so no request is made.
  useEffect(() => {
    if (user?.role !== Role.COLLAB) return;
    let cancelled = false;
    apiCollabOverview()
      .then((o) => {
        if (!cancelled) setCollabModules(o.modules ?? []);
      })
      .catch(() => {
        // No grant assumed. The server refuses without it regardless, so the
        // worst case is a partner not seeing controls they were entitled to.
        if (!cancelled) setCollabModules([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.role]);
  // Clears the Support nav badge (and the bell's share of it) the moment
  // this inbox is open, via the shared singleton — generalises the
  // per-conversation mark-read this used to do into "the whole Support
  // section is on screen", per task-w2.2. See use-clear-nav-badge.ts.
  useClearNavBadge(HREF_CATEGORIES['/support']);

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

  /**
   * Selecting a person is the one-click path: it clears the currently open
   * room so the auto-select effect below opens their newest one the moment
   * that person's rooms load. A manual room switch within the same person
   * (clicking a different row in pane 2) goes through `onSelect` directly,
   * below, and never touches `activePersonId`.
   */
  const selectPerson = (id: string) => {
    setActivePersonId(id);
    setActiveId(null);
  };

  // The common case must stay one click: once a person's rooms have loaded,
  // if nothing is open yet for them, open the newest one (rooms come back
  // sorted lastMessageAt DESC — see support.repository.ts `listConversations`).
  // Guarded on `activeId` so this never fights a room the user (or the deep
  // link effect above) already picked.
  useEffect(() => {
    if (!activePersonId || activeId) return;
    const rooms = roomDtos ?? [];
    if (rooms.length) setActiveId(rooms[0].id);
  }, [activePersonId, roomDtos, activeId]);

  // A `?c=` deep link (or any other path that sets activeId without going
  // through selectPerson) has a room but no person yet — infer it from the
  // thread once it loads, without touching activeId itself.
  useEffect(() => {
    const cid = threadData?.conversation?.customerId;
    if (cid && cid !== activePersonId) setActivePersonId(cid);
  }, [threadData?.conversation?.customerId, activePersonId]);

  /**
   * Who may say whether a desk is open.
   *
   * A partner qualifies with the Support module granted — it is their own
   * desk, not the shop's, since backend 0.55.0. The server checks the grant
   * too; this only decides whether to draw the controls.
   */
  const canEditPresence =
    user?.role === Role.SUPERADMIN ||
    user?.role === Role.ADMIN ||
    (user?.role === Role.COLLAB && collabModules.includes('SUPPORT'));
  // Gate for the desk-filter selects: only the team benefits from slicing a
  // combined inbox by brand — a collaborator's list is already scoped to
  // their own desk server-side.
  const isAdmin = user?.role === Role.SUPERADMIN || user?.role === Role.ADMIN;
  // canPostOnChannel (support.visibility.ts) says the whole team may read
  // any desk but a partner's own desk only THAT partner may post to — never
  // just admin/superadmin. Broader than `isAdmin` on purpose: it decides the
  // composer gate, not which admin-only UI to draw.
  const isTeamRole =
    user?.role === Role.SUPERADMIN || user?.role === Role.ADMIN || user?.role === Role.STAFF;

  // Auto-dismisses the inline confirmation toast after a few seconds.
  useEffect(() => {
    if (!actionNotice) return;
    const t = window.setTimeout(() => setActionNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [actionNotice]);

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
        void qc.invalidateQueries({ queryKey: ['support', 'thread', item.conversationId] });
        void qc.invalidateQueries({ queryKey: ['support', 'conversations'] });
        void qc.invalidateQueries({ queryKey: ['support', 'people'] });
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

  // Every room this person has, live + archived merged into one list — the
  // rooms pane buckets them into live/history/archived groups itself from
  // each room's own `status`/`archivedAt`.
  const allRoomDtos = useMemo(
    () => [...(roomDtos ?? []), ...(archivedRoomDtos ?? [])],
    [roomDtos, archivedRoomDtos],
  );
  // The raw DTO for the open thread: the view model deliberately drops fields the
  // rooms pane has no use for, but the actions need the real status and grant.
  const activeConversationDto = allRoomDtos.find((c) => c.id === activeId);

  /**
   * Every partner desk, from the channel list — not derived from whatever
   * conversations happen to be loaded. That derivation meant a partner with no
   * threads yet had no option, so their desk could not be opened to see that it
   * was empty, which is exactly the question "has anyone messaged Helia".
   */
  const brandOptions = [
    // The house channel's collaboratorId is null, so the plain filter below
    // drops it — without this, the owner's own desk had no option at all and
    // could not be picked even manually.
    { id: 'direct', name: 'MiniRue' },
    ...channels
      .filter((ch) => ch.collaboratorId)
      .map((ch) => ({ id: ch.collaboratorId as string, name: ch.name })),
  ];

  /**
   * Watching someone else's desk. The whole team may READ any desk but must
   * not reply as that partner — the customer would see a reply from a brand
   * written by someone who does not work there (support.visibility.ts
   * canPostOnChannel). Driven by the OPEN ROOM's own collaboratorId, not by
   * whatever the desk filter happens to be set to, so it stays correct even
   * when browsing "All desks".
   */
  const activeIsForeignDesk = isTeamRole && !!activeConversationDto?.collaboratorId;
  const watchedBrandName = activeConversationDto?.brandName ?? 'this partner';
  const composerDisabledReason = activeIsForeignDesk ? (
    <>
      Watching <strong>{watchedBrandName}</strong>&apos;s desk — read only. Only {watchedBrandName} can reply here.
    </>
  ) : undefined;

  const people = (peopleDtos ?? []).map(toPerson);
  const conversations = allRoomDtos.map(toConversation).map(
    // The conversation you're currently viewing never shows a red unread badge —
    // you're already looking at it, so a message arriving in it isn't "unread".
    (c) => (c.id === activeId ? { ...c, unread: 0 } : c),
  );

  const archiveActionPendingId =
    (archiveMutation.isPending ? (archiveMutation.variables as string) : null) ??
    (restoreMutation.isPending ? (restoreMutation.variables as string) : null);

  const handleArchive = (id: string) => {
    archiveMutation.mutate(id, { onSuccess: () => setActionNotice('Conversation archived.') });
  };
  const handleRestore = (id: string) => {
    restoreMutation.mutate(id, { onSuccess: () => setActionNotice('Conversation restored.') });
  };

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
        // Best-effort until the server round-trip replaces this bubble: the
        // sender's own avatar if we know it (a COLLAB user's personal avatar
        // in particular), else null — the same initial-letter fallback the
        // real message would render server-side for STAFF/ADMIN anyway.
        senderAvatarUrl: user?.avatarUrl ?? null,
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
  }, [threadData?.messages, pending, activeId, user?.name, user?.avatarUrl]);

  /**
   * Search + status/desk filters for the people rail, wrapped in
   * `.dash-filters` — the same wrapper every other admin list (Orders,
   * Products, Customers, Fulfillment) uses. Before this batch the two
   * selects here sat in a bare inline-styled div and stacked at every
   * screen width; `.dash-filters` overrides `.dash-input`'s `width: 100%`
   * to an auto width with a sane min-width, so they sit inline until they
   * actually run out of room.
   */
  const peopleControls = (
    <div className="dash-filters">
      <select
        className="dash-input"
        aria-label="Filter by status"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
      >
        <option value="">All statuses</option>
        <option value="OPEN">Open</option>
        <option value="PENDING">Pending</option>
        <option value="RESOLVED">Resolved</option>
        <option value="CLOSED">Closed</option>
      </select>
      {/* Only the team sees this: a collaborator's list is already scoped to their
          own brand by the server, so a desk filter there would be meaningless. */}
      {isAdmin && (
        <select
          className="dash-input"
          aria-label="Filter by desk"
          value={deskFilter}
          onChange={(e) => setDeskFilter(e.target.value)}
        >
          {/* MiniRue first, so the default selection reads first; "All desks"
              is then an explicit opt-in rather than the implicit default. */}
          {brandOptions.slice(0, 1).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
          <option value="">All desks</option>
          {brandOptions.slice(1).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  /**
   * Shop-wide, and ONLY shop-wide: whether support is open, and the reply time
   * shown to customers. One row, label left, controls right.
   *
   * The desk switcher deliberately does NOT live here. It was briefly rendered
   * in both this strip and the people-rail filter row, bound to the same
   * `deskFilter` state — two identical selects on one screen, where changing
   * either visibly moved the other, which reads as a bug rather than a
   * convenience. Choosing which desk to LOOK AT is a filter over the list, so
   * it belongs with the other filters, in `.dash-filters`, the same place every
   * other admin list in this dashboard puts them. What is left here is the only
   * thing that is genuinely shop-wide rather than list-scoped.
   */
  /**
   * On a phone the expanded strip cost 127px of an ~800px screen — a switch and
   * a text field, both shop-wide settings you touch once a shift, sitting above
   * the list of people you came here to answer. It collapses to a single row
   * that still ANSWERS the question the strip exists to answer ("are we open,
   * and what are we promising?") and opens on tap when you need to change it.
   * Above 640px the summary is hidden and the controls are always shown, so the
   * desktop strip is exactly what it was.
   */
  const presenceSummary = presence
    ? `${presence.status.charAt(0)}${presence.status.slice(1).toLowerCase()}${
        presence.replyTimeText ? ` · ${presence.replyTimeText}` : ''
      }`
    : 'Support status'

  const presenceBar = showPresence ? (
    <div className="mrc-presence-bar" data-expanded={presenceExpanded ? 'true' : 'false'}>
      <span className="mrc-presence-bar-label">Support status</span>
      <button
        type="button"
        className="mrc-presence-summary"
        aria-expanded={presenceExpanded}
        onClick={() => setPresenceExpanded((v) => !v)}
      >
        {presence && (
          <span
            className="mrc-presence-summary-dot"
            style={{ background: presenceDotColor[presence.status] }}
          />
        )}
        <span className="mrc-presence-summary-text">{presenceSummary}</span>
        <svg
          className="mrc-presence-summary-caret"
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {canEditPresence ? <PresenceControls presence={presence} /> : presenceReadOnly(presence)}
    </div>
  ) : null;

  return (
    <>
      {presenceBar}
      <DashChatView
        people={people}
        activePersonId={activePersonId}
        onSelectPerson={selectPerson}
        peopleControls={peopleControls}
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id || null);
          if (id) markRead.mutate(id);
        }}
        onArchive={handleArchive}
        onRestore={handleRestore}
        archiveActionPendingId={archiveActionPendingId}
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
        composerDisabled={activeIsForeignDesk}
        composerDisabledReason={composerDisabledReason}
        threadActions={
          activeId && activeConversationDto ? (
            <ThreadStateActions conversation={activeConversationDto} onNotice={setActionNotice} />
          ) : null
        }
      />
      {actionNotice && (
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
          {actionNotice}
        </div>
      )}
    </>
  );
}

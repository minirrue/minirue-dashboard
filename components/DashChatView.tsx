'use client'

import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import { useBreakpoint } from '@/hooks/useMotion'
import { EnlargeableImage } from '@/components/dashboard/ImagePreviewModal'
import RetryingImage from '@/components/dashboard/RetryingImage'
import { getInitials } from '@/lib/utils/getInitials'

export interface MessageAttachment {
  url: string
  kind: 'image'
}

export interface Message {
  from: 'cx' | 'agent'
  name: string
  /** Resolved server-side: personal avatar -> (COLLAB) brand logo -> null.
   * Null/undefined renders the sender's initial letter — never a broken
   * image, never an empty gap. */
  senderAvatarUrl?: string | null
  text: string
  time: string
  /** Friendly day label ('Today', 'Yesterday', 'Jul 24') derived from the
   * real message timestamp. Drives the in-thread date separators. Optional so
   * read-only / legacy callers that only have a time string still work. */
  day?: string
  attachments?: MessageAttachment[]
  /** Optimistic-send lifecycle for the team's own (right-side) messages.
   * 'sending' while the POST is in flight, 'sent' once it succeeds (until the
   * poll replaces it with the real message), 'failed' if the POST errored.
   * Absent on server-confirmed and incoming (customer) messages. */
  status?: 'sending' | 'sent' | 'failed'
  /** Re-sends a failed optimistic message. Wired only when status==='failed'. */
  onRetry?: () => void
}

export interface ConversationContact {
  name?: string
  email?: string
  phone?: string
}

export type CustomerPresence = 'ONLINE' | 'IDLE' | 'OFFLINE'

/**
 * Pane 1 — one row per customer, from `GET /support/people`. Unread and
 * "how many rooms" are rolled up across every (non-archived) room that
 * person has, which is the whole point of a people rail: unlimited rooms
 * per person no longer means unlimited rows in the inbox (W2.1).
 */
export interface Person {
  id: string
  name: string
  avatarUrl?: string | null
  /** Friendly last-activity stamp, already formatted by the caller (time
   * today, short date otherwise — see `relativeStamp` in the inbox). */
  time: string
  /** Rolled up across every one of this person's rooms. */
  unread: number
  presence: CustomerPresence
  /** Non-archived room count, shown in the rooms pane header ("Youssef · 3
   * chats"). */
  chatCount: number
}

export interface Conversation {
  id: string
  name: string
  /** Real latest-message preview (already truncated). Empty string when the
   * thread has no messages yet — the row then shows a muted placeholder. */
  preview: string
  /** What the rooms-pane row headlines with: the product name ("About
   * No.1") for an ITEM room, otherwise the latest message preview. */
  subject: string
  time: string
  unread: number
  /** Three-state live presence of the customer — drives the coloured avatar
   * dot on the row and in the thread header, plus the header label. */
  presence: CustomerPresence
  /** Whether the thread is about a specific product (ITEM) or a general
   * enquiry (GENERAL). Shown as a small label in the list row. */
  kind: 'GENERAL' | 'ITEM'
  /** The customer's account id, when they're a registered customer (not a
   * guest). Drives the tap-through profile link. */
  customerId?: string
  /** Full contact info the customer provided. Revealed on tap in the
   * thread header. Blank fields are omitted from display. */
  contact?: ConversationContact
  /** The brand the shopper addressed, or undefined for MiniRue direct. */
  brandName?: string
  /** The collaborator this room is tagged to, or undefined for MiniRue
   * direct — drives the watch-only composer gate (a team member may read
   * any desk but must not post as a partner). */
  collaboratorId?: string
  /** Drives the row's closed treatment and the "which thread am I replying to"
   * banner — a closed thread refuses new messages server-side. */
  status?: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED'
  /** Set once the room is archived (moved to trash); drives which of the
   * rooms-pane's three groups (live / history / archived) it renders in. */
  archivedAt?: string | null
}

export interface DashChatViewProps {
  /** Pane 1 — from `GET /support/people`. */
  people: Person[]
  activePersonId: string | null
  onSelectPerson: (id: string) => void
  /** Search + status/desk filters for the people list, rendered directly
   * above it. The caller wraps these in `.dash-filters`. */
  peopleControls?: ReactNode

  /** Pane 2 — this person's rooms, from `GET /support/conversations?customerId=`. */
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  /** Archives / restores a room. Omit either to hide that action (e.g. a
   * read-only viewer). */
  onArchive?: (id: string) => void
  onRestore?: (id: string) => void
  /** The id currently mid-archive/restore, so its row can show a disabled
   * state instead of double-firing on a slow connection. */
  archiveActionPendingId?: string | null

  /** Pane 3 — thread (unchanged). */
  messages: Message[]
  onSend: (text: string, attachments?: MessageAttachment[]) => void
  /** Per-conversation actions rendered in the thread header (right side), only
   * while a conversation is open. */
  threadActions?: ReactNode
  /** Uploads a picked/pasted image and resolves to its hosted URL. Omit to
   * hide attachment controls entirely (e.g. a read-only view). */
  onUploadImage?: (file: File) => Promise<string>
  /** Refetches the people rail, this person's rooms, and the open thread. */
  onRefresh?: () => void
  /** Shows a spinning refresh icon while a manual refresh is in flight. */
  refreshing?: boolean
  /** Disables the composer with `composerDisabledReason` in its place —
   * watching a partner's desk you may read but not post to. */
  composerDisabled?: boolean
  composerDisabledReason?: ReactNode
}

/** Three-state customer presence: dot colour + human label. */
const PRESENCE: Record<CustomerPresence, { color: string; label: string }> = {
  ONLINE: { color: '#4CAF50', label: 'Online' },
  IDLE: { color: '#E0A400', label: 'Idle' },
  OFFLINE: { color: '#9E9E9E', label: 'Offline' },
}

interface PendingAttachment {
  previewUrl: string
  url: string | null
  uploading: boolean
}

/** A room's coarse bucket in the rooms pane: live work first, then history,
 * then a collapsed archived group. */
type RoomGroup = 'live' | 'history' | 'archived'

function roomGroupOf(c: Conversation): RoomGroup {
  if (c.archivedAt) return 'archived'
  if (c.status === 'RESOLVED' || c.status === 'CLOSED') return 'history'
  return 'live'
}

function roomStatusLabel(status: Conversation['status']): string {
  if (status === 'RESOLVED') return '✓ Resolved'
  if (status === 'CLOSED') return 'Closed'
  if (status === 'PENDING') return 'Pending'
  return 'Open'
}

/** Real photo when the customer has one; a generic profile glyph otherwise.
 * There was never an image path here before (defect 3) — initials were the
 * only rendering, guest or not. Sized entirely by its circular parent
 * (`.mrc-avatar` / `.mrc-id-avatar` / `.mrc-msg-avatar`), so it drops into
 * any of the three existing avatar slots unchanged. */
function AvatarContent({ url, label }: { url?: string | null; label: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={label} className="mrc-avatar-photo" />
    )
  }
  return (
    <svg
      data-testid="avatar-generic"
      className="mrc-avatar-generic"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={`${label} — no photo`}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  )
}

/** Per-message sender avatar, next to each bubble in the thread — separate
 * from `AvatarContent` (people rail / thread header) because a message's
 * fallback is the sender's INITIAL LETTER, not the generic person glyph:
 * the backend already resolved personal avatar -> (COLLAB) brand logo ->
 * null, and null means "draw an initial", never a broken image or an empty
 * gap. Uses `RetryingImage`, not a bare `<img>`, for the photo case: a
 * freshly-uploaded avatar is exactly the cold-cache case that component
 * exists for. */
function MessageAvatar({ url, name }: { url?: string | null; name: string }) {
  if (url) {
    return <RetryingImage src={url} alt={name} className="mrc-msg-avatar-photo" />
  }
  return (
    <span className="mrc-msg-avatar-initial" data-testid="msg-avatar-initial" aria-label={`${name} — no photo`}>
      {getInitials(name) || '?'}
    </span>
  )
}

const STYLES = `
/* ── Break out of the dashboard content padding + max-width so the inbox
   fills the whole tab region edge-to-edge, like a real chat app. Scoped to
   this route via :has(.mrc-shell); unlayered so it beats the shell's
   @layer components padding rules. ── */
.dash-main:has(.mrc-shell) { height: 100vh; height: 100dvh; }
.dash-content:has(.mrc-shell) { padding: 0; min-height: 0; display: flex; flex-direction: column; }
.dash-content-inner:has(.mrc-shell) {
  width: 100%;
  max-width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.mrc-shell {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  background: var(--mr-dash-surface);
  font-family: var(--mr-font-ui);
}
/* Below 1024px the three panes become three full-width steps (people →
   rooms → thread) with back arrows, rather than three squeezed columns —
   see DashChatView's tablet/step state. */
.mrc-shell[data-stepped="true"] .mrc-rail,
.mrc-shell[data-stepped="true"] .mrc-rooms {
  width: 100%;
  border-right: 0;
}

/* Desktop pane order: people (left) -> thread (CENTRE) -> conversations (right).
   Done with the flex order property rather than by moving the JSX, so the
   stepped/tablet flow, the back-arrow state machine and every ref/handler stay
   exactly as they were — below 1024px only one pane renders at a time, so order
   is inert there. The thread already carries flex: 1, so putting it between two
   fixed-width columns makes it the growing centre.
   NB: this whole stylesheet is a JS template literal — no backticks in comments. */
.mrc-shell[data-stepped="false"] .mrc-rail { order: 1; }
.mrc-shell[data-stepped="false"] .mrc-thread { order: 2; }
.mrc-shell[data-stepped="false"] .mrc-rooms {
  order: 3;
  /* The divider has to follow the pane: as the right-hand column its hairline
     belongs on its leading edge, otherwise the shell ends on a stray rule. */
  border-right: 0;
  border-left: 1px solid var(--mr-dash-hair);
}

/* ── People rail (pane 1) ── */
.mrc-rail {
  display: flex;
  flex-direction: column;
  width: 316px;
  flex-shrink: 0;
  min-height: 0;
  background: var(--mr-dash-surface);
  border-right: 1px solid var(--mr-dash-hair);
}
.mrc-rail-head {
  padding: 20px 20px 14px;
  border-bottom: 1px solid var(--mr-dash-hair);
  flex-shrink: 0;
}
.mrc-rail-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}
.mrc-rail-title {
  font-family: var(--mr-font-serif);
  font-weight: 500;
  font-size: 22px;
  letter-spacing: -0.01em;
  color: var(--mr-ink-900);
  line-height: 1;
}
.mrc-rail-count {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: var(--mr-gold-700);
  font-variant-numeric: tabular-nums;
}
.mrc-rail-count::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--mr-crimson-500);
}
.mrc-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  background: var(--mr-dash-sub);
  border: 1px solid var(--mr-dash-hair);
  border-radius: var(--mr-radius-md);
  transition: border-color var(--mr-dur-fast) var(--mr-ease-out), box-shadow var(--mr-dur-fast) var(--mr-ease-out);
}
.mrc-search:focus-within {
  border-color: var(--mr-gold-400);
  box-shadow: 0 0 0 3px rgba(149, 120, 60, 0.1);
}
.mrc-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  outline: none;
  font-family: var(--mr-font-ui);
  font-size: 12.5px;
  color: var(--mr-ink-900);
}
.mrc-search input::placeholder { color: var(--mr-ink-400); }

.mrc-refresh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 0;
  background: transparent;
  color: var(--mr-ink-400);
  cursor: pointer;
  transition: background var(--mr-dur-fast) var(--mr-ease-snappy), color var(--mr-dur-fast) var(--mr-ease-snappy);
}
.mrc-refresh-btn:hover { background: var(--mr-dash-sub); color: var(--mr-ink-700); }
.mrc-refresh-btn:disabled { cursor: default; }
.mrc-refresh-btn svg[data-spinning="true"] { animation: mrc-spin 0.8s linear infinite; }
@keyframes mrc-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .mrc-refresh-btn svg[data-spinning="true"] { animation: none; }
}

.mrc-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.mrc-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 68px;
  padding: 10px 18px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--mr-dash-hair);
  cursor: pointer;
  text-align: left;
  transition: background var(--mr-dur-fast) var(--mr-ease-snappy);
  animation: mrc-row-in 0.4s var(--mr-ease-out) both;
}
.mrc-row:hover { background: var(--mr-dash-sub); }
.mrc-row[data-active="true"] { background: var(--mr-cream-200); }
.mrc-row[data-active="true"]:hover { background: var(--mr-cream-200); }
.mrc-row:focus-visible {
  outline: 2px solid var(--mr-gold-500);
  outline-offset: -2px;
}

.mrc-avatar-wrap { position: relative; flex-shrink: 0; }
.mrc-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-family: var(--mr-font-serif);
  font-size: 15px;
  background: var(--mr-cream-300);
  color: var(--mr-ink-700);
  transition: background var(--mr-dur-fast) var(--mr-ease-snappy), color var(--mr-dur-fast) var(--mr-ease-snappy);
}
.mrc-row[data-active="true"] .mrc-avatar {
  background: var(--mr-gold-500);
  color: var(--mr-cream-100);
}
.mrc-avatar-photo { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
.mrc-avatar-generic { width: 55%; height: 55%; }
.mrc-dot {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 2px solid var(--mr-dash-surface);
}
.mrc-row[data-active="true"] .mrc-dot { border-color: var(--mr-cream-200); }

.mrc-row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.mrc-row-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.mrc-row-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--mr-ink-900);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mrc-row[data-unread="true"] .mrc-row-name { font-weight: 700; }
.mrc-row-time {
  flex-shrink: 0;
  font-size: 10.5px;
  color: var(--mr-ink-400);
  font-variant-numeric: tabular-nums;
  padding-top: 1px;
}
.mrc-row[data-unread="true"] .mrc-row-time { color: var(--mr-gold-700); font-weight: 600; }
.mrc-row-mid { display: flex; align-items: center; gap: 8px; }
.mrc-row-preview {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--mr-ink-500);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mrc-row[data-unread="true"] .mrc-row-preview { color: var(--mr-ink-700); font-weight: 500; }
.mrc-row-preview[data-empty="true"] { color: var(--mr-ink-400); font-style: italic; }
.mrc-badge {
  flex-shrink: 0;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--mr-crimson-500);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mrc-rail-empty, .mrc-list-empty, .mrc-rooms-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 28px;
  text-align: center;
}
.mrc-empty-glyph {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--mr-gold-100);
  color: var(--mr-gold-700);
  margin-bottom: 4px;
}
.mrc-empty-title {
  font-family: var(--mr-font-serif);
  font-size: 20px;
  color: var(--mr-ink-900);
  line-height: 1.2;
}
.mrc-empty-copy {
  font-size: 12.5px;
  color: var(--mr-ink-500);
  line-height: 1.5;
  max-width: 30ch;
}

/* ── Rooms pane (pane 2) — one person's rooms: live, then history, then a
   collapsed archived group. No avatar here — the whole pane is one person,
   already identified in its header. ── */
.mrc-rooms {
  display: flex;
  flex-direction: column;
  width: 296px;
  flex-shrink: 0;
  min-height: 0;
  background: var(--mr-dash-surface);
  border-right: 1px solid var(--mr-dash-hair);
}
.mrc-rooms-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 18px 14px;
  border-bottom: 1px solid var(--mr-dash-hair);
  flex-shrink: 0;
}
.mrc-rooms-title {
  flex: 1;
  min-width: 0;
  font-family: var(--mr-font-serif);
  font-size: 17px;
  font-weight: 500;
  color: var(--mr-ink-900);
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mrc-rooms-count {
  flex-shrink: 0;
  font-family: var(--mr-font-label);
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--mr-ink-400);
}
.mrc-rooms-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}
.mrc-room-row {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 12px 18px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--mr-dash-hair);
  cursor: pointer;
  text-align: left;
  transition: background var(--mr-dur-fast) var(--mr-ease-snappy);
}
.mrc-room-row:hover { background: var(--mr-dash-sub); }
/* The row used to be a <button> and got a focus ring for free; as a focusable
   list item it needs one declared, or keyboard users lose their place. */
.mrc-room-row:focus-visible {
  outline: 2px solid var(--mr-gold-400);
  outline-offset: -2px;
}
.mrc-room-row[data-active="true"] { background: var(--mr-cream-200); }
.mrc-room-row[data-unread="true"] { box-shadow: inset 3px 0 0 0 var(--mr-gold-500); }
.mrc-room-row[data-archived="true"] { opacity: 0.66; }
.mrc-room-row[data-archived="true"]:hover { opacity: 1; }
.mrc-room-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.mrc-room-subject {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--mr-ink-900);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mrc-room-row[data-unread="true"] .mrc-room-subject { font-weight: 700; }
.mrc-room-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--mr-ink-500);
}
.mrc-room-status { font-weight: 600; }
.mrc-room-status[data-tone="live"] { color: var(--mr-gold-700); }
.mrc-room-status[data-tone="done"] { color: var(--mr-ink-500); }
.mrc-room-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.mrc-room-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 0;
  background: transparent;
  color: var(--mr-ink-400);
  cursor: pointer;
  transition: background var(--mr-dur-fast) var(--mr-ease-snappy), color var(--mr-dur-fast) var(--mr-ease-snappy);
}
.mrc-room-action-btn:hover { background: var(--mr-dash-hair); color: var(--mr-ink-700); }
.mrc-room-action-btn:disabled { opacity: 0.5; cursor: default; }
.mrc-room-divider { height: 1px; background: var(--mr-dash-hair); margin: 0; }
.mrc-room-group-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 11px 18px;
  border: 0;
  border-top: 1px solid var(--mr-dash-hair);
  background: transparent;
  cursor: pointer;
  font-family: var(--mr-font-label);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--mr-ink-500);
}
.mrc-room-group-toggle:hover { background: var(--mr-dash-sub); }
.mrc-room-group-toggle svg { transition: transform var(--mr-dur-fast) var(--mr-ease-out); flex-shrink: 0; }
.mrc-room-group-toggle[aria-expanded="true"] svg { transform: rotate(90deg); }

/* ── Thread pane ── */
.mrc-thread {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--mr-dash-bg);
}
.mrc-thread-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 13px 22px;
  flex-shrink: 0;
  background: var(--mr-dash-surface);
  border-bottom: 1px solid var(--mr-dash-hair);
  z-index: 2;
}
.mrc-thread-head-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
/* Moved out of the thread header and into the contact panel, where someone
   already goes looking for details about a conversation. It was its own row
   under the header — a monospace UUID given equal billing with who you are
   talking to. */
.mrc-thread-uuid {
  display: flex;
  align-items: baseline;
  gap: 10px;
  width: 100%;
  border: 0;
  background: none;
  padding: 0;
  font: inherit;
  font-size: 12.5px;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.mrc-thread-uuid .mrc-contact-id {
  transition: color var(--mr-dur-fast) var(--mr-ease-snappy);
}
.mrc-thread-uuid:hover .mrc-contact-id { color: var(--mr-gold-700); }
.mrc-thread-uuid-copied {
  color: var(--mr-gold-700);
  font-weight: 600;
  font-size: 11px;
}
.mrc-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border: 0;
  border-radius: 50%;
  background: var(--mr-dash-sub);
  color: var(--mr-ink-700);
  cursor: pointer;
  transition: background var(--mr-dur-fast) var(--mr-ease-snappy);
}
.mrc-back:hover { background: var(--mr-dash-hair); }
.mrc-back:active { transform: scale(0.94); }
.mrc-id {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
  background: none;
  border: 0;
  padding: 4px;
  margin: -4px;
  border-radius: var(--mr-radius-md);
  cursor: pointer;
  text-align: left;
  transition: background var(--mr-dur-fast) var(--mr-ease-snappy);
}
.mrc-id:hover { background: var(--mr-dash-sub); }
.mrc-id-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-family: var(--mr-font-serif);
  font-size: 15px;
  background: var(--mr-gold-500);
  color: var(--mr-cream-100);
}
.mrc-id-text { min-width: 0; }
.mrc-id-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--mr-ink-900);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mrc-id-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--mr-ink-500);
  text-transform: capitalize;
}
.mrc-id-status-dot { width: 7px; height: 7px; border-radius: 50%; }
.mrc-id-chevron {
  color: var(--mr-ink-400);
  transition: transform var(--mr-dur-fast) var(--mr-ease-out);
}
.mrc-id[aria-expanded="true"] .mrc-id-chevron { transform: rotate(180deg); }
.mrc-head-slot { margin-left: auto; flex-shrink: 0; }
.mrc-head-actions { margin-left: auto; flex-shrink: 0; display: flex; align-items: center; gap: 8px; }
.mrc-head-actions + .mrc-head-slot { margin-left: 10px; }

.mrc-replying {
  padding: 7px 14px;
  font-family: var(--mr-font-label);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--mr-ink-500);
  background: var(--mr-dash-sub);
  border-bottom: 1px solid var(--mr-dash-hair);
}
.mrc-replying strong { color: var(--mr-ink-900); font-weight: 600; }
.mrc-replying[data-closed="true"] {
  color: var(--mr-cream-100);
  background: var(--mr-ink-700);
}

.mrc-contact {
  flex-shrink: 0;
  padding: 14px 22px;
  background: var(--mr-dash-sub);
  border-bottom: 1px solid var(--mr-dash-hair);
  display: flex;
  flex-direction: column;
  gap: 7px;
  animation: mrc-expand 0.28s var(--mr-ease-out) both;
}
.mrc-contact-label {
  font-family: var(--mr-font-label);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--mr-ink-400);
}
.mrc-contact-row { display: flex; gap: 10px; font-size: 12.5px; }
.mrc-contact-key { min-width: 52px; color: var(--mr-ink-400); }
.mrc-contact-val { color: var(--mr-ink-900); word-break: break-word; }
.mrc-contact-empty { font-size: 12.5px; color: var(--mr-ink-500); }
.mrc-contact-link {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
  padding: 8px 10px;
  border: 1px solid var(--mr-dash-hair);
  border-radius: var(--mr-radius-md);
  background: var(--mr-dash-surface);
  text-decoration: none;
  transition: border-color var(--mr-dur-fast) var(--mr-ease-snappy), background var(--mr-dur-fast) var(--mr-ease-snappy);
}
.mrc-contact-link:hover { border-color: var(--mr-gold-400); background: var(--mr-cream-100); }
.mrc-contact-link .mrc-contact-key { flex-shrink: 0; }
.mrc-contact-id {
  flex: 1;
  min-width: 0;
  font-family: var(--mr-font-mono);
  font-size: 11.5px;
  color: var(--mr-ink-700);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mrc-contact-link svg { flex-shrink: 0; color: var(--mr-gold-700); }

.mrc-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 20px 22px 8px;
  scrollbar-width: thin;
}
.mrc-day {
  display: flex;
  align-items: center;
  justify-content: center;
  position: sticky;
  top: 4px;
  z-index: 1;
  margin: 6px 0 14px;
  pointer-events: none;
}
.mrc-day span {
  font-family: var(--mr-font-label);
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--mr-ink-500);
  background: color-mix(in srgb, var(--mr-dash-surface) 82%, transparent);
  backdrop-filter: blur(4px);
  padding: 4px 12px;
  border-radius: var(--mr-radius-pill);
  border: 1px solid var(--mr-dash-hair);
}

.mrc-msg { display: flex; flex-direction: column; animation: mrc-msg-in 0.34s var(--mr-ease-out) both; }
.mrc-msg[data-grouped="true"] { margin-top: 3px; }
.mrc-msg[data-grouped="false"] { margin-top: 14px; }
.mrc-msg[data-side="cx"] { align-items: flex-start; }
.mrc-msg[data-side="agent"] { align-items: flex-end; }

.mrc-bubble-row { display: flex; align-items: flex-end; gap: 8px; max-width: 76%; }
.mrc-msg[data-side="agent"] .mrc-bubble-row { flex-direction: row-reverse; }
.mrc-msg-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-family: var(--mr-font-serif);
  font-size: 11px;
  background: var(--mr-cream-300);
  color: var(--mr-ink-700);
}
.mrc-msg-avatar[data-hidden="true"] { visibility: hidden; }
.mrc-msg-avatar-photo { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
.mrc-msg-avatar-initial { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }

.mrc-bubble {
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.55;
  word-break: break-word;
}
.mrc-msg[data-side="cx"] .mrc-bubble {
  background: var(--mr-dash-surface);
  color: var(--mr-ink-900);
  border: 1px solid var(--mr-dash-hair);
  border-radius: 16px 16px 16px 5px;
  box-shadow: var(--mr-shadow-xs);
}
.mrc-msg[data-side="cx"][data-grouped="true"] .mrc-bubble { border-radius: 5px 16px 16px 5px; }
.mrc-msg[data-side="agent"] .mrc-bubble {
  background: var(--mr-ink-900);
  color: var(--mr-cream-100);
  border-radius: 16px 16px 5px 16px;
  box-shadow: var(--mr-shadow-sm);
}
.mrc-msg[data-side="agent"][data-grouped="true"] .mrc-bubble { border-radius: 16px 5px 5px 16px; }

.mrc-atts { display: flex; flex-direction: column; gap: 8px; }
.mrc-atts[data-has-text="true"] { margin-bottom: 8px; }
.mrc-att-img {
  display: block;
  width: auto;
  height: auto;
  max-width: min(240px, 100%);
  max-height: 260px;
  object-fit: cover;
  border-radius: 10px;
  cursor: pointer;
  transition: transform var(--mr-dur-fast) var(--mr-ease-out);
}
.mrc-att-img:hover { transform: scale(1.015); }
.mrc-meta {
  margin-top: 5px;
  padding: 0 6px;
  font-size: 10.5px;
  color: var(--mr-ink-500);
}
.mrc-msg[data-side="agent"] .mrc-meta { text-align: right; }

/* ── Optimistic send status (team/right-side bubbles only) ── */
.mrc-status {
  margin-top: 4px;
  padding: 0 6px;
  font-size: 10.5px;
  line-height: 1.2;
  text-align: right;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}
.mrc-status[data-status="sending"] { color: var(--mr-ink-400); opacity: 0.85; }
.mrc-status[data-status="sent"] { color: var(--mr-ink-400); }
.mrc-status[data-status="sent"] svg { display: block; }
.mrc-status[data-status="failed"] { color: var(--mr-crimson-500); font-weight: 500; }
.mrc-retry {
  border: 0;
  background: none;
  padding: 0;
  font: inherit;
  color: var(--mr-crimson-500);
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}
.mrc-retry:hover { color: var(--mr-crimson-600, var(--mr-crimson-500)); }

.mrc-thread-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 28px;
  text-align: center;
}

/* ── Composer ── */
.mrc-composer {
  flex-shrink: 0;
  padding: 12px 18px;
  padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--mr-dash-hair);
  background: var(--mr-dash-surface);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mrc-pending { display: flex; gap: 8px; flex-wrap: wrap; }
.mrc-pending-item { position: relative; width: 56px; height: 56px; flex-shrink: 0; }
.mrc-pending-img {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--mr-dash-hair);
}
.mrc-pending-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 0;
  background: var(--mr-ink-900);
  color: var(--mr-cream-100);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mrc-composer-row { display: flex; gap: 10px; align-items: flex-end; }
.mrc-icon-btn {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--mr-dash-sub);
  color: var(--mr-ink-700);
  transition: background var(--mr-dur-fast) var(--mr-ease-snappy), transform var(--mr-dur-fast) var(--mr-ease-spring);
}
.mrc-icon-btn:hover { background: var(--mr-dash-hair); }
.mrc-icon-btn:active { transform: scale(var(--mr-scale-press)); }
.mrc-field {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 16px;
  border: 1px solid var(--mr-dash-hair);
  border-radius: var(--mr-radius-xl);
  background: var(--mr-dash-bg);
  transition: border-color var(--mr-dur-fast) var(--mr-ease-out), box-shadow var(--mr-dur-fast) var(--mr-ease-out);
}
.mrc-field:focus-within {
  border-color: var(--mr-gold-400);
  box-shadow: 0 0 0 3px rgba(149, 120, 60, 0.1);
}
.mrc-field input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  outline: none;
  font-family: var(--mr-font-ui);
  font-size: 13px;
  color: var(--mr-ink-900);
}
.mrc-field input::placeholder { color: var(--mr-ink-400); }
.mrc-send {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--mr-cream-300);
  color: var(--mr-ink-400);
  cursor: default;
  transform: scale(0.9);
  transition: background var(--mr-dur-normal) var(--mr-ease-out), transform var(--mr-dur-fast) var(--mr-ease-spring), color var(--mr-dur-normal) var(--mr-ease-out);
}
.mrc-send[data-ready="true"] {
  background: var(--mr-ink-900);
  color: var(--mr-cream-100);
  cursor: pointer;
  transform: scale(1);
}
.mrc-send[data-ready="true"]:hover { transform: scale(1.08); }
.mrc-send[data-ready="true"]:active { transform: scale(var(--mr-scale-press)); }

/* Watch-only desk: the team may read but not post — see canPostOnChannel on
   the server. Replaces the composer entirely rather than just disabling the
   send button, so the reason is never missed. */
.mrc-composer-disabled {
  flex-shrink: 0;
  padding: 14px 22px;
  padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--mr-dash-hair);
  background: var(--mr-dash-sub);
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--mr-ink-500);
  text-align: center;
}

/* ── Inbox filters, above the list they filter, at every width ── */
/* Continuous with .mrc-rail-head above, not a second band under it. Three
   things used to separate them: the head's own bottom hairline, a
   --mr-dash-sub tint here, and 12px of top padding. The negative margin lifts
   this element over that hairline and the rail's own surface colour paints
   over it, so the seam is gone rather than merely thinner, and the head's
   existing 14px bottom padding becomes the single gap — the same interval the
   title already uses above the search field. 20px sides (not 18px) put the
   selects on the search box's edges; they were two pixels inside it. Every
   pixel reclaimed goes to the conversation list, which is what the rail is
   actually for. */
.mrc-rail-controls {
  flex-shrink: 0;
  margin-top: -1px;
  padding: 0 20px 12px;
  border-bottom: 1px solid var(--mr-dash-hair);
  background: var(--mr-dash-surface);
}
/* One filter concept, one row. .dash-filters is built for full-width listing
   pages (Orders, Products, Customers): its 140px control floor overflowed this
   ~316px rail and wrapped the two selects onto separate rows, reading as two
   unrelated settings, and its 16px bottom margin — there to clear a table —
   stacked on this container's own 12px padding for 28px of dead band above the
   people list. Columns that divide whatever width the rail has cannot wrap, so
   status and desk stay one group and the list keeps the height. Unlayered, like
   the rest of this sheet, so it beats dash-filters' own @layer rules. */
.mrc-rail-controls .dash-filters {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 8px;
  margin-bottom: 0;
}
/* minmax(0, 1fr) only holds if the children stop asserting a min-width. A
   collaborator sees one select here rather than two, and grid-auto-flow means
   that single control fills the row instead of leaving a hole. */
.mrc-rail-controls .dash-filters > .dash-input:not(.dash-input-search) {
  width: 100%;
  min-width: 0;
}

@media (max-width: 640px) {
  .mrc-bubble-row { max-width: 84%; }
  .mrc-thread { animation: mrc-slide-in 0.32s var(--mr-ease-out) both; }

  /* Desktop proportions in a phone's header: 20px of padding around a 26px
     display serif, above a search box, above the filters — ~133px of chrome
     before a single customer's name. The heading becomes a label for the pane
     rather than a page title, and the space goes to the list. */
  .mrc-rail-head { padding: 12px 16px 10px; }
  .mrc-rail-title { font-size: 20px; }
  .mrc-rail-title-row { margin-bottom: 10px; }
  .mrc-rail-controls { padding: 0 16px 10px; }
}

/* ── Mobile: pin the whole support surface to the VISIBLE viewport ──
   The desktop override at the top sizes .dash-main to 100dvh, but on a phone
   that block also contains the sticky dashboard top bar, while the outer
   .dash-shell keeps min-height:100svh with no overflow containment. On engines
   that fall back to 100vh (or whenever the large/dynamic viewport exceeds the
   currently-visible one) the shell grows past the visible area, the PAGE
   itself scrolls, and the bottom-anchored composer slides below the fold —
   that is why "Reply to customer…" was unreachable the instant a conversation
   opened. Bounding the shell to the visible viewport (dvh, with an svh
   fallback) and letting .dash-main flex-fill keeps the thread a fixed-height
   flex column: header flex-none → messages (.mrc-scroll) flex:1/min-height:0 →
   composer flex-none pinned above the home indicator. Only the message list
   ever scrolls. Scoped to the support route via :has(.mrc-shell), so no other
   tab and none of the shared shell chrome is affected. */
@media (max-width: 760px) {
  .dash-shell:has(.mrc-shell) {
    height: 100svh;
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
  }
  .dash-main:has(.mrc-shell) {
    flex: 1;
    min-height: 0;
    height: auto;
  }

}

@keyframes mrc-row-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes mrc-msg-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes mrc-slide-in { from { transform: translateX(6%); opacity: 0.6; } to { transform: none; opacity: 1; } }
@keyframes mrc-expand { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .mrc-shell *, .mrc-thread, .mrc-row, .mrc-room-row, .mrc-msg, .mrc-contact {
    animation: none !important;
    transition-duration: 0.01ms !important;
  }
}
`

export function DashChatView({
  people,
  activePersonId,
  onSelectPerson,
  peopleControls,
  conversations,
  activeId,
  onSelect,
  onArchive,
  onRestore,
  archiveActionPendingId,
  messages,
  onSend,
  threadActions,
  onUploadImage,
  onRefresh,
  refreshing,
  composerDisabled,
  composerDisabledReason,
}: DashChatViewProps) {
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<PendingAttachment[]>([])
  const [contactOpen, setContactOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [archivedExpanded, setArchivedExpanded] = useState(false)
  // Which attachment is open full-size, keyed `messageIndex:attachmentIndex`
  // so two identical images in a thread cannot both open at once. Message has
  // no id — optimistic sends exist before the server assigns one.
  const [attPreview, setAttPreview] = useState<string | null>(null)
  const { tablet } = useBreakpoint()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Below 1024px the three panes become three full-width steps with back
  // arrows (0 = people, 1 = rooms, 2 = thread) instead of three squeezed
  // columns. Transitions are driven explicitly by the click handlers below
  // (selectPerson/selectRoom/back*), never by an effect watching activeId —
  // an effect keyed on props would fight manual "back" navigation, since
  // going back does not clear the underlying selection.
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const awaitingAutoRoomRef = useRef(false)

  useEffect(() => {
    // Runs on mount and whenever the layout crosses the 1024px line — lands
    // on whatever is already selected (e.g. a `?c=` deep link) rather than
    // always resetting to the people pane.
    if (!tablet) return
    if (activeId) setStep(2)
    else if (activePersonId) setStep(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablet])

  useEffect(() => {
    // Selecting a person auto-opens their newest room (one click, not two —
    // see the inbox's auto-select effect). On a stepped layout that means
    // jumping straight to the thread the moment that room id arrives, not
    // stopping on the now-empty-feeling rooms step in between.
    if (awaitingAutoRoomRef.current && activeId) {
      awaitingAutoRoomRef.current = false
      if (tablet) setStep(2)
    }
  }, [activeId, tablet])

  const selectPerson = (id: string) => {
    onSelectPerson(id)
    setArchivedExpanded(false)
    if (tablet) {
      setStep(1)
      awaitingAutoRoomRef.current = true
    }
  }

  const selectRoom = (id: string) => {
    onSelect(id)
    awaitingAutoRoomRef.current = false
    if (tablet) setStep(2)
  }

  const backToPeople = () => setStep(0)
  const backToRooms = () => setStep(1)

  const activePerson = people.find(p => p.id === activePersonId)
  const convo = conversations.find(c => c.id === activeId)
  const canSend = input.trim().length > 0 || pending.some(p => p.url && !p.uploading)
  const unreadTotal = useMemo(() => people.reduce((n, p) => n + (p.unread > 0 ? 1 : 0), 0), [people])

  // Search matches the customer's name — pane 1 is people, not rooms, so
  // there is no message text or per-room id to also match against here.
  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return people
    return people.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
  }, [people, search])

  const { liveRooms, historyRooms, archivedRooms } = useMemo(() => {
    const live: Conversation[] = []
    const history: Conversation[] = []
    const archived: Conversation[] = []
    for (const c of conversations) {
      const g = roomGroupOf(c)
      if (g === 'live') live.push(c)
      else if (g === 'history') history.push(c)
      else archived.push(c)
    }
    return { liveRooms: live, historyRooms: history, archivedRooms: archived }
  }, [conversations])

  const copyConversationId = (id: string) => {
    navigator.clipboard?.writeText(id).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 1500)
    }).catch(() => {})
  }

  const uploadFile = (file: File) => {
    if (!onUploadImage || !file.type.startsWith('image/')) return
    const previewUrl = URL.createObjectURL(file)
    setPending(prev => [...prev, { previewUrl, url: null, uploading: true }])
    onUploadImage(file)
      .then(url => {
        setPending(prev => prev.map(p => (p.previewUrl === previewUrl ? { ...p, url, uploading: false } : p)))
      })
      .catch(() => {
        setPending(prev => prev.filter(p => p.previewUrl !== previewUrl))
      })
  }

  const removePending = (previewUrl: string) => {
    setPending(prev => prev.filter(p => p.previewUrl !== previewUrl))
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!onUploadImage) return
    const items = Array.from(e.clipboardData?.items ?? [])
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) uploadFile(file)
      }
    }
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const toBottom = () => { el.scrollTop = el.scrollHeight }
    // Land on the newest message when opening a conversation or on a new one,
    // re-running after layout + late-loading images settle so we never start
    // scrolled to the top.
    toBottom()
    const raf = requestAnimationFrame(toBottom)
    const t = window.setTimeout(toBottom, 80)
    return () => { cancelAnimationFrame(raf); window.clearTimeout(t) }
  }, [activeId, messages.length])

  useEffect(() => {
    setContactOpen(false)
  }, [activeId])

  const send = () => {
    const txt = input.trim()
    const ready = pending.filter(p => p.url && !p.uploading)
    if ((!txt && ready.length === 0) || !activeId) return
    if (pending.some(p => p.uploading)) return
    setInput('')
    setPending([])
    onSend(txt, ready.length ? ready.map(p => ({ url: p.url as string, kind: 'image' as const })) : undefined)
  }

  const showPeople = !tablet || step === 0
  const showRooms = !tablet || step === 1
  const showThread = !tablet || step === 2

  /**
   * The row is a focusable list item, NOT a button, because it contains the
   * archive/restore buttons. A <button> inside a <button> is invalid HTML: the
   * parser re-parents the inner one out of the row, so React's hydration warning
   * was reporting a DOM the browser had already rewritten — the action button
   * ended up outside the row it belongs to. Suppressing the warning would keep
   * that rewrite. Enter and Space are handled explicitly since a div does not
   * get them for free.
   */
  const renderRoomRow = (c: Conversation, group: RoomGroup) => (
    <div
      key={c.id}
      role="listitem"
      tabIndex={0}
      onClick={() => selectRoom(c.id)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          selectRoom(c.id)
        }
      }}
      data-active={activeId === c.id}
      data-unread={c.unread > 0}
      data-archived={group === 'archived'}
      className="mrc-room-row"
    >
      <span className="mrc-room-top">
        <span className="mrc-room-subject">{c.subject}</span>
        {group === 'archived' ? (
          onRestore && (
            <span className="mrc-room-actions">
              <button
                type="button"
                className="mrc-room-action-btn"
                disabled={archiveActionPendingId === c.id}
                onClick={(e) => { e.stopPropagation(); onRestore(c.id) }}
                aria-label={`Restore conversation with ${c.name}`}
                title="Restore"
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" /></svg>
              </button>
            </span>
          )
        ) : (
          onArchive && (
            <span className="mrc-room-actions">
              <button
                type="button"
                className="mrc-room-action-btn"
                disabled={archiveActionPendingId === c.id}
                onClick={(e) => { e.stopPropagation(); onArchive(c.id) }}
                aria-label={`Archive conversation with ${c.name}`}
                title="Archive"
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 13h4" /></svg>
              </button>
            </span>
          )
        )}
      </span>
      <span className="mrc-room-meta">
        <span className="mrc-room-status" data-tone={group === 'live' ? 'live' : 'done'}>{roomStatusLabel(c.status)}</span>
        <span>·</span>
        <span>{c.time}</span>
      </span>
    </div>
  )

  // data-step is published so the surrounding dashboard chrome can react to
  // which pane is showing. Below the stepped breakpoint only one pane is on
  // screen at a time, and step 2 is the open conversation — the one state where
  // the menu bar and the shop-status strip are pure overhead between the
  // customer's message and the reply box.
  return (
    <div
      className="mrc-shell"
      data-stepped={tablet ? 'true' : 'false'}
      data-step={tablet ? String(step) : ''}
    >
      <style>{STYLES}</style>

      {/* ── Pane 1: People rail ── */}
      {showPeople && (
        <aside className="mrc-rail">
          <div className="mrc-rail-head">
            <div className="mrc-rail-title-row">
              <span className="mrc-rail-title">Messages</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {unreadTotal > 0 && (
                  <span className="mrc-rail-count">{unreadTotal} unread</span>
                )}
                {onRefresh && (
                  <button
                    type="button"
                    className="mrc-refresh-btn"
                    onClick={onRefresh}
                    disabled={refreshing}
                    aria-label="Refresh conversations"
                    title="Refresh conversations"
                  >
                    <svg data-spinning={refreshing ? 'true' : 'false'} width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 4v6h-6M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <div className="mrc-search">
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="var(--mr-ink-400)" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customers"
                aria-label="Search customers"
              />
            </div>
          </div>

          {peopleControls && (
            <div className="mrc-rail-controls">{peopleControls}</div>
          )}

          {people.length === 0 ? (
            <div className="mrc-rail-empty">
              <span className="mrc-empty-glyph">
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </span>
              <span className="mrc-empty-title">No messages yet</span>
              <span className="mrc-empty-copy">When a customer starts a conversation from the storefront, it will appear here.</span>
            </div>
          ) : filteredPeople.length === 0 ? (
            <div className="mrc-list-empty">
              <span className="mrc-empty-glyph">
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              </span>
              <span className="mrc-empty-title">No matches</span>
              <span className="mrc-empty-copy">No customer matches "{search}".</span>
            </div>
          ) : (
            <div className="mrc-list" role="list">
              {filteredPeople.map((p, i) => (
                <button
                  key={p.id}
                  role="listitem"
                  onClick={() => selectPerson(p.id)}
                  data-active={activePersonId === p.id}
                  data-unread={p.unread > 0}
                  className="mrc-row"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <span className="mrc-avatar-wrap">
                    <span className="mrc-avatar"><AvatarContent url={p.avatarUrl} label={p.name} /></span>
                    <span className="mrc-dot" style={{ background: PRESENCE[p.presence].color }} />
                  </span>
                  <span className="mrc-row-body">
                    <span className="mrc-row-top">
                      <span className="mrc-row-name">{p.name}</span>
                      <span className="mrc-row-time">{p.time}</span>
                    </span>
                    <span className="mrc-row-mid">
                      <span className="mrc-row-preview">{p.chatCount} {p.chatCount === 1 ? 'chat' : 'chats'}</span>
                      {p.unread > 0 && <span className="mrc-badge">{p.unread}</span>}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>
      )}

      {/* ── Pane 2: this person's rooms ── */}
      {showRooms && (
        <aside className="mrc-rooms">
          <div className="mrc-rooms-head">
            {tablet && (
              <button className="mrc-back" onClick={backToPeople} aria-label="Back to customers">
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
            )}
            {activePerson ? (
              <>
                <span className="mrc-rooms-title">{activePerson.name}</span>
                <span className="mrc-rooms-count">{activePerson.chatCount} {activePerson.chatCount === 1 ? 'chat' : 'chats'}</span>
              </>
            ) : (
              <span className="mrc-rooms-title">Rooms</span>
            )}
          </div>

          {!activePerson ? (
            <div className="mrc-rooms-empty">
              <span className="mrc-empty-glyph">
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </span>
              <span className="mrc-empty-title">Select a customer</span>
              <span className="mrc-empty-copy">Choose a customer from the list to see their conversations.</span>
            </div>
          ) : liveRooms.length === 0 && historyRooms.length === 0 && archivedRooms.length === 0 ? (
            <div className="mrc-rooms-empty">
              <span className="mrc-empty-title">No conversations</span>
              <span className="mrc-empty-copy">This customer has no rooms on this desk.</span>
            </div>
          ) : (
            <div className="mrc-rooms-list" role="list">
              {liveRooms.map(c => renderRoomRow(c, 'live'))}
              {liveRooms.length > 0 && historyRooms.length > 0 && <div className="mrc-room-divider" />}
              {historyRooms.map(c => renderRoomRow(c, 'history'))}
              {archivedRooms.length > 0 && (
                <>
                  <button
                    type="button"
                    className="mrc-room-group-toggle"
                    onClick={() => setArchivedExpanded(v => !v)}
                    aria-expanded={archivedExpanded}
                  >
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                    Archived ({archivedRooms.length})
                  </button>
                  {archivedExpanded && archivedRooms.map(c => renderRoomRow(c, 'archived'))}
                </>
              )}
            </div>
          )}
        </aside>
      )}

      {/* ── Pane 3: Thread ── */}
      {showThread && (
        <section className="mrc-thread">
          <div className="mrc-thread-head">
            <div className="mrc-thread-head-row">
              {tablet && (
                <button className="mrc-back" onClick={backToRooms} aria-label="Back to conversations">
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
              )}
              {convo && (
                <button
                  className="mrc-id"
                  onClick={() => setContactOpen(o => !o)}
                  aria-expanded={contactOpen}
                  aria-label="Show customer contact details"
                >
                  <span className="mrc-id-avatar"><AvatarContent url={activePerson?.avatarUrl} label={convo.name} /></span>
                  <span className="mrc-id-text">
                    <span className="mrc-id-name">{convo.name}</span>
                    <span className="mrc-id-status">
                      <span className="mrc-id-status-dot" style={{ background: PRESENCE[convo.presence].color }} />
                      {PRESENCE[convo.presence].label}
                    </span>
                  </span>
                  <svg className="mrc-id-chevron" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                </button>
              )}
              {convo && threadActions && <div className="mrc-head-actions">{threadActions}</div>}
            </div>
          </div>

          {/* Which thread a reply will go to. With several similar-looking rows
              open all day, the identity button alone was too quiet — and a closed
              thread has to say so, because the server refuses the message rather
              than the textarea. */}
          {convo && (
            <div className="mrc-replying" data-closed={convo.status === 'RESOLVED' || convo.status === 'CLOSED'}>
              {convo.status === 'RESOLVED' || convo.status === 'CLOSED' ? (
                <>
                  This conversation is {convo.status.toLowerCase()} — reopen it to reply.
                </>
              ) : (
                <>
                  Replying to <strong>{convo.name}</strong>
                  {convo.brandName ? <> · {convo.brandName}</> : <> · MiniRue</>}
                </>
              )}
            </div>
          )}

          {convo && contactOpen && (
            <div className="mrc-contact">
              <span className="mrc-contact-label">Contact details</span>
              {(() => {
                const fields = [
                  { label: 'Name', value: convo.contact?.name },
                  { label: 'Email', value: convo.contact?.email },
                  { label: 'Phone', value: convo.contact?.phone },
                ].filter((f): f is { label: string; value: string } => Boolean(f.value))
                if (fields.length === 0) {
                  return <span className="mrc-contact-empty">No contact details on file for this conversation.</span>
                }
                return fields.map(f => (
                  <span className="mrc-contact-row" key={f.label}>
                    <span className="mrc-contact-key">{f.label}</span>
                    <span className="mrc-contact-val">{f.value}</span>
                  </span>
                ))
              })()}
              <button
                type="button"
                className="mrc-thread-uuid"
                onClick={() => copyConversationId(convo.id)}
                aria-label="Copy conversation ID"
                title="Click to copy the conversation ID"
              >
                <span className="mrc-contact-key">ID</span>
                <span className="mrc-contact-id">{convo.id}</span>
                {copiedId === convo.id && <span className="mrc-thread-uuid-copied">Copied</span>}
              </button>
              {convo.customerId && (
                <Link className="mrc-contact-link" href={`/customers/${convo.customerId}`} aria-label="Open customer profile">
                  <span className="mrc-contact-key">Account</span>
                  <span className="mrc-contact-id">{convo.customerId}</span>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M8 7h9v9" /></svg>
                </Link>
              )}
            </div>
          )}

          {convo ? (
            <div className="mrc-scroll" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="mrc-thread-empty">
                  <span className="mrc-empty-glyph">
                    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M8 12h8M8 8h8M8 16h5" /><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  </span>
                  <span className="mrc-empty-copy">No replies yet. Say hello to start the conversation.</span>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const prev = messages[i - 1]
                  const next = messages[i + 1]
                  const isAgent = msg.from === 'agent'
                  const grouped = Boolean(prev && prev.from === msg.from && prev.day === msg.day)
                  const lastOfGroup = !next || next.from !== msg.from || next.day !== msg.day
                  const showDay = Boolean(msg.day) && (i === 0 || prev?.day !== msg.day)
                  return (
                    <div key={i}>
                      {showDay && (
                        <div className="mrc-day"><span>{msg.day}</span></div>
                      )}
                      <div className="mrc-msg" data-side={isAgent ? 'agent' : 'cx'} data-grouped={grouped}>
                        <div className="mrc-bubble-row">
                          {/* Per-message sender avatar (customer OR team/collab side) —
                              the backend already resolved personal avatar -> brand logo ->
                              null per message, so this reads msg.senderAvatarUrl rather
                              than the conversation-level customer avatar used elsewhere. */}
                          <span className="mrc-msg-avatar" data-hidden={!lastOfGroup}>
                            <MessageAvatar url={msg.senderAvatarUrl} name={msg.name} />
                          </span>
                          <div className="mrc-bubble">
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mrc-atts" data-has-text={Boolean(msg.text)}>
                                {/* Opens in the same overlay every other image
                                    in the dashboard uses. It used to open a raw
                                    browser tab, which loses the conversation
                                    you were reading. */}
                                {msg.attachments.map((att, ai) => (
                                  <EnlargeableImage
                                    key={ai}
                                    src={att.url}
                                    alt="Attachment"
                                    className="mrc-att-img"
                                    previewOpen={attPreview === `${i}:${ai}`}
                                    onOpenPreview={() => setAttPreview(`${i}:${ai}`)}
                                    onClosePreview={() => setAttPreview(null)}
                                  />
                                ))}
                              </div>
                            )}
                            {msg.text}
                          </div>
                        </div>
                        {lastOfGroup && (
                          <div className="mrc-meta">{msg.name} · {msg.time}</div>
                        )}
                        {isAgent && msg.status && (
                          <div className="mrc-status" data-status={msg.status}>
                            {msg.status === 'sending' && <span>Sending…</span>}
                            {msg.status === 'sent' && (
                              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-label="Sent">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            )}
                            {msg.status === 'failed' && (
                              <span>
                                Failed · <button type="button" className="mrc-retry" onClick={msg.onRetry}>Retry</button>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            <div className="mrc-thread-empty">
              <span className="mrc-empty-glyph">
                <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </span>
              <span className="mrc-empty-title">Select a conversation</span>
              <span className="mrc-empty-copy">Choose a customer from the list to read their messages and reply.</span>
            </div>
          )}

          {/* ── Composer ── */}
          {/* Hidden entirely on a closed thread: the send would be refused by the
              server anyway, so offering it would only produce an error. */}
          {convo && convo.status !== "RESOLVED" && convo.status !== "CLOSED" && (
            composerDisabled ? (
              <div className="mrc-composer-disabled" role="status">
                {composerDisabledReason ?? 'You may read this desk but not reply here.'}
              </div>
            ) : (
            <div className="mrc-composer">
              {pending.length > 0 && (
                <div className="mrc-pending">
                  {pending.map(p => (
                    <div className="mrc-pending-item" key={p.previewUrl}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.previewUrl} alt="Pending attachment" className="mrc-pending-img" style={{ opacity: p.uploading ? 0.5 : 1 }} />
                      <button className="mrc-pending-remove" onClick={() => removePending(p.previewUrl)} aria-label="Remove attachment">×</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mrc-composer-row">
                {onUploadImage && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) uploadFile(file)
                        e.target.value = ''
                      }}
                      style={{ display: 'none' }}
                    />
                    <button className="mrc-icon-btn" onClick={() => fileInputRef.current?.click()} aria-label="Attach image">
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </button>
                  </>
                )}
                <div className="mrc-field" onPaste={handlePaste}>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                    placeholder="Reply to customer…"
                    aria-label="Reply to customer"
                  />
                </div>
                <button className="mrc-send" data-ready={canSend} onClick={send} aria-label="Send reply">
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
            </div>
            )
          )}
        </section>
      )}
    </div>
  )
}

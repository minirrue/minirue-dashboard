'use client'

import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import { useBreakpoint } from '@/hooks/useMotion'

export interface MessageAttachment {
  url: string
  kind: 'image'
}

export interface Message {
  from: 'cx' | 'agent'
  name: string
  text: string
  time: string
  /** Friendly day label ('Today', 'Yesterday', 'Jul 24') derived from the
   * real message timestamp. Drives the in-thread date separators. Optional so
   * read-only / legacy callers that only have a time string still work. */
  day?: string
  attachments?: MessageAttachment[]
}

export interface ConversationContact {
  name?: string
  email?: string
  phone?: string
}

export interface Conversation {
  id: string
  name: string
  preview: string
  time: string
  unread: number
  avatar: string
  status: 'online' | 'away' | 'offline'
  /** Whether the thread is about a specific product (ITEM) or a general
   * enquiry (GENERAL). Shown as a small label in the list row. */
  kind: 'GENERAL' | 'ITEM'
  /** True when the customer is currently active on the storefront — drives the
   * green/grey presence dot on the row and in the thread header. */
  customerOnline?: boolean
  /** The customer's account id, when they're a registered customer (not a
   * guest). Enables the tap-through link to their profile in the contact panel. */
  customerId?: string
  /** Full contact info the customer provided (guest checkout details, or
   * whatever is known for a logged-in customer). Revealed on tap in the
   * thread header. Blank fields are omitted from display. */
  contact?: ConversationContact
}

export interface DashChatViewProps {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  messages: Message[]
  onSend: (text: string, attachments?: MessageAttachment[]) => void
  headerSlot?: ReactNode
  /** Uploads a picked/pasted image and resolves to its hosted URL. Omit to
   * hide attachment controls entirely (e.g. a read-only view). */
  onUploadImage?: (file: File) => Promise<string>
}

/** Customer presence dot: brand green when online, muted ink when not. */
const onlineDot = (online?: boolean) => (online ? 'var(--mr-success)' : 'var(--mr-ink-300)')

interface PendingAttachment {
  previewUrl: string
  url: string | null
  uploading: boolean
}

const STYLES = `
.mrc-shell {
  position: relative;
  display: flex;
  height: calc(100vh - 64px);
  height: calc(100dvh - 64px);
  min-height: 460px;
  overflow: hidden;
  background: var(--mr-dash-surface);
  border: 1px solid var(--mr-dash-hair);
  border-radius: 18px;
  box-shadow: var(--mr-shadow-md);
  font-family: var(--mr-font-ui);
}

/* ── Conversation rail ── */
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
  height: 74px;
  min-height: 74px;
  max-height: 74px;
  padding: 0 18px;
  overflow: hidden;
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
.mrc-row-bottom { display: flex; align-items: center; gap: 8px; }
.mrc-row-preview {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--mr-ink-500);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mrc-row[data-unread="true"] .mrc-row-preview { color: var(--mr-ink-700); }
.mrc-kind {
  flex-shrink: 0;
  font-family: var(--mr-font-label);
  font-size: 8.5px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--mr-ink-400);
  padding: 2px 6px;
  border-radius: var(--mr-radius-sm);
  background: var(--mr-dash-sub);
  border: 1px solid var(--mr-dash-hair);
  line-height: 1.3;
}
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

.mrc-rail-empty, .mrc-list-empty {
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
  align-items: center;
  gap: 12px;
  padding: 13px 22px;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--mr-dash-surface) 88%, transparent);
  backdrop-filter: saturate(1.1) blur(6px);
  border-bottom: 1px solid var(--mr-dash-hair);
  z-index: 2;
}
.mrc-back {
  display: none;
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
  font-family: var(--mr-font-serif);
  font-size: 11px;
  background: var(--mr-cream-300);
  color: var(--mr-ink-700);
}
.mrc-msg-avatar[data-hidden="true"] { visibility: hidden; }

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
  max-width: 220px;
  max-height: 220px;
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
  padding: 12px 18px 14px;
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

/* ── Small viewport: sticky mobile topbar (~72px) eats vertical space ── */
@media (max-width: 760px) {
  .mrc-shell {
    height: calc(100vh - 112px);
    height: calc(100dvh - 112px);
  }
  .mrc-rail { width: 288px; }
}

/* ── True mobile: single pane, edge-to-edge chat app ── */
@media (max-width: 640px) {
  .mrc-shell {
    margin: -20px;
    height: calc(100vh - 72px);
    height: calc(100dvh - 72px);
    border-radius: 0;
    border: 0;
    border-top: 1px solid var(--mr-dash-hair);
    box-shadow: none;
  }
  .mrc-rail { width: 100%; border-right: 0; }
  .mrc-back { display: flex; }
  .mrc-bubble-row { max-width: 84%; }
  .mrc-thread { animation: mrc-slide-in 0.32s var(--mr-ease-out) both; }
}

@keyframes mrc-row-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes mrc-msg-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes mrc-slide-in { from { transform: translateX(6%); opacity: 0.6; } to { transform: none; opacity: 1; } }
@keyframes mrc-expand { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .mrc-shell *, .mrc-thread, .mrc-row, .mrc-msg, .mrc-contact {
    animation: none !important;
    transition-duration: 0.01ms !important;
  }
}
`

export function DashChatView({ conversations, activeId, onSelect, messages, onSend, headerSlot, onUploadImage }: DashChatViewProps) {
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<PendingAttachment[]>([])
  const [contactOpen, setContactOpen] = useState(false)
  const { mobile } = useBreakpoint()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const convo = conversations.find(c => c.id === activeId)
  const canSend = input.trim().length > 0 || pending.some(p => p.url && !p.uploading)
  const unreadTotal = useMemo(() => conversations.reduce((n, c) => n + (c.unread > 0 ? 1 : 0), 0), [conversations])

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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
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

  const showRail = !mobile || !activeId
  const showThread = !mobile || Boolean(activeId)

  return (
    <div className="mrc-shell">
      <style>{STYLES}</style>

      {/* ── Conversation rail ── */}
      {showRail && (
        <aside className="mrc-rail">
          <div className="mrc-rail-head">
            <div className="mrc-rail-title-row">
              <span className="mrc-rail-title">Messages</span>
              {unreadTotal > 0 && (
                <span className="mrc-rail-count">{unreadTotal} unread</span>
              )}
            </div>
            <div className="mrc-search">
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="var(--mr-ink-400)" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input placeholder="Search conversations" aria-label="Search conversations" />
            </div>
          </div>

          {conversations.length === 0 ? (
            <div className="mrc-rail-empty">
              <span className="mrc-empty-glyph">
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </span>
              <span className="mrc-empty-title">No messages yet</span>
              <span className="mrc-empty-copy">When a customer starts a conversation from the storefront, it will appear here.</span>
            </div>
          ) : (
            <div className="mrc-list" role="list">
              {conversations.map((c, i) => (
                <button
                  key={c.id}
                  role="listitem"
                  onClick={() => onSelect(c.id)}
                  data-active={activeId === c.id}
                  data-unread={c.unread > 0}
                  className="mrc-row"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <span className="mrc-avatar-wrap">
                    <span className="mrc-avatar">{c.avatar}</span>
                    <span className="mrc-dot" style={{ background: onlineDot(c.customerOnline) }} />
                  </span>
                  <span className="mrc-row-body">
                    <span className="mrc-row-top">
                      <span className="mrc-row-name">{c.name}</span>
                      <span className="mrc-row-time">{c.time}</span>
                    </span>
                    <span className="mrc-row-bottom">
                      <span className="mrc-kind">{c.kind}</span>
                      <span className="mrc-row-preview">{c.preview}</span>
                      {c.unread > 0 && <span className="mrc-badge">{c.unread}</span>}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>
      )}

      {/* ── Thread pane ── */}
      {showThread && (
        <section className="mrc-thread">
          <div className="mrc-thread-head">
            {mobile && (
              <button className="mrc-back" onClick={() => onSelect('')} aria-label="Back to conversations">
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
                <span className="mrc-id-avatar">{convo.avatar}</span>
                <span className="mrc-id-text">
                  <span className="mrc-id-name">{convo.name}</span>
                  <span className="mrc-id-status">
                    <span className="mrc-id-status-dot" style={{ background: onlineDot(convo.customerOnline) }} />
                    {convo.customerOnline ? 'Online' : 'Offline'}
                  </span>
                </span>
                <svg className="mrc-id-chevron" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              </button>
            )}
            {headerSlot && <div className="mrc-head-slot">{headerSlot}</div>}
          </div>

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
                          {!isAgent && (
                            <span className="mrc-msg-avatar" data-hidden={!lastOfGroup}>{convo.avatar}</span>
                          )}
                          <div className="mrc-bubble">
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mrc-atts" data-has-text={Boolean(msg.text)}>
                                {msg.attachments.map((att, ai) => (
                                  <a key={ai} href={att.url} target="_blank" rel="noopener noreferrer">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={att.url} alt="Attachment" className="mrc-att-img" />
                                  </a>
                                ))}
                              </div>
                            )}
                            {msg.text}
                          </div>
                        </div>
                        {lastOfGroup && (
                          <div className="mrc-meta">{msg.name} · {msg.time}</div>
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
          {convo && (
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
          )}
        </section>
      )}
    </div>
  )
}

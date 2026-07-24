'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
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
  attachments?: MessageAttachment[]
}

export interface Conversation {
  id: string
  name: string
  preview: string
  time: string
  unread: number
  avatar: string
  status: 'online' | 'away' | 'offline'
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

const statusColor: Record<string, string> = {
  online: '#4CAF50',
  away: '#FF9800',
  offline: '#9E9E9E',
}

interface PendingAttachment {
  previewUrl: string
  url: string | null
  uploading: boolean
}

export function DashChatView({ conversations, activeId, onSelect, messages, onSend, headerSlot, onUploadImage }: DashChatViewProps) {
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<PendingAttachment[]>([])
  const { mobile } = useBreakpoint()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const convo = conversations.find(c => c.id === activeId)
  const canSend = input.trim().length > 0 || pending.some(p => p.url && !p.uploading)

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
    if (bottomRef.current) {
      bottomRef.current.scrollTop = bottomRef.current.scrollHeight
    }
  }, [activeId, messages.length])

  const send = () => {
    const txt = input.trim()
    const ready = pending.filter(p => p.url && !p.uploading)
    if ((!txt && ready.length === 0) || !activeId) return
    if (pending.some(p => p.uploading)) return
    setInput('')
    setPending([])
    onSend(txt, ready.length ? ready.map(p => ({ url: p.url as string, kind: 'image' as const })) : undefined)
  }

  const selectConvo = (id: string) => {
    onSelect(id)
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 73px)', overflow: 'hidden' }}>

      {/* Conversation list */}
      {(!mobile || !activeId) && (
        <div style={{
          width: mobile ? '100%' : 280, flexShrink: 0,
          borderRight: '1px solid var(--mr-dash-hair)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--mr-dash-surface)',
        }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--mr-dash-hair)' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500, fontSize: 18, color: 'var(--mr-ink-900)', marginBottom: 12 }}>
              Customer messages
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--mr-dash-sub)', borderRadius: 8, border: '1px solid var(--mr-dash-hair)' }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="var(--mr-ink-400)" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
              <input placeholder="Search conversations" style={{ border: 0, background: 'transparent', outline: 'none', fontFamily: 'Inter Tight, sans-serif', fontSize: 12, color: 'var(--mr-ink-900)', flex: 1 }} />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
            {conversations.map((c, i) => {
              const isActive = activeId === c.id
              return (
                <button key={c.id} onClick={() => selectConvo(c.id)} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  width: '100%', padding: '14px 18px',
                  background: isActive ? 'var(--mr-cream-200)' : 'transparent',
                  border: 0, borderBottom: '1px solid var(--mr-dash-hair)',
                  borderLeft: `3px solid ${isActive ? 'var(--mr-gold-500)' : 'transparent'}`,
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background 160ms, border-color 160ms',
                  animation: `mr-fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both`,
                  animationDelay: `${i * 45}ms`,
                }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%',
                      background: isActive ? 'var(--mr-gold-500)' : 'var(--mr-cream-300)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Cormorant Garamond, serif', fontSize: 13,
                      color: isActive ? 'var(--mr-cream-100)' : 'var(--mr-ink-700)',
                    }}>{c.avatar}</div>
                    <span style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: statusColor[c.status] ?? '#9E9E9E', border: '2px solid var(--mr-dash-surface)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 13, fontWeight: c.unread ? 700 : 500, color: 'var(--mr-ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>{c.name}</span>
                      <span style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 10, color: 'var(--mr-ink-400)', flexShrink: 0 }}>{c.time}</span>
                    </div>
                    <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 12, color: c.unread ? 'var(--mr-ink-700)' : 'var(--mr-ink-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.preview}</div>
                  </div>
                  {c.unread > 0 && (
                    <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: 'var(--mr-crimson-500)', color: '#fff', fontFamily: 'Inter Tight, sans-serif', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '0 5px' }}>{c.unread}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Thread */}
      {(!mobile || activeId) && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--mr-dash-bg)' }}>

          {/* Thread header */}
          <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--mr-dash-hair)', display: 'flex', alignItems: 'center', gap: 14, background: 'var(--mr-dash-surface)' }}>
            {mobile && (
              <button onClick={() => onSelect('')} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--mr-ink-700)', padding: 0 }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M20 12H4M10 6l-6 6 6 6"/></svg>
              </button>
            )}
            {convo && (
              <>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--mr-gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cormorant Garamond, serif', fontSize: 13, color: 'var(--mr-cream-100)' }}>{convo.avatar}</div>
                  <span style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: statusColor[convo.status] ?? '#9E9E9E', border: '2px solid var(--mr-dash-surface)' }} />
                </div>
                <div>
                  <div style={{ fontFamily: 'Inter Tight, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--mr-ink-900)' }}>{convo.name}</div>
                  <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 11, color: 'var(--mr-ink-400)', textTransform: 'capitalize' }}>{convo.status}</div>
                </div>
              </>
            )}
            {headerSlot && (
              <div style={{ marginLeft: 'auto' }}>{headerSlot}</div>
            )}
          </div>

          {/* Messages */}
          <div ref={bottomRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12, scrollbarWidth: 'none' }}>
            {messages.map((msg, i) => {
              const isAgent = msg.from === 'agent'
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isAgent ? 'flex-end' : 'flex-start', animation: `mr-fade-up 0.35s cubic-bezier(0.16,1,0.3,1) both`, animationDelay: `${i * 35}ms` }}>
                  <div style={{
                    maxWidth: '70%', padding: '11px 16px',
                    borderRadius: isAgent ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                    background: isAgent ? 'var(--mr-ink-900)' : 'var(--mr-dash-surface)',
                    color: isAgent ? 'var(--mr-cream-100)' : 'var(--mr-ink-900)',
                    fontFamily: 'Inter Tight, sans-serif', fontSize: 13, lineHeight: 1.55,
                    boxShadow: isAgent ? 'var(--mr-shadow-sm)' : 'var(--mr-shadow-xs)',
                    border: isAgent ? 'none' : '1px solid var(--mr-dash-hair)',
                  }}>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: msg.text ? 8 : 0 }}>
                        {msg.attachments.map((att, ai) => (
                          <a key={ai} href={att.url} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={att.url}
                              alt="Attachment"
                              style={{ maxWidth: 220, maxHeight: 220, borderRadius: 10, display: 'block', cursor: 'pointer' }}
                            />
                          </a>
                        ))}
                      </div>
                    )}
                    {msg.text}
                  </div>
                  <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 10, color: 'var(--mr-ink-400)', marginTop: 4, padding: '0 4px' }}>
                    {msg.name} · {msg.time}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Input */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--mr-dash-hair)', background: 'var(--mr-dash-surface)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {pending.map(p => (
                  <div key={p.previewUrl} style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.previewUrl}
                      alt="Pending attachment"
                      style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, opacity: p.uploading ? 0.5 : 1, border: '1px solid var(--mr-dash-hair)' }}
                    />
                    <button
                      onClick={() => removePending(p.previewUrl)}
                      aria-label="Remove attachment"
                      style={{
                        position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%',
                        background: 'var(--mr-ink-900)', color: 'var(--mr-cream-100)', border: 'none', cursor: 'pointer',
                        fontSize: 11, lineHeight: '18px', textAlign: 'center', padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
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
                <button
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach image"
                  style={{
                    width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--mr-cream-300)', border: 0, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--mr-ink-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>
              </>
            )}
            <div
              onPaste={handlePaste}
              style={{ flex: 1, display: 'flex', alignItems: 'center', border: '1px solid var(--mr-dash-hair)', borderRadius: 10, background: 'var(--mr-dash-bg)', padding: '10px 14px', gap: 10, transition: 'border-color 200ms, box-shadow 200ms' }}
              onFocusCapture={e => { e.currentTarget.style.borderColor = 'var(--mr-gold-400)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(149,120,60,0.1)' }}
              onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--mr-dash-hair)'; e.currentTarget.style.boxShadow = 'none' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Reply to customer…"
                aria-label="Reply to customer"
                style={{ flex: 1, border: 0, background: 'transparent', outline: 'none', fontFamily: 'Inter Tight, sans-serif', fontSize: 13, color: 'var(--mr-ink-900)' }}
              />
            </div>
            <button onClick={send} aria-label="Send reply" style={{
              width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
              background: canSend ? 'var(--mr-ink-900)' : 'var(--mr-cream-300)',
              border: 0, cursor: canSend ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 200ms cubic-bezier(0.34,1.56,0.64,1), transform 160ms',
              transform: canSend ? 'scale(1)' : 'scale(0.88)',
            }}
            onMouseEnter={e => { if (canSend) e.currentTarget.style.transform = 'scale(1.08)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = canSend ? 'scale(1)' : 'scale(0.88)' }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={canSend ? 'var(--mr-cream-100)' : 'var(--mr-ink-400)'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { useBreakpoint } from '@/hooks/useMotion'

interface Message {
  from: 'cx' | 'agent'
  name: string
  text: string
  time: string
}

interface Conversation {
  id: string
  name: string
  preview: string
  time: string
  unread: number
  avatar: string
  status: 'online' | 'away' | 'offline'
}

const DASH_CONVERSATIONS: Conversation[] = [
  { id:'c1', name:'Hélène Bernard',  preview:'Do you still have the Oud Nocturne in 50ml?', time:'Now',  unread:2, avatar:'HB', status:'online' },
  { id:'c2', name:'Junichi Mori',    preview:"My order MR-24800 hasn't arrived yet.",        time:'4m',   unread:1, avatar:'JM', status:'online' },
  { id:'c3', name:'Louisa Greer',    preview:"Can I exchange the Figuier for a diff size?",  time:'18m',  unread:0, avatar:'LG', status:'away' },
  { id:'c4', name:'Marcus Wahl',     preview:'The packaging was beautiful, thank you!',      time:'1h',   unread:0, avatar:'MW', status:'offline' },
  { id:'c5', name:'Priya Raghavan',  preview:"What's the difference between the two oud…",  time:'2h',   unread:0, avatar:'PR', status:'offline' },
]

const THREAD_MAP: Record<string, Message[]> = {
  c1: [
    { from:'cx',    name:'Hélène Bernard', text:'Bonjour! Do you still have the Oud Nocturne in 50ml?',                              time:'10:41' },
    { from:'agent', name:'Sophie M.',      text:'Bonjour Hélène! Yes, we have 42 units in stock right now.',                         time:'10:42' },
    { from:'cx',    name:'Hélène Bernard', text:"Perfect. Can I get gift wrapping? It's for my husband's birthday.",                 time:'10:42' },
    { from:'agent', name:'Sophie M.',      text:'Absolutely — we offer complimentary gift wrapping on all orders. Shall I add a handwritten card as well?', time:'10:43' },
    { from:'cx',    name:'Hélène Bernard', text:'Yes please! That would be wonderful.',                                              time:'10:44' },
  ],
  c2: [
    { from:'cx',    name:'Junichi Mori',  text:'Hello, my order MR-24800 was supposed to arrive yesterday.',                        time:'09:15' },
    { from:'agent', name:'Sophie M.',     text:'Hi Junichi! Let me check that for you right away.',                                  time:'09:16' },
    { from:'agent', name:'Sophie M.',     text:"I can see it's currently in transit with DHL. Estimated delivery is today by 6pm.", time:'09:17' },
    { from:'cx',    name:'Junichi Mori',  text:"My order MR-24800 hasn't arrived yet.",                                            time:'10:58' },
  ],
  c3: [
    { from:'cx',    name:'Louisa Greer',  text:'Hi — I bought the Figuier 75ml but I think 50ml would suit me better. Can I exchange?', time:'08:30' },
    { from:'agent', name:'Sophie M.',     text:"Of course Louisa! We have a 14-day exchange policy. I'll arrange a prepaid return label.", time:'08:45' },
    { from:'cx',    name:'Louisa Greer',  text:"Can I exchange the Figuier for a different size? Thank you.",                      time:'09:02' },
  ],
}

const statusColor: Record<string, string> = {
  online: '#4CAF50',
  away: '#FF9800',
  offline: '#9E9E9E',
}

export function DashChatView() {
  const [active, setActive] = useState<string | null>('c1')
  const [input, setInput] = useState('')
  const [threads, setThreads] = useState<Record<string, Message[]>>(THREAD_MAP)
  const [typing, setTyping] = useState(false)
  const [convos, setConvos] = useState<Conversation[]>(DASH_CONVERSATIONS)
  const { mobile } = useBreakpoint()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const thread = active ? (threads[active] || []) : []
  const convo = convos.find(c => c.id === active)

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollTop = bottomRef.current.scrollHeight
    }
  }, [active, thread.length])

  const send = () => {
    const txt = input.trim()
    if (!txt || !active) return
    setInput('')
    const msg: Message = {
      from: 'agent',
      name: 'Sophie M. (You)',
      text: txt,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setThreads(t => ({ ...t, [active]: [...(t[active] || []), msg] }))
    setTyping(true)
    setConvos(c => c.map(x => x.id === active ? { ...x, unread: 0, preview: txt, time: 'Now' } : x))
    setTimeout(() => setTyping(false), 1600)
  }

  const selectConvo = (id: string) => {
    setActive(id)
    setConvos(c => c.map(x => x.id === id ? { ...x, unread: 0 } : x))
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 73px)', overflow: 'hidden' }}>

      {/* Conversation list */}
      {(!mobile || !active) && (
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
            {convos.map((c, i) => {
              const isActive = active === c.id
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
      {(!mobile || active) && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--mr-dash-bg)' }}>

          {/* Thread header */}
          <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--mr-dash-hair)', display: 'flex', alignItems: 'center', gap: 14, background: 'var(--mr-dash-surface)' }}>
            {mobile && (
              <button onClick={() => setActive(null)} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--mr-ink-700)', padding: 0 }}>
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
          </div>

          {/* Messages */}
          <div ref={bottomRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12, scrollbarWidth: 'none' }}>
            {thread.map((msg, i) => {
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
                    {msg.text}
                  </div>
                  <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 10, color: 'var(--mr-ink-400)', marginTop: 4, padding: '0 4px' }}>
                    {msg.name} · {msg.time}
                  </div>
                </div>
              )
            })}

            {typing && (
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ padding: '12px 16px', borderRadius: '4px 14px 14px 14px', background: 'var(--mr-dash-surface)', border: '1px solid var(--mr-dash-hair)', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0, 1, 2].map(j => (
                    <span key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--mr-ink-400)', animation: 'mr-breath 1s ease-in-out infinite', animationDelay: `${j * 150}ms`, display: 'inline-block' }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--mr-dash-hair)', background: 'var(--mr-dash-surface)', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: '1px solid var(--mr-dash-hair)', borderRadius: 10, background: 'var(--mr-dash-bg)', padding: '10px 14px', gap: 10, transition: 'border-color 200ms, box-shadow 200ms' }}
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
              background: input.trim() ? 'var(--mr-ink-900)' : 'var(--mr-cream-300)',
              border: 0, cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 200ms cubic-bezier(0.34,1.56,0.64,1), transform 160ms',
              transform: input.trim() ? 'scale(1)' : 'scale(0.88)',
            }}
            onMouseEnter={e => { if (input.trim()) e.currentTarget.style.transform = 'scale(1.08)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = input.trim() ? 'scale(1)' : 'scale(0.88)' }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={input.trim() ? 'var(--mr-cream-100)' : 'var(--mr-ink-400)'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

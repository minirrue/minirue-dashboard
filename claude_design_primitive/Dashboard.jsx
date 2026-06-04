// Dashboard.jsx — Full animated store-owner back-office

/* ─── DashIcon ───────────────────────────────────────────── */
function DashIcon({ name, size = 16, stroke = 1.5 }) {
  const paths = {
    home:     <><path d="M3 11l9-7 9 7v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V11z"/></>,
    box:      <><path d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10"/></>,
    list:     <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></>,
    users:    <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="6" r="2.5"/><path d="M15 14a5 5 0 0 1 6 0"/></>,
    chart:    <><path d="M3 20h18M6 16V9M11 16V5M16 16v-8M21 16v-4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></>,
    search:   <><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>,
    bell:     <><path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3V9zM10 19a2 2 0 0 0 4 0"/></>,
    up:       <><path d="M12 19V5M5 12l7-7 7 7"/></>,
    down:     <><path d="M12 5v14M5 12l7 7 7-7"/></>,
    dot:      <><circle cx="12" cy="12" r="3" fill="currentColor"/></>,
    external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></>,
    store:    <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    chat:     <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || null}
    </svg>
  );
}

/* ─── StatusBadge ────────────────────────────────────────── */
function DashStatusBadge({ state }) {
  const map = {
    paid:       { bg:'var(--mr-st-ok-bg)',     fg:'var(--mr-st-ok-fg)',     t:'Paid',         dot:'#2C5A38' },
    dispatched: { bg:'var(--mr-st-info-bg)',   fg:'var(--mr-st-info-fg)',   t:'Dispatched',   dot:'#2E466B' },
    pending:    { bg:'var(--mr-st-warn-bg)',   fg:'var(--mr-st-warn-fg)',   t:'Pending',      dot:'#B8832A' },
    refunded:   { bg:'var(--mr-st-muted-bg)',  fg:'var(--mr-st-muted-fg)',  t:'Refunded',     dot:'#8A8376' },
    failed:     { bg:'var(--mr-st-danger-bg)', fg:'var(--mr-st-danger-fg)', t:'Failed',       dot:'#8E1418' },
    low:        { bg:'var(--mr-st-warn-bg)',   fg:'var(--mr-st-warn-fg)',   t:'Low stock',    dot:'#B8832A' },
    out:        { bg:'var(--mr-st-danger-bg)', fg:'var(--mr-st-danger-fg)', t:'Out of stock', dot:'#8E1418' },
    instock:    { bg:'var(--mr-st-ok-bg)',     fg:'var(--mr-st-ok-fg)',     t:'In stock',     dot:'#2C5A38' },
  };
  const v = map[state] || map.pending;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:6,
      padding:'5px 10px', borderRadius:6,
      background:v.bg, color:v.fg,
      fontFamily:'Inter Tight, sans-serif', fontSize:11, fontWeight:600,
      letterSpacing:'0.01em', lineHeight:1, whiteSpace:'nowrap',
    }}>
      <span style={{ width:6, height:6, borderRadius:999, background:v.dot, flexShrink:0 }}/>
      {v.t}
    </span>
  );
}

/* ─── AnimatedMetric — count-up number card ─────────────── */
function AnimatedMetric({ eyebrow, rawValue, display, delta, trend = 'up', spark, index = 0 }) {
  const enter = window.useStaggerEnter(index, { preset:'default', step:60, from:{ y:16, opacity:0, scale:0.96 }, baseDelay:100 });
  const { w } = window.useBreakpoint();
  const [hovered, setHovered] = React.useState(false);
  const positive = trend === 'up';

  // Responsive scale — tighten on narrow cards
  const isCompact = w < 1100;
  const valSize   = isCompact ? 22 : 28;
  const padding   = isCompact ? '14px 16px' : '20px 22px';
  const badgePad  = isCompact ? '3px 6px' : '4px 8px';
  const badgeFs   = isCompact ? 10 : 11;
  const eyebrowFs = isCompact ? 9 : 10;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...enter,
        background:'var(--mr-dash-surface)',
        border:'1px solid var(--mr-dash-hair)',
        borderRadius:10,
        padding,
        display:'flex', flexDirection:'column', gap: isCompact ? 8 : 10,
        boxShadow: hovered ? 'var(--mr-shadow-md)' : 'var(--mr-shadow-xs)',
        transform: `${enter.transform} ${hovered ? 'translateY(-3px)' : 'translateY(0)'}`,
        transition: `${enter.transition}, box-shadow 220ms var(--mr-ease-out), transform 220ms var(--mr-ease-spring)`,
        cursor:'default', minWidth:0, overflow:'hidden',
      }}>
      <div style={{ fontFamily:'Jost, sans-serif', fontSize:eyebrowFs, letterSpacing:'0.18em', textTransform:'uppercase', color:'var(--mr-ink-500)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{eyebrow}</div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:6, flexWrap:'wrap' }}>
        <div className="mr-num" style={{ fontSize:valSize, fontWeight:700, color:'var(--mr-ink-900)', lineHeight:1, fontFamily:'Inter Tight, sans-serif', whiteSpace:'nowrap' }}>{display}</div>
        <div style={{
          display:'inline-flex', alignItems:'center', gap:3, flexShrink:0,
          padding:badgePad, borderRadius:999,
          background: positive ? 'var(--mr-st-ok-bg)' : 'var(--mr-st-danger-bg)',
          color: positive ? 'var(--mr-st-ok-fg)' : 'var(--mr-st-danger-fg)',
          fontFamily:'Inter Tight, sans-serif', fontSize:badgeFs, fontWeight:600, fontVariantNumeric:'tabular-nums',
          whiteSpace:'nowrap',
          animation:`mr-fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both`,
          animationDelay:`${100 + index * 60 + 200}ms`,
        }}>
          <DashIcon name={positive ? 'up' : 'down'} size={10} />{delta}
        </div>
      </div>
      {/* Sparkline */}
      <svg viewBox="0 0 140 28" preserveAspectRatio="none" style={{ width:'100%', height:28 }}>
        <polyline points={spark} fill="none"
          stroke={positive ? '#95783C' : '#8E1418'} strokeWidth="1.5"
          strokeLinejoin="round" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

/* ─── NotificationDrawer — slides from right like CartDrawer ─ */
const NOTIFICATIONS = [
  { id:'n1', type:'order',   title:'New order received',          body:'MR-24802 · Hélène Bernard · € 320',      time:'Just now',  unread:true  },
  { id:'n2', type:'stock',   title:'Low stock alert',             body:'Lost Cherry 50ml — only 3 units left',   time:'12m ago',   unread:true  },
  { id:'n3', type:'message', title:'New customer message',        body:'Junichi Mori: "Has my order shipped?"',   time:'34m ago',   unread:false },
  { id:'n4', type:'order',   title:'Order dispatched',            body:'MR-24800 · Absolue Rose · DHL Express',  time:'1h ago',    unread:false },
  { id:'n5', type:'stock',   title:'Blanc Amande — out of stock', body:'Restock needed before next campaign',    time:'2h ago',    unread:false },
  { id:'n6', type:'message', title:'5-star review received',      body:'Louisa Greer: "Absolutely magnificent"', time:'3h ago',    unread:false },
];

function NotificationDrawer({ open, onClose }) {
  const [notifications, setNotifications] = React.useState(NOTIFICATIONS);
  const unreadCount = notifications.filter(n => n.unread).length;

  const markAllRead = () => setNotifications(n => n.map(x => ({ ...x, unread: false })));
  const dismiss = (id) => setNotifications(n => n.filter(x => x.id !== id));

  const typeIcon = (type) => ({
    order:   { icon: 'box',   color: 'var(--mr-st-ok-fg)',     bg: 'var(--mr-st-ok-bg)'     },
    stock:   { icon: 'alert', color: 'var(--mr-st-warn-fg)',   bg: 'var(--mr-st-warn-bg)'   },
    message: { icon: 'chat',  color: 'var(--mr-st-info-fg)',   bg: 'var(--mr-st-info-bg)'   },
  })[type] || { icon: 'dot', color: 'var(--mr-ink-500)', bg: 'var(--mr-cream-300)' };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position:'fixed', inset:0, background:'rgba(11,11,11,0.38)',
        backdropFilter: open ? 'blur(3px)' : 'blur(0)',
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
        transition:'opacity 260ms cubic-bezier(0.4,0,0.2,1), backdrop-filter 260ms',
        zIndex:80,
      }} />

      {/* Drawer — same spring as CartDrawer */}
      <aside style={{
        position:'fixed', top:16, right:16, bottom:16,
        width:'min(380px, calc(100vw - 32px))',
        background:'var(--mr-dash-surface)', zIndex:90,
        borderRadius:'var(--mr-radius-lg)',
        transform: open ? 'translateX(0)' : 'translateX(calc(100% + 32px))',
        transition:'transform 400ms cubic-bezier(0.16,1,0.3,1)',
        display:'flex', flexDirection:'column',
        boxShadow:'var(--mr-shadow-xl)', overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{ padding:'20px 22px', borderBottom:'1px solid var(--mr-dash-hair)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:'Inter Tight, sans-serif', fontWeight:600, fontSize:15, color:'var(--mr-ink-900)', letterSpacing:'-0.01em' }}>
              Notifications
              {unreadCount > 0 && (
                <span style={{ marginLeft:8, padding:'2px 7px', borderRadius:99, background:'var(--mr-crimson-500)', color:'#fff', fontSize:11, fontWeight:700, verticalAlign:'middle' }}>
                  {unreadCount}
                </span>
              )}
            </div>
            <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:11, color:'var(--mr-ink-400)', marginTop:2 }}>Today</div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ background:'none', border:0, cursor:'pointer', fontFamily:'Jost, sans-serif', fontSize:9, letterSpacing:'0.18em', textTransform:'uppercase', color:'var(--mr-gold-500)', padding:'4px 8px' }}>
                Mark all read
              </button>
            )}
            <button onClick={onClose} style={{ width:30, height:30, borderRadius:'50%', background:'var(--mr-dash-sub)', border:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--mr-ink-700)', transition:'background 150ms' }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--mr-dash-hair)'}
              onMouseLeave={e=>e.currentTarget.style.background='var(--mr-dash-sub)'}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
            </button>
          </div>
        </div>

        {/* Items */}
        <div style={{ flex:1, overflowY:'auto', scrollbarWidth:'none' }}>
          {notifications.map((n, i) => {
            const ti = typeIcon(n.type);
            return (
              <div key={n.id} style={{
                display:'flex', gap:14, padding:'16px 20px',
                borderBottom:'1px solid var(--mr-dash-hair)',
                background: n.unread ? 'rgba(149,120,60,0.04)' : 'transparent',
                borderLeft: n.unread ? '3px solid var(--mr-gold-400)' : '3px solid transparent',
                animation:`mr-fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both`,
                animationDelay:`${i * 40}ms`,
                transition:'background 180ms',
                position:'relative',
              }}>
                {/* Icon */}
                <div style={{ width:36, height:36, borderRadius:'50%', background:ti.bg, color:ti.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    {n.type === 'order'   && <><path d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10"/></>}
                    {n.type === 'stock'   && <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></>}
                    {n.type === 'message' && <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>}
                  </svg>
                </div>

                {/* Content */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:13, fontWeight: n.unread ? 600 : 400, color:'var(--mr-ink-900)', marginBottom:3 }}>{n.title}</div>
                  <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:12, color:'var(--mr-ink-500)', lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.body}</div>
                  <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:10, color:'var(--mr-ink-400)', marginTop:6 }}>{n.time}</div>
                </div>

                {/* Dismiss */}
                <button onClick={() => dismiss(n.id)} style={{ position:'absolute', top:12, right:14, background:'none', border:0, cursor:'pointer', color:'var(--mr-ink-300)', padding:4, opacity:0, transition:'opacity 160ms' }}
                  onMouseEnter={e=>{e.currentTarget.style.opacity=1; e.currentTarget.style.color='var(--mr-ink-700)';}}
                  onMouseLeave={e=>{e.currentTarget.style.opacity=0;}}
                  onFocus={e=>e.currentTarget.style.opacity=1}>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
                </button>
              </div>
            );
          })}

          {notifications.length === 0 && (
            <div style={{ padding:'64px 32px', textAlign:'center' }}>
              <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:13, color:'var(--mr-ink-400)' }}>All caught up!</div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
function DashSidebar({ active, onNav, onStorefront }) {
  const groups = [
    { label:'Store', items:[
      { k:'overview',  n:'Overview',  i:'home'     },
      { k:'orders',    n:'Orders',    i:'box'      },
      { k:'catalog',   n:'Catalog',   i:'list'     },
      { k:'customers', n:'Customers', i:'users'    },
    ]},
    { label:'Insights', items:[
      { k:'analytics', n:'Analytics', i:'chart'    },
    ]},
    { label:'Support', items:[
      { k:'messages',  n:'Messages',  i:'chat'     },
    ]},
    { label:'House', items:[
      { k:'settings',  n:'Settings',  i:'settings' },
    ]},
  ];
  return (
    <aside style={{
      width:232, flexShrink:0, height:'100vh', position:'sticky', top:0,
      background:'var(--mr-dash-surface)', borderRight:'1px solid var(--mr-dash-hair)',
      padding:'20px 16px 16px', boxSizing:'border-box',
      display:'flex', flexDirection:'column', overflow:'hidden',
    }}>
      {/* Brand mark */}
      <div style={{ marginBottom:24, padding:'0 8px', flexShrink:0 }}>
        <div style={{ fontFamily:'Cormorant Garamond, serif', fontWeight:500, fontSize:20, color:'var(--mr-gold-500)', letterSpacing:'-0.01em', lineHeight:1 }}>
          MiniRue<span style={{ display:'inline-flex', marginLeft:3, verticalAlign:'top', animation:'mr-breath 4s var(--mr-ease-ios) infinite' }}><Sparkle size={8} /></span>
        </div>
        <div style={{ fontFamily:'Jost, sans-serif', fontSize:9, letterSpacing:'0.28em', textTransform:'uppercase', color:'var(--mr-ink-400)', marginTop:4 }}>Atelier</div>
      </div>

      {/* Nav groups — scrollable */}
      <div style={{ flex:1, overflowY:'auto', scrollbarWidth:'none', minHeight:0 }}>
        {groups.map((g, gi) => (
          <div key={g.label} style={{ marginBottom:18, animation:`mr-fade-up 0.45s cubic-bezier(0.16,1,0.3,1) both`, animationDelay:`${gi * 60 + 80}ms` }}>
            <div style={{ fontFamily:'Jost, sans-serif', fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--mr-ink-300)', margin:'0 10px 6px' }}>{g.label}</div>
            {g.items.map(it => {
              const isActive = active === it.k;
              return (
                <button key={it.k} onClick={() => onNav(it.k)} style={{
                  display:'flex', alignItems:'center', gap:10, width:'100%',
                  padding:'9px 10px', border:0, borderRadius:'var(--mr-radius-md)',
                  background: isActive ? 'var(--mr-cream-300)' : 'transparent',
                  color: isActive ? 'var(--mr-ink-900)' : 'var(--mr-ink-500)',
                  cursor:'pointer', textAlign:'left',
                  fontFamily:'Inter Tight, sans-serif', fontSize:13, fontWeight: isActive ? 600 : 400,
                  borderLeft:`2px solid ${isActive ? 'var(--mr-gold-500)' : 'transparent'}`,
                  transition:'background 180ms var(--mr-ease-snappy), color 180ms, border-color 180ms',
                  marginBottom:1,
                }}>
                  <DashIcon name={it.i} size={14}/>{it.n}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Back to store — fixed at bottom */}
      <div style={{ flexShrink:0, paddingTop:12, borderTop:'1px solid var(--mr-dash-hair)' }}>
        <button onClick={onStorefront} style={{
          display:'flex', alignItems:'center', gap:10, width:'100%',
          padding:'10px 10px', border:0, borderRadius:'var(--mr-radius-md)',
          background:'transparent', cursor:'pointer', color:'var(--mr-ink-500)',
          fontFamily:'Inter Tight, sans-serif', fontSize:12, marginBottom:8,
          transition:'background 180ms, color 180ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.background='var(--mr-dash-sub)'; e.currentTarget.style.color='var(--mr-ink-900)'; }}
        onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--mr-ink-500)'; }}>
          <DashIcon name="store" size={14}/> Storefront
        </button>

        {/* User row — always visible */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 10px', borderRadius:'var(--mr-radius-md)' }}>
          <div style={{ width:30, height:30, borderRadius:999, background:'var(--mr-gold-500)', color:'var(--mr-cream-100)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Cormorant Garamond, serif', fontSize:13, flexShrink:0 }}>CL</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:12, fontWeight:600, color:'var(--mr-ink-900)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>Clémence Laurent</div>
            <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:11, color:'var(--mr-ink-400)' }}>Maison Paris</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ─── TopBar ─────────────────────────────────────────────── */
function DashTopBar({ title, eyebrow, onNotif }) {
  const [focused, setFocused] = React.useState(false);
  const enter = window.useEnterSpring({ preset:'default', from:{ y:8, opacity:0, scale:1 }, delay:60 });
  return (
    <header style={{
      padding:'20px 36px', borderBottom:'1px solid var(--mr-dash-hair)',
      display:'flex', justifyContent:'space-between', alignItems:'center',
      background:'var(--mr-dash-bg)',
      ...enter,
    }}>
      <div>
        <div style={{ fontFamily:'Jost, sans-serif', fontSize:10, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--mr-ink-500)', marginBottom:6 }}>{eyebrow}</div>
        <h1 style={{ fontFamily:'Inter Tight, sans-serif', fontWeight:600, fontSize:24, margin:0, color:'var(--mr-ink-900)', letterSpacing:'-0.01em', transition:'opacity 200ms' }}>{title}</h1>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
        <div style={{
          display:'flex', alignItems:'center', gap:10,
          padding:'9px 14px',
          border:`1px solid ${focused ? 'var(--mr-gold-400)' : 'var(--mr-dash-hair)'}`,
          borderRadius:8, background:'var(--mr-dash-surface)',
          minWidth:260, color:'var(--mr-ink-400)',
          transition:'border-color 200ms var(--mr-ease-out), box-shadow 200ms',
          boxShadow: focused ? '0 0 0 3px rgba(149,120,60,0.12)' : 'none',
        }}>
          <DashIcon name="search" size={14}/>
          <input
            placeholder="Search orders, products…"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{ border:0, background:'transparent', outline:'none', flex:1, fontFamily:'Inter Tight, sans-serif', fontSize:13, color:'var(--mr-ink-900)' }}
          />
        </div>
        <div style={{ position:'relative' }}>
          <button onClick={onNotif} style={{
            background:'var(--mr-dash-surface)', border:'1px solid var(--mr-dash-hair)',
            borderRadius:8, padding:9, cursor:'pointer', color:'var(--mr-ink-700)',
            transition:'background 180ms, transform 150ms var(--mr-ease-spring)',
          }}
          onMouseEnter={e=>e.currentTarget.style.background='var(--mr-dash-sub)'}
          onMouseLeave={e=>e.currentTarget.style.background='var(--mr-dash-surface)'}
          onMouseDown={e=>e.currentTarget.style.transform='scale(0.92)'}
          onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}>
            <DashIcon name="bell" size={16}/>
          </button>
          <span style={{ position:'absolute', top:5, right:5, width:6, height:6, borderRadius:999, background:'var(--mr-crimson-500)', animation:'mr-breath 3s var(--mr-ease-ios) infinite' }}/>
        </div>
      </div>
    </header>
  );
}

/* ─── OverviewView ───────────────────────────────────────── */
function DashOverview({ onOpenOrder }) {
  const { mobile, w } = window.useBreakpoint();
  const isNarrow = w < 900;
  const ORDERS = [
    { id:'MR-24801', name:'Hélène Bernard',  item:'Oud Nocturne · 100ml',   total:'€ 320', state:'dispatched', date:'Apr 22' },
    { id:'MR-24800', name:'Junichi Mori',    item:'Absolue Rose · 50ml',    total:'€ 185', state:'paid',       date:'Apr 22' },
    { id:'MR-24799', name:'Marcus Wahl',     item:'Lost Cherry · 50ml',     total:'€ 224', state:'paid',       date:'Apr 22' },
    { id:'MR-24798', name:'Priya Raghavan',  item:"Vetiver d'Hiver · 50ml", total:'€ 210', state:'pending',    date:'Apr 21' },
    { id:'MR-24797', name:'Louisa Greer',    item:'Figuier · 75ml',         total:'€ 142', state:'dispatched', date:'Apr 21' },
    { id:'MR-24796', name:'Tomás Álvarez',   item:'Musc Dorée · 30ml',      total:'€ 125', state:'refunded',   date:'Apr 20' },
  ];
  const METRICS = [
    { eyebrow:'Revenue · 7d', display:'€ 48,210', delta:'+ 12.4%', trend:'up',   spark:'0,20 12,18 24,22 36,15 48,12 60,14 72,10 84,11 96,6 108,8 120,4 140,2' },
    { eyebrow:'Orders · 7d',  display:'214',       delta:'+ 8.1%',  trend:'up',   spark:'0,18 12,16 24,20 36,14 48,13 60,12 72,10 84,9 96,8 108,7 120,6 140,4' },
    { eyebrow:'Avg. basket',  display:'€ 225',     delta:'− 2.0%',  trend:'down', spark:'0,10 12,8 24,12 36,10 48,14 60,12 72,16 84,14 96,18 108,16 120,20 140,22' },
    { eyebrow:'Returns',      display:'1.8%',      delta:'− 0.4%',  trend:'up',   spark:'0,12 12,14 24,10 36,13 48,11 60,9 72,10 84,8 96,7 108,9 120,6 140,5' },
  ];
  const tdS = { padding: mobile ? '12px 14px' : '15px 22px', fontFamily:'Inter Tight, sans-serif', fontSize:mobile?12:13, color:'var(--mr-ink-900)', verticalAlign:'middle' };
  const [hoveredRow, setHoveredRow] = React.useState(null);
  const metricCols = mobile ? 2 : isNarrow ? 2 : 4;

  return (
    <div style={{ padding: mobile ? '16px' : '28px 36px', display:'flex', flexDirection:'column', gap: mobile ? 14 : 24 }}>
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${metricCols},1fr)`, gap: mobile ? 10 : 16 }}>
        {METRICS.map((m, i) => <AnimatedMetric key={m.eyebrow} {...m} index={i} />)}
      </div>

      <div style={{ background:'var(--mr-dash-surface)', border:'1px solid var(--mr-dash-hair)', borderRadius:10, overflow:'hidden', animation:'mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay:'340ms' }}>
        <div style={{ padding: mobile ? '14px 16px' : '18px 22px', borderBottom:'1px solid var(--mr-dash-hair)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2 style={{ fontFamily:'Inter Tight, sans-serif', fontWeight:600, fontSize:mobile?16:20, margin:0, letterSpacing:'-0.01em' }}>Recent orders</h2>
          <button style={{ background:'none', border:0, cursor:'pointer', fontFamily:'Jost, sans-serif', fontSize:10, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--mr-ink-900)', borderBottom:'1px solid var(--mr-gold-400)', paddingBottom:2 }}>View all →</button>
        </div>
        {mobile ? (
          <div>
            {ORDERS.map((o, i) => (
              <div key={o.id} onClick={() => onOpenOrder(o)} style={{ padding:'14px 16px', borderTop:'1px solid var(--mr-dash-hair)', cursor:'pointer', animation:`mr-fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both`, animationDelay:`${400 + i * 45}ms` }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--mr-dash-sub)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <div>
                    <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:13, fontWeight:600 }}>{o.name}</div>
                    <div style={{ fontFamily:'SF Mono,monospace', fontSize:11, color:'var(--mr-ink-500)', marginTop:2 }}>{o.id}</div>
                  </div>
                  <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:14, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{o.total}</div>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:12, color:'var(--mr-ink-500)' }}>{o.item} · {o.date}</div>
                  <DashStatusBadge state={o.state}/>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth: isNarrow ? 600 : 'none' }}>
              <thead>
                <tr style={{ background:'var(--mr-dash-sub)' }}>
                  {['Order','Customer','Item','Date','Status','Total'].map(h => (
                    <th key={h} style={{ textAlign:'left', padding:'12px 22px', fontFamily:'Jost, sans-serif', fontSize:10, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--mr-ink-400)', fontWeight:400, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ORDERS.map((o, i) => (
                  <tr key={o.id} onClick={() => onOpenOrder(o)} onMouseEnter={()=>setHoveredRow(i)} onMouseLeave={()=>setHoveredRow(null)}
                    style={{ cursor:'pointer', borderTop:'1px solid var(--mr-dash-hair)', background: hoveredRow===i?'var(--mr-dash-sub)':'transparent', transition:'background 140ms', animation:`mr-fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both`, animationDelay:`${400 + i * 45}ms` }}>
                    <td style={{ ...tdS, fontFamily:'SF Mono,monospace', fontSize:12, color:'var(--mr-ink-500)', whiteSpace:'nowrap' }}>{o.id}</td>
                    <td style={tdS}>{o.name}</td>
                    <td style={{ ...tdS, maxWidth: isNarrow?120:'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{o.item}</td>
                    <td style={{ ...tdS, color:'var(--mr-ink-500)', whiteSpace:'nowrap' }}>{o.date}</td>
                    <td style={tdS}><DashStatusBadge state={o.state}/></td>
                    <td style={{ ...tdS, textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>{o.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns: isNarrow?'1fr':'1.4fr 1fr', gap: mobile?12:16 }}>
        <div style={{ background:'var(--mr-dash-surface)', border:'1px solid var(--mr-dash-hair)', borderRadius:10, padding: mobile?'16px':'22px', animation:'mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay:'520ms' }}>
          <h3 style={{ fontFamily:'Inter Tight, sans-serif', fontWeight:600, fontSize:mobile?15:17, margin:`0 0 ${mobile?12:18}px`, letterSpacing:'-0.01em' }}>Top products · 7 days</h3>
          {[
            { n:"Oud Nocturne",    u:'64 units', r:'€ 20,480', pct:82 },
            { n:"Absolue Rose",    u:'48 units', r:'€ 8,880',  pct:61 },
            { n:"Vetiver d'Hiver", u:'31 units', r:'€ 6,510',  pct:40 },
            { n:"Lost Cherry",     u:'28 units', r:'€ 6,272',  pct:36 },
          ].map((p, i) => (
            <div key={p.n} style={{ padding:`${mobile?10:12}px 0`, borderTop:'1px solid var(--mr-dash-hair)', animation:`mr-fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both`, animationDelay:`${560 + i * 50}ms` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <div>
                  <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:13, color:'var(--mr-ink-900)', whiteSpace:'nowrap' }}>{p.n}</div>
                  <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:11, color:'var(--mr-ink-400)', marginTop:2, fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>{p.u}</div>
                </div>
                <div style={{ fontFamily:'Inter Tight, sans-serif', fontWeight:700, fontSize:14, fontVariantNumeric:'tabular-nums' }}>{p.r}</div>
              </div>
              <div style={{ height:3, background:'var(--mr-dash-hair)', borderRadius:2, overflow:'hidden' }}>
                <div style={{ height:'100%', background:'var(--mr-gold-400)', borderRadius:2, width:`${p.pct}%`, animation:`mr-draw-in 0.8s cubic-bezier(0.16,1,0.3,1) forwards`, animationDelay:`${600+i*60}ms`, transformOrigin:'left' }}/>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background:'var(--mr-dash-surface)', border:'1px solid var(--mr-dash-hair)', borderRadius:10, padding: mobile?'16px':'22px', animation:'mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay:'580ms' }}>
          <h3 style={{ fontFamily:'Inter Tight, sans-serif', fontWeight:600, fontSize:mobile?15:17, margin:`0 0 ${mobile?12:18}px`, letterSpacing:'-0.01em' }}>Needs attention</h3>
          {[
            { t:'Lost Cherry · 50ml — 3 left', s:'low' },
            { t:'Blanc Amande · 50ml — out of stock', s:'out' },
            { t:'Order MR-24798 · payment pending', s:'pending' },
          ].map((x, i) => (
            <div key={x.t} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, padding:`${mobile?10:13}px 0`, borderTop:'1px solid var(--mr-dash-hair)', flexWrap:'wrap', animation:`mr-fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both`, animationDelay:`${620 + i * 55}ms` }}>
              <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:13, color:'var(--mr-ink-900)', flex:1 }}>{x.t}</div>
              <DashStatusBadge state={x.s}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function DashCatalog() {
  const { mobile, w } = window.useBreakpoint();
  const products = [
    { n:'Absolue Rose',     sku:'MR-AR-50',  stock:128, price:'€ 185', state:'instock' },
    { n:'Oud Nocturne',     sku:'MR-ON-100', stock:42,  price:'€ 320', state:'instock' },
    { n:'Lost Cherry',      sku:'TF-LC-50',  stock:3,   price:'€ 280', state:'low'     },
    { n:'Blanc Amande',     sku:'MR-BA-50',  stock:0,   price:'€ 165', state:'out'     },
    { n:"Vetiver d'Hiver",  sku:'MR-VH-50',  stock:87,  price:'€ 210', state:'instock' },
    { n:'Figuier',          sku:'DI-FG-75',  stock:54,  price:'€ 142', state:'instock' },
    { n:"Musc Dorée",       sku:'MR-MD-30',  stock:21,  price:'€ 125', state:'instock' },
  ];
  const [hovered, setHovered] = React.useState(null);
  const tdS = { padding: mobile ? '12px 14px' : '15px 22px', fontFamily:'Inter Tight, sans-serif', fontSize:13, color:'var(--mr-ink-900)', verticalAlign:'middle' };

  return (
    <div style={{ padding: mobile ? '16px' : '28px 36px' }}>
      {mobile ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {products.map((p, i) => (
            <div key={p.sku} style={{ background:'var(--mr-dash-surface)', border:'1px solid var(--mr-dash-hair)', borderRadius:10, padding:'16px', display:'flex', alignItems:'center', gap:14, animation:`mr-fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both`, animationDelay:`${i*45}ms` }}>
              <div style={{ width:40, height:52, background:'var(--mr-cream-300)', borderRadius:3, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <BottleSVG bottle={['rose','oud','crimson','cream','ink','amber','amber'][i]} cap="gold" />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:13, fontWeight:600, color:'var(--mr-ink-900)' }}>{p.n}</div>
                <div style={{ fontFamily:'SF Mono,monospace', fontSize:11, color:'var(--mr-ink-500)', marginTop:2 }}>{p.sku}</div>
                <div style={{ display:'flex', gap:10, alignItems:'center', marginTop:8 }}>
                  <DashStatusBadge state={p.state}/>
                  <span style={{ fontFamily:'Inter Tight, sans-serif', fontSize:12, color:'var(--mr-ink-500)' }}>Stock: {p.stock}</span>
                </div>
              </div>
              <div style={{ fontFamily:'Inter Tight, sans-serif', fontWeight:700, fontSize:15, fontVariantNumeric:'tabular-nums', flexShrink:0 }}>{p.price}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background:'var(--mr-dash-surface)', border:'1px solid var(--mr-dash-hair)', borderRadius:10, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:580 }}>
              <thead>
                <tr style={{ background:'var(--mr-dash-sub)' }}>
                  {['Product','SKU','Stock','Price','Status',''].map(h => (
                    <th key={h} style={{ textAlign:'left', padding:'12px 22px', fontFamily:'Jost, sans-serif', fontSize:10, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--mr-ink-400)', fontWeight:400, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr key={p.sku} onMouseEnter={()=>setHovered(i)} onMouseLeave={()=>setHovered(null)}
                    style={{ borderTop:'1px solid var(--mr-dash-hair)', background: hovered===i?'var(--mr-dash-sub)':'transparent', transition:'background 140ms', animation:`mr-fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both`, animationDelay:`${80 + i * 40}ms` }}>
                    <td style={tdS}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ width:36, height:48, background:'var(--mr-cream-300)', borderRadius:3, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <BottleSVG bottle={['rose','oud','crimson','cream','ink','amber','amber'][i]} cap="gold" />
                        </div>
                        <span style={{ fontWeight:500 }}>{p.n}</span>
                      </div>
                    </td>
                    <td style={{ ...tdS, fontFamily:'SF Mono,monospace', fontSize:12, color:'var(--mr-ink-500)' }}>{p.sku}</td>
                    <td style={{ ...tdS, fontVariantNumeric:'tabular-nums', fontWeight:600 }}>{p.stock}</td>
                    <td style={{ ...tdS, textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{p.price}</td>
                    <td style={tdS}><DashStatusBadge state={p.state}/></td>
                    <td style={tdS}><button style={{ background:'none', border:0, cursor:'pointer', fontFamily:'Jost, sans-serif', fontSize:10, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--mr-ink-900)', borderBottom:'1px solid var(--mr-gold-400)', paddingBottom:2 }}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
function DashOrderDetail({ order, onBack }) {
  const { mobile, w } = window.useBreakpoint();
  const enter = window.useEnterSpring({ preset:'navigation', from:{ y:16, opacity:0, scale:1 }, delay:40 });
  const timeline = [
    { t:'Order placed',          d:'Apr 22 · 10:14', done:true  },
    { t:'Payment received',      d:'Apr 22 · 10:15', done:true  },
    { t:'Prepared at Grasse',    d:'Apr 22 · 14:02', done:true  },
    { t:'Dispatched · DHL',      d:'Apr 22 · 17:48', done:true  },
    { t:'In transit',            d:'Arrives Apr 24', done:false },
  ];
  return (
    <div style={{ padding: mobile ? '16px' : '28px 36px', ...enter }}>
      <button onClick={onBack} style={{ background:'none', border:0, cursor:'pointer', fontFamily:'Jost, sans-serif', fontSize:10, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--mr-ink-700)', marginBottom: mobile?16:24, transition:'opacity 180ms', display:'inline-flex', alignItems:'center', gap:8 }}
        onMouseEnter={e=>e.currentTarget.style.opacity=0.5}
        onMouseLeave={e=>e.currentTarget.style.opacity=1}>
        ← Back to overview
      </button>
      <div style={{ display:'grid', gridTemplateColumns: mobile ? '1fr' : w < 900 ? '1fr' : '1.5fr 1fr', gap: mobile?14:20 }}>
        <div style={{ display:'flex', flexDirection:'column', gap: mobile?12:20 }}>
          <div style={{ background:'var(--mr-dash-surface)', border:'1px solid var(--mr-dash-hair)', borderRadius:10, padding: mobile?'18px':'24px' }}>
            <h3 style={{ fontFamily:'Inter Tight, sans-serif', fontWeight:600, fontSize:mobile?16:18, margin:`0 0 ${mobile?16:20}px`, letterSpacing:'-0.01em' }}>Timeline</h3>
            {timeline.map((e, i) => (
              <div key={i} style={{ display:'flex', gap:16, paddingBottom:16, position:'relative', animation:`mr-fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both`, animationDelay:`${i * 60 + 100}ms` }}>
                <div style={{ width:10, height:10, borderRadius:999, background: e.done?'var(--mr-gold-500)':'var(--mr-cream-300)', border:'1.5px solid var(--mr-gold-400)', marginTop:4, position:'relative', zIndex:2, flexShrink:0 }}/>
                {i < timeline.length-1 && <div style={{ position:'absolute', left:4, top:14, bottom:-4, width:1, background:'var(--mr-dash-hair)' }}/>}
                <div>
                  <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:13, color:'var(--mr-ink-900)', fontWeight: e.done?500:400 }}>{e.t}</div>
                  <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:11, color:'var(--mr-ink-400)', marginTop:2, fontVariantNumeric:'tabular-nums' }}>{e.d}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:'var(--mr-dash-surface)', border:'1px solid var(--mr-dash-hair)', borderRadius:10, padding: mobile?'18px':'24px' }}>
            <h3 style={{ fontFamily:'Inter Tight, sans-serif', fontWeight:600, fontSize:mobile?16:18, margin:`0 0 ${mobile?14:18}px`, letterSpacing:'-0.01em' }}>Items</h3>
            <div style={{ display:'flex', gap:16, paddingBottom:16, borderBottom:'1px solid var(--mr-dash-hair)' }}>
              <div style={{ width:mobile?56:70, height:mobile?72:90, background:'var(--mr-ink-900)', borderRadius:3, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <BottleSVG bottle="oud" cap="gold" />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:14, overflow:'hidden', textOverflow:'ellipsis' }}>{order.item}</div>
                <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:12, color:'var(--mr-ink-400)', marginTop:2, fontVariantNumeric:'tabular-nums' }}>SKU · MR-ON-100 · qty 1</div>
              </div>
              <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:14, fontWeight:700, fontVariantNumeric:'tabular-nums', flexShrink:0 }}>{order.total}</div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', paddingTop:14, fontFamily:'Inter Tight, sans-serif', fontSize:13 }}>
              <span style={{ color:'var(--mr-ink-500)' }}>Shipping — DHL Express</span><span>Included</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', paddingTop:8, fontFamily:'Inter Tight, sans-serif', fontSize:14, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>
              <span>Total</span><span>{order.total}</span>
            </div>
          </div>
        </div>
        <div style={{ background:'var(--mr-dash-surface)', border:'1px solid var(--mr-dash-hair)', borderRadius:10, padding: mobile?'18px':'24px', height:'fit-content' }}>
          {[
            { label:'Order', value: order.id },
            { label:'Customer', value: order.name },
            { label:'History', value: '4 orders · since 2024' },
            { label:'Ship to', value: '14 Rue de Rivoli\n75001 Paris · France' },
          ].map(f => (
            <div key={f.label} style={{ marginBottom:18 }}>
              <div style={{ fontFamily:'Jost, sans-serif', fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--mr-ink-400)', marginBottom:6 }}>{f.label}</div>
              <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:13, color:'var(--mr-ink-900)', lineHeight:1.6, whiteSpace:'pre-line', fontVariantNumeric:'tabular-nums' }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
/* ─── DashboardApp — top-level dashboard ─────────────────── */
function DashboardApp({ onStorefront }) {
  const [nav, setNav] = React.useState('overview');
  const [order, setOrder] = React.useState(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const { mobile, tablet, w } = window.useBreakpoint();
  const isMobileTablet = w < 1024;

  const titles = {
    overview:  { e:'Store · Paris',         t:'Good morning, Clémence.' },
    catalog:   { e:'Catalog',               t:'37 products · 4 houses'  },
    orders:    { e:'Orders',                t:'All orders'              },
    customers: { e:'Customers',             t:'Customer directory'      },
    analytics: { e:'Insights',             t:'Analytics'              },
    messages:  { e:'Support',              t:'Customer messages'       },
    settings:  { e:'House',                t:'Settings'               },
  };

  const openOrder = (o) => { setOrder(o); setNav('_order'); };
  const backToOverview = () => { setOrder(null); setNav('overview'); };
  const activeTitle = nav === '_order' ? { e:'Order · ' + order.id, t:order.name } : titles[nav] || titles.overview;

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--mr-dash-bg)', position:'relative' }}
      data-screen-label={`Dashboard · ${nav === '_order' ? 'Order detail' : nav}`}>

      {/* Mobile overlay */}
      {isMobileTablet && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(11,11,11,0.45)', backdropFilter:'blur(4px)', zIndex:60 }} />
      )}

      {/* Sidebar */}
      <div style={{
        position: isMobileTablet ? 'fixed' : 'sticky',
        top:0, left:0, zIndex: isMobileTablet ? 70 : 'auto',
        height:'100vh', flexShrink:0,
        transform: isMobileTablet ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        transition:'transform 340ms cubic-bezier(0.16,1,0.3,1)',
      }}>
        <DashSidebar
          active={nav === '_order' ? 'overview' : nav}
          onNav={(k) => { setNav(k); setSidebarOpen(false); }}
          onStorefront={onStorefront}
        />
      </div>

      <main style={{ flex:1, minWidth:0 }}>
        {/* Mobile topbar with hamburger */}
        {isMobileTablet && (
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--mr-dash-hair)', display:'flex', alignItems:'center', gap:14, background:'var(--mr-dash-surface)', position:'sticky', top:0, zIndex:50 }}>
            <button onClick={() => setSidebarOpen(true)} style={{ background:'none', border:0, cursor:'pointer', color:'var(--mr-ink-700)', padding:4, display:'flex' }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
            </button>
            <div style={{ fontFamily:'Inter Tight, sans-serif', fontWeight:600, fontSize:18, color:'var(--mr-ink-900)', letterSpacing:'-0.01em' }}>{activeTitle.t}</div>
          </div>
        )}
        {!isMobileTablet && <DashTopBar title={activeTitle.t} eyebrow={activeTitle.e} onNotif={() => setNotifOpen(true)} />}

        {nav === 'overview'  && <DashOverview onOpenOrder={openOrder}/>}
        {nav === 'catalog'   && <DashCatalog/>}
        {nav === 'messages'  && <DashChatView/>}
        {nav === '_order'    && <DashOrderDetail order={order} onBack={backToOverview}/>}
        {['orders','customers','analytics','settings'].includes(nav) && (
          <div style={{ padding:'clamp(40px,8vw,80px)', textAlign:'center', fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:24, color:'var(--mr-ink-400)', animation:'mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
            — {activeTitle.t} —
          </div>
        )}
        <NotificationDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
      </main>
    </div>
  );
}

Object.assign(window, { DashboardApp, NotificationDrawer });

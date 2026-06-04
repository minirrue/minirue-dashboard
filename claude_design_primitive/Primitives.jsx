// Primitives.jsx — Shared UI components: Button, Icon, Wordmark, WordReveal, Marquee, BottleSVG

/* ─── Button ─────────────────────────────────────────────── */
function Button({ variant = 'primary', size = 'md', children, onClick, disabled, style, sweep = false, sweepColor, sweepInk }) {
  const base = {
    fontFamily: 'Jost, sans-serif',
    fontSize: size === 'sm' ? 11 : 12,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    padding: size === 'sm' ? '10px 18px' : '14px 26px',
    borderRadius: variant === 'ghost' ? 0 : 'var(--mr-radius-pill)',
    border: '1px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    opacity: disabled ? 0.4 : 1,
    willChange: 'transform',
    lineHeight: 1,
    ...style,
  };
  const variants = {
    primary:      { background: 'var(--mr-ink-900)', color: 'var(--mr-cream-100)', boxShadow: 'var(--mr-shadow-md)' },
    gold:         { background: 'var(--mr-gold-500)', color: 'var(--mr-cream-100)', boxShadow: 'var(--mr-shadow-md)' },
    outline:      { background: 'transparent', color: 'var(--mr-ink-900)', borderColor: 'var(--mr-ink-900)' },
    outlineLight: { background: 'transparent', color: 'var(--mr-cream-100)', borderColor: 'rgba(253,251,245,0.75)' },
    ghost:        { background: 'transparent', color: 'var(--mr-ink-900)', border: 0, borderBottom: '1px solid var(--mr-gold-400)', padding: '8px 0', borderRadius: 0 },
  };
  const hoverStyles = sweep ? {
    primary: { color: sweepInk || 'var(--mr-ink-900)' },
    gold: { color: sweepInk || 'var(--mr-ink-900)' },
    outline: { color: sweepInk || 'var(--mr-cream-100)' },
    outlineLight: { color: sweepInk || 'var(--mr-ink-900)' },
    ghost: { color: 'var(--mr-gold-700)' },
  } : {
    primary:      { background: 'var(--mr-ink-700)' },
    gold:         { background: 'var(--mr-gold-700)' },
    outline:      { background: 'var(--mr-ink-900)', color: 'var(--mr-cream-100)' },
    outlineLight: { background: 'rgba(253,251,245,0.15)' },
    ghost:        { color: 'var(--mr-gold-700)' },
  };
  const [h, setH] = React.useState(false);
  const [p, setP] = React.useState(false);
  const scale = p ? 'scale(0.96)' : h && !disabled ? `scale(var(--mp-scale-hover, 1.02))` : 'scale(1)';
  const sweepStyle = sweep ? { '--sweep-color': sweepColor || 'var(--mr-cream-100)' } : {};
  return (
    <button
      className={sweep ? 'mr-btn-sweep' : undefined}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => { setH(false); setP(false); }}
      onMouseDown={() => setP(true)}
      onMouseUp={() => setP(false)}
      style={{
        ...base,
        ...variants[variant],
        ...(h && !disabled ? hoverStyles[variant] : {}),
        ...sweepStyle,
        transform: scale,
        transition: p ? window.MR_TX.press : `transform var(--mp-dur-hover) var(--mr-ease-spring), background-color var(--mr-dur-fast) var(--mr-ease-snappy), color var(--mr-dur-fast) var(--mr-ease-snappy), box-shadow var(--mr-dur-fast) var(--mr-ease-out)`,
      }}
    >{sweep ? <span style={{ position: 'relative', zIndex: 1 }}>{children}</span> : children}</button>
  );
}

/* ─── IconButton ─────────────────────────────────────────── */
function IconButton({ icon, onClick, size = 40, tone = 'cream', label, badge, badgeBump }) {
  const [h, setH] = React.useState(false);
  const [p, setP] = React.useState(false);
  const tones = {
    cream: { bg: 'var(--mr-cream-100)', fg: 'var(--mr-ink-900)', bgH: 'var(--mr-cream-300)' },
    ink:   { bg: 'var(--mr-ink-900)', fg: 'var(--mr-cream-100)', bgH: 'var(--mr-ink-700)' },
    gold:  { bg: 'var(--mr-gold-500)', fg: 'var(--mr-cream-100)', bgH: 'var(--mr-gold-700)' },
    glass: { bg: 'rgba(253,251,245,.12)', fg: 'var(--mr-cream-100)', bgH: 'rgba(253,251,245,.22)' },
  };
  const t = tones[tone] || tones.cream;
  return (
    <button aria-label={label} onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => { setH(false); setP(false); }}
      onMouseDown={() => setP(true)}
      onMouseUp={() => setP(false)}
      style={{
        position: 'relative', width: size, height: size,
        borderRadius: 'var(--mr-radius-pill)',
        background: h ? t.bgH : t.bg, color: t.fg,
        border: 0, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transform: p ? 'scale(0.94)' : h ? `scale(var(--mp-scale-hover,1.02))` : 'scale(1)',
        transition: p ? window.MR_TX.press : window.MR_TX.hover,
        boxShadow: tone === 'glass' ? 'none' : 'var(--mr-shadow-sm)',
        flexShrink: 0,
      }}>
      {typeof icon === 'string' ? <Icon name={icon} size={Math.round(size * 0.44)} /> : icon}
      {badge > 0 && (
        <span data-bump={badgeBump ? '1' : '0'} style={{
          position: 'absolute', top: -4, right: -4,
          minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
          background: 'var(--mr-crimson-700)', color: 'var(--mr-cream-100)',
          fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: '0.04em',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--mr-shadow-sm)',
        }}>{badge}</span>
      )}
    </button>
  );
}

/* ─── Badge ──────────────────────────────────────────────── */
function Badge({ kind = 'soft', children }) {
  const s = {
    new:     { background: 'var(--mr-ink-900)', color: 'var(--mr-cream-100)' },
    sale:    { background: 'var(--mr-crimson-700)', color: 'var(--mr-cream-100)' },
    gold:    { background: 'var(--mr-gold-500)', color: 'var(--mr-cream-100)' },
    soft:    { background: 'var(--mr-cream-300)', color: 'var(--mr-ink-700)' },
    outline: { border: '1px solid var(--mr-border)', color: 'var(--mr-ink-700)' },
  };
  return (
    <span style={{
      display: 'inline-flex', padding: '5px 12px', borderRadius: 'var(--mr-radius-pill)',
      fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: '0.18em',
      textTransform: 'uppercase', lineHeight: 1, ...s[kind],
    }}>{children}</span>
  );
}

/* ─── Icon ───────────────────────────────────────────────── */
function Icon({ name, size = 18, stroke = 1.5, color = 'currentColor' }) {
  const paths = {
    search:     <><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>,
    user:       <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    bag:        <><path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></>,
    heart:      <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.5l-1-.9a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/></>,
    close:      <><path d="M5 5l14 14M19 5L5 19"/></>,
    arrowRight: <><path d="M4 12h16M14 6l6 6-6 6"/></>,
    arrowLeft:  <><path d="M20 12H4M10 6l-6 6 6 6"/></>,
    minus:      <><path d="M5 12h14"/></>,
    plus:       <><path d="M12 5v14M5 12h14"/></>,
    check:      <><path d="M4 12l5 5L20 6"/></>,
    gift:       <><path d="M4 5h16v4H4zM6 9v11h12V9"/></>,
    truck:      <><path d="M3 7h13l3 4v6a2 2 0 0 1-2 2H3V7z"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></>,
    menu:       <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    x:          <><path d="M5 5l14 14M19 5L5 19"/></>,
    grid:       <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    external:   <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || null}
    </svg>
  );
}

/* ─── Sparkle ────────────────────────────────────────────── */
function Sparkle({ size = 14, color = 'var(--mr-gold-500)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill={color} aria-hidden="true">
      <path d="M16 0 C16 7,17 12,22 14 C17 16,16 21,16 32 C16 21,15 16,10 14 C15 12,16 7,16 0 Z" />
    </svg>
  );
}

/* ─── Wordmark ───────────────────────────────────────────── */
function Wordmark({ size = 22, color = 'var(--mr-gold-500)', captionColor = 'var(--mr-ink-700)' }) {
  return (
    <div style={{ textAlign: 'center', lineHeight: 1 }}>
      <div style={{
        fontFamily: 'Cormorant Garamond, serif', fontWeight: 500,
        fontSize: size, color, letterSpacing: '-0.01em',
        display: 'inline-flex', alignItems: 'flex-start', gap: 3,
      }}>
        MiniRue
        <span className="mr-breath" style={{ display: 'inline-flex' }}>
          <Sparkle size={size * 0.35} color={color} />
        </span>
      </div>
      <div style={{
        fontFamily: 'Jost, sans-serif', fontSize: size * 0.36,
        letterSpacing: '0.34em', color: captionColor,
        marginTop: 5, textTransform: 'uppercase',
      }}>Cosmetics &amp; Perfumes</div>
    </div>
  );
}

/* ─── WordReveal — word-by-word blur+slide reveal ────────── */
// text: string, delay: base delay ms, wordDelay: per-word stagger ms
function WordReveal({ text, delay = 0, wordDelay = 80 }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((word, i) => (
        <span key={i} style={{
          display: 'inline-block',
          animation: `mr-word-in 0.65s cubic-bezier(0.16,1,0.3,1) both`,
          animationDelay: `${delay + i * wordDelay}ms`,
        }}>
          {word}{i < words.length - 1 ? '\u00a0' : ''}
        </span>
      ))}
    </>
  );
}

/* ─── Marquee — infinite scroll ribbon ──────────────────── */
function Marquee({ items, speed = 38, surface = 'ink' }) {
  const doubled = [...items, ...items];
  const isDark = surface === 'ink';
  return (
    <div style={{
      overflow: 'hidden',
      background: isDark ? 'var(--mr-ink-900)' : 'var(--mr-cream-300)',
      color: isDark ? 'var(--mr-cream-200)' : 'var(--mr-ink-700)',
      padding: '13px 0',
      borderTop: isDark ? '1px solid rgba(238,230,209,.08)' : '1px solid var(--mr-hairline)',
      borderBottom: isDark ? '1px solid rgba(238,230,209,.08)' : '1px solid var(--mr-hairline)',
    }}>
      <div style={{
        display: 'flex',
        width: 'max-content',
        animation: `mr-marquee ${speed}s linear infinite`,
      }}>
        {doubled.map((item, i) => (
          <span key={i} style={{
            fontFamily: 'Jost, sans-serif',
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            padding: '0 28px',
            opacity: isDark ? 0.65 : 0.75,
            display: 'inline-flex', alignItems: 'center', gap: 24,
            whiteSpace: 'nowrap',
          }}>
            <Sparkle size={7} color={isDark ? 'var(--mr-gold-400)' : 'var(--mr-gold-500)'} />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── BottleSVG ──────────────────────────────────────────── */
function BottleSVG({ bottle = 'amber', cap = 'ink' }) {
  const fills = {
    amber: '#B0924F', rose: '#E4D7B4', ink: '#1A1815',
    cream: '#DCD3BB', crimson: '#3B0001', oud: '#2E2A24',
  };
  const capColors = { ink: '#1A1815', gold: '#95783C', cream: '#EEE6D1' };
  return (
    <svg viewBox="0 0 80 140" style={{ height: '75%', maxWidth: '60%' }} fill="none">
      <rect x="20" y="40" width="40" height="90" fill={fills[bottle]} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/>
      <rect x="28" y="20" width="24" height="22" fill={capColors[cap]}/>
      <rect x="30" y="14" width="20" height="8" fill={capColors[cap]} opacity="0.8"/>
      <rect x="26" y="70" width="28" height="30" fill="rgba(255,255,255,0.08)"/>
      <text x="40" y="92" textAnchor="middle" fill="rgba(255,255,255,0.45)"
        fontFamily="Cormorant Garamond, serif" fontSize="6" letterSpacing="1">MINI RUE</text>
    </svg>
  );
}

Object.assign(window, { Button, IconButton, Badge, Icon, Sparkle, Wordmark, WordReveal, Marquee, BottleSVG });

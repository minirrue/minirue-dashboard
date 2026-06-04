// StorefrontContent.jsx — ProductCard, ProductGrid, EditorialBlock, ProductDetail, CartDrawer, HomeView

const PRODUCTS = [
  { id:1, name:'Absolue Rose',     house:'MiniRue Maison', meta:'Eau de parfum · 50 ml',  price:'€ 185', bottle:'rose',    cap:'gold',  tile:'amber',   flag:'New',       tagline:'Turkish rose, opened at dawn.' },
  { id:2, name:'Oud Nocturne',     house:'MiniRue Maison', meta:'Eau de parfum · 100 ml', price:'€ 320', bottle:'oud',     cap:'gold',  tile:'ink',     tagline:'Smoked oud, warm leather, the last hour of the night.' },
  { id:3, name:'Lost Cherry',      house:'Tom Ford',       meta:'Eau de parfum · 50 ml',  price:'€ 224', wasPrice:'€ 280', bottle:'crimson', cap:'cream', tile:'crimson', flag:'− 20%', tagline:'Bitter almond, black cherry, tonka.' },
  { id:4, name:'Blanc Amande',     house:'MiniRue Maison', meta:'Eau de parfum · 50 ml',  price:'€ 165', bottle:'cream',   cap:'cream', tile:'amber',   tagline:'Almond milk, iris, the calm of a Sunday.' },
  { id:5, name:'Vetiver d\'Hiver', house:'MiniRue Maison', meta:'Eau de parfum · 50 ml',  price:'€ 210', bottle:'ink',     cap:'gold',  tile:'ink',     tagline:'Cold vetiver, birch tar, a wool coat.' },
  { id:6, name:'Figuier',          house:'Diptyque',       meta:'Eau de parfum · 75 ml',  price:'€ 142', bottle:'amber',   cap:'ink',   tile:'amber',   flag:'Bestseller', tagline:'Green fig, bark, an afternoon in Provence.' },
  { id:7, name:'Musc Dorée',       house:'MiniRue Maison', meta:'Eau de parfum · 30 ml',  price:'€ 125', bottle:'amber',   cap:'gold',  tile:'amber',   tagline:'Warm musk, apricot skin, cashmere.' },
  { id:8, name:'Nuit Vénitienne',  house:'MiniRue Maison', meta:'Eau de parfum · 100 ml', price:'€ 295', bottle:'crimson', cap:'gold',  tile:'crimson', tagline:'Burnt sugar, amber, an open window in July.' },
];

/* ─── ProductCard ─────────────────────────────────────────── */
function ProductCard({ product, index = 0, onClick }) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const enter = window.useStaggerEnter(index, { preset:'default', step:55, from:{ y:20, opacity:0, scale:0.96 } });
  const tileBg = { amber:'var(--mr-cream-300)', ink:'var(--mr-ink-900)', crimson:'var(--mr-crimson-700)', rose:'#E8D6C9', oud:'#2B2420' };
  const isDark = product.tile === 'ink' || product.tile === 'crimson' || product.tile === 'oud';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{ cursor:'pointer', display:'flex', flexDirection:'column', gap:14, ...enter }}
    >
      {/* Tile */}
      <div style={{
        aspectRatio:'1/1',
        background: tileBg[product.tile] || 'var(--mr-cream-300)',
        position:'relative', overflow:'hidden',
        borderRadius:'var(--mr-radius-lg)',
        boxShadow: hover ? 'var(--mr-shadow-lg)' : 'var(--mr-shadow-sm)',
        transform: press ? 'translate3d(0,-1px,0) scale(0.98)' : hover ? 'translate3d(0,-6px,0)' : 'translate3d(0,0,0)',
        transition: press ? window.MR_TX.press : `transform var(--mp-dur-hover) var(--mr-ease-spring), box-shadow var(--mp-dur-hover) var(--mr-ease-out)`,
      }}>
        {/* Flag badge */}
        {product.flag && (
          <span style={{
            position:'absolute', top:12, left:12, zIndex:2,
            padding:'5px 10px', borderRadius:'var(--mr-radius-pill)',
            background: isDark ? 'rgba(253,251,245,0.92)' : 'var(--mr-ink-900)',
            color: isDark ? 'var(--mr-ink-900)' : 'var(--mr-cream-100)',
            fontFamily:'Jost, sans-serif', fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase',
            boxShadow:'var(--mr-shadow-sm)',
          }}>{product.flag}</span>
        )}

        {/* Wishlist on hover */}
        <div style={{
          position:'absolute', top:12, right:12, zIndex:2,
          opacity: hover ? 1 : 0,
          transform: hover ? 'scale(1)' : 'scale(0.85)',
          transition:'opacity 220ms var(--mr-ease-out), transform 240ms var(--mr-ease-spring)',
        }}>
          <IconButton icon="heart" size={34} tone={isDark ? 'glass' : 'cream'} label="Save" />
        </div>

        {/* Bottle — subtle scale on hover */}
        <div className="mr-float" style={{
          position:'absolute', inset:0,
          display:'flex', alignItems:'center', justifyContent:'center',
          transform: hover ? 'scale(1.06)' : 'scale(1)',
          transition:'transform 700ms cubic-bezier(0.16,0.84,0.44,1)',
        }}>
          <BottleSVG bottle={product.bottle} cap={product.cap} />
        </div>

        {/* Quick view pill on hover */}
        <div style={{
          position:'absolute', left:12, right:12, bottom:12,
          opacity: hover ? 1 : 0,
          transform: hover ? 'translateY(0)' : 'translateY(8px)',
          transition:'opacity 220ms var(--mr-ease-out), transform 260ms var(--mr-ease-spring)',
        }}>
          <div style={{
            background:'rgba(253,251,245,0.96)', backdropFilter:'blur(8px)',
            color:'var(--mr-ink-900)', borderRadius:'var(--mr-radius-pill)',
            padding:'10px 16px', fontFamily:'Jost, sans-serif', fontSize:10,
            letterSpacing:'0.22em', textTransform:'uppercase', textAlign:'center',
            boxShadow:'var(--mr-shadow-md)',
          }}>Quick view →</div>
        </div>
      </div>

      {/* Meta */}
      <div>
        <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:15, color:'var(--mr-ink-900)', marginBottom:3 }}>{product.name}</div>
        <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:12, color:'var(--mr-ink-400)', letterSpacing:'0.02em' }}>{product.meta}</div>
        <div style={{ marginTop:9, fontFamily:'Cormorant Garamond, serif', fontWeight:500, fontSize:17, color:'var(--mr-ink-900)', fontVariantNumeric:'oldstyle-nums tabular-nums' }}>
          {product.wasPrice && <span style={{ color:'var(--mr-ink-400)', textDecoration:'line-through', marginRight:8 }}>{product.wasPrice}</span>}
          {product.price}
        </div>
      </div>
    </div>
  );
}

/* ─── ProductGrid ─────────────────────────────────────────── */
function ProductGrid({ eyebrow, title, products, onSelect }) {
  const head = window.useScrollReveal({ from:{ y:20, opacity:0, scale:1 } });
  const { mobile, tablet, w } = window.useBreakpoint();
  const cols = mobile ? 2 : w < 900 ? 3 : 4;

  return (
    <section style={{ maxWidth:1280, margin:'0 auto', padding:`96px var(--mr-gutter)` }}>
      <div ref={head.ref} style={{
        ...head.style,
        display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:48,
        flexWrap:'wrap', gap:16,
      }}>
        <div>
          <div style={{ fontFamily:'Jost, sans-serif', fontSize:11, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--mr-ink-500)', marginBottom:14 }}>{eyebrow}</div>
          <h2 style={{ fontFamily:'Cormorant Garamond, serif', fontWeight:500, fontSize:'clamp(28px,4vw,42px)', lineHeight:1.08, letterSpacing:'-0.006em', margin:0, color:'var(--mr-ink-900)' }}>{title}</h2>
        </div>
        <a style={{ fontFamily:'Jost, sans-serif', fontSize:11, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--mr-ink-900)', borderBottom:'1px solid var(--mr-gold-400)', paddingBottom:2, cursor:'pointer' }}>
          View all <span className="mr-link-arrow">→</span>
        </a>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap:'clamp(16px,3vw,32px)' }}>
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} onClick={() => onSelect(p)} />
        ))}
      </div>
    </section>
  );
}

/* ─── EditorialBlock ──────────────────────────────────────── */
function EditorialBlock() {
  const photo = window.useScrollReveal({ from:{ y:28, opacity:0, scale:0.97 } });
  const copy  = window.useScrollReveal({ from:{ y:18, opacity:0, scale:1 }, delay:80 });
  const { mobile, w } = window.useBreakpoint();

  return (
    <section data-mr-surface="ink" style={{
      background:'var(--mr-ink-900)', color:'var(--mr-cream-100)',
      padding:`clamp(64px,10vw,120px) var(--mr-gutter)`, marginTop:48,
    }}>
      <div style={{
        maxWidth:1100, margin:'0 auto',
        display:'grid',
        gridTemplateColumns: mobile ? '1fr' : '1fr 1fr',
        gap: mobile ? 48 : 80, alignItems:'center',
      }}>
        <div ref={photo.ref} style={{
          ...photo.style,
          aspectRatio: mobile ? '4/3' : '3/4',
          background:'linear-gradient(135deg,#3B0001,#670003 50%,#1A0000)',
          position:'relative', overflow:'hidden',
          borderRadius:'var(--mr-radius-lg)',
          boxShadow:'var(--mr-shadow-crimson)',
        }}>
          <div className="mr-hero-drift" style={{
            position:'absolute', inset:0, display:'flex',
            alignItems:'center', justifyContent:'center',
            transformOrigin:'50% 55%',
          }}>
            <BottleSVG bottle="crimson" cap="cream" />
          </div>
          <div style={{
            position:'absolute', top:16, left:16,
            fontFamily:'Jost, sans-serif', fontSize:10, letterSpacing:'0.22em',
            textTransform:'uppercase', color:'var(--mr-cream-100)', opacity:0.6,
          }}>Editorial · N°4</div>
        </div>

        <div ref={copy.ref} style={copy.style}>
          <div style={{ fontFamily:'Jost, sans-serif', fontSize:11, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--mr-gold-300)', marginBottom:20 }}>The Journal</div>
          <h2 style={{ fontFamily:'Cormorant Garamond, serif', fontWeight:400, fontSize:'clamp(32px,5vw,52px)', lineHeight:1.08, letterSpacing:'-0.01em', margin:'0 0 28px' }}>
            A study in bitter cherry and tonka.
          </h2>
          <p style={{ fontFamily:'Inter Tight, sans-serif', fontSize:16, lineHeight:1.65, color:'var(--mr-cream-200)', opacity:.85, maxWidth:420, margin:'0 0 36px' }}>
            It opens quietly. Almost shy. Then — after a beat — the bitterness of an old confit, the warmth of a wood drawer, the memory of someone who was here an hour ago.
          </p>
          <Button variant="outlineLight">Read the essay <span className="mr-link-arrow">→</span></Button>
        </div>
      </div>
    </section>
  );
}

/* ─── ProductDetail — sticky-left / scroll-right split layout ─── */
function ProductDetail({ product, onBack, onAddToBag }) {
  const SIZES = [{ k:'30ml', p:'€ 145' }, { k:'50ml', p:'€ 245' }, { k:'100ml', p:'€ 380' }];
  const [size, setSize] = React.useState('50ml');
  const [added, setAdded] = React.useState(false);
  const [addedAnim, setAddedAnim] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(null);
  const [saved, setSaved] = React.useState(false);
  const { mobile } = window.useBreakpoint();
  const current = SIZES.find(s => s.k === size);
  const ctaX = window.useCrossfade(current.p);
  const copyEnt = window.useEnterSpring({ preset:'default', from:{ y:14, opacity:0, scale:1 }, delay:60 });

  // Scent notes per product
  const NOTES_MAP = {
    1: [{ t:'Top', n:'Turkish rose, pink pepper' }, { t:'Heart', n:'Iris, jasmine' }, { t:'Base', n:'Sandalwood, amber' }],
    2: [{ t:'Top', n:'Bergamot, saffron' }, { t:'Heart', n:'Oud wood, leather' }, { t:'Base', n:'Amber, vetiver' }],
    3: [{ t:'Top', n:'Black cherry, bitter almond' }, { t:'Heart', n:'Turkish rose, tonka' }, { t:'Base', n:'Smoky sandalwood, patchouli' }],
    4: [{ t:'Top', n:'Almond milk, bergamot' }, { t:'Heart', n:'Iris, heliotrope' }, { t:'Base', n:'White musk, cashmere' }],
    5: [{ t:'Top', n:'Cold vetiver, birch' }, { t:'Heart', n:'Cedarwood, tobacco' }, { t:'Base', n:'Tar, smoked musk' }],
    6: [{ t:'Top', n:'Green fig leaf, bark' }, { t:'Heart', n:'Fig wood, white flowers' }, { t:'Base', n:'Cedar, white musk' }],
    7: [{ t:'Top', n:'Apricot, bergamot' }, { t:'Heart', n:'Warm musk, iris' }, { t:'Base', n:'Cashmere, vanilla' }],
    8: [{ t:'Top', n:'Burnt sugar, saffron' }, { t:'Heart', n:'Amber, rose' }, { t:'Base', n:'Labdanum, patchouli' }],
  };
  const NOTES = NOTES_MAP[product.id] || NOTES_MAP[1];

  const tileBg = { amber:'var(--mr-cream-300)', ink:'var(--mr-ink-900)', crimson:'var(--mr-crimson-700)', rose:'#E8D6C9', oud:'#2B2420', cream:'#F0EAD8' };
  const bg = tileBg[product.tile] || 'var(--mr-cream-300)';
  const isDark = product.tile === 'ink' || product.tile === 'crimson' || product.tile === 'oud';

  const handleAdd = () => {
    if (added) return;
    setAdded(true); setAddedAnim(true);
    onAddToBag({ ...product, size, price: current.p });
    setTimeout(() => setAddedAnim(false), 600);
    setTimeout(() => setAdded(false), 2400);
  };

  // Right-side image panels — multiple scroll moments
  const panels = [
    { type:'bottle-hero', label:'Hero' },
    { type:'editorial', label:'Editorial' },
    { type:'bottle-dark', label:'Dark' },
    { type:'notes', label:'Notes' },
  ];

  if (mobile) {
    // Mobile: stacked layout
    return (
      <div style={{ background:'var(--mr-cream-200)' }}>
        <div style={{ padding:'28px 20px 0' }}>
          <button onClick={onBack} style={{ background:'none', border:0, cursor:'pointer', display:'inline-flex', gap:8, alignItems:'center', fontFamily:'Jost, sans-serif', fontSize:10, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--mr-ink-700)', padding:0 }}>
            <Icon name="arrowLeft" size={12}/> Back
          </button>
        </div>
        {/* Hero image */}
        <div style={{ margin:'24px 20px 0', aspectRatio:'3/4', background:bg, borderRadius:'var(--mr-radius-lg)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', boxShadow:'var(--mr-shadow-lg)' }}>
          <div className="mr-hero-drift" style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', transformOrigin:'50% 55%' }}>
            <BottleSVG bottle={product.bottle} cap={product.cap} />
          </div>
        </div>
        {/* Info */}
        <div style={{ padding:'32px 20px 96px', ...copyEnt }}>
          <MobileDetailInfo product={product} size={size} setSize={setSize} SIZES={SIZES} NOTES={NOTES} ctaX={ctaX} added={added} addedAnim={addedAnim} handleAdd={handleAdd} noteOpen={noteOpen} setNoteOpen={setNoteOpen} saved={saved} setSaved={setSaved} />
        </div>
      </div>
    );
  }

  // Desktop: sticky left panel + scrollable right
  return (
    <div style={{ background:'var(--mr-cream-200)', display:'flex', minHeight:'100vh', position:'relative' }}>

      {/* ── LEFT: sticky info panel ── */}
      <div style={{
        width: w < 1100 ? '48%' : '42%', flexShrink:0,
        position:'sticky', top:0,
        height:'100vh',
        overflowY:'auto',
        display:'flex', flexDirection:'column',
        borderRight:'1px solid var(--mr-hairline)',
        background:'var(--mr-cream-100)',
        scrollbarWidth:'none',
      }}>
        <style>{`.detail-left::-webkit-scrollbar{display:none}`}</style>

        <div className="detail-left" style={{ padding:'40px 52px 60px', flex:1, display:'flex', flexDirection:'column' }}>

          {/* Back */}
          <button onClick={onBack} style={{
            background:'none', border:0, cursor:'pointer',
            display:'inline-flex', gap:8, alignItems:'center',
            fontFamily:'Jost, sans-serif', fontSize:10, letterSpacing:'0.22em',
            textTransform:'uppercase', color:'var(--mr-ink-500)', padding:0, marginBottom:48,
            transition:'color 200ms', alignSelf:'flex-start',
          }}
          onMouseEnter={e=>e.currentTarget.style.color='var(--mr-ink-900)'}
          onMouseLeave={e=>e.currentTarget.style.color='var(--mr-ink-500)'}>
            <Icon name="arrowLeft" size={13}/> Collection
          </button>

          <div style={{ ...copyEnt, flex:1, display:'flex', flexDirection:'column' }}>

            {/* House + type */}
            <div style={{ fontFamily:'Jost, sans-serif', fontSize:10, letterSpacing:'0.28em', textTransform:'uppercase', color:'var(--mr-ink-400)', marginBottom:16,
              animation:'mr-word-in 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay:'100ms' }}>
              {product.house} · Eau de parfum
            </div>

            {/* Name */}
            <h1 style={{
              fontFamily:'Cormorant Garamond, serif', fontWeight:400,
              fontSize:'clamp(38px,3.8vw,56px)', lineHeight:1.0, letterSpacing:'-0.015em',
              margin:'0 0 20px', color:'var(--mr-ink-900)',
              animation:'mr-word-in 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay:'160ms',
            }}>
              <WordReveal text={product.name} delay={200} wordDelay={80} />
            </h1>

            {/* Price */}
            <div style={{
              fontFamily:'Cormorant Garamond, serif', fontWeight:500, fontSize:24,
              color:'var(--mr-ink-900)', marginBottom:24, fontVariantNumeric:'oldstyle-nums tabular-nums',
              animation:'mr-word-in 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay:'300ms',
            }}>
              {product.wasPrice && <span style={{ color:'var(--mr-ink-400)', textDecoration:'line-through', marginRight:12, fontSize:18 }}>{product.wasPrice}</span>}
              <span style={ctaX.style}>{ctaX.display}</span>
            </div>

            {/* Tagline */}
            <p style={{
              fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:18, lineHeight:1.5,
              color:'var(--mr-ink-600,#4A4540)', margin:'0 0 36px',
              animation:'mr-word-in 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay:'380ms',
            }}>
              {product.tagline}
            </p>

            {/* Size selector */}
            <div style={{ marginBottom:28, animation:'mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay:'440ms' }}>
              <div style={{ fontFamily:'Jost, sans-serif', fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--mr-ink-400)', marginBottom:12 }}>Volume</div>
              <div style={{ display:'flex', gap:8 }}>
                {SIZES.map(s => {
                  const active = size === s.k;
                  return (
                    <button key={s.k} onClick={() => setSize(s.k)} style={{
                      padding:'11px 16px', cursor:'pointer',
                      background: active ? 'var(--mr-ink-900)' : 'transparent',
                      color: active ? 'var(--mr-cream-100)' : 'var(--mr-ink-700)',
                      border:`1px solid ${active ? 'var(--mr-ink-900)' : 'var(--mr-border)'}`,
                      borderRadius:'var(--mr-radius-pill)',
                      fontFamily:'Jost, sans-serif', fontSize:10, letterSpacing:'0.18em', textTransform:'uppercase',
                      transform: active ? 'scale(1.03)' : 'scale(1)',
                      transition:'all 280ms var(--mr-ease-spring)',
                      willChange:'transform',
                    }}>{s.k} · {s.p}</button>
                  );
                })}
              </div>
            </div>

            {/* CTA row */}
            <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:36, animation:'mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay:'500ms' }}>
              <button onClick={handleAdd} style={{
                flex:1, padding:'16px 24px', borderRadius:'var(--mr-radius-pill)',
                background: added ? 'var(--mr-gold-500)' : 'var(--mr-ink-900)',
                color:'var(--mr-cream-100)', border:0, cursor:'pointer',
                fontFamily:'Jost, sans-serif', fontSize:11, letterSpacing:'0.22em', textTransform:'uppercase',
                display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                transform: addedAnim ? 'scale(0.96)' : 'scale(1)',
                transition:'background 300ms var(--mr-ease-out), transform 120ms var(--mr-ease-snappy), box-shadow 200ms',
                boxShadow: added ? 'none' : 'var(--mr-shadow-md)',
                willChange:'transform',
              }}>
                {added
                  ? <><Icon name="check" size={14}/> Added</>
                  : <>Add to bag — <span style={ctaX.style}>{ctaX.display}</span></>}
              </button>
              <button onClick={() => setSaved(s => !s)} style={{
                width:52, height:52, borderRadius:'var(--mr-radius-pill)',
                background:'var(--mr-cream-200)', border:'1px solid var(--mr-border)',
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor:'pointer', transition:'all 220ms var(--mr-ease-spring)',
                transform: saved ? 'scale(1.08)' : 'scale(1)',
                flexShrink:0,
              }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill={saved ? 'var(--mr-crimson-500)' : 'none'}
                  stroke={saved ? 'var(--mr-crimson-500)' : 'var(--mr-ink-700)'}
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transition:'all 300ms var(--mr-ease-spring)', transform: saved ? 'scale(1.1)' : 'scale(1)' }}>
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.5l-1-.9a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>
                </svg>
              </button>
            </div>

            {/* Scent notes accordion */}
            <div style={{ borderTop:'1px solid var(--mr-hairline)', animation:'mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay:'560ms' }}>
              <div style={{ fontFamily:'Jost, sans-serif', fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--mr-ink-400)', padding:'18px 0 14px' }}>
                Scent profile
              </div>
              {NOTES.map((n, i) => (
                <div key={n.t} style={{ borderBottom:'1px solid var(--mr-hairline)' }}>
                  <button onClick={() => setNoteOpen(noteOpen === i ? null : i)} style={{
                    background:'none', border:0, width:'100%',
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'15px 0', cursor:'pointer',
                  }}>
                    <span style={{ fontFamily:'Jost, sans-serif', fontSize:10, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--mr-ink-500)' }}>{n.t} note</span>
                    <span style={{ transform: noteOpen===i ? 'rotate(45deg)' : 'rotate(0)', transition:'transform 260ms var(--mr-ease-spring)', display:'inline-flex', color:'var(--mr-ink-500)' }}>
                      <Icon name="plus" size={13}/>
                    </span>
                  </button>
                  <div style={{ maxHeight: noteOpen===i ? 60 : 0, overflow:'hidden', transition:'max-height 340ms var(--mr-ease-out)' }}>
                    <div style={{ fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:17, color:'var(--mr-ink-800)', paddingBottom:18 }}>{n.n}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Service row */}
            <div style={{ marginTop:'auto', paddingTop:32, display:'flex', flexDirection:'column', gap:12, fontFamily:'Inter Tight, sans-serif', fontSize:12, color:'var(--mr-ink-400)', animation:'mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay:'640ms' }}>
              <span style={{ display:'inline-flex', gap:10, alignItems:'center' }}><Icon name="truck" size={14}/> Complimentary shipping over € 180</span>
              <span style={{ display:'inline-flex', gap:10, alignItems:'center' }}><Icon name="gift" size={14}/> Two complimentary samples per order</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: scrollable imagery panels ── */}
      <div style={{ flex:1, minHeight:'100vh' }}>

        {/* Panel 1 — Hero bottle on brand tile */}
        <div style={{
          height:'100vh', background:bg,
          display:'flex', alignItems:'center', justifyContent:'center',
          position:'relative', overflow:'hidden',
        }}>
          {product.flag && (
            <div style={{ position:'absolute', top:32, left:32, zIndex:2 }}>
              <Badge kind={product.tile==='crimson'||product.tile==='ink'||product.tile==='oud' ? 'soft' : 'new'}>{product.flag}</Badge>
            </div>
          )}
          <div className="mr-hero-drift" style={{ width:'70%', height:'70%', display:'flex', alignItems:'center', justifyContent:'center', transformOrigin:'50% 50%',
            animation:'mr-fade-up 0.9s cubic-bezier(0.16,1,0.3,1) both', animationDelay:'200ms' }}>
            <BottleSVG bottle={product.bottle} cap={product.cap} />
          </div>
          {/* Eyebrow */}
          <div style={{ position:'absolute', bottom:40, left:40, fontFamily:'Jost, sans-serif', fontSize:10, letterSpacing:'0.28em', textTransform:'uppercase', color: isDark ? 'rgba(253,251,245,0.5)' : 'rgba(11,11,11,0.35)' }}>
            Scroll to explore
          </div>
          <div style={{ position:'absolute', bottom:40, right:40, fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:15, color: isDark ? 'rgba(253,251,245,0.6)' : 'var(--mr-ink-500)' }}>
            {product.meta}
          </div>
        </div>

        {/* Panel 2 — Editorial dark moment */}
        <div style={{
          height:'100vh',
          background: isDark ? 'var(--mr-cream-300)' : 'var(--mr-ink-900)',
          display:'flex', alignItems:'center', justifyContent:'center',
          position:'relative', overflow:'hidden',
        }}>
          <div style={{ textAlign:'center', padding:'0 64px', zIndex:1, position:'relative' }}>
            <div className="mr-breath" style={{ display:'inline-flex', marginBottom:32 }}>
              <Sparkle size={28} color={isDark ? 'var(--mr-gold-500)' : 'var(--mr-gold-400)'} />
            </div>
            <blockquote style={{
              fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontWeight:400,
              fontSize:'clamp(28px,3.5vw,48px)', lineHeight:1.15, letterSpacing:'-0.01em',
              color: isDark ? 'var(--mr-ink-800)' : 'var(--mr-cream-100)',
              margin:'0 0 32px', maxWidth:540,
            }}>
              "{product.tagline}"
            </blockquote>
            <div style={{ fontFamily:'Jost, sans-serif', fontSize:10, letterSpacing:'0.28em', textTransform:'uppercase', color: isDark ? 'var(--mr-gold-500)' : 'var(--mr-gold-400)' }}>
              {product.house}
            </div>
          </div>

          {/* Background bottle silhouette */}
          <div style={{ position:'absolute', right:'-5%', top:'10%', opacity:0.06, transform:'scale(2.2)', pointerEvents:'none' }}>
            <BottleSVG bottle={product.bottle} cap={product.cap} />
          </div>
        </div>

        {/* Panel 3 — Close-up / alternate */}
        <div style={{
          height:'100vh',
          background: isDark ? '#1A1613' : 'var(--mr-cream-300)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          gap:48, position:'relative', overflow:'hidden', padding:'64px',
        }}>
          {/* Three note cards */}
          <div style={{ fontFamily:'Jost, sans-serif', fontSize:10, letterSpacing:'0.28em', textTransform:'uppercase', color: isDark ? 'var(--mr-gold-300)' : 'var(--mr-ink-500)', marginBottom:8 }}>
            Fragrance composition
          </div>
          <div style={{ display:'flex', gap:24, width:'100%', maxWidth:480 }}>
            {NOTES.map((n, i) => (
              <div key={n.t} style={{
                flex:1, padding:'28px 20px',
                background: isDark ? 'rgba(238,230,209,0.06)' : 'rgba(255,255,255,0.7)',
                borderRadius:'var(--mr-radius-lg)',
                border:`1px solid ${isDark ? 'rgba(238,230,209,0.1)' : 'var(--mr-hairline)'}`,
                textAlign:'center',
                animation:`mr-fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both`,
                animationDelay:`${i * 80}ms`,
                backdropFilter:'blur(12px)',
              }}>
                <div style={{ fontFamily:'Jost, sans-serif', fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase', color: isDark ? 'var(--mr-gold-400)' : 'var(--mr-gold-500)', marginBottom:14 }}>{n.t}</div>
                <div style={{ fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:15, lineHeight:1.4, color: isDark ? 'var(--mr-cream-200)' : 'var(--mr-ink-800)' }}>{n.n}</div>
              </div>
            ))}
          </div>

          {/* Centered bottle smaller */}
          <div style={{ opacity:0.85 }}>
            <BottleSVG bottle={product.bottle} cap={product.cap} />
          </div>
        </div>

        {/* Panel 4 — You may also like strip */}
        <div style={{ minHeight:'60vh', background:'var(--mr-cream-200)', padding:'80px 64px', display:'flex', flexDirection:'column', gap:40 }}>
          <div>
            <div style={{ fontFamily:'Jost, sans-serif', fontSize:10, letterSpacing:'0.28em', textTransform:'uppercase', color:'var(--mr-ink-500)', marginBottom:14 }}>Complete the collection</div>
            <h3 style={{ fontFamily:'Cormorant Garamond, serif', fontWeight:400, fontSize:32, margin:0, color:'var(--mr-ink-900)' }}>You may also love</h3>
          </div>
          <div style={{ display:'grid', gridTemplateColumns: w < 640 ? '1fr' : w < 900 ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap:16 }}>
            {PRODUCTS.filter(p => p.id !== product.id).slice(0,3).map((p, i) => (
              <div key={p.id} style={{
                animation:`mr-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both`,
                animationDelay:`${i * 70}ms`,
                cursor:'pointer',
              }}>
                <div style={{
                  aspectRatio:'1/1', background: { amber:'var(--mr-cream-300)', ink:'var(--mr-ink-900)', crimson:'var(--mr-crimson-700)', rose:'#E8D6C9', oud:'#2B2420', cream:'#F0EAD8' }[p.tile] || 'var(--mr-cream-300)',
                  borderRadius:'var(--mr-radius-lg)', display:'flex', alignItems:'center', justifyContent:'center',
                  overflow:'hidden', marginBottom:12,
                  boxShadow:'var(--mr-shadow-sm)',
                  transition:'transform 280ms var(--mr-ease-spring), box-shadow 280ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='var(--mr-shadow-md)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='var(--mr-shadow-sm)'; }}>
                  <div className="mr-float"><BottleSVG bottle={p.bottle} cap={p.cap} /></div>
                </div>
                <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:13, color:'var(--mr-ink-900)', marginBottom:2 }}>{p.name}</div>
                <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:15, color:'var(--mr-ink-600,#4A4540)' }}>{p.price}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── MobileDetailInfo ─────────────────────────────────────── */
function MobileDetailInfo({ product, size, setSize, SIZES, NOTES, ctaX, added, addedAnim, handleAdd, noteOpen, setNoteOpen, saved, setSaved }) {
  return (
    <>
      <div style={{ fontFamily:'Jost, sans-serif', fontSize:10, letterSpacing:'0.28em', textTransform:'uppercase', color:'var(--mr-ink-400)', marginBottom:12 }}>{product.house} · Eau de parfum</div>
      <h1 style={{ fontFamily:'Cormorant Garamond, serif', fontWeight:400, fontSize:36, lineHeight:1.0, letterSpacing:'-0.015em', margin:'0 0 16px', color:'var(--mr-ink-900)' }}>{product.name}</h1>
      <p style={{ fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:17, lineHeight:1.5, color:'var(--mr-ink-700)', margin:'0 0 28px' }}>{product.tagline}</p>
      <div style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
        {SIZES.map(s => {
          const active = size === s.k;
          return <button key={s.k} onClick={() => setSize(s.k)} style={{ padding:'10px 14px', cursor:'pointer', background: active ? 'var(--mr-ink-900)' : 'transparent', color: active ? 'var(--mr-cream-100)' : 'var(--mr-ink-700)', border:`1px solid ${active ? 'var(--mr-ink-900)' : 'var(--mr-border)'}`, borderRadius:'var(--mr-radius-pill)', fontFamily:'Jost, sans-serif', fontSize:10, letterSpacing:'0.18em', textTransform:'uppercase', transition:'all 280ms var(--mr-ease-spring)' }}>{s.k} · {s.p}</button>;
        })}
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:28 }}>
        <button onClick={handleAdd} style={{ flex:1, padding:'15px 20px', borderRadius:'var(--mr-radius-pill)', background: added ? 'var(--mr-gold-500)' : 'var(--mr-ink-900)', color:'var(--mr-cream-100)', border:0, cursor:'pointer', fontFamily:'Jost, sans-serif', fontSize:10, letterSpacing:'0.22em', textTransform:'uppercase', transition:'all 280ms var(--mr-ease-spring)', transform: addedAnim ? 'scale(0.96)' : 'scale(1)' }}>
          {added ? '✓ Added' : `Add to bag — ${ctaX.display}`}
        </button>
      </div>
      <div style={{ borderTop:'1px solid var(--mr-hairline)' }}>
        {NOTES.map((n, i) => (
          <div key={n.t} style={{ borderBottom:'1px solid var(--mr-hairline)' }}>
            <button onClick={() => setNoteOpen(noteOpen===i ? null : i)} style={{ background:'none', border:0, width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 0', cursor:'pointer' }}>
              <span style={{ fontFamily:'Jost, sans-serif', fontSize:9, letterSpacing:'0.22em', textTransform:'uppercase', color:'var(--mr-ink-500)' }}>{n.t} note</span>
              <span style={{ transform: noteOpen===i ? 'rotate(45deg)' : 'rotate(0)', transition:'transform 260ms var(--mr-ease-spring)', display:'inline-flex' }}><Icon name="plus" size={12}/></span>
            </button>
            <div style={{ maxHeight: noteOpen===i ? 60 : 0, overflow:'hidden', transition:'max-height 320ms var(--mr-ease-out)' }}>
              <div style={{ fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:16, color:'var(--mr-ink-800)', paddingBottom:16 }}>{n.n}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─── CartDrawer ──────────────────────────────────────────── */
function CartDrawer({ open, onClose, items, onRemove }) {
  const subtotal = items.reduce((a, b) => a + parseFloat(b.price.replace(/[^\d.]/g,'')), 0);
  const subX = window.useCrossfade(`€ ${subtotal.toFixed(0)}`);

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position:'fixed', inset:0, background:'rgba(11,11,11,0.44)',
        backdropFilter: open ? 'blur(3px)' : 'blur(0)',
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
        transition:'opacity 260ms var(--mr-ease-snappy), backdrop-filter 260ms', zIndex:80,
      }} />

      {/* Drawer */}
      <aside style={{
        position:'fixed', top:16, right:16, bottom:16,
        width:'min(480px,calc(100vw - 32px))',
        background:'var(--mr-cream-100)', zIndex:90,
        borderRadius:'var(--mr-radius-lg)',
        transform: open ? 'translateX(0)' : 'translateX(calc(100% + 32px))',
        transition:`transform 400ms var(--mr-ease-out)`,
        display:'flex', flexDirection:'column',
        boxShadow:'var(--mr-shadow-xl)', overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{ padding:'22px 26px', borderBottom:'1px solid var(--mr-hairline)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontFamily:'Jost, sans-serif', fontSize:12, letterSpacing:'0.22em', textTransform:'uppercase' }}>
            Your bag · <span style={{ color:'var(--mr-gold-500)' }}>{items.length}</span>
          </div>
          <IconButton icon="close" size={36} tone="cream" label="Close" onClick={onClose} />
        </div>

        {/* Items */}
        <div style={{ flex:1, overflowY:'auto', padding:'18px 28px' }}>
          {items.length === 0 ? (
            <div style={{ textAlign:'center', padding:'80px 0' }}>
              <div style={{ animation:'mr-breath 4s var(--mr-ease-ios) infinite', display:'inline-flex' }}>
                <Sparkle size={32} />
              </div>
              <p style={{ fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:22, color:'var(--mr-ink-700)', margin:'20px 0 8px' }}>Your bag is empty.</p>
              <p style={{ fontFamily:'Inter Tight, sans-serif', fontSize:13, color:'var(--mr-ink-500)' }}>Begin with a scent.</p>
            </div>
          ) : (
            items.map((it, i) => (
              <div key={i} style={{
                ...window.useStaggerEnter(i, { preset:'popover', step:45, from:{ y:12, opacity:0, scale:1 } }),
                display:'flex', gap:16, padding:'18px 0',
                borderBottom:'1px solid var(--mr-hairline)',
              }}>
                <div style={{
                  width:76, height:96, background:'var(--mr-cream-300)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  flexShrink:0, borderRadius:'var(--mr-radius-md)',
                  boxShadow:'var(--mr-shadow-sm)',
                }}>
                  <BottleSVG bottle={it.bottle} cap={it.cap} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:14, color:'var(--mr-ink-900)' }}>{it.name}</div>
                  <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:12, color:'var(--mr-ink-400)', marginTop:2 }}>Eau de parfum · {it.size || '50 ml'}</div>
                  <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:17, fontWeight:500, marginTop:10, fontVariantNumeric:'oldstyle-nums tabular-nums' }}>{it.price}</div>
                </div>
                <IconButton icon="close" size={28} tone="cream" label="Remove" onClick={() => onRemove(i)} />
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{ padding:'22px 28px', borderTop:'1px solid var(--mr-hairline)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontFamily:'Inter Tight, sans-serif', fontSize:13, color:'var(--mr-ink-500)' }}>
              <span>Subtotal</span>
              <span style={{ ...subX.style, fontFamily:'Cormorant Garamond, serif', fontSize:20, color:'var(--mr-ink-900)', fontVariantNumeric:'oldstyle-nums tabular-nums' }}>
                {subX.display}
              </span>
            </div>
            <div style={{ fontFamily:'Inter Tight, sans-serif', fontSize:11, color:'var(--mr-ink-400)', marginBottom:18 }}>
              Shipping & duties calculated at checkout.
            </div>
            <Button variant="primary" style={{ width:'100%' }}>Proceed to checkout</Button>
          </div>
        )}
      </aside>
    </>
  );
}

/* ─── HomeView ────────────────────────────────────────────── */
function HomeView({ onSelect }) {
  const gridRef = React.useRef(null);
  const handleShop = () => {
    if (gridRef.current) {
      const y = gridRef.current.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };
  return (
    <main data-screen-label="Storefront · Home">
      <Hero onShop={handleShop} />
      <Marquee items={['Worldwide shipping','New S/S \'26','Complimentary samples','Luxury packaging','Duty-paid to 62 countries','Private client service','Free engraving']} />
      <div ref={gridRef}>
        <ProductGrid eyebrow="New arrivals · S/S '26" title="The Spring Edit" products={PRODUCTS.slice(0,4)} onSelect={onSelect} />
      </div>
      <EditorialBlock />
      <ProductGrid eyebrow="The house selection" title="From the Maison" products={PRODUCTS.slice(4,8)} onSelect={onSelect} />
    </main>
  );
}

Object.assign(window, { PRODUCTS, ProductCard, ProductGrid, EditorialBlock, ProductDetail, MobileDetailInfo, CartDrawer, HomeView });

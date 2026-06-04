// StorefrontChrome.jsx — SplashScreen, Header, Hero, Footer

/* ─── SplashScreen — cinematic first-load wordmark reveal ── */
function SplashScreen({ onComplete }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    const gsap = window.gsap;
    if (!gsap) { setTimeout(onComplete, 400); return; }

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.to(ref.current, {
          opacity: 0, duration: 0.7, ease: 'power2.inOut',
          onComplete,
        });
      }
    });

    tl.from('.splash-letter', {
      opacity: 0, y: 32, duration: 0.6, ease: 'power3.out', stagger: 0.045,
    })
    .from('.splash-caption', {
      opacity: 0, letterSpacing: '0.7em', duration: 0.9, ease: 'power3.out',
    }, '-=0.25')
    .from('.splash-sparkle', {
      scale: 0, rotation: -45, opacity: 0, duration: 0.5, ease: 'back.out(2.2)',
    }, '-=0.5')
    .from('.splash-line', {
      scaleX: 0, duration: 0.7, ease: 'power3.out', stagger: 0.12,
    }, '-=0.3')
    .to({}, { duration: 0.55 });

    return () => tl.kill();
  }, []);

  return (
    <div ref={ref} style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'var(--mr-ink-900)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 0,
    }}>
      {/* Top & bottom hairlines */}
      <div className="splash-line" style={{
        position: 'absolute', top: 56, left: '10%', right: '10%',
        height: 1, background: 'rgba(238,230,209,0.14)',
        transformOrigin: 'left center',
      }} />
      <div className="splash-line" style={{
        position: 'absolute', bottom: 56, left: '10%', right: '10%',
        height: 1, background: 'rgba(238,230,209,0.14)',
        transformOrigin: 'right center',
      }} />

      <div style={{ textAlign: 'center' }}>
        {/* Letter-by-letter wordmark */}
        <div style={{
          fontFamily: 'Cormorant Garamond, serif', fontWeight: 500,
          fontSize: 'clamp(56px, 10vw, 96px)',
          color: 'var(--mr-gold-500)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          letterSpacing: '-0.01em', lineHeight: 1,
          gap: 1,
        }}>
          {'MiniRue'.split('').map((l, i) => (
            <span key={i} className="splash-letter" style={{ display: 'inline-block' }}>{l}</span>
          ))}
          <span className="splash-sparkle" style={{ display: 'inline-flex', marginLeft: 6, marginTop: 6 }}>
            <Sparkle size={32} color="var(--mr-gold-400)" />
          </span>
        </div>

        {/* Caption */}
        <div className="splash-caption" style={{
          fontFamily: 'Jost, sans-serif', fontWeight: 400,
          fontSize: 11, letterSpacing: '0.34em',
          textTransform: 'uppercase',
          color: 'var(--mr-ink-400)',
          marginTop: 14,
        }}>Cosmetics &amp; Perfumes</div>
      </div>
    </div>
  );
}

/* ─── Header ─────────────────────────────────────────────── */
function Header({ onOpenCart, cartCount = 0, transparent = false, onDashboard }) {
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [bump, setBump] = React.useState(false);
  const prevCount = React.useRef(cartCount);
  const { mobile } = window.useBreakpoint();

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => {
    if (cartCount > prevCount.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 450);
      prevCount.current = cartCount;
      return () => clearTimeout(t);
    }
    prevCount.current = cartCount;
  }, [cartCount]);

  const isLight = transparent && !scrolled;

  return (
    <>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: isLight ? 'transparent' : 'rgba(246,242,233,0.93)',
        backdropFilter: isLight ? 'none' : 'blur(18px)',
        WebkitBackdropFilter: isLight ? 'none' : 'blur(18px)',
        borderBottom: isLight ? '1px solid transparent' : '1px solid var(--mr-hairline)',
        color: isLight ? 'var(--mr-cream-100)' : 'var(--mr-ink-900)',
        transition: 'background 360ms var(--mr-ease-out), border-color 360ms var(--mr-ease-out), color 360ms var(--mr-ease-out)',
      }}>
        <div className="mr-header-inner" style={{
          display: 'grid',
          gridTemplateColumns: mobile ? '44px 1fr 44px' : '1fr auto 1fr',
          alignItems: 'center',
          padding: scrolled ? (mobile ? '10px 16px' : '14px 48px') : (mobile ? '16px 16px' : '22px 48px'),
          maxWidth: 1440, margin: '0 auto',
        }}>
          {/* Left: Nav or Hamburger */}
          {mobile ? (
            <IconButton icon="menu" size={40} tone={isLight ? 'glass' : 'cream'}
              label="Menu" onClick={() => setMobileOpen(true)} />
          ) : (
            <nav style={{ display: 'flex', gap: 28, fontFamily: 'Jost, sans-serif', fontSize: 12, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
              {['Perfume', 'Skincare', 'Maison', 'Journal'].map(l => (
                <a key={l} className="mr-nav-link" style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}>{l}</a>
              ))}
            </nav>
          )}

          {/* Center: Wordmark */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Wordmark
              size={mobile ? 18 : 22}
              color={isLight ? 'var(--mr-cream-100)' : 'var(--mr-gold-500)'}
              captionColor={isLight ? 'rgba(253,251,245,0.65)' : 'var(--mr-ink-500)'}
            />
          </div>

          {/* Right: Icons */}
          <div style={{ display: 'flex', gap: mobile ? 6 : 10, justifyContent: 'flex-end', alignItems: 'center' }}>
            {!mobile && <IconButton icon="search" label="Search" tone={isLight ? 'glass' : 'cream'} />}
            {!mobile && (
              <button onClick={onDashboard} style={{
                background: 'none', border: 0, cursor: 'pointer',
                fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: '0.22em',
                textTransform: 'uppercase', color: 'inherit', opacity: 0.55,
                padding: '6px 8px',
                transition: 'opacity 200ms',
              }}
              onMouseEnter={e => e.target.style.opacity = 1}
              onMouseLeave={e => e.target.style.opacity = 0.55}>
                Atelier
              </button>
            )}
            <IconButton icon="bag" label="Bag" tone={isLight ? 'glass' : 'cream'}
              onClick={onOpenCart} badge={cartCount} badgeBump={bump} />
          </div>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {mobile && (
        <>
          <div onClick={() => setMobileOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(11,11,11,0.5)',
            backdropFilter: mobileOpen ? 'blur(4px)' : 'blur(0)',
            opacity: mobileOpen ? 1 : 0, pointerEvents: mobileOpen ? 'auto' : 'none',
            transition: 'opacity 280ms var(--mr-ease-snappy), backdrop-filter 280ms',
            zIndex: 60,
          }} />
          <div style={{
            position: 'fixed', top: 0, left: 0, bottom: 0, width: 280,
            background: 'var(--mr-cream-100)', zIndex: 70,
            transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 340ms var(--mr-ease-out)',
            padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
              <Wordmark size={20} />
              <IconButton icon="close" size={36} tone="cream" label="Close" onClick={() => setMobileOpen(false)} />
            </div>
            {['Perfume', 'Skincare', 'Maison', 'Journal', 'About'].map((l, i) => (
              <button key={l} onClick={() => setMobileOpen(false)} style={{
                background: 'none', border: 0, textAlign: 'left', padding: '14px 0',
                borderBottom: '1px solid var(--mr-hairline)',
                fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: 'var(--mr-ink-900)',
                cursor: 'pointer',
                animation: `mr-fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both`,
                animationDelay: mobileOpen ? `${i * 40 + 80}ms` : '0ms',
              }}>{l}</button>
            ))}
            <button onClick={() => { setMobileOpen(false); onDashboard(); }} style={{
              marginTop: 'auto', background: 'none', border: 0, textAlign: 'left',
              fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: '0.22em',
              textTransform: 'uppercase', color: 'var(--mr-ink-500)', cursor: 'pointer',
              padding: '14px 0',
            }}>Atelier Dashboard →</button>
          </div>
        </>
      )}
    </>
  );
}

/* ─── Hero — auto-advancing carousel ────────────────────── */
function Hero({ onShop }) {
  const { mobile } = window.useBreakpoint();
  const SLIDES = [
    {
      id: 0,
      type: 'photo',
      eyebrow: "New arrivals · S/S '26",
      headline: 'Not just a scent.',
      sub: 'A presence.',
      tagline: 'A presence before you arrive.',
      bg: '#0B0B0B',
    },
    {
      id: 1,
      type: 'editorial',
      eyebrow: 'MiniRue Maison',
      headline: 'Absolue Rose.',
      sub: 'Turkish rose,',
      tagline: 'Opened at dawn. № 01.',
      bg: 'linear-gradient(135deg, #C9A87C 0%, #B09060 40%, #8C6A3A 100%)',
      bottle: 'rose', cap: 'gold', tile: 'amber',
    },
    {
      id: 2,
      type: 'editorial',
      eyebrow: 'MiniRue Maison',
      headline: 'Oud Nocturne.',
      sub: 'Smoked oud,',
      tagline: 'Warm leather. The last hour of the night.',
      bg: 'linear-gradient(135deg, #1A1815 0%, #0B0B0B 60%, #2E2A24 100%)',
      bottle: 'oud', cap: 'gold', tile: 'ink',
    },
    {
      id: 3,
      type: 'editorial',
      eyebrow: 'Tom Ford · Exclusive',
      headline: 'Lost Cherry.',
      sub: 'Bitter almond,',
      tagline: 'Black cherry, tonka. − 20%.',
      bg: 'linear-gradient(135deg, #3B0001 0%, #670003 50%, #1A0000 100%)',
      bottle: 'crimson', cap: 'cream', tile: 'crimson',
    },
  ];

  const DURATION = 6000; // ms per slide
  const [current, setCurrent] = React.useState(0);
  const [prev, setPrev] = React.useState(null);
  const [animating, setAnimating] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const timerRef = React.useRef(null);
  const startRef = React.useRef(null);
  const progressRef = React.useRef(0);

  const goTo = (idx) => {
    if (animating || idx === current) return;
    setPrev(current);
    setCurrent(idx);
    setAnimating(true);
    setProgress(0);
    progressRef.current = 0;
    setTimeout(() => { setPrev(null); setAnimating(false); }, 650);
  };

  const next = React.useCallback(() => {
    goTo((current + 1) % SLIDES.length);
  }, [current, animating]);

  // Progress ticker
  React.useEffect(() => {
    if (paused) return;
    const tick = () => {
      if (paused) return;
      const elapsed = performance.now() - startRef.current;
      const p = Math.min(1, elapsed / DURATION);
      progressRef.current = p;
      setProgress(p);
      if (p >= 1) {
        goTo((current + 1) % SLIDES.length);
      } else {
        timerRef.current = requestAnimationFrame(tick);
      }
    };
    startRef.current = performance.now() - (progressRef.current * DURATION);
    timerRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(timerRef.current);
  }, [current, paused]);

  const slide = SLIDES[current];
  const prevSlide = prev !== null ? SLIDES[prev] : null;
  const isDark = slide.id === 0 || slide.tile === 'ink' || slide.tile === 'crimson';

  return (
    <section
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        position:'relative',
        height: mobile ? '80vh' : 'min(100vh, 980px)',
        minHeight: mobile ? 520 : 680,
        background: '#0B0B0B',
        color:'var(--mr-cream-100)',
        overflow:'hidden',
        marginTop:-82,
      }}>

      {/* ── Previous slide (exits left) ── */}
      {prevSlide && (
        <div key={`prev-${prevSlide.id}`} style={{
          position:'absolute', inset:0, zIndex:1,
          transform: 'translateX(-100%)',
          transition: 'transform 650ms cubic-bezier(0.16,1,0.3,1)',
          willChange:'transform',
        }}>
          <SlideContent slide={prevSlide} mobile={mobile} isActive={false} />
        </div>
      )}

      {/* ── Current slide (enters from right) ── */}
      <div key={`cur-${slide.id}`} style={{
        position:'absolute', inset:0, zIndex:2,
        transform: animating ? 'translateX(0)' : 'translateX(0)',
        animation: animating ? 'hero-slide-in 650ms cubic-bezier(0.16,1,0.3,1) both' : 'none',
        willChange:'transform',
      }}>
        <SlideContent slide={slide} mobile={mobile} isActive={true} onShop={onShop} key={slide.id} />
      </div>

      {/* ── Progress indicators ── */}
      <div style={{
        position:'absolute', bottom: mobile ? 56 : 72, left:0, right:0,
        display:'flex', justifyContent:'center', gap:8, zIndex:10,
        padding:'0 24px',
      }}>
        {SLIDES.map((s, i) => (
          <button key={i} onClick={() => goTo(i)} aria-label={`Go to slide ${i+1}`} style={{
            height:3, flex: mobile ? '1 1 0' : '0 0 80px', maxWidth:100,
            background:'rgba(253,251,245,0.25)', borderRadius:2, border:0,
            cursor:'pointer', overflow:'hidden', padding:0,
            transition:'background 200ms',
          }}>
            <div style={{
              height:'100%', borderRadius:2,
              background:'var(--mr-cream-100)',
              width: i === current ? `${progress * 100}%` : i < current ? '100%' : '0%',
              transition: i === current ? 'none' : 'width 300ms cubic-bezier(0.16,1,0.3,1)',
            }}/>
          </button>
        ))}
      </div>

      {/* Scroll cue */}
      <div style={{
        position:'absolute', bottom:24, left:'50%', transform:'translateX(-50%)',
        display:'flex', flexDirection:'column', alignItems:'center', gap:6, zIndex:10,
        animation:'mr-fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both', animationDelay:'1200ms',
      }}>
        <div style={{ fontFamily:'Jost, sans-serif', fontSize:9, letterSpacing:'0.3em', textTransform:'uppercase', color:'rgba(238,230,209,0.35)' }}>Scroll</div>
        <div style={{ width:1, height:28, background:'linear-gradient(to bottom,rgba(238,230,209,0.4),transparent)', animation:'mr-float 2s var(--mr-ease-ios) infinite' }}/>
      </div>
    </section>
  );
}

/* ── SlideContent — renders a single hero slide ── */
function SlideContent({ slide, mobile, isActive, onShop }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  const textDelay = isActive ? 200 : 0;

  return (
    <div style={{ position:'absolute', inset:0 }}>
      {/* Background */}
      {slide.type === 'photo' ? (
        <img
          src="assets/hero-cinematic-red.png"
          alt="MiniRue campaign"
          className="mr-hero-drift"
          style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'62% 50%', display:'block' }}
        />
      ) : (
        <div style={{ position:'absolute', inset:0, background: slide.bg }}>
          <div className="mr-hero-drift" style={{
            position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent: mobile ? 'center' : 'flex-end',
            paddingRight: mobile ? 0 : '8%', transformOrigin:'50% 55%',
            opacity:0.9,
          }}>
            <div style={{ transform: `scale(${mobile ? 1.8 : 2.6})` }}>
              <BottleSVG bottle={slide.bottle} cap={slide.cap} />
            </div>
          </div>
        </div>
      )}

      {/* Scrims */}
      <div style={{ position:'absolute', inset:'0 0 auto 0', height:240, pointerEvents:'none', background:'linear-gradient(to bottom,rgba(11,11,11,.55),transparent)' }}/>
      <div style={{ position:'absolute', inset:'auto 0 0 0', height:280, pointerEvents:'none', background:'linear-gradient(to bottom,transparent,rgba(11,11,11,.4) 50%,rgba(11,11,11,.65) 100%)' }}/>

      {/* Copy — left-anchored, bottom-aligned */}
      <div style={{
        position:'absolute', left:0, right: mobile ? 0 : '40%', bottom: mobile ? 112 : 130,
        padding: mobile ? '0 24px' : '0 60px',
        zIndex:2,
      }}>
        <div style={{
          fontFamily:'Jost, sans-serif', fontSize:11, letterSpacing:'0.32em', textTransform:'uppercase',
          color:'rgba(238,230,209,0.6)', marginBottom:16,
          opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(8px)',
          transition: `opacity 500ms cubic-bezier(0.16,1,0.3,1) ${textDelay}ms, transform 500ms cubic-bezier(0.16,1,0.3,1) ${textDelay}ms`,
        }}>
          {slide.eyebrow}
        </div>
        <h1 style={{
          fontFamily:'Cormorant Garamond, serif', fontWeight:400,
          fontSize: mobile ? 'clamp(40px,11vw,64px)' : 'clamp(56px,7vw,96px)',
          lineHeight:0.95, letterSpacing:'-0.02em', margin:'0 0 8px',
          color:'var(--mr-cream-100)',
          textShadow:'0 2px 24px rgba(0,0,0,0.35)',
          opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          transition: `opacity 600ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 80}ms, transform 600ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 80}ms`,
        }}>
          {slide.headline}
        </h1>
        <h2 style={{
          fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontWeight:400,
          fontSize: mobile ? 'clamp(28px,8vw,44px)' : 'clamp(36px,4.5vw,60px)',
          lineHeight:0.95, letterSpacing:'-0.015em', margin:'0 0 20px',
          color:'var(--mr-gold-300)',
          textShadow:'0 2px 16px rgba(0,0,0,0.3)',
          opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          transition: `opacity 600ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 160}ms, transform 600ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 160}ms`,
        }}>
          {slide.sub}
        </h2>
        <p style={{
          fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize: mobile ? 15 : 18,
          color:'rgba(246,242,233,0.6)', margin:'0 0 32px', maxWidth:400,
          opacity: mounted ? 1 : 0,
          transition: `opacity 500ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 260}ms`,
        }}>
          {slide.tagline}
        </p>
        {isActive && (
          <div style={{
            display:'flex', gap:12, flexWrap:'wrap',
            opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)',
            transition: `opacity 500ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 360}ms, transform 500ms cubic-bezier(0.16,1,0.3,1) ${textDelay + 360}ms`,
          }}>
            <Button variant="outlineLight" sweep sweepColor="var(--mr-cream-100)" sweepInk="var(--mr-ink-900)" onClick={onShop}>
              Discover the edit
            </Button>
            <Button variant="outlineLight" sweep sweepColor="rgba(253,251,245,.15)" sweepInk="var(--mr-cream-100)" onClick={onShop} style={{ borderColor:'rgba(253,251,245,.4)' }}>
              Read the story
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
/* ─── Footer ─────────────────────────────────────────────── */
function Footer() {
  const { mobile } = window.useBreakpoint();
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current; if (!el) return;
      document.body.style.paddingBottom = el.offsetHeight + 'px';
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); document.body.style.paddingBottom = ''; };
  }, []);

  return (
    <footer ref={ref} data-mr-surface="ink" style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 0,
      background: 'var(--mr-ink-900)', color: 'var(--mr-cream-100)',
      padding: mobile ? '48px 24px 28px' : '72px 48px 44px',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', textAlign: 'center' }}>
        <Wordmark size={mobile ? 26 : 38} color="var(--mr-cream-100)" captionColor="var(--mr-ink-400)" />
        <div style={{ marginTop: 44, maxWidth: 460, margin: '44px auto 0' }}>
          <div style={{
            fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: '0.22em',
            textTransform: 'uppercase', marginBottom: 16, color: 'var(--mr-gold-300)',
          }}>Letters from MiniRue</div>
          <p style={{
            fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic',
            fontSize: 20, lineHeight: 1.4, color: 'var(--mr-cream-200)', margin: '0 0 24px',
          }}>
            Occasional notes — new arrivals, private sales, a thought on scent.
          </p>
          <form className="mr-underline-input" style={{
            display: 'flex', paddingBottom: 8, gap: 12, alignItems: 'center',
            borderBottom: '1px solid rgba(238,230,209,.2)',
          }} onSubmit={e => e.preventDefault()}>
            <input placeholder="you@address.com" style={{
              flex: 1, background: 'transparent', border: 0,
              color: 'var(--mr-cream-100)', fontFamily: 'Inter Tight, sans-serif',
              fontSize: 14, padding: '8px 0', outline: 'none',
            }} />
            <button style={{
              background: 'none', border: 0, color: 'var(--mr-gold-300)',
              cursor: 'pointer', fontFamily: 'Jost, sans-serif', fontSize: 10,
              letterSpacing: '0.22em', textTransform: 'uppercase',
              transition: 'color 200ms var(--mr-ease-out)',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--mr-gold-500)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--mr-gold-300)'}>
              Subscribe <span className="mr-link-arrow">→</span>
            </button>
          </form>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: mobile ? 28 : 44, marginTop: 60, textAlign: 'left' }}>
          {[
            { t: 'The House', l: ['About', 'Ateliers', 'Careers', 'Press'] },
            { t: 'Service',   l: ['Contact', 'Shipping', 'Gift cards', 'Track order'] },
            { t: 'Discover',  l: ['Journal', 'Fragrance guide', 'Find your scent', 'Engraving'] },
            { t: 'Legal',     l: ['Terms', 'Privacy', 'Cookies', 'Imprint'] },
          ].map(c => (
            <div key={c.t}>
              <div style={{
                fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: '0.22em',
                textTransform: 'uppercase', color: 'var(--mr-gold-300)', marginBottom: 16,
              }}>{c.t}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.l.map(x => (
                  <li key={x} className="mr-nav-link" style={{
                    fontFamily: 'Inter Tight, sans-serif', fontSize: 13,
                    color: 'var(--mr-cream-200)', opacity: 0.75, cursor: 'pointer',
                    display: 'inline-block', width: 'fit-content',
                  }}>{x}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 56, paddingTop: 28,
          borderTop: '1px solid rgba(238,230,209,.1)',
          display: 'flex', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 8,
          fontFamily: 'Inter Tight, sans-serif', fontSize: 11,
          color: 'var(--mr-ink-400)',
        }}>
          <span>© MMXXVI MiniRue Maison · Paris · Grasse</span>
          <span>Worldwide shipping · Duty-paid to 62 countries</span>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { SplashScreen, Header, Hero, SlideContent, Footer });

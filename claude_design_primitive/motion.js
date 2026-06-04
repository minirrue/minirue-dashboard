// MiniRue Motion Engine v3
// Spring physics, scroll reveals, word reveals, count-up, personality system.
// No Framer Motion dep — runs on the custom integrator + GSAP for timelines.

(function () {
  /* ─── iOS Spring Presets ─────────────────────────────────── */
  const PRESETS = {
    default:     { stiffness: 300, damping: 30, mass: 1 },
    interactive: { stiffness: 700, damping: 55, mass: 1 },
    navigation:  { stiffness: 350, damping: 35, mass: 1 },
    popover:     { stiffness: 500, damping: 35, mass: 1 },
    sheet:       { stiffness: 400, damping: 40, mass: 1 },
    bouncy:      { stiffness: 200, damping: 12, mass: 1 },
    banner:      { stiffness: 280, damping: 28, mass: 1 },
    luxury:      { stiffness: 180, damping: 28, mass: 1 },
  };

  /* Motion personality → spring map */
  const PERSONALITY_SPRINGS = {
    luxury:    { ...PRESETS.luxury },
    ios:       { ...PRESETS.default },
    energetic: { stiffness: 420, damping: 24, mass: 1 },
  };

  let _personality = 'ios';
  function setPersonality(p) { _personality = p; }
  function getPersonalitySpring(named = 'default') {
    const base = PRESETS[named] || PRESETS.default;
    const override = PERSONALITY_SPRINGS[_personality];
    // Blend: keep base stiffness ratio, scale by personality
    const ratio = override.stiffness / PRESETS.default.stiffness;
    return { stiffness: base.stiffness * ratio, damping: base.damping * (override.damping / PRESETS.default.damping), mass: 1 };
  }

  /* ─── Numerical spring integrator ───────────────────────── */
  function stepSpring(x, v, target, { stiffness, damping, mass }, dt) {
    const Fs = -stiffness * (x - target);
    const Fd = -damping * v;
    const a  = (Fs + Fd) / mass;
    const nv = v + a * dt;
    const nx = x + nv * dt;
    const done = Math.abs(nv) < 0.015 && Math.abs(nx - target) < 0.015;
    return { x: nx, v: nv, done };
  }

  /* ─── useSpringValue ─────────────────────────────────────── */
  function useSpringValue(to, preset = 'default', deps = []) {
    const { useState, useRef, useEffect } = React;
    const config = typeof preset === 'string' ? PRESETS[preset] : preset;
    const [val, setVal] = useState(to);
    const state = useRef({ x: to, v: 0, raf: 0, last: 0 });
    useEffect(() => {
      cancelAnimationFrame(state.current.raf);
      state.current.last = performance.now();
      const tick = now => {
        const dt = Math.min(0.032, (now - state.current.last) / 1000);
        state.current.last = now;
        const r = stepSpring(state.current.x, state.current.v, to, config, dt);
        state.current.x = r.x; state.current.v = r.v;
        setVal(r.x);
        if (!r.done) state.current.raf = requestAnimationFrame(tick);
        else setVal(to);
      };
      state.current.raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(state.current.raf);
      // eslint-disable-next-line
    }, [to, ...deps]);
    return val;
  }

  /* ─── useEnterSpring ─────────────────────────────────────── */
  function useEnterSpring({ preset = 'default', from = { y: 16, opacity: 0, scale: 1 }, delay = 0 } = {}) {
    const { useState, useEffect } = React;
    const [active, setActive] = useState(false);
    useEffect(() => {
      const t = setTimeout(() => setActive(true), delay);
      return () => clearTimeout(t);
    }, [delay]);
    const spring = getPersonalitySpring(preset);
    const y     = useSpringValue(active ? 0 : (from.y ?? 0), spring, [active]);
    const scale = useSpringValue(active ? 1 : (from.scale ?? 1), spring, [active]);
    const opacity = active ? 1 : (from.opacity ?? 0);
    return {
      transform: `translate3d(0,${y}px,0) scale(${scale})`,
      opacity,
      willChange: 'transform, opacity',
      transition: 'opacity 280ms cubic-bezier(0.16,1,0.3,1)',
    };
  }

  /* ─── useStaggerEnter ────────────────────────────────────── */
  function useStaggerEnter(index, { preset = 'default', step = 55, from, baseDelay = 0 } = {}) {
    return useEnterSpring({ preset, from, delay: baseDelay + index * step });
  }

  /* ─── useScrollReveal ────────────────────────────────────── */
  function useScrollReveal({ preset = 'default', from = { y: 24, opacity: 0, scale: 1 }, threshold = 0.18, once = true, delay = 0 } = {}) {
    const { useState, useEffect, useRef } = React;
    const ref = useRef(null);
    const [seen, setSeen] = useState(false);
    useEffect(() => {
      if (!ref.current) return;
      const el = ref.current;
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) { setSeen(true); if (once) io.disconnect(); }
          else if (!once) setSeen(false);
        });
      }, { threshold });
      io.observe(el);
      return () => io.disconnect();
    }, [threshold, once]);
    const spring = getPersonalitySpring(preset);
    const y     = useSpringValue(seen ? 0 : (from.y ?? 0), spring, [seen]);
    const scale = useSpringValue(seen ? 1 : (from.scale ?? 1), spring, [seen]);
    return {
      ref,
      style: {
        transform: `translate3d(0,${y}px,0) scale(${scale})`,
        opacity: seen ? 1 : (from.opacity ?? 0),
        transition: `opacity 340ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        willChange: 'transform, opacity',
      },
    };
  }

  /* ─── useCrossfade ───────────────────────────────────────── */
  function useCrossfade(value) {
    const { useState, useEffect, useRef } = React;
    const [display, setDisplay] = useState(value);
    const [phase, setPhase] = useState('idle');
    const prev = useRef(value);
    useEffect(() => {
      if (prev.current === value) return;
      setPhase('out');
      const t1 = setTimeout(() => { setDisplay(value); setPhase('in'); prev.current = value; }, 140);
      const t2 = setTimeout(() => setPhase('idle'), 420);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [value]);
    return {
      display,
      style: {
        display: 'inline-block',
        transform: phase === 'out' ? 'translateY(-4px)' : 'translateY(0)',
        opacity: phase === 'out' ? 0 : 1,
        transition: 'opacity 160ms cubic-bezier(0.16,1,0.3,1), transform 240ms cubic-bezier(0.25,0.46,0.45,0.94)',
        willChange: 'transform, opacity',
      },
    };
  }

  /* ─── useCountUp — animated number for dashboard metrics ── */
  function useCountUp(target, duration = 1200) {
    const { useState, useEffect, useRef } = React;
    const ref = useRef(null);
    const seen = useRef(false);
    const [count, setCount] = useState(0);
    useEffect(() => {
      if (!ref.current) return;
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !seen.current) {
          seen.current = true;
          const start = performance.now();
          const tick = now => {
            const p = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            setCount(Math.round(target * eased));
            if (p < 1) requestAnimationFrame(tick);
            else setCount(target);
          };
          requestAnimationFrame(tick);
        }
      }, { threshold: 0.4 });
      io.observe(ref.current);
      return () => io.disconnect();
    }, [target, duration]);
    return { ref, count };
  }

  /* ─── useBreakpoint ──────────────────────────────────────── */
  function useBreakpoint() {
    const [w, setW] = React.useState(window.innerWidth);
    React.useEffect(() => {
      const h = () => setW(window.innerWidth);
      window.addEventListener('resize', h);
      return () => window.removeEventListener('resize', h);
    }, []);
    return { mobile: w < 640, tablet: w < 1024, w };
  }

  /* ─── Transition shorthands ─────────────────────────────── */
  const MR_TX = {
    hover: 'transform var(--mp-dur-hover) var(--mp-ease-hover), box-shadow var(--mr-dur-fast) var(--mr-ease-out), background-color var(--mr-dur-fast) var(--mr-ease-snappy), color var(--mr-dur-fast) var(--mr-ease-snappy)',
    press: 'transform var(--mr-dur-instant) var(--mr-ease-snappy)',
  };

  Object.assign(window, {
    MR_SPRING: PRESETS,
    MR_TX,
    setMotionPersonality: setPersonality,
    getPersonalitySpring,
    useSpringValue,
    useEnterSpring,
    useStaggerEnter,
    useScrollReveal,
    useCrossfade,
    useCountUp,
    useBreakpoint,
  });
})();

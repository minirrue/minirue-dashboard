'use client';

import { useEffect, useRef } from 'react';

/* Magnetic cursor — ported from design-builds MiniRue.html initCursor().
   A gold ring that lerp-trails the native cursor and enlarges over
   interactive elements. Additive (native cursor stays visible), desktop-only
   (fine pointer), and disabled under prefers-reduced-motion. */
export default function MagneticCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) {
      el.style.display = 'none';
      return;
    }

    let mx = -100;
    let my = -100;
    let cx = -100;
    let cy = -100;
    let raf = 0;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };

    const tick = () => {
      cx = lerp(cx, mx, 0.12);
      cy = lerp(cy, my, 0.12);
      // center the ring at any size (translate to point, then back by half)
      el.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };

    const isInteractive = (t: EventTarget | null) =>
      t instanceof Element && t.closest('button, a, [role="button"], input, select, textarea');
    const onOver = (e: MouseEvent) => {
      if (isInteractive(e.target)) el.classList.add('enlarged');
    };
    const onOut = (e: MouseEvent) => {
      if (isInteractive(e.target)) el.classList.remove('enlarged');
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
    };
  }, []);

  return <div ref={ref} className="mr-cursor" aria-hidden="true" />;
}

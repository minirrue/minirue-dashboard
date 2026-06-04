'use client'
import { useState, useEffect, useRef } from 'react'

const PRESETS: Record<string, { stiffness: number; damping: number; mass: number }> = {
  default:     { stiffness: 300, damping: 30, mass: 1 },
  interactive: { stiffness: 700, damping: 55, mass: 1 },
  navigation:  { stiffness: 350, damping: 35, mass: 1 },
}

function stepSpring(
  x: number,
  v: number,
  target: number,
  cfg: { stiffness: number; damping: number; mass: number },
  dt: number,
) {
  const Fs = -cfg.stiffness * (x - target)
  const Fd = -cfg.damping * v
  const a  = (Fs + Fd) / cfg.mass
  const nv = v + a * dt
  const nx = x + nv * dt
  return { x: nx, v: nv, done: Math.abs(nv) < 0.015 && Math.abs(nx - target) < 0.015 }
}

function useSpringValue(to: number, preset = 'default') {
  const cfg = PRESETS[preset] || PRESETS.default
  const [val, setVal] = useState(to)
  const state = useRef({ x: to, v: 0, raf: 0, last: 0 })
  useEffect(() => {
    cancelAnimationFrame(state.current.raf)
    state.current.last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - state.current.last) / 1000)
      state.current.last = now
      const r = stepSpring(state.current.x, state.current.v, to, cfg, dt)
      state.current.x = r.x
      state.current.v = r.v
      setVal(r.x)
      if (!r.done) {
        state.current.raf = requestAnimationFrame(tick)
      } else {
        setVal(to)
      }
    }
    state.current.raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(state.current.raf)
  }, [to, cfg])
  return val
}

export function useEnterSpring({
  preset = 'default',
  from = { y: 16, opacity: 0, scale: 1 },
  delay = 0,
}: {
  preset?: string
  from?: { y?: number; opacity?: number; scale?: number }
  delay?: number
} = {}) {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setActive(true), delay)
    return () => clearTimeout(t)
  }, [delay])
  const y     = useSpringValue(active ? 0 : (from.y ?? 0), preset)
  const scale = useSpringValue(active ? 1 : (from.scale ?? 1), preset)
  return {
    transform: `translate3d(0,${y}px,0) scale(${scale})`,
    opacity: active ? 1 : (from.opacity ?? 0),
    willChange: 'transform, opacity' as const,
    transition: 'opacity 280ms cubic-bezier(0.16,1,0.3,1)',
  }
}

export function useStaggerEnter(
  index: number,
  opts: {
    preset?: string
    step?: number
    from?: { y?: number; opacity?: number; scale?: number }
    baseDelay?: number
  } = {},
) {
  const { preset = 'default', step = 55, from, baseDelay = 0 } = opts
  return useEnterSpring({ preset, from, delay: baseDelay + index * step })
}

export function useBreakpoint() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const handler = () => setW(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return { w, mobile: w < 640, tablet: w < 1024 }
}

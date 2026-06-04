'use client'

export function Sparkle({ size = 14, color = 'var(--mr-gold-500)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill={color} aria-hidden="true">
      <path d="M16 0 C16 7,17 12,22 14 C17 16,16 21,16 32 C16 21,15 16,10 14 C15 12,16 7,16 0 Z" />
    </svg>
  )
}

export function BottleSVG({
  bottle = 'amber',
  cap = 'ink',
}: {
  bottle?: string
  cap?: string
}) {
  const fills: Record<string, string> = {
    amber: '#B0924F', rose: '#E4D7B4', ink: '#1A1815',
    cream: '#DCD3BB', crimson: '#3B0001', oud: '#2E2A24',
  }
  const capColors: Record<string, string> = {
    ink: '#1A1815', gold: '#95783C', cream: '#EEE6D1',
  }
  const bottleFill = fills[bottle] ?? fills.amber
  const capFill = capColors[cap] ?? capColors.ink
  return (
    <svg viewBox="0 0 80 140" style={{ height: '75%', maxWidth: '60%' }} fill="none">
      <rect x="20" y="40" width="40" height="90" fill={bottleFill} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/>
      <rect x="28" y="20" width="24" height="22" fill={capFill}/>
      <rect x="30" y="14" width="20" height="8" fill={capFill} opacity="0.8"/>
      <rect x="26" y="70" width="28" height="30" fill="rgba(255,255,255,0.08)"/>
      <text x="40" y="92" textAnchor="middle" fill="rgba(255,255,255,0.45)"
        fontFamily="Cormorant Garamond, serif" fontSize="6" letterSpacing="1">MINI RUE</text>
    </svg>
  )
}

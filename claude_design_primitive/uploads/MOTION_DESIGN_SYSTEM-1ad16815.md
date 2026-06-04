# 🎬 MOTION DESIGN SYSTEM — Claude Design Context Prompt

> Paste this entire document into Claude Design as context before asking for animated components.
> It acts as your animation token system — the same way color tokens keep colors consistent, this keeps motion consistent.

---

## WHAT THIS IS

This is a **motion design system**. It defines:
- Named animation tokens (duration, easing, scale)
- Per-component animation rules (buttons, cards, modals, nav, etc.)
- Brand personality → motion style mapping
- Apple/iOS-inspired motion philosophy
- Copy-paste patterns in Framer Motion, GSAP, and CSS

**Core rule**: Never pick random durations or easing. Always use a named token from this system.

---

## SECTION 1 — MOTION PHILOSOPHY

### The Apple/iOS Principle
Apple's animations feel premium because they follow **three laws**:
1. **Physics, not timing** — things move like they have weight. Spring physics over linear.
2. **Context awareness** — elements animate *from where they came from*, not from screen center.
3. **Nothing locks the user** — all animations are interruptible. Never block interaction.

### The Addictiveness Formula
What makes animations feel addictive (Stripe, Linear, Vercel, iOS):
- **Fast starts** — animations begin immediately, decelerate to rest. Never slow starts.
- **Subtle overshoot** — a tiny bounce (spring) on enter feels alive. Static ease-out feels dead.
- **Coordinated stagger** — groups of elements enter in sequence with 40-60ms gaps.
- **Micro-feedback on everything** — buttons, toggles, icons respond to every interaction.
- **Continuity** — elements animate *to* their origin. Dropdown slides from button. Modal scales from trigger.

---

## SECTION 2 — ANIMATION TOKENS

These are your design tokens for motion. Reference by name in every component.

### ⏱ Duration Tokens

```
--duration-instant:   80ms    /* Button press, toggle snap */
--duration-quick:    150ms    /* Icon swap, tooltip, badge */
--duration-fast:     200ms    /* Button hover, chip, tag */
--duration-normal:   250ms    /* Dropdown, popover, small modal */
--duration-medium:   300ms    /* Modal entrance, page transition, drawer */
--duration-slow:     500ms    /* Hero reveal, onboarding, celebration */
--duration-crawl:    800ms    /* Background parallax, ambient motion */
```

### 〜 Easing Tokens (Cubic-Bezier)

```
/* SPRING-LIKE — energetic, has slight overshoot. For entrances & micro-interactions */
--ease-spring:       cubic-bezier(0.34, 1.56, 0.64, 1)

/* SMOOTH OUT — professional deceleration, no bounce. For modals, panels, large elements */
--ease-out-smooth:   cubic-bezier(0.16, 1, 0.3, 1)

/* SNAPPY — fast in and out. For toggles, quick state changes */
--ease-snappy:       cubic-bezier(0.4, 0, 0.2, 1)

/* EASE IN — for exits only. Things leaving screen accelerate away */
--ease-in-exit:      cubic-bezier(0.4, 0, 1, 1)

/* APPLE SPRING — iOS feel. Slightly more tension than ease-spring */
--ease-ios:          cubic-bezier(0.25, 0.46, 0.45, 0.94)

/* LINEAR — only for continuous loops (spinners, progress bars) */
--ease-linear:       linear
```

### 📐 Scale Tokens

```
--scale-press:       0.96     /* Button active/tap */
--scale-hover-sm:    1.02     /* Subtle card lift */
--scale-hover-md:    1.05     /* Icon, badge hover */
--scale-entrance:    0.94     /* Initial state before animating in */
--scale-exit:        0.96     /* Final state when animating out */
```

### 📏 Translate Tokens

```
--translate-up-sm:   6px      /* Tooltip, badge subtle rise */
--translate-up-md:   12px     /* Card hover lift */
--translate-up-lg:   20px     /* Section entrance from below */
--translate-up-xl:   40px     /* Hero text entrance */
--translate-down-sheet: 100%  /* Bottom sheet slide in */
--translate-right-drawer: 100% /* Side drawer */
```

---

## SECTION 3 — PER-COMPONENT ANIMATION RULES

### 🔘 BUTTON

```
State         | Property         | Value                    | Token
------------- | ---------------- | ------------------------ | -------------------
Idle          | (none)           | —                        | —
Hover         | scale            | 1.02                     | --scale-hover-sm
              | transition       | 200ms ease-spring        | --duration-fast + --ease-spring
Active/Press  | scale            | 0.96                     | --scale-press
              | transition       | 80ms ease-snappy         | --duration-instant + --ease-snappy
Release       | scale            | 1.0 → slight bounce      | spring return
Focus         | box-shadow ring  | animate in 150ms         | --duration-quick
```

**Framer Motion:**
```jsx
<motion.button
  whileHover={{ scale: 1.02, transition: { duration: 0.2, ease: [0.34, 1.56, 0.64, 1] } }}
  whileTap={{ scale: 0.96, transition: { duration: 0.08, ease: [0.4, 0, 0.2, 1] } }}
>
  Click me
</motion.button>
```

**CSS:**
```css
.btn {
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.btn:hover { transform: scale(1.02); }
.btn:active {
  transform: scale(0.96);
  transition-duration: 80ms;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

### 🃏 CARD

```
State         | Property              | Value              | Token
------------- | --------------------- | ------------------ | --------------------
Entrance      | opacity 0→1           | 300ms ease-out     | --duration-medium
              | translateY 20px→0     | --ease-out-smooth  |
Hover         | translateY -4px       | 200ms ease-spring  | --duration-fast
              | box-shadow increase   | same transition    |
Press         | translateY -1px       | 80ms ease-snappy   | --duration-instant
Click-through | scale 0.98            | 100ms              | exit feedback
```

**Framer Motion:**
```jsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
  whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
    transition: { duration: 0.2, ease: [0.34, 1.56, 0.64, 1] } }}
  whileTap={{ scale: 0.98 }}
/>
```

---

### 🪟 MODAL / DIALOG

```
Enter         | opacity 0→1, scale 0.94→1   | 300ms ease-out-smooth
Exit          | opacity 1→0, scale 1→0.96   | 200ms ease-in-exit
Backdrop      | opacity 0→0.5               | 250ms ease-snappy (separate)
Origin rule   | transform-origin from trigger button (use layoutId in Framer)
```

**Framer Motion:**
```jsx
<AnimatePresence>
  {open && (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    />
  )}
</AnimatePresence>
```

---

### 📋 DROPDOWN / POPOVER

```
Enter         | opacity 0→1, scaleY 0→1     | 200ms ease-out-smooth
              | transform-origin: top        | (or bottom if flipped)
Exit          | opacity 1→0, scaleY 1→0.95  | 150ms ease-in-exit
Items stagger | each child +30ms delay       |
Origin rule   | always originates from trigger, not screen center
```

**CSS:**
```css
.dropdown {
  transform-origin: top center;
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1),
              opacity 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
.dropdown[data-state="closed"] {
  transform: scaleY(0.95);
  opacity: 0;
}
.dropdown[data-state="open"] {
  transform: scaleY(1);
  opacity: 1;
}
```

---

### 📱 BOTTOM SHEET (iOS-style)

```
Enter         | translateY 100%→0           | 350ms ease-out-smooth
Exit          | translateY 0→100%           | 280ms ease-in-exit
Handle drag   | spring physics              | use useSpring / GSAP draggable
Snap points   | spring to nearest snap      | stiffness: 400, damping: 40
```

---

### 🔔 TOAST / NOTIFICATION

```
Enter         | translateY -20px→0, opacity 0→1  | 300ms ease-spring
Exit          | translateY 0→-10px, opacity 1→0  | 200ms ease-in-exit
Stack shift   | other toasts shift with layout animation
```

**Framer Motion:**
```jsx
<motion.div
  initial={{ opacity: 0, y: -20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -10 }}
  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
/>
```

---

### 📝 FORM INPUTS

```
Focus ring    | scale 0.98→1, opacity 0→1  | 150ms ease-spring  (ring border)
Error shake   | translateX oscillate ±4px  | 400ms total, 4 cycles
Success check | scale 0→1 with spring      | 300ms ease-spring
Label float   | translateY 0→-20px         | 200ms ease-out-smooth (floating label)
```

---

### 🗂 TABS / PILLS

```
Active indicator | layoutId shared          | Framer Motion layoutId
                 | spring transition        | stiffness: 500, damping: 35
Content switch   | opacity crossfade        | 150ms ease-snappy
```

**Framer Motion (the magic approach):**
```jsx
{/* Active tab indicator uses layoutId — Framer handles the sliding automatically */}
{activeTab === tab.id && (
  <motion.div layoutId="tab-indicator" className="active-indicator"
    transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
)}
```

---

### 🧭 NAVIGATION / MENU

```
Page transition  | old: exit left/right, new: enter right/left | 300ms ease-out-smooth
Mobile nav open  | translateX -100%→0                          | 320ms ease-out-smooth
Items stagger    | staggerChildren: 0.04s                      |
Hamburger → X    | rotate + scale morphing of bars             | 300ms ease-spring
```

---

### 📊 DATA / NUMBERS (count-up)

```
Number change  | count from old to new    | 600ms ease-out-smooth
Bar growth     | scaleX 0→1               | 500ms ease-out-smooth, staggered
Chart entrance | paths draw in            | 800ms ease-out-smooth
```

**GSAP count-up:**
```js
gsap.to(counter, {
  innerText: targetValue,
  duration: 0.6,
  ease: 'power2.out',
  snap: { innerText: 1 },
  onUpdate: () => counter.innerText = Math.round(counter.innerText)
})
```

---

### 🖼 IMAGE / MEDIA

```
Load entrance  | opacity 0→1, scale 0.98→1  | 400ms ease-out-smooth
Skeleton pulse | opacity 0.5↔1 loop         | 1200ms ease-in-out, infinite
Zoom hover     | scale 1→1.04               | 400ms ease-out-smooth (inside overflow:hidden)
```

---

## SECTION 4 — PAGE-LEVEL ANIMATION STRATEGY

### Hero Section Sequence (staggered reveal)
```
1. Background / gradient:  fade in 0ms, 600ms ease-out
2. Eyebrow label:          fade + translateY(8px→0) at 100ms delay
3. H1 headline:            fade + translateY(12px→0) at 200ms delay
4. Subheading:             fade + translateY(8px→0) at 320ms delay
5. CTA buttons:            fade + translateY(8px→0) at 440ms delay, stagger 60ms between
6. Hero image/mockup:      fade + scale(0.96→1) at 300ms delay, 500ms duration
```

### Scroll-Triggered Sections (GSAP ScrollTrigger)
```js
gsap.from('.section-content', {
  opacity: 0,
  y: 40,
  duration: 0.6,
  ease: 'power3.out',
  scrollTrigger: {
    trigger: '.section',
    start: 'top 80%',
    toggleActions: 'play none none reverse'
  }
})
```

### Page Transitions (Next.js / React Router)
```
Enter: new page slides in from right (translateX 40px→0 + opacity 0→1)
Exit:  old page fades out (opacity 1→0, no translate — avoids chaos)
Duration: 300ms, ease-out-smooth
```

---

## SECTION 5 — BRAND PERSONALITY → MOTION MAPPING

Choose your brand's motion personality and apply the corresponding tokens:

### 🏔 PREMIUM / LUXURY (Apple, Linear, Stripe)
```
- Durations: 250-400ms (never rushed)
- Easing: --ease-out-smooth almost exclusively
- Springs: minimal, only very subtle
- Scale: never above 1.03 on hover
- Stagger: very tight (30-40ms)
- Rule: restraint = confidence
```

### ⚡ ENERGETIC / STARTUP (Vercel, Raycast, Arc)
```
- Durations: 150-280ms (snappy)
- Easing: --ease-spring on most interactions
- Springs: medium bounce (stiffness 400, damping 25)
- Scale: up to 1.05 on hover
- Stagger: 40-60ms
- Rule: speed signals intelligence
```

### 🎮 PLAYFUL / CONSUMER (Duolingo, Notion, Figma)
```
- Durations: 200-400ms
- Easing: --ease-spring with higher overshoot
- Springs: pronounced bounce (stiffness 300, damping 15)
- Scale: 1.05-1.08 on hover
- Stagger: 50-80ms
- Rule: delight over efficiency
```

### 🏥 TRUSTED / ENTERPRISE (Salesforce, Atlassian)
```
- Durations: 200-300ms (predictable)
- Easing: --ease-snappy
- Springs: none or very subtle
- Scale: 1.01-1.02 max
- Rule: zero surprise, full clarity
```

---

## SECTION 6 — QUICK REFERENCE DECISION MATRIX

```
WHAT ARE YOU ANIMATING?                → WHICH EASING?
────────────────────────────────────────────────────────
Button hover / micro-interaction       → --ease-spring
Button press / tap                     → --ease-snappy
Modal, panel, drawer entrance          → --ease-out-smooth
Any element EXIT                       → --ease-in-exit
Tab indicator (layoutId)               → spring (stiffness 500, damping 35)
iOS bottom sheet                       → spring (stiffness 400, damping 40)
Page transition (large)                → --ease-out-smooth
Number/data animation                  → --ease-out-smooth (power2.out in GSAP)
Continuous loop (spinner, pulse)       → --ease-linear
Hero content stagger                   → --ease-out-smooth with delays
Celebration / success state            → --ease-spring with overshoot
```

```
HOW BIG IS THE ELEMENT?               → HOW LONG?
────────────────────────────────────────────────────────
Tiny (icon, badge, dot)               → 80-150ms
Small (button, tag, chip)             → 150-200ms
Medium (dropdown, tooltip, card)      → 200-250ms
Large (modal, drawer, panel)          → 250-350ms
Full page / hero                      → 300-600ms (staggered)
```

---

## SECTION 7 — ACCESSIBILITY (NON-NEGOTIABLE)

Always add this. Every animation must respect reduced motion:

**CSS:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Framer Motion:**
```jsx
import { useReducedMotion } from 'framer-motion'

function AnimatedBox() {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.01 : 0.3 }}
    />
  )
}
```

---

## SECTION 8 — PERFORMANCE RULES

1. **Only animate `transform` and `opacity`** — these are GPU-composited, never cause layout reflow
2. **Never animate**: `width`, `height`, `top`, `left`, `margin`, `padding` (causes jank)
3. **Use `will-change: transform`** only on elements about to animate — remove after
4. **60fps minimum** — test on mid-range Android, not just your MacBook
5. **Interruptible always** — user should never wait for an animation to finish

---

## SECTION 9 — HOW TO USE THIS WITH CLAUDE DESIGN

### Ask Claude like this:

**For a specific component:**
> "Using the motion design system context above, build a pricing card with entrance animation and hover state. Use the ENERGETIC brand personality tokens. Framer Motion, React, Tailwind."

**For a full page:**
> "Build a SaaS landing hero section with the staggered reveal sequence from the motion system. PREMIUM brand personality. Apply the scroll-triggered section pattern to the features below."

**For consistency check:**
> "Review this component — does it follow the motion design system tokens? The button uses 400ms but the system says 200ms for hover. Fix it to be consistent."

**For a design system file:**
> "Generate a `motion.ts` constants file from the token table in the motion design system."

---

## SECTION 10 — READY-TO-USE TOKEN FILES

### `motion.ts` (TypeScript — Framer Motion)
```typescript
export const duration = {
  instant: 0.08,
  quick: 0.15,
  fast: 0.2,
  normal: 0.25,
  medium: 0.3,
  slow: 0.5,
  crawl: 0.8,
} as const

export const ease = {
  spring: [0.34, 1.56, 0.64, 1],
  outSmooth: [0.16, 1, 0.3, 1],
  snappy: [0.4, 0, 0.2, 1],
  inExit: [0.4, 0, 1, 1],
  ios: [0.25, 0.46, 0.45, 0.94],
} as const

export const spring = {
  bouncy: { type: 'spring', stiffness: 400, damping: 20 },
  tabs: { type: 'spring', stiffness: 500, damping: 35 },
  sheet: { type: 'spring', stiffness: 400, damping: 40 },
  gentle: { type: 'spring', stiffness: 200, damping: 30 },
} as const

export const variants = {
  fadeUp: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: duration.medium, ease: ease.outSmooth } },
    exit: { opacity: 0, y: -10, transition: { duration: duration.fast, ease: ease.inExit } },
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.94 },
    visible: { opacity: 1, scale: 1, transition: { duration: duration.medium, ease: ease.outSmooth } },
    exit: { opacity: 0, scale: 0.96, transition: { duration: duration.fast, ease: ease.inExit } },
  },
  stagger: {
    hidden: {},
    visible: { transition: { staggerChildren: 0.05 } },
  },
} as const
```

### `motion-tokens.css` (CSS Custom Properties)
```css
:root {
  /* Durations */
  --dur-instant: 80ms;
  --dur-quick: 150ms;
  --dur-fast: 200ms;
  --dur-normal: 250ms;
  --dur-medium: 300ms;
  --dur-slow: 500ms;

  /* Easings */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-snappy: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in-exit: cubic-bezier(0.4, 0, 1, 1);

  /* Scale */
  --scale-press: 0.96;
  --scale-hover: 1.02;
  --scale-entrance: 0.94;
}

/* Accessibility override */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

*Sources: Emil Kowalski (emilkowal.ski), uxderrick/ANIMATION-RESOURCES (GitHub Gist), Apple HIG Motion, production animation patterns from Linear, Stripe, Vercel.*

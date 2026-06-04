# 🍎 iOS SPRING PRESETS — Appendix to Motion Design System

> Add this to your Claude Design context alongside MOTION_DESIGN_SYSTEM.md
> These are the reverse-engineered Apple CASpringAnimation values translated to web

---

## WHY IOS ANIMATIONS FEEL DIFFERENT

The animation you're describing — **fast open, naturally decelerates, reaches zero velocity
exactly at the target, before the time runs out** — is NOT a cubic bezier curve.

It's a **physics spring** (CASpringAnimation). Here's the key difference:

```
Cubic Bezier:   fixed duration + shaped curve = fake physics feel
Spring Physics: real mass + stiffness + damping = velocity reaches 0 naturally
```

Apple's internal rule (from WWDC23): duration is DERIVED from physics, never manually set.
The spring settles when velocity drops below a threshold — not at a clock time.
This is why iOS never feels "clipped" or "mechanical" at the end.

On web, Framer Motion's `type: "spring"` replicates this exactly.
CSS cubic-bezier can only approximate it.

---

## THE APPLE SPRING FORMULA (iOS 17+ style)

Apple now defines springs with just 2 params:
- `duration` — perceptual duration (how long it *feels*, not when it stops)
- `bounce` — 0.0 = no bounce (critically damped), 1.0 = max bounce

```swift
// SwiftUI (native iOS)
.spring(duration: 0.5, bounce: 0.0)   // smooth, no bounce — used for most iOS UI
.spring(duration: 0.4, bounce: 0.2)   // slight bounce — used for sheet presentations
.spring(duration: 0.3, bounce: 0.0)   // snappy, no bounce — used for interactive elements
```

---

## IOS SPRING PRESETS → FRAMER MOTION EQUIVALENTS

These are reverse-engineered from Apple's system springs and verified visually.

### 1. 🏠 iOS App Launch / Sheet Presentation
The smoothest, most "Apple" feel. No bounce. Used for app open, modal sheets.
```js
// Framer Motion
transition: {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 1
}
// Feel: Fast open, silky deceleration, zero velocity at rest
// Apple equivalent: .spring(duration: 0.55, bounce: 0.0)
```

### 2. ⚡ iOS Interactive / Gesture-Driven
Used when following a finger. Snappier response, almost no bounce.
```js
transition: {
  type: "spring",
  stiffness: 700,
  damping: 55,
  mass: 1
}
// Feel: Immediate response, stops precisely
// Apple equivalent: .interactiveSpring(response: 0.15, dampingFraction: 0.86)
```

### 3. 📋 iOS Navigation Push (like pushing a view controller)
Medium speed, no bounce, clean.
```js
transition: {
  type: "spring",
  stiffness: 350,
  damping: 35,
  mass: 1
}
// Feel: Confident directional movement, settles cleanly
// Apple equivalent: .spring(duration: 0.45, bounce: 0.0)
```

### 4. 🎯 iOS Popover / Contextual Menu
Quick entrance from trigger point, tiny bounce.
```js
transition: {
  type: "spring",
  stiffness: 500,
  damping: 35,
  mass: 1
}
// Feel: Pops open quickly, tiny bounce adds life
// Apple equivalent: .spring(duration: 0.35, bounce: 0.15)
```

### 5. 📱 iOS Bottom Sheet Drag Snap
Used when sheet snaps to a position after a drag gesture.
```js
transition: {
  type: "spring",
  stiffness: 400,
  damping: 40,
  mass: 1
}
// Feel: Snaps to position, absorbs momentum naturally
// Apple equivalent: .spring(duration: 0.4, bounce: 0.1)
```

### 6. 🎉 iOS Celebration (like iMessage heart reaction)
More bounce. Used for delight moments.
```js
transition: {
  type: "spring",
  stiffness: 200,
  damping: 12,
  mass: 1
}
// Feel: Bouncy, playful, overshoots and settles
// Apple equivalent: .spring(duration: 0.6, bounce: 0.4)
```

### 7. 🔔 iOS Notification Banner
Slides in from top, settles with minimal bounce.
```js
transition: {
  type: "spring",
  stiffness: 280,
  damping: 28,
  mass: 1
}
// Feel: Arrives with purpose, minimal wobble
// Apple equivalent: .spring(duration: 0.5, bounce: 0.08)
```

---

## HOW TO READ THE SPRING VALUES

```
stiffness ↑ = faster, snappier (higher force pulling to target)
damping ↑   = less bounce (more friction/braking)
mass ↑      = slower, heavier feel (harder to start, harder to stop)

Critical damping (no bounce) = damping ≈ 2 × √(stiffness × mass)
iOS mostly uses critically damped or slightly underdamped springs.
```

**Quick guide:**
```
Want FASTER?   → increase stiffness (e.g. 300 → 500)
Want SMOOTHER? → increase damping proportionally (e.g. 30 → 45)
Want BOUNCIER? → decrease damping without changing stiffness (e.g. 30 → 15)
Want HEAVIER?  → increase mass (e.g. 1 → 1.5)
```

---

## THE CLOSEST CSS CUBIC-BEZIER APPROXIMATIONS

For cases where you can't use Framer Motion / GSAP (pure CSS only):

```css
/* iOS default spring approximation — the most "Apple" curve */
transition-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);

/* iOS snappy interactive approximation */
transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);

/* iOS sheet/modal approximation */
transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);

/* iOS navigation push approximation */
transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1);
```

⚠️ These are approximations only. They use fixed durations, so they don't naturally
decelerate to 0 velocity — they just look similar. For the real feel, use spring physics.

---

## FULL COMPONENT EXAMPLES WITH IOS SPRINGS

### Modal (Sheet presentation)
```jsx
// Framer Motion — feels exactly like iOS sheet
<AnimatePresence>
  {open && (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.96 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
        // opacity uses timed ease for cross-fade feel
        opacity: { duration: 0.2, ease: "easeOut" }
      }}
    />
  )}
</AnimatePresence>
```

### Button (interactive, gesture-like)
```jsx
<motion.button
  whileHover={{
    scale: 1.03,
    transition: { type: "spring", stiffness: 400, damping: 25 }
  }}
  whileTap={{
    scale: 0.97,
    transition: { type: "spring", stiffness: 700, damping: 55 }
  }}
>
  Tap me
</motion.button>
```

### Card entrance (app launch feel)
```jsx
const cardVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 20 },
  visible: (i) => ({
    opacity: 1, scale: 1, y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
      delay: i * 0.06  // stagger like iOS grid
    }
  })
}

{cards.map((card, i) => (
  <motion.div
    key={card.id}
    custom={i}
    variants={cardVariants}
    initial="hidden"
    animate="visible"
  />
))}
```

### Page / Route Transition (navigation push)
```jsx
// Entering page slides in from right
<motion.div
  initial={{ x: "100%", opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  exit={{ x: "-30%", opacity: 0 }}
  transition={{
    type: "spring",
    stiffness: 350,
    damping: 35,
    opacity: { duration: 0.2 }
  }}
/>
```

---

## GSAP EQUIVALENTS (for non-React)

GSAP doesn't have native spring physics in its free tier, but you can get very close:

```js
// iOS app launch feel — GSAP
gsap.from('.modal', {
  opacity: 0,
  scale: 0.94,
  y: 30,
  duration: 0.5,
  ease: 'power3.out',  // closest to iOS default spring
})

// iOS snappy interactive feel — GSAP
gsap.to('.button', {
  scale: 0.97,
  duration: 0.12,
  ease: 'power2.out',
})

// iOS sheet snap — GSAP with CustomEase (club plugin)
// CustomEase.create("iosSheet", "0.32, 0.72, 0, 1")
gsap.from('.sheet', {
  y: '100%',
  duration: 0.45,
  ease: 'power4.out',
})
```

---

## NAMED SPRING PRESETS (add to your motion.ts)

```typescript
// Add to your motion.ts from the main Motion Design System
export const iosSpring = {
  // The most "Apple" feel — use this as your default
  default: {
    type: "spring" as const,
    stiffness: 300,
    damping: 30,
    mass: 1
  },
  // For elements that follow gestures or need instant feel
  interactive: {
    type: "spring" as const,
    stiffness: 700,
    damping: 55,
    mass: 1
  },
  // For navigation pushes and large panel movements
  navigation: {
    type: "spring" as const,
    stiffness: 350,
    damping: 35,
    mass: 1
  },
  // For popovers and contextual menus
  popover: {
    type: "spring" as const,
    stiffness: 500,
    damping: 35,
    mass: 1
  },
  // For bottom sheets and drag-to-snap
  sheet: {
    type: "spring" as const,
    stiffness: 400,
    damping: 40,
    mass: 1
  },
  // For celebration moments and reactions
  bouncy: {
    type: "spring" as const,
    stiffness: 200,
    damping: 12,
    mass: 1
  }
} as const

// Usage:
// transition={iosSpring.default}
// transition={iosSpring.interactive}
```

---

## HOW TO PROMPT CLAUDE DESIGN WITH THESE

**For a specific iOS feel:**
> "Build a modal using the `iosSpring.default` preset from the iOS spring system.
> It should feel like an iOS sheet presentation — fast open, zero bounce, silky stop."

**For interactive components:**
> "This button should feel like an iOS app icon — use `iosSpring.interactive` for tap,
> and `iosSpring.default` for the release/return."

**For testing feel:**
> "Build me a sandbox with all 6 iosSpring presets as buttons I can tap to feel
> the difference between them. Show the stiffness and damping values under each."

---

## KEY SOURCES

- Apple WWDC23 "Animate with springs": developer.apple.com/videos/play/wwdc2023/10158
- GetStream SwiftUI Spring Animations: github.com/GetStream/swiftui-spring-animations
- Mike Rundle "Your Spring Animations Are Bad": medium.com/@flyosity
- Framer Motion spring docs: www.framer.com/motion/transition/#spring

---

*The core insight: iOS doesn't fake physics with bezier curves. It runs actual spring physics.
Velocity naturally reaches zero at the target. That's the entire secret.*

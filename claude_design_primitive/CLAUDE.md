# MiniRue Design System — Persistent Context for Claude

## Brand
Luxury perfume & cosmetics e-commerce. Cream paper, antique gold, deep ink, editorial crimson.
Fonts: Cormorant Garamond (display/serif) · Jost (labels/caps) · Inter Tight (UI/body)

## File Structure
- `MiniRue.html` — main app entry (React + Babel, GSAP)
- `motion.js` — spring physics engine (useEnterSpring, useScrollReveal, useBreakpoint, useCountUp)
- `mr-tokens.css` — all CSS custom properties (colors, type, spacing, shadows, motion)
- `Primitives.jsx` — Button, IconButton, Badge, Icon, Wordmark, WordReveal, Marquee, BottleSVG
- `StorefrontChrome.jsx` — SplashScreen, Header, Hero, Footer
- `StorefrontContent.jsx` — ProductCard, ProductGrid, EditorialBlock, ProductDetail, CartDrawer, HomeView
- `Dashboard.jsx` — DashboardApp, DashSidebar, DashTopBar, DashOverview, DashCatalog, DashOrderDetail, DashChatView
- `ChatWidget.jsx` — ChatButton, ChatPanel (storefront), DashChatView (dashboard)

## Color Tokens
```
--mr-gold-500: #95783C   (brand gold / logo)
--mr-gold-400: #B0924F   (accents / hairlines)
--mr-gold-300: #C9B483   (soft gold)
--mr-cream-100: #FDFBF5  (lightest cream / paper)
--mr-cream-200: #F6F2E9  (brand background)
--mr-cream-300: #EDE7D6  (card edge / divider)
--mr-ink-900: #0B0B0B    (near black / editorial)
--mr-ink-700: #2E2A24    (body on cream)
--mr-ink-500: #5C564C    (secondary text)
--mr-crimson-700: #670003 (editorial crimson / hero)
--mr-crimson-500: #8E1418 (sale / alert)
--mr-dash-bg: #F4F2EC     (dashboard page)
--mr-dash-surface: #FFFFFF (dashboard cards)
--mr-dash-hair: #E6E2D8   (dashboard hairlines)
```

## Motion Design System (ALWAYS USE THESE — NEVER INVENT NEW VALUES)

### Duration Tokens
```
--mr-dur-instant: 80ms    // button press, snap
--mr-dur-quick:  150ms    // icon swap, tooltip
--mr-dur-fast:   200ms    // button hover, chip
--mr-dur-normal: 250ms    // dropdown, popover
--mr-dur-medium: 300ms    // modal, drawer entrance
--mr-dur-slow:   500ms    // hero reveal, onboarding
--mr-dur-crawl:  800ms    // background parallax
```

### Easing Tokens (Cubic-Bezier)
```
--mr-ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1)   // energetic, slight overshoot — buttons, micro
--mr-ease-out:      cubic-bezier(0.16, 1, 0.3, 1)        // smooth decel — modals, panels, large elements
--mr-ease-snappy:   cubic-bezier(0.4, 0, 0.2, 1)         // fast in/out — toggles, state changes
--mr-ease-in-exit:  cubic-bezier(0.4, 0, 1, 1)           // exits only — elements leaving screen
--mr-ease-ios:      cubic-bezier(0.25, 0.46, 0.45, 0.94) // Apple iOS feel — ambient, continuous
```

### Scale Tokens
```
--mr-scale-press: 0.96   // button active/tap
--mr-scale-hover: 1.02   // subtle card lift
```

### iOS Spring Presets (Framer-style, used in motion.js)
```js
MR_SPRING.default:     { stiffness: 300, damping: 30, mass: 1 }  // sheet / modal — most "Apple"
MR_SPRING.interactive: { stiffness: 700, damping: 55, mass: 1 }  // gesture / tap — instant feel
MR_SPRING.navigation:  { stiffness: 350, damping: 35, mass: 1 }  // push / navigate
MR_SPRING.popover:     { stiffness: 500, damping: 35, mass: 1 }  // dropdown, menu
MR_SPRING.sheet:       { stiffness: 400, damping: 40, mass: 1 }  // bottom sheet, snap
MR_SPRING.bouncy:      { stiffness: 200, damping: 12, mass: 1 }  // celebration, delight
MR_SPRING.banner:      { stiffness: 280, damping: 28, mass: 1 }  // toast, notification
MR_SPRING.luxury:      { stiffness: 180, damping: 28, mass: 1 }  // slow, restrained
```

### Motion Decision Matrix
```
WHAT                             → EASING              DURATION
Button hover                     → ease-spring          200ms (fast)
Button press/tap                 → ease-snappy          80ms  (instant)
Modal / drawer / panel ENTER     → ease-out             300ms (medium)
Modal / drawer / panel EXIT      → ease-in-exit         200ms (fast)
Tab indicator (sliding pill)     → spring stiff:500 d:35
iOS sheet presentation           → spring stiff:300 d:30
Page / hero entrance             → ease-out             300-600ms staggered
Number / data animation          → ease-out             600ms
Continuous loop (spinner)        → linear               ∞
Scroll-reveal section            → spring default       on-enter
Celebration / success            → spring bouncy
```

### Per-Component Rules

**Button:**
- hover: scale(1.02) 200ms ease-spring
- press: scale(0.96) 80ms ease-snappy
- release: spring return to 1.0

**Card:**
- entrance: opacity 0→1 + y 20→0, 300ms ease-out
- hover: translateY(-6px) 200ms ease-spring, shadow increase
- press: scale(0.98) 80ms ease-snappy

**Drawer / Cart / Notifications:**
- enter: translateX(100%→0) 380ms ease-out, backdrop blur
- exit: translateX(0→100%) 300ms ease-in-exit
- backdrop: opacity 0→0.44 250ms ease-snappy

**Splash (wordmark reveal):**
- letters: staggered y:32→0, 600ms power3.out, 45ms between
- caption: letterSpacing 0.7em→0.34em, 900ms power3.out
- sparkle: scale(0)→scale(1) rotate(-45→0), 500ms back.out(2.2)

**Word Reveal (hero text):**
- per word: opacity 0→1, blur(8px→0), translateY(18→0)
- 0.65s ease-out, stagger 80-100ms between words

**ScrollReveal (sections):**
- useScrollReveal({ from: { y: 24, opacity: 0 } })
- threshold: 0.18, once: true

### Brand Personality — PREMIUM/LUXURY + iOS
- Durations: 250-400ms (never rushed)
- Easing: ease-out-smooth almost exclusively for large elements
- Springs: iOS spring on interactive bits only (buttons, cards)
- Scale: never above 1.03 on hover
- Stagger: 45-60ms between children
- Rule: restraint = confidence

## CSS Transform Warning
**NEVER animate `width`, `height`, `top`, `left`, `margin`, `padding`.**
Only animate `transform` and `opacity` — GPU composited, no layout reflow.

**NEVER use CSS `transform` on a parent of `position:fixed` children.**
Even identity `transform: translateY(0)` creates a containing block that breaks fixed positioning.
Animate with `opacity` only on wrapper elements that contain fixed children.

## React / Babel Notes
- All components export via `Object.assign(window, { ... })` at file bottom
- Each .jsx file is a separate `<script type="text/babel" src="...">` — they share `window` but NOT scope
- Global style objects MUST have unique names (not `const styles = {}`)
- Never use `type="module"` on script imports

## Responsive Breakpoints (useBreakpoint hook)
```js
const { mobile, tablet, w } = window.useBreakpoint();
// mobile: w < 640
// tablet: w < 1024
// w: current viewport width (reactive)
```

## Fixed Layout Rules
- Footer: `position:fixed; bottom:0; z-index:0` — page sheet (z-index:1) covers it until scrolled past
- CartDrawer: `position:fixed; right:16; top:16; bottom:16` — slides in from right
- NotificationDrawer: same pattern as CartDrawer but on right, narrower (380px)
- ChatPanel: `position:fixed; bottom:88; right:24` — springs up from bottom-right
- Tweaks panel: `position:fixed; bottom:24; left:24; z-index:1000`
- ChatButton: `position:fixed; bottom:24; right:24; z-index:200`

## Dashboard Tokens
```
--mr-dash-bg:      #F4F2EC   (page background)
--mr-dash-surface: #FFFFFF   (cards)
--mr-dash-sub:     #F9F7F2   (table zebra / sub-headers)
--mr-dash-hair:    #E6E2D8   (hairlines)
Status pairs: ok(#E5F1E6/#2C5A38) warn(#FBEFCF/#7A5212) danger(#FADDDE/#8E1418) info(#E3EAF2/#2E466B)
```

## Accessibility
Always include:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

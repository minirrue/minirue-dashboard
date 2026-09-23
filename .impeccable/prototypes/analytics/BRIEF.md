# Analytics redesign: shared prototype brief (dashboard#128, Phase 1)

Three standalone HTML prototypes of the MiniRue **Analytics** area, plus one comparison page. They are design explorations only: no backend wiring and no changes to production code. All three **keep the MiniRue brand world**; what differs between them is structure, organisation, density and interaction. They are judged side by side on: clarity, scan speed, action discoverability, mobile usability, accessibility, data density, export discoverability, and visual quality.

Read `F:\Projects\ebneely\ebneely_minirue\minirue-dashboard\PRODUCT.md` first. It holds the product truth.

## Files

Folder: `F:\Projects\ebneely\ebneely_minirue\minirue-dashboard\.impeccable\prototypes\analytics\`
- `a-clarity.html`: Clarity-first
- `b-guided.html`: Guided workflow
- `c-calm.html`: Calm premium
- `index.html`: comparison page (built by the lead)

## Technical contract (every prototype)

- **One self-contained HTML file.** Inline `<style>` and `<script>`, vanilla JS, no framework and no build step. Do NOT write `<!doctype>`, `<html>`, `<head>` or `<body>` tags: the file is wrapped at publish time. Start the file with `<title>` and then `<style>`. Everything else goes straight into the body.
- **External resources:** only Google Fonts stylesheets (`https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Jost:wght@400;500;600&display=swap`, plus Cormorant Garamond for prototype C only), and optionally scripts from `https://cdn.jsdelivr.net/npm/` or `https://cdnjs.cloudflare.com` pinned to an exact version. No other hosts, and no images from the web.
- **Icons:** inline SVG in the Lucide style (24 viewBox, stroke 1.75, round caps). Hand-author the few you need, or define them once as `<symbol>`s in an SVG sprite. **No emoji and no unicode glyphs as icons.**
- **Single light theme, on purpose.** The MiniRue dashboard is light-only. Paint `body` with an explicit background token and give every colour from tokens.
- **Responsive:** must work at 1440, 1280, 1024, 768 and 390px wide. Keep a ≥16px side gutter. The body never scrolls horizontally. Wide tables sit in their own `overflow-x:auto` wrapper, with sticky first column and sticky headers.
- **Downloads are blocked and `alert/confirm/prompt` do nothing** in the viewer. The export flow simulates generation and ends in an in-page "ready" state that says it is a prototype. Never call `window.print()`.
- **Accessibility:**
  - real `<button>`, `<a>` and `<table>` elements, with `aria-current` and `aria-expanded`
  - visible `:focus-visible` rings in gold (`--mr-gold-400`, 2px, offset 2px)
  - drawers and sheets trap focus and close on Esc
  - `role="status"` for count changes
  - state is never shown by colour alone (use an icon or text as well)
  - contrast ≥4.5:1 for body text
- **Reduced motion:** wrap all motion in `@media (prefers-reduced-motion: no-preference)` or honour `matchMedia`. With reduced motion, every state appears instantly.
- **Theme the browser surfaces:** `::selection` gold-100, `accent-color` ink, thin warm scrollbars, and `font-variant-numeric: tabular-nums` on every number.
- **The page opens at rest in a realistic working state** (Overview, live data). Nothing is parked at opacity 0.
- A small, unobtrusive **"Prototype" control** (bottom-left pill, collapsible) switches the demo state for the current section: `Live · Loading · Empty range · Error · Filtered`. Reviewers use it to see every state, so it must not look like product UI. Keep it visually distinct (dashed outline, "Prototype" label).

## Brand tokens (from `styles/mr-tokens.css`; use these values)

```
--mr-ink-900:#0B0B0B  --mr-ink-800:#1A1815  --mr-ink-700:#2E2A24  --mr-ink-500:#5C564C  --mr-ink-400:#8A8376  --mr-ink-300:#B5AE9F
--mr-gold-900:#6B5526 --mr-gold-700:#846432 --mr-gold-500:#95783C --mr-gold-400:#B0924F --mr-gold-300:#C9B483 --mr-gold-200:#E4D7B4 --mr-gold-100:#EEE6D1
--mr-cream-100:#FDFBF5 --mr-cream-200:#F6F2E9 --mr-cream-300:#EDE7D6 --mr-cream-400:#DCD3BB
--mr-dash-bg:#F4F2EC  --mr-dash-surface:#FFFFFF  --mr-dash-sub:#F9F7F2  --mr-dash-hair:#E6E2D8  --mr-dash-table-row-hover:#F0EDE4
status pairs (bg/fg): ok #E5F1E6/#2C5A38 · warn #FBEFCF/#7A5212 · danger #FADDDE/#8E1418 · muted #ECE8DE/#5A5244 · info #E3EAF2/#2E466B
chart series (fixed order, never reorder): #A8791F gold · #008B77 teal · #5B45BC indigo · #B03A3E crimson · #0A6E9E petrol · #C2622C orange
sequential ramp (max 5): #C9B483 #B0924F #95783C #846432 #6B5526
radius: 4 / 8 / 14 / 22 · spacing 4px grid · shadows soft with offset (no hard offset shadows)
ease-out: cubic-bezier(0.16,1,0.3,1) · durations 150–250ms for UI state
```

- **Primary buttons are ink (#0B0B0B) on cream text. Gold is for emphasis, focus and the current selection only, never as the main button colour.**
- Fonts: Inter for the whole UI and all data; Jost (500, slight tracking) for small labels and section names; Cormorant Garamond only in C, and only for page titles.

## Required surfaces (all three prototypes)

1. **The analytics shell:**
   - a slim dashboard sidebar stub (MiniRue wordmark and main-nav items: Orders, Products, Customers, Accounting, **Analytics** active, Storefront). It collapses on mobile.
   - analytics section navigation for **Overview · People · Journeys · Sources · Flow · Data quality**
2. **One global analytics toolbar**, the same on every section:
   - date range (preset menu: Today, 7d, 30d, This month, Custom; the default shows **23 Aug – 21 Sep 2026**)
   - filters for Source/channel, Campaign, Device, Location
   - the **"This is us" exclusion status** as a compact indicator ("Excluding you + staff + bots"), which opens the Analytics settings
   - Refresh, with a "Updated 2 min ago" freshness note
   - **Export**
   - Active filters appear as removable chips with a one-click "Clear all". Section-level controls exist only when they apply to that section alone.
3. **Overview:** headline answers (unique visitors, product viewers, bag, checkout, purchases, revenue EGP 0) and the funnel with the biggest drop highlighted. Include a small daily trend of unique visitors, top sources and top products, and a data-quality line (freshness, exclusions, bot share, reconciliation state).
4. **Flow:** a decision-oriented funnel/flow table.
   - Path: source → landing → product → bag → checkout → purchase.
   - Each row shows unique visitors **and** conversion %, with event counts shown separately (use a toggle "People / Events" or a secondary column).
   - Sortable columns, a sticky header, search, and drill-down to journeys (open a visitor drawer).
   - Highlight drop-off points; flag impossible or missing transitions (e.g. "checkout without bag: 0", "3 events with no session").
5. **Sources / attribution:**
   - normalized source → campaign → landing rows, with the raw values inspectable (a row expands or a "Raw" toggle shows `utm_campaign=__CAMPAIGN_NAME__`, the click-ID present, etc.)
   - "Unknown / untagged" labelled separately
6. **Data quality:**
   - the canonical visitor definition, and the reconciliation of Overview vs People vs Journeys
   - exclusion breakdown with reasons
   - QA checks: duplicate events, missing IDs, impossible sequences, order totals
   - purchase ↔ order reconciliation
7. **People and Journeys** can be lighter: a searchable, sortable people table (friendly visitor numbers like `Visitor #1187`), and one journey rendered as a flow (entry → steps → exit, with times).
8. **Metric definitions** are discoverable: a tooltip or popover on every headline number (unique visitors, sessions, events, product views, bag, checkout, purchases).
9. **Dashboard-level Export flow** (one entry point):
   - Choose **Current section / Selected sections (checkbox list) / Entire dashboard**, and a format (CSV, JSON).
   - A preview line shows what is included: date range, active filters, exclusion mode, section names, and the generation timestamp.
   - A separately named advanced option: "Raw events (event-level)".
   - Then a progress state, then a "Ready" state.
10. **Analytics settings ("This is us")**, as a sheet:
    - a single exclusion mode radio: current device, signed-in staff, test users, IP/device rules, no exclusion
    - what is excluded and from which date, and whether history is re-evaluated
    - an audit trail list
    - a "Count this device again" action inside the sheet only
11. **States:** loading (skeletons shaped like the content, not spinners in the middle), empty range (teaches what to do), error (names the problem and offers Retry), filtered, and no search results. The Prototype control reaches all of them.

## Animate UI patterns to implement (vanilla recreations of animate-ui.com primitives)

Use only where they clarify state. Name the pattern in a code comment next to it, e.g. `/* Animate UI: Tabs + Highlight */`.
- **Tabs + Highlight:** the active section indicator glides between tabs (a transform on one indicator element).
- **Sliding Number / Counting Number:** headline numbers roll to their new value when filters or the range change (digits slide vertically ~220ms).
- **Sheet:** the Export and Settings panels slide in from the right on desktop and become bottom sheets on mobile. Backdrop fade.
- **Popover / Dropdown Menu:** the date preset and filter menus scale and fade from their trigger origin (origin-aware, 150ms).
- **Tooltip:** metric definitions, with a 120ms delay and fade and slide.
- **Auto Height:** expanding rows and disclosures animate height smoothly (via grid-template-rows 0fr→1fr).
- **Toggle Group:** People/Events and similar toggles have a sliding highlight.
- **Progress:** export generation.
- **Shimmer:** skeleton loading.
Do not use decorative backgrounds, bubbles, stars, gradients, particles, liquid buttons or looping ambient motion.

## UX rules (Impeccable craft floor + ui-ux-pro-max, merged)

- Accessibility and touch come first: ≥44px touch targets on mobile, ≥8px between targets, and no hover-only information (tooltips also open on focus and tap).
- Funnels: 3–8 stages; show conversion % between each stage; **highlight the biggest drop**; keep stage names and values as text, not only as bar lengths.
- Time trend: a line or area chart, a faint grid, an emphasized endpoint, and a tooltip on hover or focus. With fewer than 4 points, use a number instead.
- Categories are sorted descending by value. Use a table when there are more than 15.
- Number formatting everywhere: thousands separators, `EGP 1,139`, compact `1.2K` only when space is tight (full value in a tooltip). Numbers never overflow their container.
- Tables:
  - semantic `<table>`, sortable headers with `aria-sort`, sticky header, search with a **"No results"** state that suggests a fix
  - horizontal scroll on its own wrapper on mobile, or a stacked card layout at ≤480px
- Chips wrap (`flex-wrap`); labels do not wrap mid-chip.
- Skeletons match the loaded layout (no layout jump). Mark count updates with `role="status"`.
- Toasts: auto-dismiss after 3–5s, and they confirm actions ("Export ready", "Filters cleared").
- **Refuse:**
  - kicker or eyebrow labels above headings (banned)
  - gradient text
  - glass or blur decoration
  - coloured `border-left` stripes on cards or alerts
  - hard offset shadows
  - same-size icon+heading+text card grids as the page structure
  - nested cards
  - the generic "big number, small label, delta pill" hero template stamped four times
  - emoji icons
  - `01/02/03` section numbers
  - sparklines as decoration
  - modals where a sheet or inline disclosure works
- Copy is plain and from the owner's side: "Where visitors came from", not "Acquisition dimension". Controls name their action.

## Sample data (use exactly; it is the real 23 Aug – 21 Sep 2026 export from #128. Items marked *sample* are illustrative splits)

Label the page footer or the Prototype pill: "Sample based on the 23 Aug – 21 Sep 2026 export".

**Canonical funnel (unique visitors, bots/owner/staff/test excluded):**
| Stage | People | From previous |
|---|---|---|
| Visited | 195 | n/a |
| Viewed a product | 111 | 56.9% |
| Added to bag | 2 | 1.8% ← biggest drop (109 viewed but never added) |
| Reached checkout | 1 | 50% |
| Purchased | 0 | 0% |
Revenue EGP 0. Orders 0.

**Journey outcomes (195):** 109 viewed a product but never added · 79 bounced · 5 browsed without a product · 1 left in bag · 1 left in checkout.

**Sources (unique visitors → bag → checkout → purchase):**
| Channel | Visitors | Bag | Checkout | Purchase |
|---|---|---|---|---|
| Paid ads | 94 | 1 | 0 | 0 |
| Social | 61 | 0 | 0 | 0 |
| Direct | 37 | 1 | 1 | 0 |
| Referral / other | 3 | 0 | 0 | 0 |

**Paid split (*sample*):**
- TikTok · "Minirueshop" (id 1876609874144674): 58
- TikTok · untagged campaign (`utm_campaign=__CAMPAIGN_NAME__`): 21. Show it as "TikTok · campaign name missing" with the raw value inspectable.
- Meta · campaign 120250555651910697 (no friendly name yet): 15. Show it as "Meta · unnamed campaign" with the ID inspectable.

**Social split (*sample*):** Instagram 34 · Facebook 22 · TikTok (organic) 5.

**Landing pages (*sample*, unique visitors):**
- /shop/skincare: 71
- Home (/): 64
- Arencia Retinal Booster Shot: 32
- Arencia Vitamin C Booster Shot: 14
- The Vita A Retinal Shot Tightening Booster: 9
- Other / unknown path: 5

**Product interest (unique product viewers, *sample* split of 111):**
| Product | Viewers | Added to bag |
|---|---|---|
| Arencia Retinal Booster Shot | 46 | 1 |
| Arencia Vitamin C Booster Shot | 38 | 1 |
| The Vita A Retinal Shot Tightening Booster | 27 | 0 |

**Open carts (real):**
- Visitor #1187 · Paid, TikTok "Minirueshop" · Arencia Retinal Booster Shot · EGP 1,139 · left in bag · 18 Sep 2026 · no contact captured
- Visitor #1203 · Direct · Arencia Vitamin C Booster Shot · EGP 1,139 · left at checkout (delivery step) · 20 Sep 2026 · no contact captured

**Daily unique visitors 23 Aug → 21 Sep (30 values, *sample*, sums to 195):**
`4,5,3,6,7,5,4,6,8,7,5,6,9,11,8,6,5,7,6,4,5,8,10,9,7,6,5,4,8,6`

**Data quality (*sample* where noted):**
- Raw events in range: 1,380. Excluded as bots: 1,087 (78.8%). Owner/staff/test: 64 events *sample*.
- Exclusion mode: "This device + signed-in staff", since 12 Sep 2026; history re-evaluated on the next rollup.
- Visitor totals before the fix *(sample)*: Overview 212 vs People 195 vs Journeys 195. The canonical definition (a person = cookie visitor ID; fingerprints are not merged across days) makes all three show **195**.
- Attribution gaps: 21 visitors with `__CAMPAIGN_NAME__` · 15 Meta visitors with a numeric campaign ID only · 5 landings on unknown paths.
- QA checks *(sample)*:
  - duplicate events 3 (deduplicated)
  - events missing event ID 0
  - impossible sequences 2 (`page_leave` logged before its `page_view`; reordered)
  - checkout without bag 0
  - order total mismatches 0
- Purchase ↔ order reconciliation: 0 orders · 0 tracked purchases · 0 attributed → reconciled (nothing to mismatch in this range).
- Freshness: updated 2 min ago.

**People (*sample* rows; use ~10):**
- Visitor #1187: paid TikTok · Cairo · mobile · 3 sessions · bag EGP 1,139
- Visitor #1203: direct · Giza · desktop · 2 sessions · checkout
- Other rows are product viewers and bouncers from Instagram, Facebook, TikTok organic and direct, across Cairo, Giza, Alexandria and Mansoura, with mobile dominant.

**One journey to render (Visitor #1187, *sample* times):**
- Session 3, 18 Sep:
  - 21:04 lands on /shop/skincare from a TikTok ad "Minirueshop"
  - 21:05 views Arencia Retinal Booster Shot (1m 40s)
  - 21:07 adds to bag EGP 1,139
  - 21:07 opens the bag
  - 21:08 leaves
- Earlier sessions: 16 Sep (Instagram, 2 product views) and 17 Sep (direct, home only).

**Guidance lines, for the guided prototype especially** (true to the data, with no invented wins):
- "Hold ad spend: 94 paid visitors, 0 purchases. Measure first."
- "The product page is the leak: 111 viewed a product, 2 added to bag. Start with Arencia Retinal (46 viewed, 1 added): check price, delivery, trust, and mobile Add-to-bag visibility."
- "Name the TikTok campaign sending `__CAMPAIGN_NAME__`: 21 visitors can't be credited."
- "Both open carts (EGP 2,278 total) have no contact: ask for phone earlier in checkout."
- "Optimise ads to Add-to-bag as a diagnostic only, not to Purchase, until purchases reconcile to orders."

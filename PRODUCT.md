# Product

<!-- impeccable:product-schema 1 -->

> Written 2026-09-23 by `/impeccable init`. The interview round went unanswered, so facts marked *(inferred)* come from the repository and issues dashboard#90 / #128 and still need the owner's confirmation.

## Platform

web

## Users

- **Primary:** the MiniRue owner, running the shop and its paid ads. They open the dashboard on a laptop for deep review and on a phone for quick checks during the day *(inferred)*.
- **Secondary:** whoever buys the media (Meta, TikTok), who needs campaign, UTM, and ROAS truth before moving budget (dashboard#90, #128).

## Product Purpose

The MiniRue admin dashboard runs an Egyptian online skincare shop (minirueshop.com): products, orders, customers, accounting, storefront, and analytics. The Analytics area has one job: answer **"where did visitors come from, where did they drop, and what should I do next?"** with numbers the owner can trust enough to spend money on (dashboard#128).

## Positioning

The analytics are first-party and connected to real orders. Every number can drill down to one visitor, their journey, and their orders, and purchases are reconciled against backend order IDs rather than trusted from pixels alone. A generic ad dashboard cannot truthfully claim that.

## Operating Context

- Paid traffic from TikTok and Meta, with social, direct, and referral traffic alongside it. Prices are in EGP, and the traffic is mostly Cairo and Giza.
- The owner reviews a date range, checks where traffic came from and where it dropped, and then decides on ads, product pages, or cart recovery.
- Exports are taken for offline and AI analysis, and must match exactly what is on screen (dashboard#128).

## Capabilities and Constraints

- The stack is Next.js 16, React 19, and Tailwind v4. shadcn is mapped onto MiniRue tokens (`styles/shadcn-theme.css`), and hand-written `.dash-*` CSS still drives the other screens.
- Analytics screens today: Overview, Realtime, Visitors (with Flow, Acquisition, and Checkout merged in), Pages, Products, Events, Sales, Who counts (flags), and DevOps.
- Terminology from #128 is binding. There is one canonical **unique visitor** metric across Overview, People, Journeys, Sources, and Flow, and "event counts" and "visitor counts" must never be mixed silently.
- Owner, staff, test, and bot traffic is excluded from commercial metrics, and the exclusion reason stays auditable. The "This is us" control lives in one settings place.
- Motion follows Animate UI patterns (animate-ui.com), must be purposeful, and must respect reduced-motion.
- Undecided: whether shadcn replaces the `.dash-*` CSS system across the whole dashboard (dashboard#102).

## Brand Commitments

- MiniRue identity: ink near-black (`#0B0B0B`), gold accent (`#B0924F` family), and warm neutral grounds. Tokens live in `styles/mr-tokens.css`.
- Gold is reserved for emphasis and focus and is never the primary button colour. Primary actions are ink.
- UI face is Inter, label face is Jost, and serif is Cormorant Garamond (brand).
- The chart palette in `mr-tokens.css` is colour-blind validated, and its slot order must not change.

## Evidence on Hand

- Real export from 2026-08-23 to 2026-09-21 (dashboard#128): 195 real visitor journeys, of which 94 paid, 61 social, 37 direct, and 3 referral or other. 109 viewed a product without adding it to the bag, 79 bounced, 1 left in checkout, 1 left in the bag, and 5 browsed without viewing a product. There were 0 purchases, and 2 open carts at EGP 1,139 each (one from paid TikTok, one direct), neither with contact details.
- Product interest is concentrated on Arencia Retinal Booster Shot, Arencia Vitamin C Booster Shot, and The Vita A Retinal Shot Tightening Booster.
- The TikTok campaign `Minirueshop` (id 1876609874144674) is split with `__CAMPAIGN_NAME__`, and Meta campaigns appear as raw numeric IDs.
- About 78.8% of raw events are classified as bot traffic (dashboard#90).
- Absent: no confirmed purchases in the window. Do not invent ROAS, revenue, or conversion wins.

## Product Principles

1. **Truth before polish.** A number is shown only with its definition and its exclusion state.
2. **One visitor, everywhere.** Every figure drills down to the same people.
3. **Answer, then detail.** Headline answers come first, and raw events are available on demand.
4. **Decisions, not decoration.** Every screen should point to what to do next.
5. **What you see is what you export.**

## Accessibility & Inclusion

Keyboard navigation, visible focus, WCAG AA contrast, no status conveyed by colour alone, and support for reduced motion (dashboard#128).

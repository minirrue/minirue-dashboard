# CLAUDE.md — minirue-dashboard (admin/collaborator dashboard)

## Stack
- Next.js 16.2.4 App Router
- React 19.2.4
- TypeScript 5
- Tailwind CSS v4 (CSS-first config, `@tailwindcss/postcss`)
- GSAP 3.15.0 + Lenis (smooth scroll)
- `@tanstack/react-query` 5.45 (data fetching/caching)
- Zod 4 (validation)
- Jest + Testing Library (unit), Playwright (`test:e2e`)

## ADDING A PAGE? Add its rewrite too — or it 404s in production

Pages live under `app/dashboard/…` but are served at clean URLs with the `/dashboard` prefix
stripped. That mapping is a **hand-maintained list** in `next.config.ts` `rewrites()` — there is
no wildcard. A page with no entry builds fine, appears in `next build` output, and returns
**404 on the live site**.

So every new page is two edits, not one:

1. `app/dashboard/products/global-variants/page.tsx` — the page.
2. `next.config.ts` — `{ source: "/products/global-variants", destination: "/dashboard/products/global-variants" }`.

Internal `<Link href>` values use the clean URL (`/products/brands`), never the `app/` path.
The `redirects()` block above `rewrites()` sends `/dashboard/:path*` → `/:path*` permanently, so
linking to the `app/` path causes a redirect hop, not a working link.

This was missed once already (Global variants, 2026-07-22) — the page shipped and 404'd.

## Deploy target
Admin/collaborator dashboard — internal-facing, not indexed by search engines. See
`package.json`/`Dockerfile` for build/deploy specifics (container-based deploy: `Dockerfile`,
`.dockerignore` present at repo root).

**There is no deploy workflow in this repo.** `.github/workflows/` has only `ci.yml` and
`story-sync.yml`. Pushing to `main` runs checks and stops — it does NOT deploy. Only
`minirue-backend` has a `deploy.yml` (a Dokploy webhook). Anything shipped here reaches the
live dashboard by some other route; do not assume a push went live.

## Directory conventions
| Path | Contents |
|---|---|
| `app/dashboard/` | Routes, layouts, pages (App Router) — products, orders, customers, inventory, fulfillment, loyalty, refunds, settings, analytics, collab/collaborators |
| `styles/mr-tokens.css` | Design + motion tokens (source of truth) |
| `components/dashboard/` | Dashboard-specific components (StatusBadge, DashboardRoleWelcome, etc.) |
| `components/` | Shared primitives (`primitives.tsx`, `ClientOnly.tsx`) |
| `lib/api/` | Backend API clients (orders, fulfillment, refunds, analytics, loyalty, customers, auth, payments) |
| `lib/hooks/` | React Query hooks (`use-catalog`, `use-orders`, `use-cart`, `use-client-query`) |
| `lib/auth/` | Token/session/role handling |

## Shipping citation
Every shipped change must cite `minirue-dashboard@{version} ({short-hash})` in the commit
message. Bump `package.json` version at minor/patch grain — patch for a single fix, minor for a
feature batch, once per batch, not per commit.

## Non-technical changelog (Settings → Info tab)
Every shipped fix/feature ALSO adds one entry to `lib/changelog.ts` (`CHANGELOG` array, newest
first) — this powers the "Info" tab under Settings, which is how non-technical admin users see
and self-verify what changed, without reading commit messages or code. Write each `summary` for
a store owner, never dev-speak (e.g. "Fixed product photos showing up broken" not "resolved
gallery URL resolution in serializeProduct"). This is a durable convention, not optional — do
not skip it even for small fixes.

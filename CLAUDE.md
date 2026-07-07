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

## Deploy target
Admin/collaborator dashboard — internal-facing, not indexed by search engines. See
`package.json`/`Dockerfile` for build/deploy specifics (container-based deploy: `Dockerfile`,
`.dockerignore` present at repo root).

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

## Shipping citation (RULEBOOK §28)
Every shipped change must cite `minirue-dashboard@{version} ({short-hash})` in the commit
message — see `apps/minirue-obsidian/_main/_templates/RULEBOOK.md` §28. Bump `package.json`
version at minor/patch grain per §28's rule (patch for a single fix, minor for a feature batch,
once per batch — not per commit).

import { Role, isRole, type Role as RoleType } from './role';

/** Roles that belong in the admin dashboard at all. */
const STAFF_ROLES: RoleType[] = [Role.SUPERADMIN, Role.ADMIN, Role.STAFF];
/** Roles that belong in the brand-partner portal. */
const COLLAB_ROLES: RoleType[] = [Role.COLLAB];

const ADMIN_ONLY: readonly RoleType[] = [Role.SUPERADMIN, Role.ADMIN];
/**
 * The Operations jobs STAFF (the support-desk role) actually does: orders
 * (including manual orders), customers (read + tier adjust), loyalty
 * (accounts + adjust), fulfillment, refunds and payments, support, and
 * gallery/media — plus their own notifications and their /overview landing.
 * minirue-dashboard#74 (owner, 2026-09-15) widened this from the 2026-07-30
 * Support+Orders-only list to the full Operations group, mirroring the
 * backend STAFF allow-list (minirue-backend#182,
 * test/auth/staff-rbac-matrix.spec.ts). Settings, Info, Analytics, SEO,
 * Accounting, Catalogue, Discounts, Bundles, Inventory, Collaborators,
 * Storefront and Accounts stay ADMIN_ONLY / SUPERADMIN-only — do not widen
 * this list further without a fresh owner ask.
 */
const ADMIN_AND_SUPPORT: readonly RoleType[] = [
  Role.SUPERADMIN,
  Role.ADMIN,
  Role.STAFF,
];

/**
 * Allowed roles per dashboard route — mirrors backend `@Roles` on controllers.
 *
 * SUPERADMIN is listed explicitly everywhere rather than relied on implicitly,
 * so this file reads as the whole answer. `canAccessDashboardRoute` grants it
 * regardless, matching the backend RolesGuard.
 */
export const DASHBOARD_ROUTE_ACCESS: Record<string, readonly RoleType[]> = {
  // STAFF included since #74: their landing page. OverviewClient itself
  // renders a different view for STAFF (notifications + their own support
  // conversations) than the admin metrics view — the Overview nav item stays
  // admin-only in the sidebar (see DashboardSidebar's `adminOnly` flag), so
  // this is a reachable landing, not a visible tab.
  '/overview': ADMIN_AND_SUPPORT,
  // The whole catalogue lives under one parent now (2026-07-24): the map at
  // /catalogue and the sub-tabs /catalogue/products, /catalogue/categories,
  // /catalogue/brands, /catalogue/global-variants. One key covers them all by
  // prefix, so the sidebar's single "Catalogue" item highlights everywhere in
  // it. Old /products and /categories URLs redirect here (see next.config).
  '/catalogue': ADMIN_ONLY,
  '/orders': ADMIN_AND_SUPPORT,
  '/customers': ADMIN_AND_SUPPORT,
  '/fulfillment': ADMIN_AND_SUPPORT,
  '/refunds': ADMIN_AND_SUPPORT,
  // Codes and the sitewide markdown. ADMIN_ONLY, deliberately: discounts and
  // bundles admin stay awaiting the owner (#74) — STAFF still issues
  // compensation from inside a support conversation, which the backend
  // allows them under a spending cap, and still sees what a customer has
  // been given, on that customer's own page. Neither needs this tab.
  '/discounts': ADMIN_ONLY,
  // Parked 2026-07-23: inventory is under active repair and is not trustworthy
  // for day-to-day admin use. SUPERADMIN keeps it so it can be worked on.
  // Restore ADMIN_ONLY when it comes back.
  '/inventory': [Role.SUPERADMIN],
  // Accounting (epic minirue-backend#155): costs, floors, margins and the
  // pricing slider. Mirrors @Roles(ADMIN) on /v1/accounting.
  '/accounting': ADMIN_ONLY,
  '/analytics': ADMIN_ONLY,
  // SEO audit of the live shop (minirue-dashboard#69). Mirrors @Roles(ADMIN)
  // on /v1/seo/audit (minirue-backend#171).
  '/seo': ADMIN_ONLY,
  // Customer support inbox — staff/admin/superadmin handle it; collaborators
  // get their own inbox at /collab/support instead. One of the two things
  // STAFF is scoped down to (2026-07-30).
  '/support': ADMIN_AND_SUPPORT,
  '/reviews': ADMIN_ONLY,
  // Reactivated for STAFF (#74): loyalty accounts + adjust are on the backend
  // STAFF allow-list, and Loyalty moved out of Insights into Operations.
  '/loyalty': ADMIN_AND_SUPPORT,
  '/settings': ADMIN_ONLY,
  // Was STAFF_ROLES — narrowed to ADMIN_ONLY 2026-07-30 per owner ask ("hide
  // from him info also").
  '/info': ADMIN_ONLY,
  // Notifications stay reachable for STAFF: their bell/feed is scoped to just
  // Order/Payment/Support categories server-side (AdminNotificationsService,
  // restrictCategories), so opening this page never shows them something they
  // cannot act on.
  '/notifications': ADMIN_AND_SUPPORT,
  '/storefront-appearance': ADMIN_ONLY,
  '/collaborators': ADMIN_ONLY,
  // Partner oversight — watch brand partners. Admin + super admin.
  '/partners': ADMIN_ONLY,
  // Managing accounts — creating them, changing roles, deleting them, and
  // signing in as one. Nobody but the top role, by design.
  '/admin': [Role.SUPERADMIN],
  '/collab': COLLAB_ROLES,
  '/collab/workspace': COLLAB_ROLES,
  '/collab/orders': COLLAB_ROLES,
  '/collab/products': COLLAB_ROLES,
  '/collab/brand': COLLAB_ROLES,
  '/collab/analytics': COLLAB_ROLES,
  '/collab/support': COLLAB_ROLES,
  // Gallery is per-account (either an admin user or a collaborator, per
  // gallery-routes.md) — the same /dashboard/gallery screen and backend
  // routes serve both caller types, each auto-scoped to their own folders.
  // STAFF regained access under Operations (#74).
  '/gallery': [...ADMIN_AND_SUPPORT, ...COLLAB_ROLES],
};

export const DASHBOARD_NAV_PATHS = Object.keys(DASHBOARD_ROUTE_ACCESS).sort(
  (a, b) => b.length - a.length,
);

/**
 * Sections that exist but are deliberately parked. A role that cannot reach
 * one of these gets "under maintenance" rather than "access denied" — the
 * difference matters, because the admin has not done anything wrong.
 */
export const MAINTENANCE_ROUTES: readonly string[] = ['/inventory'];

export function isMaintenanceRoute(path: string): boolean {
  return MAINTENANCE_ROUTES.includes(normalizeDashboardPath(path));
}

export function isStaffRole(role: string): boolean {
  return isRole(role) && (STAFF_ROLES.includes(role) || COLLAB_ROLES.includes(role));
}

/**
 * SUPERADMIN or ADMIN — the two roles that run the shop rather than work in it.
 *
 * For operational detail that would be noise, or misread as a problem, by
 * anyone else: STAFF seeing a latency figure climb has no action to take and no
 * context for whether the number is bad. Reuses the same ADMIN_ONLY list the
 * route table is built from, so "who counts as an admin" has one definition.
 */
export function isAdminRole(role: string | undefined | null): boolean {
  return !!role && isRole(role) && ADMIN_ONLY.includes(role);
}

/**
 * Is this a path the dashboard actually serves?
 *
 * `normalizeDashboardPath` cannot answer this — it falls back to '/overview'
 * for anything it does not recognise, which is right for highlighting a sidebar
 * item and wrong for deciding whether to follow a link.
 *
 * Needed because notification rows carry a free-form `link` column that the UI
 * rendered straight into `<Link href>`. Every row the templates write is a real
 * route, but the column is writable by any caller of the create endpoint, and a
 * row naming a path this app has no page for navigates to a hard 404 — reported
 * 2026-08-21 as the Notifications tab "crashing to /logout", a route that
 * exists nowhere in this repo.
 *
 * Also rejects protocol-relative and absolute URLs, so a stored link can never
 * send an operator off-site.
 */
export function isKnownDashboardPath(path: string): boolean {
  const bare = path.split('?')[0].split('#')[0];
  if (!bare.startsWith('/') || bare.startsWith('//')) return false;
  const normalized = bare === '/dashboard' ? '/overview' : bare.replace(/^\/dashboard(?=\/)/, '');
  return DASHBOARD_NAV_PATHS.some(
    (href) => normalized === href || normalized.startsWith(`${href}/`),
  );
}

export function normalizeDashboardPath(path: string): string {
  const normalizedPath = path === '/dashboard' ? '/overview' : path.replace(/^\/dashboard(?=\/)/, '');
  for (const href of DASHBOARD_NAV_PATHS) {
    if (normalizedPath === href || normalizedPath.startsWith(`${href}/`)) return href;
  }
  return '/overview';
}

/**
 * The brand partner's own screens — "my workspace", "my brand profile", "my
 * orders". They describe the caller's own brand, so they only mean anything to
 * someone who has one. Matched by path prefix rather than by which roles the
 * route lists, so an inline role array cannot quietly opt a screen out.
 */
export function isPartnerOwnScreen(path: string): boolean {
  const normalized = normalizeDashboardPath(path);
  return normalized === '/collab' || normalized.startsWith('/collab/');
}

export function canAccessDashboardRoute(role: string, path: string): boolean {
  if (!isRole(role)) return false;
  const normalized = normalizeDashboardPath(path);
  // Mirrors the backend guard: the top role reaches every screen. Leaving it
  // off a single route here would hide a tab the API would happily serve.
  //
  // Except the partner's own screens. A super admin has no brand, so "my
  // workspace" and "my brand profile" have no subject — they appeared in the
  // sidebar and answered "Insufficient role" when opened. Watching over
  // partners is a different screen (/partners), which lists them and is
  // reached by role like everything else.
  if (role === Role.SUPERADMIN) return !isPartnerOwnScreen(normalized);
  const allowed = DASHBOARD_ROUTE_ACCESS[normalized];
  if (!allowed) return isStaffRole(role);
  return allowed.includes(role);
}

export function firstAccessibleDashboardRoute(role: string): string {
  if (!isStaffRole(role)) return '/login';
  // '/overview' sits ahead of the rest on purpose: since #74 it's reachable
  // by STAFF too (their landing — notifications + their own support
  // conversations, not the admin metrics view), so this is where both admins
  // and STAFF land. '/orders' stays as the next fallback for any staff role
  // that somehow can't reach '/overview'.
  for (const href of [
    '/collab/workspace',
    '/overview',
    '/orders',
    '/support',
    '/fulfillment',
    '/catalogue',
    '/analytics',
    '/settings',
  ]) {
    if (canAccessDashboardRoute(role, href)) return href;
  }
  return '/overview';
}

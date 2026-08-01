import { Role, isRole, type Role as RoleType } from './role';

/** Roles that belong in the admin dashboard at all. */
const STAFF_ROLES: RoleType[] = [Role.SUPERADMIN, Role.ADMIN, Role.STAFF];
/** Roles that belong in the brand-partner portal. */
const COLLAB_ROLES: RoleType[] = [Role.COLLAB];

const ADMIN_ONLY: readonly RoleType[] = [Role.SUPERADMIN, Role.ADMIN];
/**
 * The two jobs STAFF (the support-desk role) actually does: answer customers
 * and see their orders. Deliberately NOT reused for anything else — 2026-07-30
 * the owner asked for STAFF narrowed to exactly Support + Orders (+ their
 * notifications), with everything else — Overview, Analytics, Fulfillment,
 * Reviews, the Settings > Info tab, Gallery, all of it — hidden. Before this
 * date STAFF also had Overview/Fulfillment/Analytics/Reviews/Info via this
 * same list; do not widen it again without a fresh owner ask.
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
  '/overview': ADMIN_ONLY,
  // The whole catalogue lives under one parent now (2026-07-24): the map at
  // /catalogue and the sub-tabs /catalogue/products, /catalogue/categories,
  // /catalogue/brands, /catalogue/global-variants. One key covers them all by
  // prefix, so the sidebar's single "Catalogue" item highlights everywhere in
  // it. Old /products and /categories URLs redirect here (see next.config).
  '/catalogue': ADMIN_ONLY,
  '/orders': ADMIN_AND_SUPPORT,
  '/customers': ADMIN_ONLY,
  '/fulfillment': ADMIN_ONLY,
  '/refunds': ADMIN_ONLY,
  // Codes and the sitewide markdown. ADMIN_ONLY, deliberately: STAFF was
  // scoped down to two jobs on 2026-07-30 (answer customers, see their
  // orders), and this screen is neither. They still issue compensation — from
  // inside a support conversation, which the backend allows them under a
  // spending cap — and they still see what a customer has been given, on that
  // customer's own page. Neither needs this tab.
  '/discounts': ADMIN_ONLY,
  // Parked 2026-07-23: inventory is under active repair and is not trustworthy
  // for day-to-day admin use. SUPERADMIN keeps it so it can be worked on.
  // Restore ADMIN_ONLY when it comes back.
  '/inventory': [Role.SUPERADMIN],
  '/analytics': ADMIN_ONLY,
  // Customer support inbox — staff/admin/superadmin handle it; collaborators
  // get their own inbox at /collab/support instead. One of the two things
  // STAFF is scoped down to (2026-07-30).
  '/support': ADMIN_AND_SUPPORT,
  '/reviews': ADMIN_ONLY,
  '/loyalty': ADMIN_ONLY,
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
  // STAFF removed 2026-07-30 (not one of their two jobs).
  '/gallery': [...ADMIN_ONLY, ...COLLAB_ROLES],
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
  // '/orders' sits ahead of '/fulfillment'/'/catalogue'/'/analytics'/'/settings'
  // on purpose: since 2026-07-30 STAFF cannot open any of those, and would be
  // bounced straight back out if this list sent them there first. Orders (and
  // failing that, Support) are the two routes STAFF can actually open.
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

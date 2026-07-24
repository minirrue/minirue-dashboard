import { Role, isRole, type Role as RoleType } from './role';

/** Roles that belong in the admin dashboard at all. */
const STAFF_ROLES: RoleType[] = [Role.SUPERADMIN, Role.ADMIN, Role.STAFF];
/** Roles that belong in the brand-partner portal. */
const COLLAB_ROLES: RoleType[] = [Role.COLLAB];

const ADMIN_ONLY: readonly RoleType[] = [Role.SUPERADMIN, Role.ADMIN];
/** Admin work that customer support also handles. */
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
  '/overview': ADMIN_AND_SUPPORT,
  // The whole catalogue lives under one parent now (2026-07-24): the map at
  // /catalogue and the sub-tabs /catalogue/products, /catalogue/categories,
  // /catalogue/brands, /catalogue/global-variants. One key covers them all by
  // prefix, so the sidebar's single "Catalogue" item highlights everywhere in
  // it. Old /products and /categories URLs redirect here (see next.config).
  '/catalogue': ADMIN_ONLY,
  '/orders': ADMIN_AND_SUPPORT,
  '/customers': ADMIN_ONLY,
  '/fulfillment': ADMIN_AND_SUPPORT,
  '/refunds': ADMIN_ONLY,
  // Parked 2026-07-23: inventory is under active repair and is not trustworthy
  // for day-to-day admin use. SUPERADMIN keeps it so it can be worked on.
  // Restore ADMIN_ONLY when it comes back.
  '/inventory': [Role.SUPERADMIN],
  '/analytics': ADMIN_AND_SUPPORT,
  // Customer support inbox — staff/admin/superadmin handle it; collaborators
  // get their own inbox at /collab/support instead.
  '/support': ADMIN_AND_SUPPORT,
  '/loyalty': ADMIN_ONLY,
  '/settings': ADMIN_ONLY,
  '/info': STAFF_ROLES,
  '/notifications': STAFF_ROLES,
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
  // Gallery is per-account (either a staff/admin user or a collaborator, per
  // gallery-routes.md) — the same /dashboard/gallery screen and backend
  // routes serve both caller types, each auto-scoped to their own folders.
  '/gallery': [...STAFF_ROLES, ...COLLAB_ROLES],
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
  for (const href of [
    '/collab/workspace',
    '/overview',
    '/orders',
    '/fulfillment',
    '/catalogue',
    '/analytics',
    '/settings',
  ]) {
    if (canAccessDashboardRoute(role, href)) return href;
  }
  return '/overview';
}

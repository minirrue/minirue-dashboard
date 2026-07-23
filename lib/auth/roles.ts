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
  '/products': ADMIN_ONLY,
  '/categories': ADMIN_ONLY,
  '/orders': ADMIN_AND_SUPPORT,
  '/customers': ADMIN_ONLY,
  '/fulfillment': ADMIN_AND_SUPPORT,
  '/refunds': ADMIN_ONLY,
  // Parked 2026-07-23: inventory is under active repair and is not trustworthy
  // for day-to-day admin use. SUPERADMIN keeps it so it can be worked on.
  // Restore ADMIN_ONLY when it comes back.
  '/inventory': [Role.SUPERADMIN],
  '/analytics': ADMIN_AND_SUPPORT,
  '/loyalty': ADMIN_ONLY,
  '/settings': ADMIN_ONLY,
  '/info': STAFF_ROLES,
  '/storefront-appearance': ADMIN_ONLY,
  '/collaborators': ADMIN_ONLY,
  // Managing accounts — creating them, changing roles, deleting them, and
  // signing in as one. Nobody but the top role, by design.
  '/admin': [Role.SUPERADMIN],
  '/collab': COLLAB_ROLES,
  '/collab/workspace': COLLAB_ROLES,
  '/collab/orders': COLLAB_ROLES,
  '/collab/products': COLLAB_ROLES,
  '/collab/brand': COLLAB_ROLES,
  '/collab/analytics': COLLAB_ROLES,
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

export function canAccessDashboardRoute(role: string, path: string): boolean {
  if (!isRole(role)) return false;
  // Mirrors the backend guard: the top role reaches every screen. Leaving it
  // off a single route here would hide a tab the API would happily serve.
  if (role === Role.SUPERADMIN) return true;
  const normalized = normalizeDashboardPath(path);
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
    '/products',
    '/analytics',
    '/settings',
  ]) {
    if (canAccessDashboardRoute(role, href)) return href;
  }
  return '/overview';
}

import { Role, isRole, type Role as RoleType } from './role';

const STAFF_ROLES: RoleType[] = [
  Role.DEV,
  Role.SUPERADMIN,
  Role.OWNER,
  Role.ADMIN,
  Role.STAFF,
];
const COLLAB_ROLES: RoleType[] = [Role.COLLAB, Role.DEV];

/**
 * Allowed roles per dashboard route — mirrors backend `@Roles` on controllers.
 * See `knowledge/specs/005-shared-enums-types/data-model.md` RBAC matrix.
 */
export const DASHBOARD_ROUTE_ACCESS: Record<string, readonly RoleType[]> = {
  '/overview': [Role.ADMIN, Role.OWNER, Role.SUPERADMIN, Role.STAFF, Role.DEV],
  '/products': [Role.ADMIN, Role.OWNER, Role.SUPERADMIN, Role.DEV],
  '/categories': [Role.ADMIN, Role.OWNER, Role.SUPERADMIN, Role.DEV],
  '/orders': [Role.ADMIN, Role.OWNER, Role.SUPERADMIN, Role.STAFF, Role.DEV],
  '/customers': [Role.ADMIN, Role.OWNER, Role.SUPERADMIN, Role.DEV],
  '/fulfillment': [Role.ADMIN, Role.OWNER, Role.SUPERADMIN, Role.STAFF, Role.DEV],
  '/refunds': [Role.ADMIN, Role.OWNER, Role.SUPERADMIN, Role.DEV],
  '/inventory': [Role.ADMIN, Role.OWNER, Role.SUPERADMIN, Role.DEV],
  '/analytics': [Role.OWNER, Role.SUPERADMIN, Role.STAFF, Role.DEV],
  '/loyalty': [Role.ADMIN, Role.OWNER, Role.SUPERADMIN, Role.DEV],
  '/settings': [Role.ADMIN, Role.OWNER, Role.SUPERADMIN, Role.DEV],
  '/info': STAFF_ROLES,
  '/storefront-appearance': [Role.ADMIN, Role.OWNER, Role.SUPERADMIN, Role.DEV],
  '/collaborators': [Role.ADMIN, Role.OWNER, Role.SUPERADMIN],
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

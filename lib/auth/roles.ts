import { Role, isRole, type Role as RoleType } from './role';

const STAFF_ROLES: RoleType[] = [Role.DEV, Role.OWNER, Role.ADMIN, Role.STAFF];
const COLLAB_ROLES: RoleType[] = [Role.COLLAB, Role.DEV];

/**
 * Allowed roles per dashboard route — mirrors backend `@Roles` on controllers.
 * See `knowledge/specs/005-shared-enums-types/data-model.md` RBAC matrix.
 */
export const DASHBOARD_ROUTE_ACCESS: Record<string, readonly RoleType[]> = {
  '/dashboard': [Role.ADMIN, Role.OWNER, Role.STAFF, Role.DEV],
  '/dashboard/products': [Role.ADMIN, Role.OWNER, Role.DEV],
  '/dashboard/categories': [Role.ADMIN, Role.OWNER, Role.DEV],
  '/dashboard/orders': [Role.ADMIN, Role.OWNER, Role.STAFF, Role.DEV],
  '/dashboard/customers': [Role.ADMIN, Role.OWNER, Role.DEV],
  '/dashboard/fulfillment': [Role.ADMIN, Role.OWNER, Role.STAFF, Role.DEV],
  '/dashboard/refunds': [Role.ADMIN, Role.OWNER, Role.DEV],
  '/dashboard/inventory': [Role.ADMIN, Role.OWNER, Role.DEV],
  '/dashboard/analytics': [Role.OWNER, Role.STAFF, Role.DEV],
  '/dashboard/loyalty': [Role.ADMIN, Role.OWNER, Role.DEV],
  '/dashboard/settings': [Role.ADMIN, Role.OWNER, Role.DEV],
  '/dashboard/storefront-appearance': [Role.ADMIN, Role.OWNER, Role.DEV],
  '/dashboard/collaborators': [Role.ADMIN, Role.OWNER],
  '/dashboard/collab': COLLAB_ROLES,
  '/dashboard/collab/orders': COLLAB_ROLES,
  '/dashboard/collab/products': COLLAB_ROLES,
  '/dashboard/collab/brand': COLLAB_ROLES,
  '/dashboard/collab/analytics': COLLAB_ROLES,
};

export const DASHBOARD_NAV_PATHS = Object.keys(DASHBOARD_ROUTE_ACCESS).sort(
  (a, b) => b.length - a.length,
);

export function isStaffRole(role: string): boolean {
  return isRole(role) && (STAFF_ROLES.includes(role) || COLLAB_ROLES.includes(role));
}

export function normalizeDashboardPath(path: string): string {
  for (const href of DASHBOARD_NAV_PATHS) {
    if (path === href || path.startsWith(`${href}/`)) return href;
  }
  return '/dashboard';
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
    '/dashboard/collab',
    '/dashboard',
    '/dashboard/orders',
    '/dashboard/fulfillment',
    '/dashboard/products',
    '/dashboard/analytics',
    '/dashboard/settings',
  ]) {
    if (canAccessDashboardRoute(role, href)) return href;
  }
  return '/dashboard';
}

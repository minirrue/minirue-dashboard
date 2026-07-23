import { describe, expect, it } from '@jest/globals';
import { Role, ROLE_VALUES, ASSIGNABLE_ROLES, isRole, roleLabel } from '@/lib/auth/role';
import {
  canAccessDashboardRoute,
  firstAccessibleDashboardRoute,
  isStaffRole,
  normalizeDashboardPath,
  DASHBOARD_ROUTE_ACCESS,
  isMaintenanceRoute,
  MAINTENANCE_ROUTES,
  isPartnerOwnScreen,
} from '@/lib/auth/roles';

describe('role vocabulary', () => {
  it('exposes the canonical backend members', () => {
    expect(ROLE_VALUES).toEqual(
      expect.arrayContaining([
        Role.CUSTOMER,
        Role.COLLAB,
        Role.STAFF,
        Role.ADMIN,
        Role.SUPERADMIN,
      ]),
    );
    // Mirrors the backend enum exactly, so this count is deliberately strict.
    // DEV and OWNER were retired by migration 0014.
    expect(ROLE_VALUES).toHaveLength(5);
  });

  it('no longer recognises the retired roles', () => {
    expect(isRole('DEV')).toBe(false);
    expect(isRole('OWNER')).toBe(false);
  });

  it('rejects non-canonical role strings', () => {
    expect(isRole('CUSTOMER')).toBe(true);
    expect(isRole('customer')).toBe(false);
    expect(isRole('NOT_A_ROLE')).toBe(false);
  });

  it('gives every role a human label', () => {
    for (const role of ROLE_VALUES) {
      expect(roleLabel(role)).toBeTruthy();
    }
  });

  it('leaves SUPERADMIN out of the freely-assignable list', () => {
    expect(ASSIGNABLE_ROLES).not.toContain(Role.SUPERADMIN);
  });
});

describe('dashboard RBAC routes', () => {
  it('maps nested paths to dashboard sections', () => {
    expect(normalizeDashboardPath('/dashboard/orders/abc')).toBe('/orders');
    expect(normalizeDashboardPath('/orders/abc')).toBe('/orders');
    expect(normalizeDashboardPath('/dashboard')).toBe('/overview');
  });

  it('allows staff operations for STAFF but not catalog admin', () => {
    expect(canAccessDashboardRoute(Role.STAFF, '/orders')).toBe(true);
    expect(canAccessDashboardRoute(Role.STAFF, '/catalogue')).toBe(false);
  });

  it('gives support staff the customer-facing screens only', () => {
    for (const allowed of ['/overview', '/orders', '/fulfillment', '/analytics']) {
      expect(canAccessDashboardRoute(Role.STAFF, allowed)).toBe(true);
    }
    for (const denied of ['/catalogue', '/settings', '/customers', '/admin']) {
      expect(canAccessDashboardRoute(Role.STAFF, denied)).toBe(false);
    }
  });

  it('gives ADMIN the shop but not account administration', () => {
    for (const allowed of ['/catalogue', '/settings', '/analytics', '/collaborators']) {
      expect(canAccessDashboardRoute(Role.ADMIN, allowed)).toBe(true);
    }
    expect(canAccessDashboardRoute(Role.ADMIN, '/admin')).toBe(false);
  });

  it('keeps a customer out of the dashboard entirely', () => {
    expect(isStaffRole(Role.CUSTOMER)).toBe(false);
    for (const path of Object.keys(DASHBOARD_ROUTE_ACCESS)) {
      expect(canAccessDashboardRoute(Role.CUSTOMER, path)).toBe(false);
    }
    expect(firstAccessibleDashboardRoute(Role.CUSTOMER)).toBe('/login');
  });

  it('keeps a collaborator inside their own portal', () => {
    expect(canAccessDashboardRoute(Role.COLLAB, '/collab/workspace')).toBe(true);
    expect(canAccessDashboardRoute(Role.COLLAB, '/gallery')).toBe(true);
    for (const denied of ['/catalogue', '/orders', '/settings', '/admin', '/customers']) {
      expect(canAccessDashboardRoute(Role.COLLAB, denied)).toBe(false);
    }
  });

  it('gives SUPERADMIN every admin screen, but not a partner\'s own screens', () => {
    for (const path of Object.keys(DASHBOARD_ROUTE_ACCESS)) {
      // A super admin has no brand, so "my workspace" and "my brand profile"
      // have no subject. They used to appear and answer "Insufficient role";
      // now they are hidden, and partner oversight is its own screen.
      const expected = !isPartnerOwnScreen(path);
      expect(canAccessDashboardRoute(Role.SUPERADMIN, path)).toBe(expected);
    }
  });

  it('keeps a super admin out of the partner\'s own screens', () => {
    for (const path of ['/collab', '/collab/workspace', '/collab/brand']) {
      expect(canAccessDashboardRoute(Role.SUPERADMIN, path)).toBe(false);
    }
  });

  it('reserves account administration for SUPERADMIN alone', () => {
    expect(DASHBOARD_ROUTE_ACCESS['/admin']).toEqual([Role.SUPERADMIN]);
  });

  it('redirects unknown staff to their first allowed route', () => {
    expect(firstAccessibleDashboardRoute(Role.STAFF)).toBe('/overview');
  });
});

describe('inventory parked for maintenance', () => {
  it('keeps ADMIN and OWNER out of inventory while it is parked', () => {
    expect(canAccessDashboardRoute(Role.ADMIN, '/inventory')).toBe(false);
  });

  it('still lets SUPERADMIN in so it can be repaired', () => {
    expect(canAccessDashboardRoute(Role.SUPERADMIN, '/inventory')).toBe(true);
  });

  it('parks the inventory subpages too, not just the landing page', () => {
    expect(canAccessDashboardRoute(Role.ADMIN, '/inventory/movements')).toBe(false);
    expect(canAccessDashboardRoute(Role.ADMIN, '/inventory/warehouses')).toBe(false);
  });

  it('flags inventory as a maintenance route so the right panel renders', () => {
    expect(isMaintenanceRoute('/inventory')).toBe(true);
    expect(isMaintenanceRoute('/inventory/receive')).toBe(true);
    expect(isMaintenanceRoute('/orders')).toBe(false);
  });

  it('leaves every other route reachable for ADMIN', () => {
    expect(canAccessDashboardRoute(Role.ADMIN, '/orders')).toBe(true);
    expect(canAccessDashboardRoute(Role.ADMIN, '/refunds')).toBe(true);
    expect(MAINTENANCE_ROUTES).toEqual(['/inventory']);
  });
});

import { describe, expect, it } from '@jest/globals';
import { Role, ROLE_VALUES, isRole } from '@/lib/auth/role';
import {
  canAccessDashboardRoute,
  firstAccessibleDashboardRoute,
  isStaffRole,
  normalizeDashboardPath,
} from '@/lib/auth/roles';

describe('role vocabulary', () => {
  it('exposes the canonical backend members', () => {
    expect(ROLE_VALUES).toEqual(
      expect.arrayContaining([Role.CUSTOMER, Role.STAFF, Role.ADMIN, Role.OWNER, Role.DEV]),
    );
    expect(ROLE_VALUES).toHaveLength(5);
  });

  it('rejects non-canonical role strings', () => {
    expect(isRole('CUSTOMER')).toBe(true);
    expect(isRole('customer')).toBe(false);
    expect(isRole('NOT_A_ROLE')).toBe(false);
  });
});

describe('dashboard RBAC routes', () => {
  it('maps nested paths to dashboard sections', () => {
    expect(normalizeDashboardPath('/dashboard/orders/abc')).toBe('/dashboard/orders');
    expect(normalizeDashboardPath('/dashboard')).toBe('/dashboard');
  });

  it('allows staff operations for STAFF but not catalog admin', () => {
    expect(canAccessDashboardRoute(Role.STAFF, '/dashboard/orders')).toBe(true);
    expect(canAccessDashboardRoute(Role.STAFF, '/dashboard/products')).toBe(false);
  });

  it('allows analytics for OWNER and STAFF but not ADMIN', () => {
    expect(canAccessDashboardRoute(Role.OWNER, '/dashboard/analytics')).toBe(true);
    expect(canAccessDashboardRoute(Role.STAFF, '/dashboard/analytics')).toBe(true);
    expect(canAccessDashboardRoute(Role.ADMIN, '/dashboard/analytics')).toBe(false);
  });

  it('redirects unknown staff to their first allowed route', () => {
    expect(firstAccessibleDashboardRoute(Role.STAFF)).toBe('/dashboard');
    expect(isStaffRole(Role.CUSTOMER)).toBe(false);
  });
});

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
      expect.arrayContaining([
        Role.CUSTOMER,
        Role.STAFF,
        Role.ADMIN,
        Role.OWNER,
        Role.SUPERADMIN,
        Role.DEV,
      ]),
    );
    // SUPERADMIN added 2026-07-22 for the data reset — it must mirror the
    // backend enum exactly, so this count is deliberately strict.
    expect(ROLE_VALUES).toHaveLength(7);
  });

  it('rejects non-canonical role strings', () => {
    expect(isRole('CUSTOMER')).toBe(true);
    expect(isRole('customer')).toBe(false);
    expect(isRole('NOT_A_ROLE')).toBe(false);
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
    expect(canAccessDashboardRoute(Role.STAFF, '/products')).toBe(false);
  });

  it('allows analytics for OWNER and STAFF but not ADMIN', () => {
    expect(canAccessDashboardRoute(Role.OWNER, '/analytics')).toBe(true);
    expect(canAccessDashboardRoute(Role.STAFF, '/analytics')).toBe(true);
    expect(canAccessDashboardRoute(Role.ADMIN, '/analytics')).toBe(false);
  });

  it('redirects unknown staff to their first allowed route', () => {
    expect(firstAccessibleDashboardRoute(Role.STAFF)).toBe('/overview');
    expect(isStaffRole(Role.CUSTOMER)).toBe(false);
  });
});

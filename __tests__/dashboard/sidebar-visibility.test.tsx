import { describe, expect, it } from '@jest/globals';
import { NAV_ITEMS } from '@/components/dashboard/DashboardSidebar';
import { Role, ROLE_VALUES } from '@/lib/auth/role';
import {
  canAccessDashboardRoute,
  normalizeDashboardPath,
  DASHBOARD_ROUTE_ACCESS,
} from '@/lib/auth/roles';

/**
 * A tab that is visible but answers 403 reads as a broken dashboard, not as a
 * permission. These tests make that state impossible to ship: every nav item
 * must have an explicit role rule, and what each role can see is pinned here in
 * full rather than left to whoever edits the sidebar next.
 */

const allItems = NAV_ITEMS.flatMap((group) => group.items);

function visibleTo(role: string): string[] {
  return allItems
    .filter((item) => canAccessDashboardRoute(role, item.href))
    .map((item) => item.href)
    .sort();
}

describe('sidebar visibility', () => {
  it('every nav item has an explicit role rule', () => {
    // Without an entry, canAccessDashboardRoute falls back to "any staff role",
    // which is how a tab ends up visible to someone the API refuses.
    const missing = allItems
      .map((item) => item.href)
      .filter((href) => !(normalizeDashboardPath(href) in DASHBOARD_ROUTE_ACCESS));
    expect(missing).toEqual([]);
  });

  it('no nav item points at a path that normalizes somewhere else', () => {
    // A typo'd href silently normalizes to /overview and inherits its rules.
    for (const item of allItems) {
      expect(normalizeDashboardPath(item.href)).toBe(item.href);
    }
  });

  it('shows a customer nothing at all', () => {
    expect(visibleTo(Role.CUSTOMER)).toEqual([]);
  });

  it('shows a collaborator only their own portal and the gallery', () => {
    const visible = visibleTo(Role.COLLAB);
    expect(visible.every((href) => href.startsWith('/collab') || href === '/gallery')).toBe(true);
    expect(visible).toContain('/collab/workspace');
  });

  it('shows support staff no admin-only tabs', () => {
    const visible = visibleTo(Role.STAFF);
    for (const forbidden of ['/products', '/settings', '/customers', '/admin', '/collaborators']) {
      expect(visible).not.toContain(forbidden);
    }
    expect(visible).toContain('/orders');
  });

  it('shows Accounts to the super admin and to nobody else', () => {
    for (const role of ROLE_VALUES) {
      expect(visibleTo(role).includes('/admin')).toBe(role === Role.SUPERADMIN);
    }
  });

  it('shows an admin everything except Accounts', () => {
    const visible = visibleTo(Role.ADMIN);
    expect(visible).not.toContain('/admin');
    expect(visible).toContain('/settings');
    expect(visible).toContain('/products');
  });

  it('never shows a tab a role would be refused on', () => {
    for (const role of ROLE_VALUES) {
      for (const href of visibleTo(role)) {
        expect(canAccessDashboardRoute(role, href)).toBe(true);
      }
    }
  });
});

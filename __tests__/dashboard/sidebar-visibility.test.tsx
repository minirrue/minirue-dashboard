import { describe, expect, it } from '@jest/globals';
import { NAV_ITEMS, isNavItemVisible } from '@/components/dashboard/DashboardSidebar';
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

/** Section + label, in NAV_ITEMS order, exactly as the real sidebar would
 * render for this role (collab-module gating aside — that's covered by the
 * collaborator tests below via href, not label/order). */
function visibleMenu(role: string): { section: string; label: string }[] {
  return NAV_ITEMS.flatMap((group) =>
    group.items
      .filter((item) => isNavItemVisible(role, item))
      .map((item) => ({ section: group.section, label: item.label })),
  );
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

  it('no nav item falls through to the /overview catch-all', () => {
    // A typo'd href silently normalizes to /overview and inherits its rules.
    // A deliberate deep link like /catalogue/brands (a sub-tab) is
    // fine — it normalizes to its real section (/products), just not to itself.
    for (const item of allItems) {
      if (item.href === '/overview') continue;
      expect(normalizeDashboardPath(item.href)).not.toBe('/overview');
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

  it('shows support staff exactly Operations plus Notifications', () => {
    // minirue-dashboard#74 (owner, 2026-09-15): Loyalty, Media gallery,
    // Customers and Orders move into Operations, which is now the whole
    // staff group. STAFF sees only Operations + Notifications — no Overview
    // metrics, Settings, Info, Store group, Insights or Reviews.
    //
    // Follow-up same day: the owner's answer on backend#182 opened Discounts,
    // Bundles and Inventory to STAFF too (Reviews stays admin-only).
    expect(visibleMenu(Role.STAFF)).toEqual([
      { section: 'Operations', label: 'Orders' },
      { section: 'Operations', label: 'Customers' },
      { section: 'Operations', label: 'Loyalty' },
      { section: 'Operations', label: 'Discounts' },
      { section: 'Operations', label: 'Chat' },
      { section: 'Operations', label: 'Email' },
      { section: 'Operations', label: 'Fulfillment' },
      { section: 'Operations', label: 'Refunds and payments' },
      { section: 'Operations', label: 'Inventory' },
      { section: 'System', label: 'Notifications' },
    ]);
  });

  it('hides overview, analytics, seo, settings, reviews, info, catalogue product editing and storefront from support staff', () => {
    // '/overview' is checked via the real sidebar-visibility helper, not raw
    // canAccessDashboardRoute — the route is deliberately reachable by STAFF
    // (their landing), but the nav item stays admin-only. Every other href
    // here is denied at the route level too, so plain visibleTo is fine.
    const staffLabels = visibleMenu(Role.STAFF).map((m) => m.label);
    expect(staffLabels).not.toContain('Overview');
    const visible = visibleTo(Role.STAFF);
    for (const forbidden of [
      '/catalogue', '/settings', '/admin', '/collaborators', '/storefront-appearance',
      '/analytics', '/seo', '/reviews', '/info', '/accounting', '/partners',
    ]) {
      expect(visible).not.toContain(forbidden);
    }
  });

  it('keeps STAFF out of bundles and catalogue product editing (owner, 2026-09-15)', () => {
    expect(canAccessDashboardRoute(Role.STAFF, '/catalogue/bundles')).toBe(false);
    expect(canAccessDashboardRoute(Role.STAFF, '/catalogue/bundles/new')).toBe(false);
    expect(canAccessDashboardRoute(Role.ADMIN, '/catalogue/bundles')).toBe(true);
    expect(canAccessDashboardRoute(Role.STAFF, '/catalogue')).toBe(false);
    expect(canAccessDashboardRoute(Role.STAFF, '/catalogue/products')).toBe(false);
  });

  it('shows the admin the exact Operations, Insights and Store groupings', () => {
    // Pins the full regrouped layout (#74, plus the same-day backend#182
    // follow-up): Operations gathers every day-to-day job including Bundles,
    // Insights is Analytics + SEO only (Loyalty moved out), and Overview
    // stays in Store, admin-only.
    const menu = visibleMenu(Role.ADMIN);
    const bySection = (section: string) =>
      menu.filter((m) => m.section === section).map((m) => m.label);
    expect(bySection('Store')).toEqual(['Overview', 'Catalogue', 'Collaborators', 'Accounting', 'Storefront']);
    // Inventory is open to ADMIN again (owner, 2026-09-15: "inventory for admin also").
    expect(bySection('Operations')).toEqual([
      'Orders', 'Customers', 'Loyalty', 'Gallery', 'Discounts', 'Bundles',
      'Chat', 'Email', 'Reviews', 'Fulfillment', 'Refunds and payments', 'Inventory',
    ]);
    expect(bySection('Insights')).toEqual(['Analytics', 'SEO']);
    expect(bySection('System')).toEqual(['Notifications', 'Settings', 'Info']);
    expect(menu.some((m) => m.section === 'Media')).toBe(false);
  });

  it('lets STAFF reach /overview directly (their landing) without showing an Overview tab', () => {
    // The Overview nav item is admin-only in the sidebar, but the route
    // itself is reachable by STAFF — that's how their landing page renders
    // (notifications + their own support conversations) without a dead tab.
    expect(canAccessDashboardRoute(Role.STAFF, '/overview')).toBe(true);
    expect(visibleMenu(Role.STAFF).map((m) => m.label)).not.toContain('Overview');
  });

  it('still lets admins and super admins moderate reviews', () => {
    // Moderating reviews used to be staffed like /support; since 2026-07-30
    // STAFF no longer sees it, but admin still does.
    expect(visibleTo(Role.ADMIN)).toContain('/reviews');
    expect(visibleTo(Role.SUPERADMIN)).toContain('/reviews');
    expect(visibleTo(Role.COLLAB)).not.toContain('/reviews');
    expect(visibleTo(Role.CUSTOMER)).not.toContain('/reviews');
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
    // The catalogue nav item lands on the map, not the raw list.
    expect(visible).toContain('/catalogue');
  });

  it('opens Accounting to admins and super admins only', () => {
    // PG-DASHBOARD-ACCTG-002. Costs, margins and floors are shop-owner
    // figures; STAFF gets the access-denied panel, as the backend
    // @Roles(ADMIN) on /v1/accounting would refuse them anyway.
    expect(DASHBOARD_ROUTE_ACCESS['/accounting']).toEqual([Role.SUPERADMIN, Role.ADMIN]);
    expect(normalizeDashboardPath('/dashboard/accounting')).toBe('/accounting');
    expect(canAccessDashboardRoute(Role.ADMIN, '/accounting')).toBe(true);
    expect(canAccessDashboardRoute(Role.SUPERADMIN, '/accounting')).toBe(true);
    for (const role of [Role.STAFF, Role.COLLAB, Role.CUSTOMER]) {
      expect(canAccessDashboardRoute(role, '/accounting')).toBe(false);
    }
  });

  it('shows SEO in Insights next to Analytics, to admins and super admins only', () => {
    // PG-DASHBOARD-SEO-002 (minirue-dashboard#69). Mirrors @Roles(ADMIN) on /v1/seo/audit.
    const insights = NAV_ITEMS.find((g) => g.section === 'Insights')?.items.map((i) => i.href) ?? [];
    expect(insights.indexOf('/seo')).toBe(insights.indexOf('/analytics') + 1);
    expect(DASHBOARD_ROUTE_ACCESS['/seo']).toEqual([Role.SUPERADMIN, Role.ADMIN]);
    expect(normalizeDashboardPath('/dashboard/seo')).toBe('/seo');
    for (const role of ROLE_VALUES) {
      expect(visibleTo(role).includes('/seo')).toBe(role === Role.ADMIN || role === Role.SUPERADMIN);
    }
  });

  it('never shows a tab a role would be refused on', () => {
    for (const role of ROLE_VALUES) {
      for (const href of visibleTo(role)) {
        expect(canAccessDashboardRoute(role, href)).toBe(true);
      }
    }
  });
});

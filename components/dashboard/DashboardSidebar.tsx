'use client';

import React from 'react';
import Link from 'next/link';
import { canAccessDashboardRoute } from '@/lib/auth/roles';
import UserMenu from './UserMenu';
import { Sparkle } from '../primitives';
import { CHANGELOG } from '@/lib/changelog';
import { hasUnreadChangelog } from '@/lib/changelog-read-state';
import NotificationDrawer from './NotificationDrawer';
import { useUnreadNotificationCount } from '@/lib/hooks/use-unread-notifications';
import { apiCollabOverview, type CollabModule } from '@/lib/api/collab-portal';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

/* ── Icon helpers (inline SVG to avoid external deps) ── */

function IconPackage() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4A2 2 0 0 1 2 16.76V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.78 0z" />
      <polyline points="2.32 6.16 12 11 21.68 6.16" />
      <line x1="12" y1="22.76" x2="12" y2="11" />
    </svg>
  );
}

function IconShoppingBag() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="16" x2="12" y2="11" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function IconBarChart() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconHandshake() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 17l-1.5-1.5a2.12 2.12 0 0 1 0-3l4.5-4.5a2.12 2.12 0 0 1 3 0L19 10" />
      <path d="M8.5 15.5 4 20l-2-2 6.5-6.5a2.12 2.12 0 0 1 3 0L13 13" />
      <path d="m17 10 2.5-2.5a2.12 2.12 0 0 1 3 0L24 9" />
      <path d="m13 13 2 2" />
      <path d="m11 15 2 2" />
    </svg>
  );
}

function IconTrendingUp() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconTruck() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function IconRefreshCcw() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
    </svg>
  );
}

function IconImage() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function IconPalette() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="10.5" r="2.5" />
      <circle cx="8.5" cy="7.5" r="2.5" />
      <circle cx="6.5" cy="12.5" r="2.5" />
      <path d="M12 22a10 10 0 0 0 10-10c0-2.5-1-4.5-2.5-6" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <circle cx="12" cy="10.5" r="2.2" />
      <path d="M8.6 16.2a3.8 3.8 0 0 1 6.8 0" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3V9zM10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Shows a "Maintenance" badge next to the label — screens flagged as
   * not yet reliable/complete, still visible/usable but under active work. */
  maintenance?: boolean;
  /** When set, this item is only shown to a COLLAB caller who has this
   * module actually granted (collaborator_module_grants) — real RBAC gating
   * instead of always showing the tab and letting the click 404/error. */
  requiresCollabModule?: 'ORDERS' | 'PRODUCTS' | 'ANALYTICS';
}

export interface DashboardSidebarProps {
  /** Currently active route path */
  activePath?: string;
  /** Signed-in staff role from `/auth/me` */
  userRole?: string;
  /** User display name for the footer identity menu */
  userName?: string;
  /** Mobile drawer open state */
  mobileDrawerOpen?: boolean;
  /** Mobile drawer close callback */
  onMobileDrawerClose?: () => void;
}

// Exported so __tests__/dashboard/sidebar-visibility.test.tsx can assert
// against the real list — a role rule that drifts from the nav is exactly the
// bug that puts a 403 tab on someone's screen.
export const NAV_ITEMS: { section: string; items: NavItem[] }[] = [
  {
    section: 'Partner',
    items: [
      { label: 'Workspace', href: '/collab/workspace', icon: <IconBarChart /> },
      { label: 'My orders', href: '/collab/orders', icon: <IconShoppingBag />, requiresCollabModule: 'ORDERS' },
      { label: 'My products', href: '/collab/products', icon: <IconPackage />, requiresCollabModule: 'PRODUCTS' },
      { label: 'Brand profile', href: '/collab/brand', icon: <IconPalette /> },
      { label: 'My analytics', href: '/collab/analytics', icon: <IconTrendingUp />, requiresCollabModule: 'ANALYTICS' },
    ],
  },
  {
    section: 'Store',
    items: [
      { label: 'Overview', href: '/overview', icon: <IconBarChart /> },
      // One Catalogue entry lands on the map at /catalogue; Products, Categories,
      // Brands and Global variants are its slash sub-tabs (the hallway), so they
      // are no longer separate sidebar items. normalizeDashboardPath folds every
      // /catalogue/* path to /catalogue, so this stays highlighted throughout.
      { label: 'Catalogue', href: '/catalogue', icon: <IconPackage /> },
      { label: 'Orders', href: '/orders', icon: <IconShoppingBag /> },
      { label: 'Customers', href: '/customers', icon: <IconUsers /> },
      { label: 'Collaborators', href: '/collaborators', icon: <IconHandshake /> },
      // Oversight, not management — watch partners' standing, access and sales.
      // Admin + super admin (DASHBOARD_ROUTE_ACCESS['/partners'] = ADMIN_ONLY).
      { label: 'Partners', href: '/partners', icon: <IconTrendingUp /> },
      { label: 'Storefront', href: '/storefront-appearance', icon: <IconPalette /> },
    ],
  },
  {
    section: 'Media',
    items: [
      { label: 'Gallery', href: '/gallery', icon: <IconImage /> },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Fulfillment', href: '/fulfillment', icon: <IconTruck /> },
      { label: 'Refunds', href: '/refunds', icon: <IconRefreshCcw /> },
      { label: 'Inventory', href: '/inventory', icon: <IconPackage />, maintenance: true },
    ],
  },
  {
    section: 'Insights',
    items: [
      { label: 'Analytics', href: '/analytics', icon: <IconTrendingUp /> },
      { label: 'Loyalty', href: '/loyalty', icon: <IconStar /> },
    ],
  },
  {
    section: 'System',
    items: [
      // Super admin only — DASHBOARD_ROUTE_ACCESS['/admin'] lists that role
      // alone, so the filter below removes this item for everyone else rather
      // than showing a tab that answers 403.
      { label: 'Accounts', href: '/admin', icon: <IconShield /> },
      { label: 'Notifications', href: '/notifications', icon: <IconBell /> },
      { label: 'Settings', href: '/settings', icon: <IconSettings /> },
      { label: 'Info', href: '/info', icon: <IconInfo /> },
    ],
  },
];

export default function DashboardSidebar({
  activePath = '/overview',
  userRole,
  userName,
  mobileDrawerOpen,
  onMobileDrawerClose,
}: DashboardSidebarProps) {
  // While userRole hasn't resolved yet (every page refresh briefly has it
  // undefined before useUser() loads), fall back to NO items rather than
  // every item unfiltered — the previous fallback showed the full nav
  // (including role-gated sections like Partner/Collaborators) for one
  // frame, then yanked sections away once the real role arrived, reading
  // as a visible glitch on every refresh.
  //
  // Separately: a COLLAB caller's Partner nav items were previously gated
  // only by ROLE (any COLLAB sees every Partner tab), never by which
  // modules an admin actually granted them — so removing a collaborator's
  // ANALYTICS module still left "My analytics" visible; clicking it hit the
  // real backend guard and surfaced a raw "Module not available for your
  // account: ANALYTICS" error instead of the tab simply not existing. Real
  // RBAC gating: fetch the caller's granted modules once and hide (not
  // show-then-error) any tab whose `requiresCollabModule` isn't granted.
  const [collabModules, setCollabModules] = React.useState<CollabModule[] | null>(null);
  useMountedEffect(() => {
    if (userRole !== 'COLLAB') {
      setCollabModules(null);
      return;
    }
    let cancelled = false;
    apiCollabOverview()
      .then((ov) => {
        if (!cancelled) setCollabModules(ov.modules);
      })
      .catch(() => {
        if (!cancelled) setCollabModules([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userRole]);

  const visibleGroups = NAV_ITEMS.map((group) => ({
    ...group,
    items: userRole
      ? group.items.filter((item) => {
          if (!canAccessDashboardRoute(userRole, item.href)) return false;
          if (item.requiresCollabModule) {
            // Still resolving (collabModules === null) — hide rather than
            // flash the tab and yank it away once modules load.
            if (collabModules === null) return false;
            return collabModules.includes(item.requiresCollabModule);
          }
          return true;
        })
      : [],
  })).filter((group) => group.items.length > 0);

  // An item only prefix-matches child routes (e.g. /collab/products under
  // Workspace's /collab) when no OTHER visible nav item is itself nested
  // under it — otherwise a parent-shaped href like /collab lights up for
  // every one of its siblings' subpages too. Was hardcoded to a single
  // '/overview' exception before, which missed '/collab' the same way.
  const allHrefs = visibleGroups.flatMap((group) => group.items.map((i) => i.href));
  const hasNestedSibling = (href: string) =>
    allHrefs.some((h) => h !== href && h.startsWith(`${href}/`));

  // Red dot on the Info nav item when there's an unread changelog entry —
  // read via localStorage only after mount (matches SSR's first render so
  // there's no hydration mismatch), cleared once the admin actually visits
  // /info (InfoClient marks it read there).
  const [showInfoDot, setShowInfoDot] = React.useState(false);
  useMountedEffect(() => {
    const latestId = Math.max(...CHANGELOG.map((e) => e.id), 0);
    setShowInfoDot(hasUnreadChangelog(latestId));
  }, [activePath]);

  // Notification bell moved here from the topbar — the topbar is now
  // desktop-hidden entirely (it duplicated context already shown in the
  // sidebar), so this is its only home on desktop. Mobile keeps its own
  // copy in the slim mobile-only bar (DashboardTopbar) since the sidebar
  // itself is hidden there.
  const [notifOpen, setNotifOpen] = React.useState(false);
  // Fetches the true unread count on mount, so the bell dot reflects reality
  // before the drawer is ever opened (it used to only update after opening).
  const [unreadCount, setUnreadCount] = useUnreadNotificationCount();

  const renderNav = () => (
    <nav className="dash-sidebar-nav" onClick={onMobileDrawerClose}>
      {visibleGroups.map((group) => (
        <section className="dash-sidebar-group" key={group.section} aria-label={group.section}>
          <div className="dash-sidebar-section">{group.section}</div>
          <div className="dash-sidebar-group-items">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="dash-sidebar-link"
                data-active={
                  activePath === item.href ||
                  (!hasNestedSibling(item.href) && activePath.startsWith(`${item.href}/`))
                    ? 'true'
                    : undefined
                }
              >
                <span className="dash-sidebar-link-icon">{item.icon}</span>
                <span className="dash-sidebar-link-label">{item.label}</span>
                {item.maintenance && (
                  <span className="dash-sidebar-link-badge">Maintenance</span>
                )}
                {item.href === '/info' && showInfoDot && (
                  <span className="dash-sidebar-link-dot" aria-label="New updates" />
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </nav>
  );

  const renderBrand = (showNotifButton = false) => (
    <div className="dash-sidebar-brand">
      <div>
        <div className="dash-sidebar-logo">
          MiniRue
          <span className="dash-sidebar-logo-mark" aria-hidden="true">
            <Sparkle size={9} />
          </span>
        </div>
        <div className="dash-sidebar-subtitle">Atelier dashboard</div>
      </div>
      {showNotifButton && (
        <button
          type="button"
          className="dash-notif-btn"
          onClick={() => setNotifOpen(true)}
          aria-label={unreadCount > 0 ? `Open notifications (${unreadCount} unread)` : 'Open notifications'}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3V9zM10 19a2 2 0 0 0 4 0" />
          </svg>
          {unreadCount > 0 && <span className="dash-notif-dot" aria-hidden="true" />}
        </button>
      )}
    </div>
  );

  const renderFooter = () => (
    <div className="dash-sidebar-footer">
      <UserMenu userName={userName} userRole={userRole} />
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="dash-sidebar">
        {renderBrand(true)}
        {renderNav()}
        {renderFooter()}
      </aside>
      <NotificationDrawer
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onUnreadCountChange={setUnreadCount}
      />

      {/* Mobile slide-out drawer */}
      <aside
        className="dash-mobile-drawer"
        data-open={mobileDrawerOpen ? 'true' : undefined}
      >
        {renderBrand()}
        {renderNav()}
        {renderFooter()}
      </aside>

      {/* Mobile backdrop */}
      {mobileDrawerOpen && (
        <div
          className="dash-mobile-backdrop"
          onClick={onMobileDrawerClose}
          aria-hidden="true"
        />
      )}
    </>
  );
}

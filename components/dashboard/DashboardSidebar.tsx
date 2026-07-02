'use client';

import React from 'react';
import { canAccessDashboardRoute } from '@/lib/auth/roles';
import RoleBadge from './RoleBadge';

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

function IconGrid() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
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

export interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export interface DashboardSidebarProps {
  /** Currently active route path */
  activePath?: string;
  /** Signed-in staff role from `/auth/me` */
  userRole?: string;
}

const NAV_ITEMS: { section: string; items: NavItem[] }[] = [
  {
    section: 'Partner',
    items: [
      { label: 'Workspace', href: '/dashboard/collab', icon: <IconBarChart /> },
      { label: 'My orders', href: '/dashboard/collab/orders', icon: <IconShoppingBag /> },
      { label: 'My products', href: '/dashboard/collab/products', icon: <IconPackage /> },
      { label: 'Brand profile', href: '/dashboard/collab/brand', icon: <IconPalette /> },
      { label: 'My analytics', href: '/dashboard/collab/analytics', icon: <IconTrendingUp /> },
    ],
  },
  {
    section: 'Store',
    items: [
      { label: 'Overview', href: '/dashboard', icon: <IconBarChart /> },
      { label: 'Products', href: '/dashboard/products', icon: <IconPackage /> },
      { label: 'Categories', href: '/dashboard/categories', icon: <IconGrid /> },
      { label: 'Orders', href: '/dashboard/orders', icon: <IconShoppingBag /> },
      { label: 'Customers', href: '/dashboard/customers', icon: <IconUsers /> },
      { label: 'Collaborators', href: '/dashboard/collaborators', icon: <IconUsers /> },
      { label: 'Storefront', href: '/dashboard/storefront-appearance', icon: <IconPalette /> },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Fulfillment', href: '/dashboard/fulfillment', icon: <IconTruck /> },
      { label: 'Refunds', href: '/dashboard/refunds', icon: <IconRefreshCcw /> },
      { label: 'Inventory', href: '/dashboard/inventory', icon: <IconPackage /> },
    ],
  },
  {
    section: 'Insights',
    items: [
      { label: 'Analytics', href: '/dashboard/analytics', icon: <IconTrendingUp /> },
      { label: 'Loyalty', href: '/dashboard/loyalty', icon: <IconStar /> },
    ],
  },
  {
    section: 'System',
    items: [
      { label: 'Settings', href: '/dashboard/settings', icon: <IconSettings /> },
    ],
  },
];

export default function DashboardSidebar({ activePath = '/dashboard', userRole }: DashboardSidebarProps) {
  const visibleGroups = NAV_ITEMS.map((group) => ({
    ...group,
    items: userRole
      ? group.items.filter((item) => canAccessDashboardRoute(userRole, item.href))
      : group.items,
  })).filter((group) => group.items.length > 0);

  return (
    <aside className="dash-sidebar">
      <div className="dash-sidebar-brand">
        <div className="dash-sidebar-logo">
          MiniRue
          <span className="dash-sidebar-logo-mark" aria-hidden="true">
            *
          </span>
        </div>
        <div className="dash-sidebar-subtitle">Atelier dashboard</div>
      </div>

      <nav className="dash-sidebar-nav">
        {visibleGroups.map((group) => (
          <section className="dash-sidebar-group" key={group.section} aria-label={group.section}>
            <div className="dash-sidebar-section">{group.section}</div>
            <div className="dash-sidebar-group-items">
              {group.items.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="dash-sidebar-link"
                  data-active={
                    activePath === item.href || (item.href !== '/dashboard' && activePath.startsWith(`${item.href}/`))
                      ? 'true'
                      : undefined
                  }
                >
                  <span className="dash-sidebar-link-icon">{item.icon}</span>
                  <span className="dash-sidebar-link-label">{item.label}</span>
                </a>
              ))}
            </div>
          </section>
        ))}
      </nav>

      <div className="dash-sidebar-footer">
        <div className="dash-sidebar-footer-link">Storefront</div>
        <div className="dash-sidebar-footer-user">
          <div className="dash-sidebar-footer-avatar" aria-hidden="true">
            MR
          </div>
          <div className="dash-sidebar-footer-copy">
            {userRole ? <RoleBadge role={userRole} size="compact" /> : null}
            <span className="dash-sidebar-footer-version">MiniRue Admin v0.1</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

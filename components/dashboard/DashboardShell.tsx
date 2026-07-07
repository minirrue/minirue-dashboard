'use client';

import React, { useEffect, useState } from 'react';
import DashboardSidebar from './DashboardSidebar';
import DashboardTopbar, { type BreadcrumbItem } from './DashboardTopbar';
import MagneticCursor from './MagneticCursor';

const SIDEBAR_COLLAPSED_KEY = 'dash-sidebar-collapsed';

export interface DashboardShellProps {
  children: React.ReactNode;
  /** Active sidebar path */
  activePath?: string;
  /** Topbar breadcrumbs */
  breadcrumbs?: BreadcrumbItem[];
  /** User display name */
  userName?: string;
  /** Canonical role from `/auth/me` */
  userRole?: string;
  /** Optional topbar eyebrow copy */
  shellEyebrow?: string;
  /** Optional topbar title */
  shellTitle?: string;
}

export function DashboardShell({
  children,
  activePath,
  breadcrumbs,
  userName,
  userRole,
  shellEyebrow,
  shellTitle,
}: DashboardShellProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const toggleDrawer = () => setMobileDrawerOpen((v) => !v);
  const closeDrawer = () => setMobileDrawerOpen(false);

  // Desktop sidebar collapse state lives here (not in DashboardSidebar) because
  // `.dash-main`'s margin-left is not reachable from `.dash-sidebar` via a plain
  // CSS sibling selector — MagneticCursor renders its own sibling <div> between
  // them, and DashboardSidebar itself renders a Fragment of two <aside> elements
  // (desktop + mobile drawer) plus a conditional backdrop, so the DOM adjacency
  // a `+`/`~` selector would need doesn't hold. Lifting the boolean up lets us
  // drive both the sidebar's data-attribute and the main content's margin from
  // one source of truth.
  const [collapsed, setCollapsed] = useState(false);

  // SSR-safe hydration: default to false on the server/first client render,
  // then read the persisted value once mounted.
  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === 'true') setCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? 'true' : 'false');
  }, [collapsed]);

  const toggleCollapsed = () => setCollapsed((v) => !v);

  return (
    <div className="dash-shell">
      <MagneticCursor />
      <DashboardSidebar
        activePath={activePath}
        userRole={userRole}
        userName={userName}
        mobileDrawerOpen={mobileDrawerOpen}
        onMobileDrawerClose={closeDrawer}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />
      <main className="dash-main" data-sidebar-collapsed={collapsed ? 'true' : undefined}>
        <DashboardTopbar
          breadcrumbs={breadcrumbs}
          userName={userName}
          userRole={userRole}
          eyebrow={shellEyebrow}
          title={shellTitle}
          onToggleDrawer={toggleDrawer}
        />
        <div className="dash-content">
          <div className="dash-content-inner">{children}</div>
        </div>
      </main>
    </div>
  );
}

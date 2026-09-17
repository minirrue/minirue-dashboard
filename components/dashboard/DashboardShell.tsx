'use client';

import React, { useCallback, useEffect, useState } from 'react';
import DashboardSidebar from './DashboardSidebar';
import DashboardTopbar, { type BreadcrumbItem } from './DashboardTopbar';

export interface DashboardShellProps {
  children: React.ReactNode;
  /** Active sidebar path */
  activePath?: string;
  /** Topbar breadcrumbs */
  breadcrumbs?: BreadcrumbItem[];
  /** User display name */
  userName?: string;
  /** Stable account id used to scope persisted shell preferences. */
  userId?: string;
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
  userId,
  userRole,
  shellEyebrow,
  shellTitle,
}: DashboardShellProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarStorageKey = `minirue:dashboard-sidebar:${userId ?? `${userRole ?? 'loading'}:${userName ?? 'user'}`}`;
  const toggleDrawer = () => setMobileDrawerOpen((v) => !v);
  const closeDrawer = () => setMobileDrawerOpen(false);
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem(sidebarStorageKey, next ? 'collapsed' : 'expanded');
      return next;
    });
  }, [sidebarStorageKey]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setSidebarCollapsed(window.localStorage.getItem(sidebarStorageKey) === 'collapsed');
    });
    return () => {
      active = false;
    };
  }, [sidebarStorageKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleSidebar]);

  return (
    <div className="dash-shell" data-sidebar-collapsed={sidebarCollapsed ? 'true' : undefined}>
      <DashboardSidebar
        activePath={activePath}
        userRole={userRole}
        userName={userName}
        userId={userId}
        mobileDrawerOpen={mobileDrawerOpen}
        onMobileDrawerClose={closeDrawer}
        collapsed={sidebarCollapsed}
        onCollapsedChange={toggleSidebar}
      />
      <main className="dash-main">
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

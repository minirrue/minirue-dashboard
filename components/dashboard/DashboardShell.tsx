'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  /**
   * Working search control supplied by the dashboard-search provider.
   * The shell only places it; keyboard shortcuts and dialog state stay with
   * the provider so chrome never creates an inert or duplicate search UI.
   */
  searchTrigger?: React.ReactNode;
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
  searchTrigger,
}: DashboardShellProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarStorageKey = `minirue:dashboard-sidebar:${userId ?? `${userRole ?? 'loading'}:${userName ?? 'user'}`}`;
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const toggleDrawer = useCallback(() => {
    drawerTriggerRef.current = document.querySelector<HTMLButtonElement>('.dash-hamburger-btn');
    setMobileDrawerOpen((value) => !value);
  }, []);
  const closeDrawer = useCallback(() => setMobileDrawerOpen(false), []);
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem(sidebarStorageKey, next ? 'collapsed' : 'expanded');
      return next;
    });
  }, [sidebarStorageKey]);

  useEffect(() => {
    let active = true;
    const desktop = window.matchMedia('(min-width: 1024px)');
    const syncDesktopPreference = () => {
      if (!active) return;
      setSidebarCollapsed(
        desktop.matches && window.localStorage.getItem(sidebarStorageKey) === 'collapsed',
      );
    };
    queueMicrotask(syncDesktopPreference);
    desktop.addEventListener('change', syncDesktopPreference);
    return () => {
      active = false;
      desktop.removeEventListener('change', syncDesktopPreference);
    };
  }, [sidebarStorageKey]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setMobileDrawerOpen(false);
    });
    return () => {
      active = false;
    };
  }, [activePath]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey)
        && event.key.toLowerCase() === 'b'
        && window.matchMedia('(min-width: 1024px)').matches
      ) {
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
        drawerTriggerRef={drawerTriggerRef}
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
          searchTrigger={searchTrigger}
          onToggleDrawer={toggleDrawer}
        />
        <div className="dash-content">
          <div className="dash-content-inner">{children}</div>
        </div>
      </main>
    </div>
  );
}

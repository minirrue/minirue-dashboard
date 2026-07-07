'use client';

import React, { useState } from 'react';
import DashboardSidebar from './DashboardSidebar';
import DashboardTopbar, { type BreadcrumbItem } from './DashboardTopbar';
import MagneticCursor from './MagneticCursor';

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

  return (
    <div className="dash-shell">
      <MagneticCursor />
      <DashboardSidebar
        activePath={activePath}
        userRole={userRole}
        userName={userName}
        mobileDrawerOpen={mobileDrawerOpen}
        onMobileDrawerClose={closeDrawer}
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

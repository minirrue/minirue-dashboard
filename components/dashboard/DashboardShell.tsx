'use client';

import React from 'react';
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
  return (
    <div className="dash-shell">
      <DashboardSidebar activePath={activePath} userRole={userRole} />
      <main className="dash-main">
        <DashboardTopbar
          breadcrumbs={breadcrumbs}
          userName={userName}
          userRole={userRole}
          eyebrow={shellEyebrow}
          title={shellTitle}
        />
        <div className="dash-content">
          <div className="dash-content-inner">{children}</div>
        </div>
      </main>
    </div>
  );
}

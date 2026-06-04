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
}

export function DashboardShell({
  children,
  activePath,
  breadcrumbs,
  userName,
}: DashboardShellProps) {
  return (
    <div className="dash-shell">
      <DashboardSidebar activePath={activePath} />
      <main className="dash-main">
        <DashboardTopbar breadcrumbs={breadcrumbs} userName={userName} />
        <div className="dash-content">{children}</div>
      </main>
    </div>
  );
}

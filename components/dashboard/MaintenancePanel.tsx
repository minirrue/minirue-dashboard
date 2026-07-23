'use client';

import Link from 'next/link';
import { routeSectionLabel } from '@/lib/auth/role-brief';
import { isRole } from '@/lib/auth/role';
import { firstAccessibleDashboardRoute } from '@/lib/auth/roles';

export interface MaintenancePanelProps {
  attemptedPath: string;
  role: string;
}

export default function MaintenancePanel({ attemptedPath, role }: MaintenancePanelProps) {
  const section = routeSectionLabel(attemptedPath);
  const homeHref = isRole(role) ? firstAccessibleDashboardRoute(role) : '/overview';

  return (
    <div
      className="dash-access-denied"
      role="status"
      data-trace-id="PG-DASHBOARD-OPS-004::EL-REGION-maintenance-panel"
    >
      <div className="dash-access-denied-icon" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </div>
      <h1 className="dash-access-denied-title">{section} is under maintenance</h1>
      <p className="dash-access-denied-copy">
        We have taken this section offline while we fix it, so nothing here can be
        trusted or changed right now. Nothing is wrong with your account — everything
        else in the dashboard still works normally.
      </p>
      <div className="dash-access-denied-actions">
        <Link
          href={homeHref}
          className="dash-btn-primary"
          data-trace-id="PG-DASHBOARD-OPS-004::EL-LINK-go-to-dashboard"
        >
          Go to my dashboard
        </Link>
      </div>
    </div>
  );
}

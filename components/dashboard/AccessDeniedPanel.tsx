'use client';

import Link from 'next/link';
import RoleBadge from './RoleBadge';
import { roleBrief, routeSectionLabel } from '@/lib/auth/role-brief';
import { Role, isRole } from '@/lib/auth/role';
import { firstAccessibleDashboardRoute, canAccessDashboardRoute } from '@/lib/auth/roles';

export interface AccessDeniedPanelProps {
  role: string;
  attemptedPath: string;
}

export default function AccessDeniedPanel({ role, attemptedPath }: AccessDeniedPanelProps) {
  const section = routeSectionLabel(attemptedPath);
  const homeHref = isRole(role) ? firstAccessibleDashboardRoute(role) : '/dashboard';
  const brief = isRole(role) ? roleBrief(role) : null;

  return (
    <div className="dash-access-denied" role="alert">
      <div className="dash-access-denied-icon" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h1 className="dash-access-denied-title">You don&apos;t have access to {section}</h1>
      <p className="dash-access-denied-copy">
        Your current role doesn&apos;t include permission for this area. Use the navigation to reach modules
        available to you, or return to your dashboard home.
      </p>
      {role ? <RoleBadge role={role} /> : null}
      {brief ? (
        <p className="dash-access-denied-hint">
          Your role is set up for{' '}
          <Link href={brief.primaryAction.href} className="dash-link">
            {brief.primaryAction.label.toLowerCase()}
          </Link>
          .
        </p>
      ) : null}
      <div className="dash-access-denied-actions">
        <Link href={homeHref} className="dash-btn-primary">
          Go to my dashboard
        </Link>
        {role === Role.STAFF && canAccessDashboardRoute(role, '/dashboard/collab') ? (
          <Link href="/dashboard/collab" className="dash-btn-secondary">
            Partner workspace
          </Link>
        ) : null}
        {isRole(role) && canAccessDashboardRoute(role, '/dashboard/orders') ? (
          <Link href="/dashboard/orders" className="dash-btn-secondary">
            View orders
          </Link>
        ) : null}
      </div>
    </div>
  );
}

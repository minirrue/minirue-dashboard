import React from 'react';
import RoleBadge from './RoleBadge';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface DashboardTopbarProps {
  breadcrumbs?: BreadcrumbItem[];
  /** User display name for avatar initials */
  userName?: string;
  /** Canonical role label from `/auth/me` */
  userRole?: string;
  eyebrow?: string;
  title?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function DashboardTopbar({
  breadcrumbs = [{ label: 'Dashboard' }],
  userName = 'Admin',
  userRole,
  eyebrow,
  title,
}: DashboardTopbarProps) {
  const resolvedTitle = title ?? breadcrumbs[breadcrumbs.length - 1]?.label ?? 'Dashboard';
  const resolvedEyebrow = eyebrow ?? breadcrumbs[0]?.label ?? 'Dashboard';

  return (
    <header className="dash-topbar">
      <div className="dash-topbar-copy">
        <div className="dash-topbar-eyebrow">{resolvedEyebrow}</div>
        <div className="dash-topbar-heading">
          <h1 className="dash-topbar-title">{resolvedTitle}</h1>
          <nav className="dash-breadcrumb" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <React.Fragment key={`${crumb.label}-${i}`}>
                  {i > 0 && <span className="dash-breadcrumb-sep">/</span>}
                  {isLast ? (
                    <span className="dash-breadcrumb-current">{crumb.label}</span>
                  ) : (
                    <a className="dash-breadcrumb-link" href={crumb.href}>
                      {crumb.label}
                    </a>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="dash-user-menu">
        <RoleBadge role={userRole} />
        <div className="dash-user-meta">
          <div className="dash-user-name" title={userName}>
            {userName}
          </div>
          {userRole ? <div className="dash-user-role-label">Signed in</div> : null}
        </div>
        <div className="dash-avatar" title={userName} aria-label={`Signed in as ${userName}`}>
          <span>{getInitials(userName)}</span>
        </div>
      </div>
    </header>
  );
}

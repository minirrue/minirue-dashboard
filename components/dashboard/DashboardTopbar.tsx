import React from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface DashboardTopbarProps {
  breadcrumbs?: BreadcrumbItem[];
  /** User display name for avatar initials */
  userName?: string;
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
}: DashboardTopbarProps) {
  return (
    <header className="dash-topbar">
      <nav className="dash-breadcrumb" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          return (
            <React.Fragment key={crumb.label}>
              {i > 0 && <span className="dash-breadcrumb-sep">/</span>}
              {isLast ? (
                <span className="dash-breadcrumb-current">{crumb.label}</span>
              ) : (
                <a href={crumb.href} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {crumb.label}
                </a>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      <div className="dash-user-menu">
        <div className="dash-avatar" title={userName}>
          {getInitials(userName)}
        </div>
      </div>
    </header>
  );
}

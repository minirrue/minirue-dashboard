'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import NotificationDrawer from './NotificationDrawer';

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
  /** Mobile drawer toggle callback */
  onToggleDrawer?: () => void;
}

export default function DashboardTopbar({
  breadcrumbs = [{ label: 'Overview' }],
  eyebrow,
  title,
  onToggleDrawer,
}: DashboardTopbarProps) {
  const resolvedEyebrow = eyebrow ?? breadcrumbs[0]?.label ?? 'Overview';
  const [notifOpen, setNotifOpen] = useState(false);

  // The topbar used to also render its own <h1>{title}</h1> — every page's
  // own content already renders its own on-page title (e.g. ProductsClient's
  // "Products" <h1>), so this duplicated literally every single page's
  // heading once the topbar started showing the real per-page title instead
  // of a hardcoded 'Overview'. The eyebrow (app/section context) and the
  // breadcrumb trail (for nested detail pages) still earn their place here;
  // the redundant title text does not.
  return (
    <>
    <header className="dash-topbar">
      <div className="dash-topbar-copy">
        <div className="dash-topbar-eyebrow">{resolvedEyebrow}</div>
        <div className="dash-topbar-heading">
          {breadcrumbs.length > 1 && (
            <nav className="dash-breadcrumb" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, i) => {
                const isLast = i === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={`${crumb.label}-${i}`}>
                    {i > 0 && <span className="dash-breadcrumb-sep">/</span>}
                    {isLast ? (
                      <span className="dash-breadcrumb-current">{crumb.label}</span>
                    ) : crumb.href ? (
                      <Link className="dash-breadcrumb-link" href={crumb.href}>
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="dash-breadcrumb-link">{crumb.label}</span>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          )}
        </div>
      </div>

      <div className="dash-topbar-actions">
        <button
          className="dash-hamburger-btn"
          onClick={onToggleDrawer}
          aria-label="Toggle navigation menu"
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <button
          className="dash-notif-btn"
          onClick={() => setNotifOpen(true)}
          aria-label="Open notifications"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3V9zM10 19a2 2 0 0 0 4 0" />
          </svg>
          <span className="dash-notif-dot" aria-hidden="true" />
        </button>
      </div>
    </header>
    <NotificationDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
}

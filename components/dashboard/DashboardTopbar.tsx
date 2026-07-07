'use client';

import React, { useState, useEffect } from 'react';
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
  const resolvedTitle = title ?? breadcrumbs[breadcrumbs.length - 1]?.label ?? 'Overview';
  const resolvedEyebrow = eyebrow ?? breadcrumbs[0]?.label ?? 'Overview';
  const [notifOpen, setNotifOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);

  /* Mobile detection (same breakpoint as sidebar: 760px) */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <>
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
        {isMobile && !searchExpanded ? (
          <button
            className="dash-topbar-search-icon-btn"
            onClick={() => setSearchExpanded(true)}
            aria-label="Open search"
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </button>
        ) : (
          <label className={`dash-topbar-search${isMobile ? ' dash-topbar-search--mobile' : ''}`}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              placeholder="Search orders, products…"
              aria-label="Search"
              autoFocus={isMobile && searchExpanded}
              onBlur={() => { if (isMobile) setSearchExpanded(false); }}
            />
          </label>
        )}

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

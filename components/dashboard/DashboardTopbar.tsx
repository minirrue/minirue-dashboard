'use client';

import { useState } from 'react';
import NotificationDrawer from './NotificationDrawer';

// Kept for compatibility with existing callers passing breadcrumbs/eyebrow/
// title — those props are no longer rendered (see below) but callers don't
// need to be touched just to drop values that are now ignored.
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

export default function DashboardTopbar({ onToggleDrawer }: DashboardTopbarProps) {
  const [notifOpen, setNotifOpen] = useState(false);

  // The topbar previously also showed an "eyebrow" (app/section label) and
  // breadcrumb trail on the left. That whole block is removed per explicit
  // request — the sidebar already identifies the current section, and the
  // per-page content has its own heading — so this bar now only ever holds
  // the mobile menu toggle and the notification bell, right-aligned.
  return (
    <>
    <header className="dash-topbar dash-topbar--minimal">
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

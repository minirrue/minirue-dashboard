'use client';

import React from 'react';
import Link from 'next/link';
import { useAdminNotifications } from './notifications/useAdminNotifications';
import NotificationFilters from './notifications/NotificationFilters';
import NotificationList from './notifications/NotificationList';

export interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Lets the sidebar show a real unread count on the bell. */
  onUnreadCountChange?: (count: number) => void;
}

export default function NotificationDrawer({
  open,
  onClose,
  onUnreadCountChange,
}: NotificationDrawerProps) {
  const {
    items, unreadCount, categoryCounts,
    loading, refreshing, error,
    filters, setFilters,
    refresh, markRead, markAllRead,
  } = useAdminNotifications({ enabled: open });

  React.useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [unreadCount, onUnreadCountChange]);

  return (
    <>
      <div
        className="dash-notif-backdrop"
        onClick={onClose}
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
      />
      <aside
        className="dash-notif-drawer"
        data-open={open ? 'true' : 'false'}
        aria-hidden={!open}
        aria-label="Notifications"
      >
        <div className="dash-notif-header">
          <div className="dash-notif-title">
            Notifications
            {unreadCount > 0 && (
              <span style={{ marginLeft: 8, color: 'var(--mr-fg-4)', fontSize: 12 }}>
                {unreadCount} unread
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={() => void refresh()}
              disabled={refreshing}
              aria-label="Refresh notifications"
              title="Refresh"
              style={{ fontSize: 11, padding: '3px 7px' }}
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0}
              style={{ fontSize: 11, padding: '3px 7px' }}
            >
              Mark all read
            </button>
            <button className="dash-notif-close" onClick={onClose} aria-label="Close notifications">
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M5 5l14 14M19 5L5 19" />
              </svg>
            </button>
          </div>
        </div>

        <NotificationFilters
          filters={filters}
          setFilters={setFilters}
          categoryCounts={categoryCounts}
        />

        <div style={{ overflowY: 'auto', flex: 1 }}>
          <NotificationList
            items={items}
            loading={loading}
            error={error}
            onRetry={() => void refresh()}
            onMarkRead={(id) => void markRead(id)}
          />
        </div>

        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--mr-dash-hair)' }}>
          <Link href="/notifications" className="dash-link" onClick={onClose}>
            Open the full notification centre →
          </Link>
        </div>
      </aside>
    </>
  );
}

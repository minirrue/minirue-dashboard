'use client';

import React from 'react';
import { useAdminNotifications } from '@/components/dashboard/notifications/useAdminNotifications';
import NotificationFilters from '@/components/dashboard/notifications/NotificationFilters';
import NotificationList from '@/components/dashboard/notifications/NotificationList';

export default function NotificationsClient() {
  const {
    items, total, unreadCount, categoryCounts,
    loading, refreshing, error,
    filters, setFilters,
    refresh, toggleRead, markAllRead,
  } = useAdminNotifications({ enabled: true, limit: 100 });

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Notifications</h1>
        <div className="dash-row-actions">
          <button
            type="button"
            className="dash-btn-secondary"
            onClick={() => void refresh()}
            disabled={refreshing}
            aria-label="Refresh notifications"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            className="dash-btn-secondary"
            onClick={() => void markAllRead()}
            disabled={unreadCount === 0}
          >
            Mark all read
          </button>
        </div>
      </div>

      <p className="dash-help-text" style={{ marginTop: 0 }}>
        {total} notification{total === 1 ? '' : 's'}
        {unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
      </p>

      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        <NotificationFilters
          filters={filters}
          setFilters={setFilters}
          categoryCounts={categoryCounts}
        />
        <NotificationList
          items={items}
          loading={loading}
          error={error}
          onRetry={() => void refresh()}
          onToggleRead={(id, isRead) => void toggleRead(id, isRead)}
        />
      </div>
    </>
  );
}

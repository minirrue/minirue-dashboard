'use client';

import React from 'react';
import NotificationItem from './NotificationItem';
import type { AdminNotification } from '@/lib/api/notifications';

export default function NotificationList({
  items,
  loading,
  error,
  onRetry,
  onMarkRead,
}: {
  items: AdminNotification[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onMarkRead: (id: number) => void;
}) {
  if (loading) {
    return (
      <div style={{ padding: 14 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className="dash-skeleton"
            style={{ display: 'block', width: i % 2 ? '60%' : '85%', height: 14, marginBottom: 12 }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 14 }}>
        <p className="dash-inline-error">{error}</p>
        <button type="button" className="dash-btn-secondary" style={{ marginTop: 10 }} onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="dash-notif-empty">
        Nothing here yet. Orders, refunds, fulfilments and collaborator activity will show up here as they happen.
      </div>
    );
  }

  return (
    <div>
      {items.map((n) => (
        <NotificationItem key={n.id} notification={n} onMarkRead={onMarkRead} />
      ))}
    </div>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import type { AdminNotification } from '@/lib/api/notifications';

const SEVERITY_STATUS: Record<AdminNotification['severity'], string> = {
  INFO: 'pending',
  SUCCESS: 'delivered',
  WARNING: 'processing',
  CRITICAL: 'cancelled',
};

function relativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-EG', { month: 'short', day: 'numeric' });
}

export default function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: AdminNotification;
  onMarkRead: (id: number) => void;
}) {
  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
        <span className="dash-status" data-status={SEVERITY_STATUS[notification.severity]}>
          <span className="dash-status-dot" />
          {notification.category.charAt(0) + notification.category.slice(1).toLowerCase()}
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--mr-fg-4)', fontSize: 11 }}>
          {relativeTime(notification.createdAt)}
        </span>
      </div>
      <div style={{ fontWeight: notification.isRead ? 400 : 600, color: 'var(--mr-fg)', fontSize: 14 }}>
        {notification.title}
      </div>
      <div style={{ color: 'var(--mr-fg-3)', fontSize: 13, marginTop: 2 }}>
        {notification.body}
      </div>
    </>
  );

  return (
    <div
      className="dash-notif-item"
      data-unread={notification.isRead ? undefined : 'true'}
      style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--mr-dash-hair)',
        background: notification.isRead ? 'transparent' : 'var(--mr-dash-raise, rgba(0,0,0,0.02))',
      }}
    >
      {notification.link ? (
        <Link
          href={notification.link}
          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          onClick={() => { if (!notification.isRead) onMarkRead(notification.id); }}
        >
          {body}
        </Link>
      ) : (
        body
      )}
      {!notification.isRead && (
        <button
          type="button"
          className="dash-btn-ghost"
          style={{ fontSize: 11, padding: '2px 6px', marginTop: 6 }}
          onClick={() => onMarkRead(notification.id)}
        >
          Mark read
        </button>
      )}
    </div>
  );
}

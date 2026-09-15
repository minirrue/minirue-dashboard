'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiAdminListNotifications, type AdminNotification } from '@/lib/api/notifications';
import { apiSupportConversations, type ConversationDto } from '@/lib/api/support';
import type { ApiError } from '@/lib/api/client';

/**
 * STAFF's Overview (#74, owner 2026-09-15): "his overview is the notifications
 * and his own support." Deliberately small — two panels, existing API
 * clients only (apiAdminListNotifications, apiSupportConversations), no new
 * backend endpoints. `apiSupportConversations` has no "assigned to me"
 * filter today (ConversationDto carries no `assignedStaffId`), so this shows
 * the same inbox list the Support tab does, most-recent-first, rather than a
 * caller-scoped query that doesn't exist yet.
 */
export default function StaffOverview() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiAdminListNotifications({ limit: 6, sort: 'newest' }),
      apiSupportConversations(),
    ])
      .then(([notifRes, convos]) => {
        setNotifications(Array.isArray(notifRes?.data) ? notifRes.data : []);
        setConversations(Array.isArray(convos) ? convos.slice(0, 6) : []);
      })
      .catch((e) => setError((e as ApiError).message ?? 'Failed to load your overview'))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <div className="dash-card">
        <p className="dash-inline-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="dash-overview-cols">
      <div className="dash-panel" style={{ animationDelay: '160ms' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <h3 className="dash-panel-title" style={{ margin: 0 }}>Notifications</h3>
          <button className="dash-btn-ghost" onClick={() => router.push('/notifications')}>
            View all →
          </button>
        </div>
        {loading ? (
          <div className="dash-panel-empty">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="dash-panel-empty">You&rsquo;re all caught up — no notifications.</div>
        ) : (
          notifications.map((n, i) => (
            <div
              key={n.id}
              className="dash-attn-row"
              style={{ cursor: 'pointer', animationDelay: `${200 + i * 45}ms` }}
              onClick={() => router.push('/notifications')}
            >
              <div className="dash-attn-text">
                {!n.isRead && <span aria-hidden="true" style={{ marginRight: 6 }}>•</span>}
                {n.title}
              </div>
              <span className="dash-status" data-status={n.severity === 'CRITICAL' ? 'danger' : n.severity === 'WARNING' ? 'warn' : 'ok'}>
                {n.category.toLowerCase()}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="dash-panel" style={{ animationDelay: '220ms' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <h3 className="dash-panel-title" style={{ margin: 0 }}>My conversations</h3>
          <button className="dash-btn-ghost" onClick={() => router.push('/support')}>
            Open support →
          </button>
        </div>
        {loading ? (
          <div className="dash-panel-empty">Loading…</div>
        ) : conversations.length === 0 ? (
          <div className="dash-panel-empty">No conversations yet.</div>
        ) : (
          conversations.map((c, i) => (
            <div
              key={c.id}
              className="dash-attn-row"
              style={{ cursor: 'pointer', animationDelay: `${260 + i * 45}ms` }}
              onClick={() => router.push('/support')}
            >
              <div className="dash-attn-text">
                {c.customerName || c.guestName || c.customerEmail || c.guestEmail || 'Guest'}
                {c.lastMessagePreview ? ` — ${c.lastMessagePreview}` : ''}
              </div>
              <span className="dash-status" data-status={c.status.toLowerCase()}>
                {c.status.toLowerCase().replace(/_/g, ' ')}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import type { AdminNotification } from '@/lib/api/notifications';
import { isKnownDashboardPath } from '@/lib/auth/roles';

const SEVERITY_STATUS: Record<AdminNotification['severity'], string> = {
  INFO: 'pending',
  SUCCESS: 'delivered',
  WARNING: 'processing',
  CRITICAL: 'cancelled',
};

/** Human label + the tab it belongs to, resolved from entityType then category. */
function typeMeta(n: AdminNotification): { label: string; tab: string } {
  const et = (n.entityType ?? '').toLowerCase();
  if (et === 'support') return { label: 'Support', tab: 'Support' };
  if (et === 'order' || n.category === 'ORDER') return { label: 'Order', tab: 'Orders' };
  if (et === 'customer' || n.category === 'CUSTOMER') return { label: 'Customer', tab: 'Customers' };
  switch (n.category) {
    case 'PAYMENT': return { label: 'Payment', tab: 'Orders' };
    case 'FULFILLMENT': return { label: 'Fulfilment', tab: 'Fulfilment' };
    case 'REFUND': return { label: 'Refund', tab: 'Refunds' };
    case 'INVENTORY': return { label: 'Inventory', tab: 'Inventory' };
    case 'COLLAB': return { label: 'Collaborator', tab: 'Collaborators' };
    default: return { label: 'System', tab: 'Notifications' };
  }
}

/**
 * entityType/category → clean dashboard URL (support carries the conversation id).
 *
 * Every candidate goes through `reachable`, which drops anything this app does
 * not actually serve. The stored `link` is the reason: it is a free-form column
 * writable by any caller of the create endpoint, and it was rendered straight
 * into `<Link href>`. A row naming a path with no page navigated to a hard 404
 * — reported 2026-08-21 as the Notifications tab "crashing to /logout", which
 * exists nowhere in this repo.
 *
 * Role is deliberately NOT consulted here. A row is a leaf rendered in a list
 * and in the bell drawer; giving it its own identity query would make every
 * row a data-fetching component for a check the dashboard layout already
 * performs — it renders AccessDeniedPanel for any route the role cannot open,
 * however the operator got there.
 */
function resolveHref(n: AdminNotification): string | null {
  const reachable = (href: string | null): string | null =>
    href && isKnownDashboardPath(href) ? href : null;

  const et = (n.entityType ?? '').toLowerCase();
  const convId =
    n.data && typeof n.data.conversationId === 'string' ? (n.data.conversationId as string) : null;
  if (et === 'support')
    return reachable(convId ? `/support?c=${encodeURIComponent(convId)}` : '/support');
  if (et === 'customer' && n.entityId) return reachable(`/customers/${n.entityId}`);
  if ((et === 'order' || n.category === 'ORDER') && n.entityId)
    return reachable(`/orders/${n.entityId}`);
  // The stored `link` is free-form and writable by any caller of the create
  // endpoint — validated, never trusted. See isKnownDashboardPath.
  if (n.link) {
    const vetted = reachable(n.link);
    if (vetted) return vetted;
    // A bad stored link falls through to the category default rather than
    // rendering a dead View button.
  }
  return reachable(categoryHref(n.category));
}

function categoryHref(category: AdminNotification['category']): string {
  switch (category) {
    case 'CUSTOMER': return '/customers';
    case 'ORDER':
    case 'PAYMENT': return '/orders';
    case 'FULFILLMENT': return '/fulfillment';
    case 'REFUND': return '/refunds';
    case 'INVENTORY': return '/inventory';
    case 'COLLAB': return '/collab';
    // Never null: a notification with nowhere to go renders as an inert row
    // with no View button, which reads as broken rather than as informational.
    // The notification centre is always a truthful destination.
    default: return '/notifications';
  }
}

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
  onToggleRead,
}: {
  notification: AdminNotification;
  onToggleRead: (id: number, isRead: boolean) => void;
}) {
  const meta = typeMeta(notification);
  const href = resolveHref(notification);
  const unread = !notification.isRead;

  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {unread && (
          <span
            aria-label="Unread"
            style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: 'var(--mr-accent, #6d28d9)',
            }}
          />
        )}
        <span className="dash-status" data-status={SEVERITY_STATUS[notification.severity]}>
          <span className="dash-status-dot" />
          {meta.label}
        </span>
        <span style={{ color: 'var(--mr-fg-4)', fontSize: 11 }}>from {meta.tab}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--mr-fg-4)', fontSize: 11 }}>
          {relativeTime(notification.createdAt)}
        </span>
      </div>
      <div
        style={{
          fontWeight: unread ? 650 : 400,
          color: unread ? 'var(--mr-fg)' : 'var(--mr-fg-3)',
          fontSize: 14,
        }}
      >
        {notification.title}
      </div>
      <div style={{ color: unread ? 'var(--mr-fg-3)' : 'var(--mr-fg-4)', fontSize: 13, marginTop: 2 }}>
        {notification.body}
      </div>
    </>
  );

  return (
    <div
      className="dash-notif-item"
      data-unread={unread ? 'true' : undefined}
      style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--mr-dash-hair)',
        background: unread ? 'var(--mr-dash-raise, rgba(109,40,217,0.05))' : 'transparent',
        opacity: unread ? 1 : 0.72,
      }}
    >
      {href ? (
        <Link
          href={href}
          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          onClick={() => { if (unread) onToggleRead(notification.id, false); }}
        >
          {body}
        </Link>
      ) : (
        body
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {href && (
          <Link
            href={href}
            className="dash-btn-ghost"
            style={{ fontSize: 11, padding: '2px 8px', textDecoration: 'none' }}
            onClick={() => { if (unread) onToggleRead(notification.id, false); }}
          >
            View
          </Link>
        )}
        <button
          type="button"
          className="dash-btn-ghost"
          style={{ fontSize: 11, padding: '2px 8px' }}
          onClick={() => onToggleRead(notification.id, notification.isRead)}
        >
          {notification.isRead ? 'Mark unread' : 'Mark read'}
        </button>
      </div>
    </div>
  );
}

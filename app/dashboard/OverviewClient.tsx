'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGetAnalyticsOverview } from '@/lib/api/analytics';
import { apiAdminListOrders } from '@/lib/api/orders';
import { canAccessDashboardRoute } from '@/lib/auth/roles';
import { useUser } from '@/lib/hooks/use-auth';
import DashboardRoleWelcome from '@/components/dashboard/DashboardRoleWelcome';
import type { AnalyticsOverview } from '@/lib/api/analytics';
import type { Order } from '@/lib/api/orders';
import type { ApiError } from '@/lib/api/client';

function egpShort(cents: number): string {
  const val = cents / 100;
  if (val >= 1_000_000) return `EGP ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `EGP ${(val / 1_000).toFixed(1)}K`;
  return `EGP ${val.toLocaleString('en-EG', { minimumFractionDigits: 2 })}`;
}

const ORDER_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PENDING:    { bg: 'var(--mr-st-warn-bg)',   fg: 'var(--mr-st-warn-fg)' },
  CONFIRMED:  { bg: 'var(--mr-st-info-bg)',   fg: 'var(--mr-st-info-fg)' },
  PROCESSING: { bg: 'var(--mr-st-info-bg)',   fg: 'var(--mr-st-info-fg)' },
  SHIPPED:    { bg: 'var(--mr-st-ok-bg)',     fg: 'var(--mr-st-ok-fg)' },
  DELIVERED:  { bg: 'var(--mr-st-ok-bg)',     fg: 'var(--mr-st-ok-fg)' },
  CANCELLED:  { bg: 'var(--mr-st-danger-bg)', fg: 'var(--mr-st-danger-fg)' },
};

function SkeletonStatCards() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="dash-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="dash-skeleton" style={{ display: 'block', width: '70%', height: 11 }} />
          <span className="dash-skeleton" style={{ display: 'block', width: '50%', height: 26 }} />
        </div>
      ))}
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--mr-border)' }}>
        <span className="dash-skeleton" style={{ display: 'block', width: 120, height: 14 }} />
      </div>
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>{['Order #', 'Customer', 'Status', 'Total', 'Date'].map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 5 }).map((_, j) => (
                  <td key={j}><span className="dash-skeleton" style={{ display: 'block', width: j === 0 ? 80 : 60, height: 13 }} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function OverviewClient() {
  const router = useRouter();
  const { data: user } = useUser();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const canAnalytics = canAccessDashboardRoute(user.role, '/dashboard/analytics');

    Promise.all([
      canAnalytics ? apiGetAnalyticsOverview() : Promise.resolve(null),
      apiAdminListOrders({ limit: 6 }),
    ])
      .then(([ov, ord]) => {
        setOverview(ov);
        setOrders(ord.data);
      })
      .catch((e) => setError((e as ApiError).message ?? 'Failed to load overview'))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <SkeletonStatCards />
        <SkeletonTable />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="dash-card">
        <p className="dash-inline-error">{error ?? 'Unable to load your session.'}</p>
      </div>
    );
  }

  const canAnalytics = canAccessDashboardRoute(user.role, '/dashboard/analytics');
  const displayName = user.name?.trim() || user.email.split('@')[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <DashboardRoleWelcome userName={displayName} role={user.role} />

      {!canAnalytics ? (
        <div className="dash-role-notice">
          Analytics and revenue summaries are limited to owner and staff roles. Catalog, customers, and
          settings remain available in the sidebar.
        </div>
      ) : null}

      {overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {[
            { label: 'Revenue today', value: egpShort(overview.revenue.today_cents) },
            { label: 'Revenue this week', value: egpShort(overview.revenue.week_cents) },
            { label: 'Pending orders', value: String(overview.orders.pending_count) },
            { label: 'New customers (week)', value: String(overview.customers.new_week) },
          ].map(({ label, value }) => (
            <div key={label} className="dash-card dash-stat-card">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="dash-section-title" style={{ margin: 0 }}>{label}</span>
                <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--mr-fg)', lineHeight: 1 }}>{value}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--mr-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="dash-section-title" style={{ margin: 0 }}>Recent Orders</h2>
          <button className="dash-btn-ghost" onClick={() => router.push('/dashboard/orders')}>View all →</button>
        </div>
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={5} className="dash-table-empty">No orders yet.</td></tr>
              ) : (
                orders.map((o) => {
                  const colors = ORDER_STATUS_COLORS[o.status] ?? ORDER_STATUS_COLORS.PENDING;
                  return (
                    <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/dashboard/orders/${o.id}`)}>
                      <td><code style={{ fontSize: 12 }}>{o.orderNumber}</code></td>
                      <td style={{ fontSize: 13, color: 'var(--mr-fg-2)' }}>{o.shippingAddressSnapshot.fullName}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 4, background: colors.bg, color: colors.fg, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {o.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 600 }}>
                        {o.totalCurrency} {parseFloat(o.totalAmount).toLocaleString('en-EG', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--mr-fg-4)', whiteSpace: 'nowrap' }}>
                        {new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

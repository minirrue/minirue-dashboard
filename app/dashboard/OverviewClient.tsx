'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  apiGetAnalyticsOverview,
  apiGetRevenueSeries,
  apiGetTopProducts,
} from '@/lib/api/analytics';
import { apiAdminListOrders } from '@/lib/api/orders';
import { canAccessDashboardRoute } from '@/lib/auth/roles';
import { useUser } from '@/lib/hooks/use-auth';
import DashboardRoleWelcome from '@/components/dashboard/DashboardRoleWelcome';
import type { AnalyticsOverview, RevenuePoint, TopProduct } from '@/lib/api/analytics';
import type { Order } from '@/lib/api/orders';
import type { ApiError } from '@/lib/api/client';

/* ── formatting ─────────────────────────────────────────── */
function egpShort(cents: number): string {
  const val = cents / 100;
  if (val >= 1_000_000) return `EGP ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `EGP ${(val / 1_000).toFixed(1)}K`;
  return `EGP ${val.toLocaleString('en-EG', { minimumFractionDigits: 2 })}`;
}

/* ── sparkline geometry — matches design viewBox 0 0 140 28 ── */
function sparkPoints(values: number[]): string {
  if (values.length < 2) return '';
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const n = values.length;
  return values
    .map((v, i) => {
      const x = (i / (n - 1)) * 140;
      const y = 26 - ((v - min) / span) * 24; // padded 2..26, inverted
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

type Trend = 'up' | 'down';
function pctChange(first: number, last: number): { label: string; trend: Trend } | null {
  if (first <= 0) return null;
  const p = ((last - first) / first) * 100;
  const up = p >= 0;
  return { label: `${up ? '+' : '−'} ${Math.abs(p).toFixed(1)}%`, trend: up ? 'up' : 'down' };
}

const ORDER_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PENDING:    { bg: 'var(--mr-st-warn-bg)',   fg: 'var(--mr-st-warn-fg)' },
  CONFIRMED:  { bg: 'var(--mr-st-info-bg)',   fg: 'var(--mr-st-info-fg)' },
  PROCESSING: { bg: 'var(--mr-st-info-bg)',   fg: 'var(--mr-st-info-fg)' },
  SHIPPED:    { bg: 'var(--mr-st-ok-bg)',     fg: 'var(--mr-st-ok-fg)' },
  DELIVERED:  { bg: 'var(--mr-st-ok-bg)',     fg: 'var(--mr-st-ok-fg)' },
  CANCELLED:  { bg: 'var(--mr-st-danger-bg)', fg: 'var(--mr-st-danger-fg)' },
};

/* ── trend arrow ────────────────────────────────────────── */
function TrendArrow({ up }: { up: boolean }) {
  return (
    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      {up ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}
    </svg>
  );
}

/* ── metric card — design AnimatedMetric, real data ─────── */
interface MetricProps {
  eyebrow: string;
  value: string;
  index: number;
  spark?: string;
  delta?: string | null;
  trend?: Trend;
  sub?: string;
}
function MetricCard({ eyebrow, value, index, spark, delta, trend = 'up', sub }: MetricProps) {
  return (
    <div className="dash-metric" style={{ animationDelay: `${100 + index * 60}ms` }}>
      <div className="dash-metric-eyebrow">{eyebrow}</div>
      <div className="dash-metric-row">
        <div className="dash-metric-value mr-num">{value}</div>
        {delta ? (
          <span className="dash-metric-delta" data-trend={trend}>
            <TrendArrow up={trend === 'up'} />
            {delta}
          </span>
        ) : null}
      </div>
      {spark ? (
        <svg className="dash-metric-spark" viewBox="0 0 140 28" preserveAspectRatio="none">
          <polyline
            points={spark}
            fill="none"
            stroke={trend === 'down' ? 'var(--mr-crimson-500)' : 'var(--mr-gold-500)'}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      ) : sub ? (
        <div className="dash-metric-sub">{sub}</div>
      ) : (
        <div style={{ height: 28 }} />
      )}
    </div>
  );
}

/* ── skeletons ──────────────────────────────────────────── */
function SkeletonMetrics() {
  return (
    <div className="dash-metric-grid">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="dash-metric" style={{ animation: 'none' }}>
          <span className="dash-skeleton" style={{ display: 'block', width: '55%', height: 10 }} />
          <span className="dash-skeleton" style={{ display: 'block', width: '45%', height: 26, marginTop: 4 }} />
          <span className="dash-skeleton" style={{ display: 'block', width: '100%', height: 20, marginTop: 4 }} />
        </div>
      ))}
    </div>
  );
}
function SkeletonTable() {
  return (
    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--mr-dash-hair)' }}>
        <span className="dash-skeleton" style={{ display: 'block', width: 140, height: 16 }} />
      </div>
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>{['Order', 'Customer', 'Item', 'Date', 'Status', 'Total'].map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
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
  const [series, setSeries] = useState<RevenuePoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const canAnalytics = canAccessDashboardRoute(user.role, '/dashboard/analytics');

    Promise.all([
      canAnalytics ? apiGetAnalyticsOverview().catch(() => null) : Promise.resolve(null),
      apiAdminListOrders({ limit: 6 }),
      canAnalytics ? apiGetRevenueSeries('7d').catch(() => [] as RevenuePoint[]) : Promise.resolve([] as RevenuePoint[]),
      canAnalytics ? apiGetTopProducts(4).catch(() => [] as TopProduct[]) : Promise.resolve([] as TopProduct[]),
    ])
      .then(([ov, ord, rev, top]) => {
        setOverview(ov);
        setOrders(ord.data);
        setSeries(rev);
        setTopProducts(top);
      })
      .catch((e) => setError((e as ApiError).message ?? 'Failed to load overview'))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <SkeletonMetrics />
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

  /* ── metric cards (real data) ── */
  const revSpark = sparkPoints(series.map((p) => p.total_cents));
  const revDelta =
    series.length >= 2 ? pctChange(series[0].total_cents, series[series.length - 1].total_cents) : null;

  const metrics: MetricProps[] = overview
    ? [
        {
          eyebrow: 'Revenue · 7d',
          value: egpShort(overview.revenue.week_cents),
          spark: revSpark || undefined,
          delta: revDelta?.label ?? null,
          trend: revDelta?.trend ?? 'up',
          index: 0,
        },
        {
          eyebrow: 'Revenue · today',
          value: egpShort(overview.revenue.today_cents),
          spark: revSpark || undefined,
          trend: revDelta?.trend ?? 'up',
          index: 1,
        },
        {
          eyebrow: 'Pending orders',
          value: String(overview.orders.pending_count),
          sub: `${overview.orders.processing_count} processing · ${overview.orders.shipped_count} shipped`,
          index: 2,
        },
        {
          eyebrow: 'New customers · 7d',
          value: String(overview.customers.new_week),
          sub: `${overview.customers.new_today} today · ${overview.customers.total_active} active`,
          index: 3,
        },
      ]
    : [];

  /* ── top products (real data) ── */
  const maxRev = Math.max(...topProducts.map((t) => t.revenue_cents), 1);

  /* ── needs attention (derived from real order status counts) ── */
  const attn: { t: string; s: string }[] = [];
  if (overview) {
    const o = overview.orders;
    if (o.pending_count > 0) attn.push({ t: `${o.pending_count} order${o.pending_count > 1 ? 's' : ''} awaiting confirmation`, s: 'pending' });
    if (o.processing_count > 0) attn.push({ t: `${o.processing_count} order${o.processing_count > 1 ? 's' : ''} in processing`, s: 'processing' });
    if (o.shipped_count > 0) attn.push({ t: `${o.shipped_count} shipment${o.shipped_count > 1 ? 's' : ''} awaiting delivery`, s: 'shipped' });
    if (o.cancelled_count > 0) attn.push({ t: `${o.cancelled_count} order${o.cancelled_count > 1 ? 's' : ''} cancelled`, s: 'cancelled' });
  }
  const attnRows = attn.slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <DashboardRoleWelcome userName={displayName} role={user.role} />

      {!canAnalytics ? (
        <div className="dash-role-notice">
          Analytics and revenue summaries are limited to owner and staff roles. Catalog, customers, and
          settings remain available in the sidebar.
        </div>
      ) : null}

      {/* ── metric cards ── */}
      {metrics.length > 0 && (
        <div className="dash-metric-grid">
          {metrics.map((m) => (
            <MetricCard key={m.eyebrow} {...m} />
          ))}
        </div>
      )}

      {/* ── recent orders ── */}
      <div className="dash-card" style={{ padding: 0, overflow: 'hidden', animationDelay: '340ms' }}>
        <div className="dash-panel-head">
          <h2 className="dash-panel-title" style={{ margin: 0 }}>Recent orders</h2>
          <button className="dash-btn-ghost" onClick={() => router.push('/dashboard/orders')}>View all →</button>
        </div>
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Item</th>
                <th>Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={6} className="dash-table-empty">No orders yet.</td></tr>
              ) : (
                orders.map((o, i) => {
                  const colors = ORDER_STATUS_COLORS[o.status] ?? ORDER_STATUS_COLORS.PENDING;
                  const item = o.items?.[0]?.productSnapshot?.name ?? '—';
                  const extra = (o.items?.length ?? 0) > 1 ? ` +${o.items.length - 1}` : '';
                  return (
                    <tr
                      key={o.id}
                      style={{ cursor: 'pointer', animation: 'mr-fade-up 0.4s var(--mr-ease-out) both', animationDelay: `${400 + i * 45}ms` }}
                      onClick={() => router.push(`/dashboard/orders/${o.id}`)}
                    >
                      <td><code style={{ fontSize: 12, color: 'var(--mr-fg-3)' }}>{o.orderNumber}</code></td>
                      <td style={{ fontSize: 13, color: 'var(--mr-fg)' }}>{o.shippingAddressSnapshot.fullName}</td>
                      <td style={{ fontSize: 13, color: 'var(--mr-fg-2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item}{extra}</td>
                      <td style={{ fontSize: 12, color: 'var(--mr-fg-4)', whiteSpace: 'nowrap' }}>
                        {new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: colors.bg, color: colors.fg, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {o.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 700 }}>
                        {o.totalCurrency} {parseFloat(o.totalAmount).toLocaleString('en-EG', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── top products + needs attention ── */}
      {canAnalytics && (
        <div className="dash-overview-cols">
          <div className="dash-panel" style={{ animationDelay: '520ms' }}>
            <h3 className="dash-panel-title">Top products · 7 days</h3>
            {topProducts.length === 0 ? (
              <div className="dash-panel-empty">No sales data yet.</div>
            ) : (
              topProducts.map((p, i) => (
                <div key={p.product_id} className="dash-toprow" style={{ animationDelay: `${560 + i * 50}ms` }}>
                  <div className="dash-toprow-head">
                    <div style={{ minWidth: 0 }}>
                      <div className="dash-toprow-name">{p.product_name}</div>
                      <div className="dash-toprow-units">{p.quantity_sold} units</div>
                    </div>
                    <div className="dash-toprow-rev">{egpShort(p.revenue_cents)}</div>
                  </div>
                  <div className="dash-toprow-track">
                    <div
                      className="dash-toprow-fill"
                      style={{ width: `${Math.max(4, (p.revenue_cents / maxRev) * 100)}%`, animationDelay: `${600 + i * 60}ms` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="dash-panel" style={{ animationDelay: '580ms' }}>
            <h3 className="dash-panel-title">Needs attention</h3>
            {attnRows.length === 0 ? (
              <div className="dash-panel-empty">All clear — nothing needs attention.</div>
            ) : (
              attnRows.map((x, i) => (
                <div key={x.t} className="dash-attn-row" style={{ animationDelay: `${620 + i * 55}ms` }}>
                  <div className="dash-attn-text">{x.t}</div>
                  <span className="dash-status" data-status={x.s}>{x.s.replace(/_/g, ' ')}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

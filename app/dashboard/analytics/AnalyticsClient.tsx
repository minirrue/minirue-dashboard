'use client';

import React, {useState, useCallback } from 'react';
import {
  apiGetAnalyticsOverview,
  apiGetRevenueSeries,
  apiGetTopProducts,
  apiGetOrdersFunnel,
} from '@/lib/api/analytics';
import type { AnalyticsOverview, RevenuePoint, TopProduct, OrdersFunnel } from '@/lib/api/analytics';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

function egp(cents: number): string {
  return `EGP ${(cents / 100).toLocaleString('en-EG', { minimumFractionDigits: 2 })}`;
}
function egpShort(cents: number): string {
  const val = cents / 100;
  if (val >= 1_000_000) return `EGP ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `EGP ${(val / 1_000).toFixed(1)}K`;
  return egp(cents);
}

function StatCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="dash-card dash-stat-card">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="dash-section-title" style={{ margin: 0 }}>{title}</span>
        <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--mr-fg)', lineHeight: 1 }}>{value}</span>
        {sub && <span style={{ fontSize: 12, color: 'var(--mr-fg-4)' }}>{sub}</span>}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="dash-card dash-stat-card">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <span className="dash-skeleton" style={{ width: 100, height: 13 }} />
        <span className="dash-skeleton" style={{ width: 140, height: 28 }} />
      </div>
    </div>
  );
}

function RevenueChart({ points }: { points: RevenuePoint[] }) {
  const safePoints = Array.isArray(points) ? points : [];
  const max = Math.max(...safePoints.map((p) => p.total_cents || 0), 1);
  const visible = safePoints.slice(-30);

  return (
    <div className="dash-card" style={{ padding: '16px 20px' }}>
      <p className="dash-section-title" style={{ marginBottom: 12 }}>Revenue — last 30 days</p>
      {visible.length === 0 ? (
        <p style={{ color: 'var(--mr-fg-4)', fontSize: 14 }}>No revenue data available.</p>
      ) : (
        <table className="dash-revenue-chart">
          <tbody>
            {visible.map((p) => (
              <tr key={p.date}>
                <td style={{ color: 'var(--mr-fg-3)', fontSize: 12, whiteSpace: 'nowrap', paddingRight: 12 }}>
                  {new Date(p.date).toLocaleDateString('en-EG', { month: 'short', day: 'numeric' })}
                </td>
                <td className="dash-revenue-bar-cell">
                  <div className="dash-revenue-bar-track">
                    <div className="dash-revenue-bar-fill" style={{ transform: `scaleX(${(p.total_cents / max).toFixed(4)})` }} />
                  </div>
                </td>
                <td style={{ textAlign: 'right', paddingLeft: 12, color: 'var(--mr-fg-2)', whiteSpace: 'nowrap' }}>
                  {egpShort(p.total_cents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TopProductsTable({ products: rawProducts }: { products: TopProduct[] }) {
  const products = Array.isArray(rawProducts) ? rawProducts : [];
  if (products.length === 0) {
    return (
      <div className="dash-card">
        <p style={{ color: 'var(--mr-fg-4)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>No product sales data yet.</p>
      </div>
    );
  }
  return (
    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 0' }}>
        <p className="dash-section-title">Top 5 Products</p>
      </div>
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th style={{ textAlign: 'right' }}>Units Sold</th>
              <th style={{ textAlign: 'right' }}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {products.slice(0, 5).map((p, i) => (
              <tr key={p.product_id}>
                <td style={{ color: 'var(--mr-fg-4)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</td>
                <td>{p.product_name}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Number(p.quantity_sold).toLocaleString()}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{egp(p.revenue_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrdersFunnelPanel({ funnel }: { funnel: OrdersFunnel }) {
  const steps = [
    { label: 'Carts created', value: funnel.carts_created || 0 },
    { label: 'Orders placed', value: funnel.orders_placed || 0 },
    { label: 'Orders paid', value: funnel.orders_paid || 0 },
    { label: 'Orders fulfilled', value: funnel.orders_fulfilled || 0 },
  ];
  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <div className="dash-card" style={{ padding: '16px 20px' }}>
      <p className="dash-section-title" style={{ marginBottom: 12 }}>Checkout funnel</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map((step) => (
          <div key={step.label} style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--mr-fg-3)' }}>{step.label}</span>
            <div className="dash-revenue-bar-track">
              <div
                className="dash-revenue-bar-fill"
                style={{ transform: `scaleX(${(step.value / max).toFixed(4)})`, opacity: 0.85 }}
              />
            </div>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--mr-fg-2)', minWidth: 48, textAlign: 'right' }}>
              {step.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 14, fontSize: 12, color: 'var(--mr-fg-4)' }}>
        Cart → paid: {(funnel.conversion_to_paid || 0).toFixed(1)}% · Paid → fulfilled: {(funnel.conversion_to_fulfilled || 0).toFixed(1)}%
      </p>
    </div>
  );
}

export default function AnalyticsClient() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [funnel, setFunnel] = useState<OrdersFunnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, rev, top, fn] = await Promise.all([
        apiGetAnalyticsOverview(),
        apiGetRevenueSeries('30d'),
        apiGetTopProducts(5),
        apiGetOrdersFunnel(),
      ]);
      setOverview(ov);
      setRevenue(rev);
      setTopProducts(top);
      setFunnel(fn);
    } catch (e) {
      setError((e as ApiError).message ?? 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useMountedEffect(() => { load(); }, [load]);

  const totalOrders = overview?.orders
    ? Object.values(overview.orders).reduce((a, b) => a + (b || 0), 0)
    : 0;

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Analytics</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        {loading ? (
          <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
        ) : error ? (
          <div className="dash-card" style={{ gridColumn: '1/-1' }}>
            <p className="dash-inline-error">{error}</p>
            <button className="dash-btn-secondary" style={{ marginTop: 12 }} onClick={load}>Retry</button>
          </div>
        ) : overview ? (
          <>
            <StatCard title="Revenue Today" value={egpShort(overview.revenue?.today_cents || 0)} sub={`This week: ${egpShort(overview.revenue?.week_cents || 0)}`} />
            <StatCard title="Revenue This Month" value={egpShort(overview.revenue?.month_cents || 0)} />
            <StatCard title="Total Orders" value={totalOrders.toLocaleString()} sub={`${overview.orders?.delivered_count || 0} delivered`} />
            <StatCard title="New Customers (Week)" value={(overview.customers?.new_week || 0).toLocaleString()} sub={`${overview.customers?.total_active || 0} total active`} />
          </>
        ) : null}
      </div>

      {!loading && !error && (
        <div style={{ marginBottom: 20 }}>
          <RevenueChart points={revenue} />
        </div>
      )}

      {!loading && !error && funnel && (
        <div style={{ marginBottom: 20 }}>
          <OrdersFunnelPanel funnel={funnel} />
        </div>
      )}

      {!loading && !error && (
        <TopProductsTable products={topProducts} />
      )}
    </>
  );
}

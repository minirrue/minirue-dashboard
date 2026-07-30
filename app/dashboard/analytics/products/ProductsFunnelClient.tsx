'use client';

import React from 'react';
import Link from 'next/link';
import AnalyticsSubnav from '@/components/dashboard/AnalyticsSubnav';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';
import { HorizontalBar } from '@/components/dashboard/charts';
import { useAnalyticsRange, useProductsTop } from '@/lib/hooks/use-analytics';
import type { AnalyticsRangeState } from '@/lib/hooks/use-analytics';
import { egp } from '@/lib/api/analytics-insights';
import type { AnalyticsFreshness, ProductMetric } from '@/lib/api/analytics-insights';

function RangeControl({
  range,
  onChange,
}: {
  range: AnalyticsRangeState;
  onChange: (next: Partial<AnalyticsRangeState>) => void;
}) {
  return (
    <div className="dash-filters" style={{ marginBottom: 20 }}>
      <label className="dash-field" style={{ maxWidth: 160 }}>
        <span className="dash-label">From</span>
        <input type="date" className="dash-input" value={range.from} max={range.to} onChange={(e) => onChange({ from: e.target.value })} />
      </label>
      <label className="dash-field" style={{ maxWidth: 160 }}>
        <span className="dash-label">To</span>
        <input type="date" className="dash-input" value={range.to} min={range.from} onChange={(e) => onChange({ to: e.target.value })} />
      </label>
      <label className="dash-checkbox-label" style={{ marginLeft: 8 }}>
        <input type="checkbox" className="dash-checkbox" checked={range.compare} onChange={(e) => onChange({ compare: e.target.checked })} />
        Compare to previous period
      </label>
    </div>
  );
}

function FreshnessNote({ freshness }: { freshness: AnalyticsFreshness }) {
  if (!freshness.rollupLastOkAt) return null;
  const minutesAgo = Math.max(0, Math.round((Date.now() - new Date(freshness.rollupLastOkAt).getTime()) / 60_000));
  const label = minutesAgo === 0 ? 'just now' : `${minutesAgo} minute${minutesAgo === 1 ? '' : 's'} ago`;
  return (
    <p style={{ fontSize: 12, color: 'var(--mr-fg-4)', margin: '4px 0 0' }}>
      Updated {label}
      {freshness.staleBuckets > 0 && ` · ${freshness.staleBuckets} bucket${freshness.staleBuckets === 1 ? '' : 's'} still catching up`}
    </p>
  );
}

function ScreenSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="dash-card" style={{ height: 220 }}>
        <span className="dash-skeleton" style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}

function ScreenError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="dash-card" style={{ padding: 32, textAlign: 'center' }}>
      <p className="dash-inline-error" style={{ display: 'inline-block' }}>{message}</p>
      <div style={{ marginTop: 12 }}>
        <button className="dash-btn-secondary" onClick={onRetry}>Retry</button>
      </div>
    </div>
  );
}

function ScreenEmpty({ message }: { message: string }) {
  return (
    <div className="dash-card" style={{ padding: 32, textAlign: 'center' }}>
      <p className="dash-help-text" style={{ margin: 0 }}>{message}</p>
    </div>
  );
}

const PRODUCT_COLUMNS: Column<ProductMetric>[] = [
  {
    key: 'productName',
    label: 'Product',
    render: (row) => (
      <Link href={`/analytics/products/${encodeURIComponent(row.productId)}`} className="dash-link">
        {row.productName}
      </Link>
    ),
  },
  { key: 'views', label: 'Views', align: 'right', sortable: true },
  { key: 'addToCart', label: 'Added to cart', align: 'right', sortable: true },
  { key: 'purchases', label: 'Purchases', align: 'right', sortable: true },
  {
    key: 'revenueMinor',
    label: 'Revenue',
    align: 'right',
    sortable: true,
    render: (row) => egp(row.revenueMinor),
  },
];

export default function ProductsFunnelClient() {
  const { range, setRange } = useAnalyticsRange();
  const products = useProductsTop(range);

  const rows = products.data?.data ?? [];
  const noHistory = products.data ? !products.data.freshness.rollupLastOkAt : false;

  return (
    <>
      <AnalyticsSubnav />
      <div className="dash-page-header">
        <h1 className="dash-page-title">Products</h1>
      </div>
      <RangeControl range={range} onChange={setRange} />

      {products.isLoading ? (
        <ScreenSkeleton />
      ) : products.isError ? (
        <ScreenError
          message={products.error?.message ?? 'Product data could not load.'}
          onRetry={() => void products.refetch()}
        />
      ) : noHistory ? (
        <ScreenEmpty message="Analytics isn't collecting data yet. Once tracking is live, figures will show up here." />
      ) : (
        <>
          {products.data && <FreshnessNote freshness={products.data.freshness} />}

          {/* HorizontalBar is a self-contained dash-card (title, table
              toggle, and its own "No data for this period." empty state via
              ChartFrame) — no wrapper card or duplicate heading needed. */}
          <div style={{ margin: '20px 0' }}>
            <HorizontalBar
              data={rows.slice(0, 10)}
              label={(p) => p.productName}
              value={(p) => p.purchases}
              title="Top products by purchases"
            />
          </div>

          <DashboardTable<ProductMetric>
            columns={PRODUCT_COLUMNS}
            data={rows}
            emptyMessage="No product activity in this range."
            tableTraceId="PG-DASHBOARD-ANL-PRODUCTS::EL-TABLE-top-products"
            getRowTraceId={(row) => `PG-DASHBOARD-ANL-PRODUCTS::EL-ROW-product@${row.productId}`}
          />
        </>
      )}
    </>
  );
}

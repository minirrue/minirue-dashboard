'use client';

import React from 'react';
import Link from 'next/link';
import AnalyticsSubnav from '@/components/dashboard/AnalyticsSubnav';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';
import { Funnel } from '@/components/dashboard/charts';
import { useAnalyticsRange, useProductFunnel } from '@/lib/hooks/use-analytics';
import type { AnalyticsRangeState } from '@/lib/hooks/use-analytics';
import { egp } from '@/lib/api/analytics-insights';
import type { ProductFunnel } from '@/lib/api/analytics-insights';

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

function ScreenSkeleton() {
  return (
    <div className="dash-card" style={{ height: 260 }}>
      <span className="dash-skeleton" style={{ width: '100%', height: '100%' }} />
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

/**
 * The real `products/{id}/funnel` response has no `stages` — it's a daily
 * series plus a variant split and a source split (see lane-16 report). This
 * screen's "view → cart → purchase" funnel is derived by summing the real
 * per-day series, not invented: every count below is a genuine total from
 * `series`, just aggregated client-side instead of pre-aggregated server-side.
 */
function deriveFunnelStages(series: ProductFunnel['series']) {
  const totals = series.reduce(
    (acc, s) => ({
      views: acc.views + s.views,
      addToCarts: acc.addToCarts + s.addToCarts,
      beginCheckouts: acc.beginCheckouts + s.beginCheckouts,
      purchases: acc.purchases + s.purchases,
    }),
    { views: 0, addToCarts: 0, beginCheckouts: 0, purchases: 0 },
  );
  return [
    { label: 'Viewed', value: totals.views },
    { label: 'Added to cart', value: totals.addToCarts },
    { label: 'Began checkout', value: totals.beginCheckouts },
    { label: 'Purchased', value: totals.purchases },
  ];
}

const VARIANT_COLUMNS: Column<ProductFunnel['variantSplit'][number]>[] = [
  { key: 'variantId', label: 'Variant' },
  { key: 'addToCarts', label: 'Added to cart', align: 'right', sortable: true },
  { key: 'purchases', label: 'Purchases', align: 'right', sortable: true },
  { key: 'revenueMinor', label: 'Revenue', align: 'right', sortable: true, render: (row) => egp(row.revenueMinor) },
];

const SOURCE_COLUMNS: Column<ProductFunnel['sourceSplit'][number]>[] = [
  { key: 'channel', label: 'Channel' },
  { key: 'purchases', label: 'Purchases', align: 'right', sortable: true },
  { key: 'revenueMinor', label: 'Revenue', align: 'right', sortable: true, render: (row) => egp(row.revenueMinor) },
];

export default function ProductFunnelDetailClient({ productId }: { productId: string }) {
  const { range, setRange } = useAnalyticsRange();
  const funnel = useProductFunnel(productId, range);

  const series = funnel.data?.data.series ?? [];
  const stages = deriveFunnelStages(series);
  const variantSplit = funnel.data?.data.variantSplit ?? [];
  const sourceSplit = funnel.data?.data.sourceSplit ?? [];
  const noHistory = funnel.data ? !funnel.data.freshness.rollupLastOkAt : false;
  const productLabel = funnel.data?.data.name ?? productId;

  return (
    <>
      <AnalyticsSubnav />
      <div className="dash-page-header">
        <h1 className="dash-page-title">{funnel.data ? productLabel : `Product ${productId}`}</h1>
        <Link href="/analytics/products" className="dash-btn-secondary">Back to products</Link>
      </div>
      <RangeControl range={range} onChange={setRange} />

      {funnel.isLoading ? (
        <ScreenSkeleton />
      ) : funnel.isError ? (
        <ScreenError
          message={funnel.error?.message ?? 'Funnel data could not load.'}
          onRetry={() => void funnel.refetch()}
        />
      ) : noHistory ? (
        <ScreenEmpty message="Analytics isn't collecting data yet. Once tracking is live, figures will show up here." />
      ) : (
        <>
          {/* Funnel is a self-contained dash-card (title, table toggle, and
              its own "No data for this period." empty state via ChartFrame)
              — no wrapper card or duplicate heading needed. */}
          <Funnel stages={stages} title={`${productLabel}: view → cart → purchase`} />

          <p className="dash-section-title" style={{ margin: '20px 0 12px' }}>By variant</p>
          <DashboardTable
            columns={VARIANT_COLUMNS}
            data={variantSplit}
            emptyMessage="No variant activity in this range."
            tableTraceId="PG-DASHBOARD-ANL-PRODUCT-FUNNEL::EL-TABLE-variants"
          />

          <p className="dash-section-title" style={{ margin: '20px 0 12px' }}>By traffic channel</p>
          <DashboardTable
            columns={SOURCE_COLUMNS}
            data={sourceSplit}
            emptyMessage="No purchases from a known channel in this range."
            tableTraceId="PG-DASHBOARD-ANL-PRODUCT-FUNNEL::EL-TABLE-sources"
          />
        </>
      )}
    </>
  );
}

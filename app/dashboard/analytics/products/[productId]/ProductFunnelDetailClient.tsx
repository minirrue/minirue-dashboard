'use client';

import React from 'react';
import Link from 'next/link';
import AnalyticsSubnav from '@/components/dashboard/AnalyticsSubnav';
import { Funnel } from '@/components/dashboard/charts';
import { useAnalyticsRange, useProductFunnel } from '@/lib/hooks/use-analytics';
import type { AnalyticsRangeState } from '@/lib/hooks/use-analytics';

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

export default function ProductFunnelDetailClient({ productId }: { productId: string }) {
  const { range, setRange } = useAnalyticsRange();
  const funnel = useProductFunnel(productId, range);

  const stages = funnel.data?.data.stages ?? [];
  const noHistory = funnel.data ? !funnel.data.freshness.rollupLastOkAt : false;

  return (
    <>
      <AnalyticsSubnav />
      <div className="dash-page-header">
        <h1 className="dash-page-title">
          {funnel.data ? funnel.data.data.productName : `Product ${productId}`}
        </h1>
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
        // Funnel is a self-contained dash-card (title, table toggle, and its
        // own "No data for this period." empty state via ChartFrame) — no
        // wrapper card or duplicate heading needed.
        <Funnel
          stages={stages.map((s) => ({ label: s.label, value: s.count }))}
          title={`${funnel.data?.data.productName ?? productId}: view → cart → purchase`}
        />
      )}
    </>
  );
}

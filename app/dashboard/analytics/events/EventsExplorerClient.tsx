'use client';

import React from 'react';
import AnalyticsSubnav from '@/components/dashboard/AnalyticsSubnav';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';
import { BarChart } from '@/components/dashboard/charts';
import {
  useAnalyticsRange,
  useSearchTerms,
  useDataQuality,
  usePurchaseReconciliation,
} from '@/lib/hooks/use-analytics';
import type { AnalyticsRangeState } from '@/lib/hooks/use-analytics';
import type { AnalyticsFreshness, SearchRow } from '@/lib/api/analytics-insights';

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
      <div className="dash-card" style={{ height: 200 }}>
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

const SEARCH_COLUMNS: Column<SearchRow>[] = [
  { key: 'queryText', label: 'Search term' },
  { key: 'searches', label: 'Searches', align: 'right', sortable: true },
  { key: 'zeroResultRate', label: 'Zero-result rate', align: 'right', sortable: true, render: (row) => `${(row.zeroResultRate * 100).toFixed(1)}%` },
  { key: 'resultClicks', label: 'Result clicks', align: 'right', sortable: true },
  { key: 'addToCarts', label: 'Added to cart', align: 'right', sortable: true },
];

export default function EventsExplorerClient() {
  const { range, setRange } = useAnalyticsRange();
  const search = useSearchTerms(range);
  const quality = useDataQuality(range);
  const reconciliation = usePurchaseReconciliation(range);

  const isLoading = search.isLoading || quality.isLoading || reconciliation.isLoading;
  const isError = search.isError || quality.isError || reconciliation.isError;
  const errorMessage =
    search.error?.message ?? quality.error?.message ?? reconciliation.error?.message ?? 'Event data could not load.';

  const retry = () => {
    void search.refetch();
    void quality.refetch();
    void reconciliation.refetch();
  };

  const noHistory = search.data ? !search.data.freshness.rollupLastOkAt : false;
  const terms = search.data?.data ?? [];

  return (
    <>
      <AnalyticsSubnav />
      <div className="dash-page-header">
        <h1 className="dash-page-title">Events</h1>
      </div>
      <RangeControl range={range} onChange={setRange} />

      {isLoading ? (
        <ScreenSkeleton />
      ) : isError ? (
        <ScreenError message={errorMessage} onRetry={retry} />
      ) : noHistory ? (
        <ScreenEmpty message="Analytics isn't collecting data yet. Once tracking is live, figures will show up here." />
      ) : (
        <>
          {search.data && <FreshnessNote freshness={search.data.freshness} />}

          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 16, margin: '20px 0' }}
          >
            {quality.data && (
              <>
                <div className="dash-card">
                  <span className="dash-section-title" style={{ margin: 0 }}>Total events</span>
                  <p className="mr-num" style={{ fontSize: 22, fontWeight: 700, margin: '6px 0 0' }}>
                    {quality.data.data.totalEvents.toLocaleString()}
                  </p>
                </div>
                <div className="dash-card">
                  <span className="dash-section-title" style={{ margin: 0 }}>Bot events</span>
                  <p className="mr-num" style={{ fontSize: 22, fontWeight: 700, margin: '6px 0 0' }}>
                    {quality.data.data.botEvents.toLocaleString()}
                  </p>
                  <span style={{ fontSize: 12, color: 'var(--mr-fg-4)' }}>
                    {quality.data.data.totalEvents > 0
                      ? `${((quality.data.data.botEvents / quality.data.data.totalEvents) * 100).toFixed(2)}% of total`
                      : 'No events in this range'}
                  </span>
                </div>
                <div className="dash-card">
                  <span className="dash-section-title" style={{ margin: 0 }}>Write-buffer drops</span>
                  <p className="mr-num" style={{ fontSize: 22, fontWeight: 700, margin: '6px 0 0', color: 'var(--mr-fg-4)' }}>
                    Not tracked yet
                  </p>
                  <span style={{ fontSize: 12, color: 'var(--mr-fg-4)' }}>No persisted counter exists for this yet.</span>
                </div>
              </>
            )}
            {reconciliation.data && (
              <div className="dash-card">
                <span className="dash-section-title" style={{ margin: 0 }}>Purchase reconciliation</span>
                <p className="mr-num" style={{ fontSize: 22, fontWeight: 700, margin: '6px 0 0' }}>
                  {reconciliation.data.data.healthy ? 'Reconciled' : 'Discrepancy found'}
                </p>
                <span style={{ fontSize: 12, color: 'var(--mr-fg-4)' }}>
                  {reconciliation.data.data.orders.count.toLocaleString()} orders ·{' '}
                  {reconciliation.data.data.purchaseEvents.count.toLocaleString()} tracked purchases ·{' '}
                  {reconciliation.data.data.attribution.count.toLocaleString()} attributed
                </span>
              </div>
            )}
          </div>

          {/* BarChart is a self-contained dash-card (title, table toggle,
              and its own "No data for this period." empty state via
              ChartFrame) — no wrapper card or duplicate heading needed. */}
          <div style={{ marginBottom: 20 }}>
            <BarChart
              data={terms.slice(0, 10)}
              category={(t) => t.queryText}
              series={[{ id: 'searches', label: 'Searches', y: (t) => t.searches }]}
              title="Top search terms"
            />
          </div>

          <DashboardTable<SearchRow>
            columns={SEARCH_COLUMNS}
            data={terms}
            emptyMessage="No searches in this range."
            tableTraceId="PG-DASHBOARD-ANL-EVENTS::EL-TABLE-search-terms"
          />
        </>
      )}
    </>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import AnalyticsSubnav from '@/components/dashboard/AnalyticsSubnav';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';
import { LineChart } from '@/components/dashboard/charts';
import { useAnalyticsRange, useAudienceSummary, useAudienceTimeseries, useVisitors } from '@/lib/hooks/use-analytics';
import type { AnalyticsRangeState } from '@/lib/hooks/use-analytics';
import type { AnalyticsFreshness, VisitorListRow } from '@/lib/api/analytics-insights';

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
      <div className="dash-card" style={{ padding: 0 }}>
        <span className="dash-skeleton" style={{ width: '100%', height: 200 }} />
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

const VISITOR_COLUMNS: Column<VisitorListRow>[] = [
  {
    key: 'visitorId',
    label: 'Visitor',
    render: (row) => (
      <Link href={`/analytics/visitors/${encodeURIComponent(row.visitorId)}`} className="dash-link">
        {row.visitorId}
      </Link>
    ),
  },
  { key: 'sessionCount', label: 'Sessions', align: 'right', sortable: true },
  { key: 'pageviewCount', label: 'Pageviews', align: 'right', sortable: true },
  { key: 'orderCount', label: 'Orders', align: 'right', sortable: true },
  { key: 'firstChannel', label: 'First channel' },
  { key: 'country', label: 'Country', render: (row) => row.country ?? '—' },
  {
    key: 'lastSeenAt',
    label: 'Last seen',
    render: (row) => new Date(row.lastSeenAt).toLocaleString('en-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
  },
];

export default function VisitorsClient() {
  const { range, setRange } = useAnalyticsRange();
  const summary = useAudienceSummary(range);
  const trend = useAudienceTimeseries(range);
  const visitors = useVisitors(range);

  const isLoading = summary.isLoading || trend.isLoading || visitors.isLoading;
  const isError = summary.isError || trend.isError || visitors.isError;
  const errorMessage =
    summary.error?.message ?? trend.error?.message ?? visitors.error?.message ?? 'Visitor data could not load.';

  const retry = () => {
    void summary.refetch();
    void trend.refetch();
    void visitors.refetch();
  };

  const noHistory = summary.data ? !summary.data.freshness.rollupLastOkAt : false;
  const points = trend.data?.data ?? [];

  return (
    <>
      <AnalyticsSubnav />
      <div className="dash-page-header">
        <h1 className="dash-page-title">Visitors</h1>
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
          {summary.data && (
            <div
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 16, marginBottom: 8 }}
            >
              <div className="dash-card">
                <span className="dash-section-title" style={{ margin: 0 }}>Visitors</span>
                <p className="mr-num" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 0' }}>
                  {summary.data.data.visitors.toLocaleString()}
                </p>
              </div>
              <div className="dash-card">
                <span className="dash-section-title" style={{ margin: 0 }}>Sessions</span>
                <p className="mr-num" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 0' }}>
                  {summary.data.data.sessions.toLocaleString()}
                </p>
              </div>
              <div className="dash-card">
                <span className="dash-section-title" style={{ margin: 0 }}>Bounce rate</span>
                <p className="mr-num" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 0' }}>
                  {(summary.data.data.bounceRate * 100).toFixed(1)}%
                </p>
              </div>
              <div className="dash-card">
                <span className="dash-section-title" style={{ margin: 0 }}>New visitor rate</span>
                <p className="mr-num" style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 0' }}>
                  {summary.data.data.visitors > 0
                    ? `${((summary.data.data.newVisitors / summary.data.data.visitors) * 100).toFixed(1)}%`
                    : '—'}
                </p>
              </div>
            </div>
          )}
          {summary.data && <FreshnessNote freshness={summary.data.freshness} />}

          {/* LineChart is a self-contained dash-card (title, legend, table
              toggle, and its own "No data for this period." empty state via
              ChartFrame) — no wrapper card or duplicate heading needed. */}
          <div style={{ marginTop: 20, marginBottom: 20 }}>
            <LineChart
              data={points}
              xLabel={(p) => p.bucket}
              series={[{ id: 'visitors', label: 'Visitors', y: (p) => p.visitors }]}
              title="Daily visitors"
            />
          </div>

          <p className="dash-section-title" style={{ marginBottom: 12 }}>All visitors</p>
          <DashboardTable<VisitorListRow>
            columns={VISITOR_COLUMNS}
            data={visitors.data?.data.rows ?? []}
            emptyMessage="No visitors in this range."
            tableTraceId="PG-DASHBOARD-ANL-VISITORS::EL-TABLE-visitors"
            getRowTraceId={(row) => `PG-DASHBOARD-ANL-VISITORS::EL-ROW-visitor@${row.visitorId}`}
          />
        </>
      )}
    </>
  );
}

'use client';

import React from 'react';
import AnalyticsSubnav from '@/components/dashboard/AnalyticsSubnav';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';
import { useAnalyticsRange, useRealtime, useLiveVisitors } from '@/lib/hooks/use-analytics';
import type { AnalyticsFreshness, LiveVisitor } from '@/lib/api/analytics-insights';
import { useMinutesAgoLabel } from '@/lib/hooks/use-minutes-ago';
import AnalyticsScopeBar from '@/components/dashboard/analytics/AnalyticsScopeBar';

/* ── Shared small pieces (kept local to this screen, matching the existing
   per-screen-helper style in AnalyticsClient.tsx rather than a shared file
   this lane doesn't own) ── */

function FreshnessNote({ freshness }: { freshness: AnalyticsFreshness }) {
  // Clock read in an effect, and re-read on a timer — see useMinutesAgoLabel.
  // Computing it inline during render was impure AND left the label frozen at
  // whatever it said when the screen last re-rendered for some other reason.
  const label = useMinutesAgoLabel(freshness.rollupLastOkAt);
  if (!label) return null;
  return (
    <p style={{ fontSize: 12, color: 'var(--mr-fg-4)', margin: '4px 0 0' }}>
      Updated {label}
      {freshness.staleBuckets > 0 &&
        ` · ${freshness.staleBuckets} bucket${freshness.staleBuckets === 1 ? '' : 's'} still catching up`}
    </p>
  );
}

function ScreenSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 16 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="dash-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="dash-skeleton" style={{ width: 100, height: 13 }} />
          <span className="dash-skeleton" style={{ width: 140, height: 28 }} />
        </div>
      ))}
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

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

const LIVE_VISITOR_COLUMNS: Column<LiveVisitor>[] = [
  { key: 'path', label: 'Current page', render: (row) => row.path ?? '—' },
  { key: 'country', label: 'Country', render: (row) => row.country ?? '—' },
  { key: 'deviceType', label: 'Device', render: (row) => row.deviceType ?? '—' },
  {
    key: 'enteredAt',
    label: 'On site since',
    render: (row) => relativeTime(row.enteredAt),
  },
];

export default function RealtimeClient() {
  const { range, setRange } = useAnalyticsRange();
  const summary = useRealtime(range);
  const visitors = useLiveVisitors(range);

  const isLoading = summary.isLoading || visitors.isLoading;
  const isError = summary.isError || visitors.isError;
  const errorMessage =
    summary.error?.message ?? visitors.error?.message ?? 'Realtime data could not load.';

  const retry = () => {
    void summary.refetch();
    void visitors.refetch();
  };

  return (
    <>
      <AnalyticsSubnav />
      <div className="dash-page-header">
        <h1 className="dash-page-title">Realtime</h1>
      </div>
      <p className="dash-help-text" style={{ marginBottom: 12 }}>
        Active-visitor counts refresh automatically every 10 seconds and pause while this tab is in
        the background. The date range below scopes nothing on this screen yet — it exists so the
        control stays where every other analytics screen expects it.
      </p>
      <AnalyticsScopeBar range={range} onChange={setRange} />

      {isLoading ? (
        <ScreenSkeleton />
      ) : isError ? (
        <ScreenError message={errorMessage} onRetry={retry} />
      ) : !summary.data ? (
        <ScreenEmpty message="Realtime data isn't available right now." />
      ) : (
        <>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 16, marginBottom: 8 }}
          >
            <div className="dash-card">
              <span className="dash-section-title" style={{ margin: 0 }}>Online now</span>
              <p className="mr-num" style={{ fontSize: 28, fontWeight: 700, margin: '6px 0 0' }}>
                {summary.data.data.onlineNow.toLocaleString()}
              </p>
            </div>
            <div className="dash-card">
              <span className="dash-section-title" style={{ margin: 0 }}>Top page right now</span>
              <p className="mr-num" style={{ fontSize: 20, fontWeight: 700, margin: '6px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {summary.data.data.byPath[0]?.path ?? '—'}
              </p>
            </div>
            <div className="dash-card">
              <span className="dash-section-title" style={{ margin: 0 }}>Visitors, last minute</span>
              <p className="mr-num" style={{ fontSize: 28, fontWeight: 700, margin: '6px 0 0' }}>
                {(summary.data.data.pulse[summary.data.data.pulse.length - 1]?.count ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
          <FreshnessNote freshness={summary.data.freshness} />

          <div style={{ marginTop: 20 }}>
            <p className="dash-section-title" style={{ marginBottom: 12 }}>Who&apos;s here now</p>
            <DashboardTable<LiveVisitor>
              columns={LIVE_VISITOR_COLUMNS}
              data={visitors.data?.data ?? []}
              emptyMessage={
                summary.data.freshness.rollupLastOkAt
                  ? 'No one is on the site right now.'
                  : "Analytics isn't collecting data yet."
              }
              tableTraceId="PG-DASHBOARD-ANL-REALTIME::EL-TABLE-live-visitors"
            />
          </div>
        </>
      )}
    </>
  );
}

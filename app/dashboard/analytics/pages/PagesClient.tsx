'use client';

import React, { useState } from 'react';
import AnalyticsSubnav from '@/components/dashboard/AnalyticsSubnav';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';
import { HorizontalBar } from '@/components/dashboard/charts';
import { useAnalyticsRange, useTopPages, useEntryPages, useExitPages } from '@/lib/hooks/use-analytics';
import type { AnalyticsFreshness, PageRow } from '@/lib/api/analytics-insights';
import { useMinutesAgoLabel } from '@/lib/hooks/use-minutes-ago';
import AnalyticsScopeBar from '@/components/dashboard/analytics/AnalyticsScopeBar';

function FreshnessNote({ freshness }: { freshness: AnalyticsFreshness }) {
  // Clock read in an effect, and re-read on a timer — see useMinutesAgoLabel.
  // Computing it inline during render was impure AND left the label frozen at
  // whatever it said when the screen last re-rendered for some other reason.
  const label = useMinutesAgoLabel(freshness.rollupLastOkAt);
  if (!label) return null;
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

const PAGE_COLUMNS: Column<PageRow>[] = [
  { key: 'path', label: 'Page' },
  { key: 'pageviews', label: 'Views', align: 'right', sortable: true },
  { key: 'uniqueVisitors', label: 'Unique visitors', align: 'right', sortable: true },
  { key: 'entries', label: 'Entries', align: 'right', sortable: true },
  { key: 'exits', label: 'Exits', align: 'right', sortable: true },
  {
    key: 'bounceRate',
    label: 'Bounce rate',
    align: 'right',
    sortable: true,
    render: (row) => `${(row.bounceRate * 100).toFixed(1)}%`,
  },
];

type SubTab = 'top' | 'entry' | 'exit';

export default function PagesClient() {
  const { range, setRange } = useAnalyticsRange();
  const [tab, setTab] = useState<SubTab>('top');

  const top = useTopPages(range);
  const entry = useEntryPages(range);
  const exit = useExitPages(range);

  const isLoading = top.isLoading || entry.isLoading || exit.isLoading;
  const isError = top.isError || entry.isError || exit.isError;
  const errorMessage =
    top.error?.message ?? entry.error?.message ?? exit.error?.message ?? 'Page data could not load.';

  const retry = () => {
    void top.refetch();
    void entry.refetch();
    void exit.refetch();
  };

  const noHistory = top.data ? !top.data.freshness.rollupLastOkAt : false;
  const topRows = top.data?.data ?? [];
  const tableForTab = tab === 'top' ? topRows : tab === 'entry' ? entry.data?.data ?? [] : exit.data?.data ?? [];

  return (
    <>
      <AnalyticsSubnav />
      <div className="dash-page-header">
        <h1 className="dash-page-title">Pages</h1>
      </div>
      <AnalyticsScopeBar range={range} onChange={setRange} />

      {isLoading ? (
        <ScreenSkeleton />
      ) : isError ? (
        <ScreenError message={errorMessage} onRetry={retry} />
      ) : noHistory ? (
        <ScreenEmpty message="Analytics isn't collecting data yet. Once tracking is live, figures will show up here." />
      ) : (
        <>
          {top.data && <FreshnessNote freshness={top.data.freshness} />}

          {/* HorizontalBar is a self-contained dash-card (title, table
              toggle, and its own "No data for this period." empty state via
              ChartFrame) — no wrapper card or duplicate heading needed. */}
          <div style={{ margin: '20px 0' }}>
            <HorizontalBar
              data={topRows.slice(0, 10)}
              label={(p) => p.path}
              value={(p) => p.pageviews}
              title="Top pages by views"
            />
          </div>

          <div className="dash-tabstrip">
            <button
              className={tab === 'top' ? 'dash-btn-primary' : 'dash-btn-secondary'}
              onClick={() => setTab('top')}
            >
              Top
            </button>
            <button
              className={tab === 'entry' ? 'dash-btn-primary' : 'dash-btn-secondary'}
              onClick={() => setTab('entry')}
            >
              Entry pages
            </button>
            <button
              className={tab === 'exit' ? 'dash-btn-primary' : 'dash-btn-secondary'}
              onClick={() => setTab('exit')}
            >
              Exit pages
            </button>
          </div>

          <DashboardTable<PageRow>
            columns={PAGE_COLUMNS}
            data={tableForTab}
            emptyMessage="No data in this range."
            tableTraceId={`PG-DASHBOARD-ANL-PAGES::EL-TABLE-${tab}`}
          />
        </>
      )}
    </>
  );
}

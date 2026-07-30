'use client';

import React, { useState } from 'react';
import AnalyticsSubnav from '@/components/dashboard/AnalyticsSubnav';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';
import { Donut, BarChart } from '@/components/dashboard/charts';
import { useAnalyticsRange, useSources, useTech, useCampaignDetail } from '@/lib/hooks/use-analytics';
import type { AnalyticsRangeState } from '@/lib/hooks/use-analytics';
import { egp } from '@/lib/api/analytics-insights';
import type { AnalyticsFreshness, SourceMetric } from '@/lib/api/analytics-insights';

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

function CampaignPanel({ campaign, range }: { campaign: string; range: AnalyticsRangeState }) {
  const detail = useCampaignDetail(campaign, range);
  if (detail.isLoading) {
    return <span className="dash-skeleton" style={{ width: '100%', height: 60, display: 'block' }} />;
  }
  if (detail.isError || !detail.data) {
    return <p className="dash-inline-error" style={{ margin: 0 }}>Couldn&apos;t load campaign detail.</p>;
  }
  const { landingPages } = detail.data.data;
  return (
    <div>
      <p className="dash-section-title" style={{ marginBottom: 8 }}>Landing pages for &quot;{campaign}&quot;</p>
      {landingPages.length === 0 ? (
        <p style={{ color: 'var(--mr-fg-4)', fontSize: 13, margin: 0 }}>No landing-page data in this range.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {landingPages.map((page) => (
            <li key={page.path} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>{page.path}</span>
              <span className="mr-num">{page.views.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const SOURCE_COLUMNS: (onSelect: (campaign: string | null) => void) => Column<SourceMetric>[] = (onSelect) => [
  { key: 'source', label: 'Source' },
  { key: 'medium', label: 'Medium', render: (row) => row.medium ?? '—' },
  {
    key: 'campaign',
    label: 'Campaign',
    render: (row) =>
      row.campaign ? (
        <button className="dash-link" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, font: 'inherit' }} onClick={() => onSelect(row.campaign!)}>
          {row.campaign}
        </button>
      ) : (
        '—'
      ),
  },
  { key: 'visitors', label: 'Visitors', align: 'right', sortable: true },
  { key: 'conversions', label: 'Conversions', align: 'right', sortable: true },
  { key: 'revenueMinor', label: 'Revenue', align: 'right', sortable: true, render: (row) => egp(row.revenueMinor) },
];

export default function AcquisitionClient() {
  const { range, setRange } = useAnalyticsRange();
  const sources = useSources(range);
  const tech = useTech(range);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  const isLoading = sources.isLoading || tech.isLoading;
  const isError = sources.isError || tech.isError;
  const errorMessage = sources.error?.message ?? tech.error?.message ?? 'Acquisition data could not load.';

  const retry = () => {
    void sources.refetch();
    void tech.refetch();
  };

  const noHistory = sources.data ? !sources.data.freshness.rollupLastOkAt : false;
  const sourceRows = sources.data?.data ?? [];
  const browsers = tech.data?.data.browsers ?? [];

  return (
    <>
      <AnalyticsSubnav />
      <div className="dash-page-header">
        <h1 className="dash-page-title">Acquisition</h1>
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
          {sources.data && <FreshnessNote freshness={sources.data.freshness} />}

          {/* Donut/BarChart are self-contained dash-cards (title, table
              toggle, and their own "No data for this period." empty state
              via ChartFrame) — no wrapper card or duplicate heading needed. */}
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16, margin: '20px 0' }}
          >
            <Donut
              data={sourceRows.slice(0, 5).map((s) => ({ label: s.source, value: s.visitors }))}
              title="Traffic by source"
            />
            <BarChart
              data={browsers}
              category={(b) => b.name}
              series={[{ id: 'count', label: 'Sessions', y: (b) => b.count }]}
              title="Browsers"
            />
          </div>

          <DashboardTable<SourceMetric>
            columns={SOURCE_COLUMNS(setSelectedCampaign)}
            data={sourceRows}
            emptyMessage="No traffic sources in this range."
            tableTraceId="PG-DASHBOARD-ANL-ACQUISITION::EL-TABLE-sources"
          />

          {selectedCampaign && (
            <div className="dash-card" style={{ marginTop: 16, padding: '16px 20px' }}>
              <CampaignPanel campaign={selectedCampaign} range={range} />
            </div>
          )}
        </>
      )}
    </>
  );
}

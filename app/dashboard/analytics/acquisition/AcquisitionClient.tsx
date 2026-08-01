'use client';

import React, { useState } from 'react';
import AnalyticsSubnav from '@/components/dashboard/AnalyticsSubnav';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';
import { Donut, BarChart } from '@/components/dashboard/charts';
import { useAnalyticsRange, useSources, useTech, useCampaignDetail } from '@/lib/hooks/use-analytics';
import type { AnalyticsRangeState } from '@/lib/hooks/use-analytics';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, type ApiError } from '@/lib/api/client';
import {
  buildAnalyticsQueryString,
  egp,
  SOURCE_GROUP_BY,
} from '@/lib/api/analytics-insights';
import type {
  AnalyticsEnvelope,
  AnalyticsFreshness,
  AnalyticsQueryParams,
  GeoRow,
  SourceGroupBy,
  SourceRow,
} from '@/lib/api/analytics-insights';

/**
 * Countries, by visitors.
 *
 * `/analytics/geo` is a real endpoint with no client function or hook yet —
 * the same gap `OverviewGrid` works around. Calling `apiFetch` directly here
 * keeps that one exception in the two places that need it rather than adding a
 * half-promoted export; promote both to a shared `useGeo` when something else
 * needs it.
 */
function useCountries(params: AnalyticsQueryParams) {
  return useQuery<AnalyticsEnvelope<GeoRow[]>, ApiError>({
    queryKey: ['analytics', 'geo', 'country', params],
    queryFn: () =>
      apiFetch<AnalyticsEnvelope<GeoRow[]>>(
        `/analytics/geo?${buildAnalyticsQueryString(params, { dimension: 'country' })}`,
        { auth: true },
      ),
    staleTime: 60_000,
  });
}

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

const GROUP_BY_LABEL: Record<SourceGroupBy, string> = {
  channel: 'Channel',
  source: 'Source',
  medium: 'Medium',
  campaign: 'Campaign',
  referrer: 'Referrer',
};

/**
 * `sources/campaigns/{campaign}` returns a daily series plus content/term/
 * referrer breakdowns — there is no `landingPages` field (the original
 * client guess invented one). Shown here as real totals plus the three real
 * breakdown tables instead.
 */
function CampaignPanel({ campaign, range }: { campaign: string; range: AnalyticsRangeState }) {
  const detail = useCampaignDetail(campaign, range);
  if (detail.isLoading) {
    return <span className="dash-skeleton" style={{ width: '100%', height: 60, display: 'block' }} />;
  }
  if (detail.isError || !detail.data) {
    return <p className="dash-inline-error" style={{ margin: 0 }}>Couldn&apos;t load campaign detail.</p>;
  }
  const { series, byContent, byTerm, byReferrer } = detail.data.data;
  const totals = series.reduce(
    (acc, day) => ({ sessions: acc.sessions + day.sessions, orders: acc.orders + day.orders, revenueMinor: acc.revenueMinor + day.revenueMinor }),
    { sessions: 0, orders: 0, revenueMinor: 0 },
  );

  const breakdownColumns: Column<{ key: string; sessions: number; orders: number; revenueMinor: number }>[] = [
    { key: 'key', label: 'Key' },
    { key: 'sessions', label: 'Sessions', align: 'right', sortable: true },
    { key: 'orders', label: 'Orders', align: 'right', sortable: true },
    { key: 'revenueMinor', label: 'Revenue', align: 'right', sortable: true, render: (row) => egp(row.revenueMinor) },
  ];

  return (
    <div>
      <p className="dash-section-title" style={{ marginBottom: 8 }}>
        &quot;{campaign}&quot; — {totals.sessions.toLocaleString()} sessions, {totals.orders.toLocaleString()} orders,{' '}
        {egp(totals.revenueMinor)}
      </p>
      {byContent.length === 0 && byTerm.length === 0 && byReferrer.length === 0 ? (
        <p style={{ color: 'var(--mr-fg-4)', fontSize: 13, margin: 0 }}>No breakdown data in this range.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12 }}>
          <div>
            <p style={{ fontSize: 12, color: 'var(--mr-fg-4)', margin: '0 0 6px' }}>By ad content</p>
            <DashboardTable columns={breakdownColumns} data={byContent} pageSize={5} emptyMessage="No content breakdown." />
          </div>
          <div>
            <p style={{ fontSize: 12, color: 'var(--mr-fg-4)', margin: '0 0 6px' }}>By search term</p>
            <DashboardTable columns={breakdownColumns} data={byTerm} pageSize={5} emptyMessage="No term breakdown." />
          </div>
          <div>
            <p style={{ fontSize: 12, color: 'var(--mr-fg-4)', margin: '0 0 6px' }}>By referrer</p>
            <DashboardTable columns={breakdownColumns} data={byReferrer} pageSize={5} emptyMessage="No referrer breakdown." />
          </div>
        </div>
      )}
    </div>
  );
}

const SOURCE_COLUMNS: (groupBy: SourceGroupBy, onSelect: (key: string) => void) => Column<SourceRow>[] = (
  groupBy,
  onSelect,
) => [
  {
    key: 'key',
    label: GROUP_BY_LABEL[groupBy],
    render: (row) =>
      groupBy === 'campaign' ? (
        <button
          className="dash-link"
          style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, font: 'inherit' }}
          onClick={() => onSelect(row.key)}
        >
          {row.key}
        </button>
      ) : (
        row.key
      ),
  },
  { key: 'visitors', label: 'Visitors', align: 'right', sortable: true },
  { key: 'sessions', label: 'Sessions', align: 'right', sortable: true },
  { key: 'orders', label: 'Orders', align: 'right', sortable: true },
  { key: 'bounceRate', label: 'Bounce rate', align: 'right', sortable: true, render: (row) => `${(row.bounceRate * 100).toFixed(1)}%` },
  { key: 'revenueMinor', label: 'Revenue', align: 'right', sortable: true, render: (row) => egp(row.revenueMinor) },
];

export default function AcquisitionClient() {
  const { range, setRange } = useAnalyticsRange();
  const [groupBy, setGroupBy] = useState<SourceGroupBy>('channel');
  const sources = useSources(range, groupBy);
  const tech = useTech(range, 'browser');
  /**
   * Device and OS alongside browser.
   *
   * `/analytics/tech` returns ONE dimension per call, so three calls rather
   * than one combined response — that is the endpoint's shape, not a choice.
   * Acquisition showed browsers only, which answers the least useful of the
   * three: knowing someone used Chrome changes nothing, knowing 78% of them
   * were on a phone changes where the next month of design effort goes.
   */
  const devices = useTech(range, 'device');
  const operatingSystems = useTech(range, 'os');
  const geo = useCountries(range);
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
  const browsers = tech.data?.data ?? [];

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
              data={sourceRows.slice(0, 5).map((s) => ({ label: s.key, value: s.visitors }))}
              title={`Traffic by ${GROUP_BY_LABEL[groupBy].toLowerCase()}`}
            />
            <BarChart
              data={devices.data?.data ?? []}
              category={(d) => d.key || 'Unknown'}
              series={[{ id: 'sessions', label: 'Sessions', y: (d) => d.sessions }]}
              title="Device type"
            />
            <BarChart
              data={operatingSystems.data?.data ?? []}
              category={(o) => o.key || 'Unknown'}
              series={[{ id: 'sessions', label: 'Sessions', y: (o) => o.sessions }]}
              title="Operating system"
            />
            <BarChart
              data={geo.data?.data ?? []}
              category={(g) => g.key || 'Unknown'}
              series={[{ id: 'visitors', label: 'Visitors', y: (g) => g.visitors }]}
              title="Countries"
            />
            <BarChart
              data={browsers}
              category={(b) => b.key}
              series={[{ id: 'sessions', label: 'Sessions', y: (b) => b.sessions }]}
              title="Browsers"
            />
          </div>

          <div className="dash-tabstrip" style={{ marginBottom: 12 }}>
            {SOURCE_GROUP_BY.map((g) => (
              <button
                key={g}
                className={groupBy === g ? 'dash-btn-primary' : 'dash-btn-secondary'}
                onClick={() => {
                  setGroupBy(g);
                  setSelectedCampaign(null);
                }}
              >
                {GROUP_BY_LABEL[g]}
              </button>
            ))}
          </div>

          <DashboardTable<SourceRow>
            columns={SOURCE_COLUMNS(groupBy, setSelectedCampaign)}
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

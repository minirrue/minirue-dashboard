'use client';

import React from 'react';
import Link from 'next/link';
import AnalyticsSubnav from '@/components/dashboard/AnalyticsSubnav';
import { useAnalyticsRange, useVisitorDetail, useVisitorJourney } from '@/lib/hooks/use-analytics';
import type { AnalyticsRangeState } from '@/lib/hooks/use-analytics';
import { egp } from '@/lib/api/analytics-insights';

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
    <div className="dash-card" style={{ padding: 20 }}>
      <span className="dash-skeleton" style={{ width: '60%', height: 20, marginBottom: 12 }} />
      <span className="dash-skeleton" style={{ width: '100%', height: 120 }} />
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-EG', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function VisitorDetailClient({ visitorId }: { visitorId: string }) {
  const { range, setRange } = useAnalyticsRange();
  const detail = useVisitorDetail(visitorId, range);
  const journey = useVisitorJourney(visitorId, range);

  const isLoading = detail.isLoading || journey.isLoading;
  const isError = detail.isError || journey.isError;
  const errorMessage =
    detail.error?.message ?? journey.error?.message ?? 'Visitor detail could not load.';

  const retry = () => {
    void detail.refetch();
    void journey.refetch();
  };

  const events = journey.data?.data ?? [];

  return (
    <>
      <AnalyticsSubnav />
      <div className="dash-page-header">
        <h1 className="dash-page-title">Visitor {visitorId}</h1>
        <Link href="/analytics/visitors" className="dash-btn-secondary">Back to visitors</Link>
      </div>
      <RangeControl range={range} onChange={setRange} />

      {isLoading ? (
        <ScreenSkeleton />
      ) : isError ? (
        <ScreenError message={errorMessage} onRetry={retry} />
      ) : !detail.data ? (
        <ScreenEmpty message="No record for this visitor." />
      ) : (
        <>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 16, marginBottom: 20 }}
          >
            <div className="dash-card">
              <span className="dash-section-title" style={{ margin: 0 }}>Sessions</span>
              <p className="mr-num" style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 0' }}>
                {detail.data.data.sessions.toLocaleString()}
              </p>
            </div>
            <div className="dash-card">
              <span className="dash-section-title" style={{ margin: 0 }}>Pageviews</span>
              <p className="mr-num" style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 0' }}>
                {detail.data.data.pageviews.toLocaleString()}
              </p>
            </div>
            <div className="dash-card">
              <span className="dash-section-title" style={{ margin: 0 }}>Orders</span>
              <p className="mr-num" style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 0' }}>
                {detail.data.data.orderCount.toLocaleString()}
              </p>
            </div>
            <div className="dash-card">
              <span className="dash-section-title" style={{ margin: 0 }}>Total revenue</span>
              <p className="mr-num" style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 0' }}>
                {egp(detail.data.data.totalRevenueMinor)}
              </p>
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--mr-fg-3)', marginBottom: 20 }}>
            First seen {formatDate(detail.data.data.firstSeenAt)} · Last seen {formatDate(detail.data.data.lastSeenAt)} ·{' '}
            {detail.data.data.isReturning ? 'Returning visitor' : 'New visitor'}
            {detail.data.data.country && ` · ${detail.data.data.country}`}
            {detail.data.data.device && ` · ${detail.data.data.device}`}
          </p>

          <p className="dash-section-title" style={{ marginBottom: 12 }}>Journey</p>
          {events.length === 0 ? (
            <div className="dash-card">
              <p style={{ color: 'var(--mr-fg-4)', fontSize: 14, textAlign: 'center', padding: '20px 0', margin: 0 }}>
                No recorded events for this visitor in this range.
              </p>
            </div>
          ) : (
            <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {events.map((event) => (
                  <li
                    key={event.eventId}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--mr-dash-hair)' }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--mr-fg-2)' }}>
                      {event.type}
                      {event.path && <span style={{ color: 'var(--mr-fg-4)' }}> — {event.path}</span>}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--mr-fg-4)', whiteSpace: 'nowrap' }}>
                      {formatDate(event.occurredAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  );
}

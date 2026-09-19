'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import AnalyticsSubnav from '@/components/dashboard/AnalyticsSubnav';
import TrafficFlagPanel from '@/components/dashboard/analytics/TrafficFlagPanel';
import { useAnalyticsRange, useVisitorDetail, useVisitorJourney } from '@/lib/hooks/use-analytics';
import { egp } from '@/lib/api/analytics-insights';
import AnalyticsScopeBar from '@/components/dashboard/analytics/AnalyticsScopeBar';
import { visitorLabel } from '@/components/dashboard/analytics/VisitorName';
import { storyFromJourney } from '@/lib/api/story';
import '../flow.css';
import { formatDateTime, formatTime } from '@/lib/dates/format';

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
  return formatDateTime(iso, { year: true });
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

  const events = journey.data?.data;
  // The same story the Visitors drawer shows: visits split on 30-minute gaps,
  // each summarised — including where a non-buyer stopped.
  const story = useMemo(() => storyFromJourney(visitorId, events ?? [], null), [visitorId, events]);

  return (
    <>
      <AnalyticsSubnav />
      <div className="dash-page-header">
        <h1 className="dash-page-title">
          {detail.data ? visitorLabel({ ...detail.data.data, visitorId }) : 'Visitor'}
          {detail.data?.data.customer && (
            <Link href={`/customers/${detail.data.data.customer.id}`} className="dash-link" style={{ marginLeft: 12, fontSize: 14, fontWeight: 600 }}>
              Customer profile →
            </Link>
          )}
        </h1>
        <Link href="/analytics/visitors" className="dash-btn-secondary">Back to visitors</Link>
      </div>
      {/* dashboard#111: this one device's verdict — misfiled bot, our own phone, or verified real. */}
      <div style={{ marginBottom: 20 }}>
        <TrafficFlagPanel subjectType="VISITOR" subjectId={visitorId} onChange={() => { void detail.refetch(); }} />
      </div>
      <AnalyticsScopeBar range={range} onChange={setRange} />

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
                {detail.data.data.sessionCount.toLocaleString()}
              </p>
            </div>
            <div className="dash-card">
              <span className="dash-section-title" style={{ margin: 0 }}>Pageviews</span>
              <p className="mr-num" style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 0' }}>
                {detail.data.data.pageviewCount.toLocaleString()}
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
                {egp(detail.data.data.revenueMinor)}
              </p>
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--mr-fg-3)', marginBottom: 20 }}>
            First seen {formatDate(detail.data.data.firstSeenAt)} · Last seen {formatDate(detail.data.data.lastSeenAt)}
            {' · '}First channel: {detail.data.data.firstChannel}
            {detail.data.data.country && ` · ${detail.data.data.country}`}
            {detail.data.data.isBot && ' · Flagged as bot traffic'}
          </p>

          {detail.data.data.orderCount === 0 && story.sessions.length > 0 && (
            <p className="flow-verdict">
              <strong>Didn&apos;t buy.</strong> Last visit: {story.sessions[0].summary}
            </p>
          )}
          <p className="dash-section-title" style={{ marginBottom: 12 }}>Story</p>
          {story.sessions.length === 0 ? (
            <div className="dash-card">
              <p style={{ color: 'var(--mr-fg-4)', fontSize: 14, textAlign: 'center', padding: '20px 0', margin: 0 }}>
                No recorded events for this visitor in this range.
              </p>
            </div>
          ) : (
            <div className="dash-card">
              <ol className="flow-sessions">
                {story.sessions.map((ss, i) => (
                  <li key={i} className="flow-session">
                    <div className="flow-session__touch">
                      <span className="flow-session__when">{formatDate(ss.startedAt)}</span>
                      {ss.touch.landingPath && <span className="flow-session__src">Landed on {ss.touch.landingPath}</span>}
                    </div>
                    <p className="flow-session__summary">{ss.summary}</p>
                    <ol className="flow-steps">
                      {ss.steps.map((st, j) => (
                        <li key={j} className="flow-step" data-kind={st.kind}>
                          <span className="flow-step__dot" aria-hidden="true" />
                          <span className="flow-step__label">{st.label}</span>
                          <span className="flow-step__meta">
                            {[st.valueMinor != null ? egp(st.valueMinor) : null, formatTime(st.at)]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </>
  );
}

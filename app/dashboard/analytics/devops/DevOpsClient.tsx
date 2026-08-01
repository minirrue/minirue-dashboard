'use client';

import React from 'react';
import AnalyticsSubnav from '@/components/dashboard/AnalyticsSubnav';
import {
  useAnalyticsRange,
  useAudienceSummary,
  usePurchaseReconciliation,
} from '@/lib/hooks/use-analytics';
import type { AnalyticsRangeState } from '@/lib/hooks/use-analytics';
import {
  MEASURED_AT,
  MEASURED_HARDWARE,
  READ_CAPACITY,
  WRITE_CAPACITY,
} from '@/lib/capacity-model';

/**
 * System health, measured now — with the last load test kept at the bottom as
 * a dated reference rather than presented as if it were live.
 *
 * That separation is the whole structure of this page. A benchmark and a live
 * reading look identical once they are numbers on a screen, and mistaking one
 * for the other is how people plan against a figure that stopped being true
 * months ago. Everything above "Last load test" is computed from this shop's
 * real traffic in the selected range; everything inside it is stamped with the
 * date it was measured and the machine it was measured on.
 */

function daysBetween(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1;
  // Inclusive: a single-day range is one day of traffic, not zero.
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

function RangeControl({
  range,
  onChange,
}: {
  range: AnalyticsRangeState;
  onChange: (next: Partial<AnalyticsRangeState>) => void;
}) {
  return (
    <div className="dash-filters" style={{ marginBottom: 24 }}>
      <label className="dash-field" style={{ maxWidth: 160 }}>
        <span className="dash-label">From</span>
        <input
          type="date"
          className="dash-input"
          value={range.from}
          max={range.to}
          onChange={(e) => onChange({ from: e.target.value })}
        />
      </label>
      <label className="dash-field" style={{ maxWidth: 160 }}>
        <span className="dash-label">To</span>
        <input
          type="date"
          className="dash-input"
          value={range.to}
          min={range.from}
          onChange={(e) => onChange({ to: e.target.value })}
        />
      </label>
    </div>
  );
}

/** A live reading. Value first, because that is what is being asked. */
function LiveStat({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 16,
        padding: '11px 0',
        borderTop: '1px solid var(--mr-line-2, rgba(0,0,0,0.07))',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--mr-fg-2)' }}>
        {label}
        {note ? (
          <span style={{ display: 'block', fontSize: 12, color: 'var(--mr-fg-4)', marginTop: 2 }}>
            {note}
          </span>
        ) : null}
      </span>
      <span style={{ whiteSpace: 'nowrap' }}>
        <span className="mr-num" style={{ fontSize: 15 }}>
          {value}
        </span>
        {unit ? (
          <span style={{ fontSize: 12, color: 'var(--mr-fg-4)', marginLeft: 5 }}>{unit}</span>
        ) : null}
      </span>
    </div>
  );
}

/** A pass/fail reading. Colour carries the state; the words carry the meaning. */
function HealthRow({
  label,
  ok,
  okText,
  badText,
}: {
  label: string;
  ok: boolean | null;
  okText: string;
  badText: string;
}) {
  const tone =
    ok === null
      ? { fg: 'var(--mr-fg-4)', text: 'Not known yet' }
      : ok
        ? { fg: 'var(--mr-gold-500)', text: okText }
        : { fg: 'var(--mr-crimson-600, #9B2C2C)', text: badText };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 16,
        padding: '11px 0',
        borderTop: '1px solid var(--mr-line-2, rgba(0,0,0,0.07))',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--mr-fg-2)' }}>{label}</span>
      <span style={{ fontSize: 13, color: tone.fg, textAlign: 'right' }}>{tone.text}</span>
    </div>
  );
}

export default function DevOpsClient() {
  const { range, setRange } = useAnalyticsRange();
  const summary = useAudienceSummary(range);
  const reconcile = usePurchaseReconciliation(range);

  const days = daysBetween(range.from, range.to);
  const s = summary.data?.data;
  const freshness = summary.data?.freshness;

  /**
   * Rates from this shop's own traffic. Real division of real counts — nothing
   * here is a constant.
   *
   * Averaged over the selected range, so a wide range flattens the peaks. That
   * is stated on the rows rather than corrected for, because "correcting" it
   * would mean multiplying by an assumed traffic shape, which is exactly the
   * kind of invented number this page is supposed to avoid.
   */
  const seconds = days * 86_400;
  const pageviewsPerSec = s ? s.pageviews / seconds : 0;
  const sessionsPerDay = s ? s.sessions / days : 0;
  const ordersPerDay = s ? s.purchases / days : 0;

  const rollupMinutesAgo = freshness?.rollupLastOkAt
    ? Math.max(
        0,
        Math.round((Date.now() - new Date(freshness.rollupLastOkAt).getTime()) / 60_000),
      )
    : null;

  const fmt = (n: number, dp = 0) =>
    n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

  return (
    <div data-trace-id="PG-DASHBOARD-ANL-DEVOPS::EL-REGION-root">
      <header className="dash-page-header">
        <h1 className="dash-page-title">System</h1>
      </header>

      <AnalyticsSubnav />

      <p className="dash-muted" style={{ maxWidth: '68ch', margin: '20px 0 0', lineHeight: 1.6 }}>
        What the shop is actually doing, measured from its own traffic. The load test at the
        bottom is a dated benchmark, not a live reading — it tells you what the server managed
        on the day it was run.
      </p>

      <RangeControl range={range} onChange={setRange} />

      {summary.isLoading ? (
        <div className="dash-skeleton" style={{ height: 200 }} />
      ) : summary.isError ? (
        <p className="dash-inline-error">
          Could not load traffic for this range. Nothing below is current.
        </p>
      ) : (
        <>
          <div className="dash-card" style={{ padding: 24, marginBottom: 20 }}>
            <h2 className="dash-section-title" style={{ marginTop: 0 }}>
              Load right now
            </h2>
            <p className="dash-muted" style={{ maxWidth: '62ch', lineHeight: 1.6 }}>
              Averaged across the selected range. A wide range smooths out the busy hours, so
              narrow it to a single day to see a real peak.
            </p>
            <div style={{ marginTop: 8 }}>
              <LiveStat
                label="Page views"
                value={pageviewsPerSec < 1 ? pageviewsPerSec.toFixed(3) : fmt(pageviewsPerSec, 1)}
                unit="per second"
                note={`${fmt(s?.pageviews ?? 0)} across ${days} day${days === 1 ? '' : 's'}.`}
              />
              <LiveStat
                label="Sessions"
                value={fmt(sessionsPerDay, 1)}
                unit="per day"
                note={`${fmt(s?.sessions ?? 0)} in this range, from ${fmt(s?.visitors ?? 0)} visitors.`}
              />
              <LiveStat
                label="Orders"
                value={fmt(ordersPerDay, 1)}
                unit="per day"
                note={`${fmt(s?.purchases ?? 0)} in this range.`}
              />
              <LiveStat
                label="Checkouts started"
                value={fmt(s?.beginCheckouts ?? 0)}
                note="Reaching checkout is the write-heavy path — it costs far more than browsing."
              />
            </div>
          </div>

          <div className="dash-card" style={{ padding: 24, marginBottom: 20 }}>
            <h2 className="dash-section-title" style={{ marginTop: 0 }}>
              Is the data trustworthy
            </h2>
            <p className="dash-muted" style={{ maxWidth: '62ch', lineHeight: 1.6 }}>
              Every number on every analytics screen depends on these. If one of them is wrong,
              the reports are confidently wrong rather than obviously broken.
            </p>
            <div style={{ marginTop: 8 }}>
              <HealthRow
                label="Reporting pipeline"
                ok={rollupMinutesAgo === null ? null : rollupMinutesAgo < 15}
                okText={
                  rollupMinutesAgo === 0
                    ? 'Up to date, just now'
                    : `Up to date, ${rollupMinutesAgo} min ago`
                }
                badText={`Behind by ${rollupMinutesAgo} minutes`}
              />
              <HealthRow
                label="Buckets still catching up"
                ok={freshness ? freshness.staleBuckets === 0 : null}
                okText="None"
                badText={`${freshness?.staleBuckets ?? 0} waiting`}
              />
              <HealthRow
                label="Tracked purchases match real orders"
                ok={reconcile.data?.data.healthy ?? null}
                okText="Every order accounted for"
                badText="Some orders and tracked purchases disagree"
              />
            </div>
          </div>
        </>
      )}

      {/*
        The benchmark, kept and clearly fenced off. It is genuinely useful — it
        is the only evidence of what this server can take — but it is a
        measurement from one day, not a live reading, and the heading says so
        before any number appears.
      */}
      <div className="dash-card" style={{ padding: 24 }}>
        <h2 className="dash-section-title" style={{ marginTop: 0 }}>
          Last load test
        </h2>
        <p className="dash-muted" style={{ maxWidth: '64ch', lineHeight: 1.6 }}>
          Measured {MEASURED_AT} with k6 against the live stack — {MEASURED_HARDWARE.cores} cores,{' '}
          {MEASURED_HARDWARE.memoryGb} GB RAM,{' '}
          {MEASURED_HARDWARE.swapGb === 0 ? 'no swap' : `${MEASURED_HARDWARE.swapGb} GB swap`}.
          These are not live figures and they stop being true the day the server or the code
          changes.
        </p>

        <div style={{ marginTop: 8 }}>
          <LiveStat
            label="Browsing held"
            value={String(READ_CAPACITY.sustained)}
            unit="req/sec"
            note={`${READ_CAPACITY.p95Ms} ms for 95 of every 100 requests. Fell over past ${READ_CAPACITY.ceiling}.`}
          />
          <LiveStat
            label="Buying held"
            value={String(WRITE_CAPACITY.sustained)}
            unit="orders/sec"
            note={`${WRITE_CAPACITY.p95Ms} ms at that rate. Fell over past ${WRITE_CAPACITY.ceiling}.`}
          />
        </div>

        <p style={{ margin: '16px 0 0', fontSize: 13, color: 'var(--mr-fg-3)', lineHeight: 1.6 }}>
          Buying sustains a twentieth of browsing, and extra servers do not change it — every
          order goes through the one database. Browsing is what scales; checkout is what has to
          be protected. {WRITE_CAPACITY.limitedBy}
        </p>
        <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--mr-fg-3)', lineHeight: 1.6 }}>
          Two caveats. The catalogue used for the test carried no product images, so image-heavy
          pages behave differently. And the browsing figure assumes repeat requests are served
          from cache — traffic where every visitor asks for something unique pushes more of it
          through to the database.
        </p>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--mr-fg-4)' }}>
          Re-run with <code>apps/minirue-backend/loadtest/</code> and update{' '}
          <code>lib/capacity-model.ts</code>. Generate the load from outside the server — running
          it on the box competes with what it is measuring.
        </p>
      </div>
    </div>
  );
}

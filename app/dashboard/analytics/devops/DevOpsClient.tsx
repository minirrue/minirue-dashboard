'use client';

import React from 'react';
import AnalyticsSubnav from '@/components/dashboard/AnalyticsSubnav';
import { useAnalyticsRange, useAudienceSummary } from '@/lib/hooks/use-analytics';
import type { AnalyticsRangeState } from '@/lib/hooks/use-analytics';
import {
  MEASURED_AT,
  MEASURED_HARDWARE,
  READ_CAPACITY,
  REQUEST_COST,
  TRAFFIC_SHAPE,
  WRITE_CAPACITY,
  drainTimeSeconds,
  project,
} from '@/lib/capacity-model';

/**
 * Capacity, not traffic.
 *
 * Every other analytics screen answers "what did people do". This one answers
 * "how much more of it can we take, and what breaks first" — a question that
 * usually gets answered for the first time on the day it matters.
 *
 * Two commitments shape the whole page:
 *
 * 1. Measured or labelled. The ceilings come from a real load test on this
 *    stack (lib/capacity-model.ts carries the date and method). The two
 *    industry-shape assumptions are called out as assumptions where they are
 *    used, not buried in a footnote.
 *
 * 2. The asymmetry leads. Reads sustain 200/sec and writes 10/sec — a 20x gap —
 *    so the page puts the two side by side rather than averaging them into one
 *    reassuring number. Everything downstream follows from that gap.
 */

const RANGE_DAYS_FALLBACK = 1;

function daysBetween(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return RANGE_DAYS_FALLBACK;
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

/**
 * One path's headroom, drawn to scale.
 *
 * The track is the measured ceiling and the fill is current load, so a glance
 * gives the ratio before any number is read — which is the point, because the
 * ratio is what decides whether to act. A numeric-only presentation would make
 * 2% and 60% look equally like "a number".
 */
function HeadroomBar({
  title,
  unit,
  current,
  sustained,
  ceiling,
  p95Ms,
  limitedBy,
}: {
  title: string;
  unit: string;
  current: number;
  sustained: number;
  ceiling: number;
  p95Ms: number;
  limitedBy: string;
}) {
  const usedPct = Math.min(100, (current / sustained) * 100);
  // Where the hard ceiling sits relative to the safe figure, so the gap between
  // "comfortable" and "falls over" is visible rather than implied.
  const ceilingPct = Math.min(100, (sustained / ceiling) * 100);

  const tone =
    usedPct >= 80
      ? { fg: 'var(--mr-crimson-600, #9B2C2C)', label: 'At capacity' }
      : usedPct >= 40
        ? { fg: 'var(--mr-gold-500)', label: 'Watch' }
        : { fg: 'var(--mr-gold-400)', label: 'Comfortable' };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <h3 className="dash-section-title" style={{ margin: 0 }}>
          {title}
        </h3>
        <span style={{ fontSize: 12, color: tone.fg, whiteSpace: 'nowrap' }}>{tone.label}</span>
      </div>

      <div>
        <div
          style={{
            position: 'relative',
            height: 10,
            borderRadius: 5,
            background: 'var(--mr-line-2, rgba(0,0,0,0.07))',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.max(usedPct, 0.8)}%`,
              height: '100%',
              background: tone.fg,
              borderRadius: 5,
            }}
          />
          {/* The safe/ceiling boundary. A 1px rule, not a coloured band — it
              marks a threshold, it is not a second quantity. */}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              insetBlock: 0,
              left: `${ceilingPct}%`,
              width: 1,
              background: 'var(--mr-fg-4)',
              opacity: 0.55,
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 6,
            fontSize: 12,
            color: 'var(--mr-fg-4)',
          }}
        >
          <span>
            <span className="mr-num" style={{ color: 'var(--mr-fg-2)' }}>
              {current < 1 ? current.toFixed(2) : current.toFixed(1)}
            </span>{' '}
            {unit} now
          </span>
          <span>
            safe to <span className="mr-num">{sustained}</span> · breaks at{' '}
            <span className="mr-num">{ceiling}</span>
          </span>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: 'var(--mr-fg-3)', lineHeight: 1.5 }}>
        {limitedBy}
      </p>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--mr-fg-4)' }}>
        Response time at the safe figure: <span className="mr-num">{p95Ms} ms</span> for 95 of every
        100 requests.
      </p>
    </section>
  );
}

/** A label/value row. Used where the numbers are a derivation, not a dashboard. */
function DerivationRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 16,
        padding: '9px 0',
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
      <span className="mr-num" style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  );
}

export default function DevOpsClient() {
  const { range, setRange } = useAnalyticsRange();
  const summary = useAudienceSummary(range);

  const [buyers, setBuyers] = React.useState(500);

  const days = daysBetween(range.from, range.to);
  const s = summary.data?.data;

  /**
   * Current load, derived from real traffic in the selected range.
   *
   * Pageviews are converted to API calls using the storefront's own fan-out
   * (REQUEST_COST.perPageView) rather than counted directly — the analytics
   * beacon records page views, not the four other calls each one triggers, so
   * counting beacons alone would understate real load roughly fivefold.
   *
   * The peak-hour figure is what matters for capacity: a daily average would
   * flatter the shop by exactly the amount that breaks it.
   */
  const avgRps = s ? (s.pageviews * REQUEST_COST.perPageView) / (days * 86_400) : 0;
  const peakRps = avgRps * (24 * TRAFFIC_SHAPE.peakHourShare);
  const peakOrdersPerSec = s ? (s.purchases / (days * 86_400)) * (24 * TRAFFIC_SHAPE.peakHourShare) : 0;

  const p = project();
  const drain = drainTimeSeconds(buyers);
  const fmt = (n: number) => Math.round(n).toLocaleString();

  return (
    <div data-trace-id="PG-DASHBOARD-ANL-DEVOPS::EL-REGION-root">
      <header className="dash-page-header">
        <h1 className="dash-page-title">Capacity</h1>
      </header>

      <AnalyticsSubnav />

      <p
        className="dash-muted"
        style={{ maxWidth: '68ch', margin: '20px 0 0', lineHeight: 1.6 }}
      >
        What this server can take before customers feel it. The ceilings below were measured
        against this stack on {MEASURED_AT} — they are not estimates, and they stop being true
        the day the hardware or the code changes.
      </p>

      <RangeControl range={range} onChange={setRange} />

      {summary.isLoading ? (
        <div className="dash-skeleton" style={{ height: 220 }} />
      ) : summary.isError ? (
        <p className="dash-inline-error">
          Could not load traffic for this range, so current load is unknown. The measured ceilings
          below are unaffected.
        </p>
      ) : null}

      {/* The asymmetry, stated once and shown immediately. */}
      <div
        className="dash-card"
        style={{ display: 'grid', gap: 32, padding: 24, marginBottom: 20 }}
      >
        <HeadroomBar
          title="Browsing"
          unit="req/sec"
          current={peakRps}
          sustained={READ_CAPACITY.sustained}
          ceiling={READ_CAPACITY.ceiling}
          p95Ms={READ_CAPACITY.p95Ms}
          limitedBy={READ_CAPACITY.limitedBy}
        />
        <HeadroomBar
          title="Buying"
          unit="orders/sec"
          current={peakOrdersPerSec}
          sustained={WRITE_CAPACITY.sustained}
          ceiling={WRITE_CAPACITY.ceiling}
          p95Ms={WRITE_CAPACITY.p95Ms}
          limitedBy={WRITE_CAPACITY.limitedBy}
        />
        <p style={{ margin: 0, fontSize: 13, color: 'var(--mr-fg-3)', lineHeight: 1.6 }}>
          Buying sustains a twentieth of what browsing does, and adding servers does not change
          it — every order goes through the one database. That gap, not the daily total, is what
          capacity planning here is about.
        </p>
      </div>

      {/* Concentration, made concrete. This is the failure mode that daily
          totals hide entirely. */}
      <div className="dash-card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 className="dash-section-title" style={{ marginTop: 0 }}>
          A drop, or a campaign
        </h2>
        <p className="dash-muted" style={{ maxWidth: '62ch', lineHeight: 1.6 }}>
          Daily volume is rarely the risk. Concentration is: the same orders that are effortless
          across an afternoon will fail if they all arrive at once.
        </p>

        <label className="dash-field" style={{ maxWidth: 280, marginTop: 8 }}>
          <span className="dash-label">People checking out at the same moment</span>
          <input
            type="number"
            className="dash-input"
            min={1}
            max={100_000}
            value={buyers}
            onChange={(e) => setBuyers(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>

        <div style={{ marginTop: 16 }}>
          <DerivationRow
            label="Time to clear the queue"
            value={
              drain < 60
                ? `${drain.toFixed(0)} seconds`
                : `${(drain / 60).toFixed(1)} minutes`
            }
            note={`At ${WRITE_CAPACITY.sustained} orders per second.`}
          />
          <DerivationRow
            label="The last person waits"
            value={
              drain < 60
                ? `${drain.toFixed(0)} seconds`
                : `${(drain / 60).toFixed(1)} minutes`
            }
            note={
              drain > 30
                ? 'Longer than most people will wait before reloading — and a reload adds another attempt to the queue.'
                : 'Within what a checkout spinner can hold.'
            }
          />
        </div>

        {drain > 30 ? (
          <p
            style={{
              margin: '14px 0 0',
              fontSize: 13,
              lineHeight: 1.6,
              color: 'var(--mr-crimson-600, #9B2C2C)',
            }}
          >
            Past the point where more servers help. Staggering access — a queue, timed entry, or
            a waiting room — is the fix; the database is the constraint and there is only one.
          </p>
        ) : null}
      </div>

      {/* The projection. Shown as a derivation so each step is auditable rather
          than a headline number nobody can check. */}
      <div className="dash-card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 className="dash-section-title" style={{ marginTop: 0 }}>
          How many customers this supports
        </h2>
        <p className="dash-muted" style={{ maxWidth: '62ch', lineHeight: 1.6 }}>
          Every line is derived from the one above it, so you can see which assumption to argue
          with rather than taking the last number on faith.
        </p>

        <div style={{ marginTop: 8 }}>
          <DerivationRow
            label="Sustained browsing capacity"
            value={`${READ_CAPACITY.sustained} req/sec`}
            note={`Measured ${MEASURED_AT}.`}
          />
          <DerivationRow
            label="Reserved for bursts"
            value={`÷ ${TRAFFIC_SHAPE.burstHeadroom}`}
            note="Assumption: arrivals inside the busy hour are not evenly spaced."
          />
          <DerivationRow label="Safe peak-hour rate" value={`${fmt(p.safePeakRps)} req/sec`} />
          <DerivationRow
            label="Busiest hour as a share of the day"
            value={`${TRAFFIC_SHAPE.peakHourShare * 100}%`}
            note="Assumption: typical e-commerce shape, not measured on this shop."
          />
          <DerivationRow label="Requests per day" value={fmt(p.dailyRequests)} />
          <DerivationRow
            label="Requests per session"
            value={String(REQUEST_COST.perSession)}
            note={`About ${REQUEST_COST.pagesPerSession} pages at ~${REQUEST_COST.perPageView} API calls each, from the storefront's own code.`}
          />
          <DerivationRow label="Sessions per day" value={fmt(p.sessionsPerDay)} />
          <DerivationRow
            label="Daily active customers"
            value={fmt(p.dau)}
            note={`At ${TRAFFIC_SHAPE.sessionsPerUserPerDay} sessions per person per day.`}
          />
          <DerivationRow
            label="Monthly active customers"
            value={fmt(p.mau)}
            note="The softest number here — it assumes a return rate this shop has not measured yet."
          />
          <DerivationRow
            label="People browsing at once"
            value={fmt(p.concurrentBrowsers)}
            note="At roughly one request every ten seconds each."
          />
        </div>
      </div>

      {/* Provenance. A capacity figure nobody can trace is a number people
          argue with instead of plan against. */}
      <div className="dash-card" style={{ padding: 24 }}>
        <h2 className="dash-section-title" style={{ marginTop: 0 }}>
          Where these numbers came from
        </h2>
        <div>
          <DerivationRow
            label="Measured on"
            value={MEASURED_AT}
            note={`${MEASURED_HARDWARE.cores} cores · ${MEASURED_HARDWARE.memoryGb} GB RAM · ${
              MEASURED_HARDWARE.swapGb === 0 ? 'no swap' : `${MEASURED_HARDWARE.swapGb} GB swap`
            }. ${MEASURED_HARDWARE.note}`}
          />
          <DerivationRow
            label="Method"
            value="k6, external"
            note="Load generated from outside the server. Running it on the box competes with the thing being measured and understates capacity by roughly a quarter."
          />
        </div>
        <p style={{ margin: '16px 0 0', fontSize: 13, color: 'var(--mr-fg-3)', lineHeight: 1.6 }}>
          Two things these figures do not cover. The catalogue they were measured against carried
          no product images, so image-heavy pages will behave differently. And the browsing number
          assumes repeat requests are being served from cache — traffic where every visitor asks
          for something unique pushes more of it through to the database.
        </p>
        <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--mr-fg-3)', lineHeight: 1.6 }}>
          Re-measure with <code>apps/minirue-backend/loadtest/</code> after any change to the
          server, the database, or how much traffic the shop actually gets, and update{' '}
          <code>lib/capacity-model.ts</code>.
        </p>
      </div>
    </div>
  );
}

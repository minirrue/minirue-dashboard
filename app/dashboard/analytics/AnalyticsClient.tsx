'use client';

import React from 'react';
import AnalyticsSubnav from '@/components/dashboard/AnalyticsSubnav';
import { useAnalyticsRange, useAudienceSummary } from '@/lib/hooks/use-analytics';
import type { AnalyticsFreshness } from '@/lib/api/analytics-insights';
import { useMinutesAgoLabel } from '@/lib/hooks/use-minutes-ago';
import StaffDeviceControl from './StaffDeviceControl';
import AnalyticsScopeBar from '@/components/dashboard/analytics/AnalyticsScopeBar';
import CommandCenter from '@/components/dashboard/analytics/command/CommandCenter';

/**
 * Lane 12 rewrite. Replaces the old hard-coded 8-tile + bar-table + funnel +
 * top-5 screen with `AnalyticsSubnav` + a header (range/compare, a freshness
 * indicator, the Edit layout toggle) + the registry-driven `OverviewGrid`.
 * See `OverviewGrid.tsx` for the widget composition and `OverviewGrid`'s own
 * header comment for the widgets the brief names that have no backing data
 * anywhere in this app yet.
 */

/** Small, always-on freshness note next to the range control — distinct from
 * the louder degraded banner below, which only appears when something is
 * actually behind. */
function FreshnessIndicator({ freshness }: { freshness: AnalyticsFreshness }) {
  // Clock read in an effect, and re-read on a timer — see useMinutesAgoLabel.
  // Computing it inline during render was impure AND left the label frozen at
  // whatever it said when the screen last re-rendered for some other reason.
  const label = useMinutesAgoLabel(freshness.rollupLastOkAt);
  if (!label) return null;
  return (
    <p style={{ fontSize: 12, color: 'var(--mr-fg-3)', margin: 0 }}>
      Updated {label}
    </p>
  );
}

/** Page-level banner for a stale rollup or ingest lag — every figure below
 * is still real data, just possibly behind, and the operator needs to know
 * by how much rather than discover it later. Only fires on an actual lag
 * (`staleBuckets > 0` with a rollup that has succeeded at least once) — a
 * rollup that has never run is the "empty" state each widget already
 * renders on its own, not a degradation banner. */
function CollectionDegradedBanner({ staleBuckets }: { staleBuckets: number }) {
  return (
    <div className="dash-degraded-banner" role="status">
      <span className="dash-status" data-status="warn">
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
        Data behind
      </span>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--mr-fg-2)' }}>
        {staleBuckets} bucket{staleBuckets === 1 ? '' : 's'} in this range {staleBuckets === 1 ? 'is' : 'are'} still
        catching up — figures below may be behind until the rollup finishes.
      </p>
    </div>
  );
}

export default function AnalyticsClient() {
  const { range, setRange } = useAnalyticsRange();

  // The command center reads the same audience summary — React Query dedupes
  // by key, so this is a cache hit used only for freshness and the banner.
  const freshnessProbe = useAudienceSummary(range);
  const freshness = freshnessProbe.data?.freshness;
  const degraded = !!freshness?.rollupLastOkAt && freshness.staleBuckets > 0;

  /*
   * One Overview (owner, 2026-09-19: "everything is scattered"). The old
   * editable widget board repeated the command center's numbers below it; its
   * useful parts now live inside the command center ("Who they are") and on
   * the screen each belongs to, and every figure links onward instead.
   */
  return (
    <>
      <AnalyticsSubnav />

      <div className="dash-page-header">
        <h1 className="dash-page-title cc-masthead">Analytics &amp; Media</h1>
      </div>

      <AnalyticsScopeBar
        range={range}
        onChange={setRange}
        quality={freshness ? <FreshnessIndicator freshness={freshness} /> : null}
      />

      {degraded && freshness ? <CollectionDegradedBanner staleBuckets={freshness.staleBuckets} /> : null}

      <CommandCenter range={range} />

      <StaffDeviceControl />
    </>
  );
}

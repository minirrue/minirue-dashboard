'use client';

import React, { useMemo, useReducer, useState } from 'react';
import AnalyticsSubnav from '@/components/dashboard/AnalyticsSubnav';
import OverviewGrid, { ANALYTICS_OVERVIEW_WIDGETS, buildDefaultOverviewLayout } from './OverviewGrid';
import AddWidgetPanel from './AddWidgetPanel';
import { useAnalyticsRange, useAudienceSummary } from '@/lib/hooks/use-analytics';
import type { AnalyticsRangeState } from '@/lib/hooks/use-analytics';
import { layoutReducer, loadLayout, saveLayout } from '@/lib/analytics/layout-store';
import type { AnalyticsFreshness } from '@/lib/api/analytics-insights';

/**
 * Lane 12 rewrite. Replaces the old hard-coded 8-tile + bar-table + funnel +
 * top-5 screen with `AnalyticsSubnav` + a header (range/compare, a freshness
 * indicator, the Edit layout toggle) + the registry-driven `OverviewGrid`.
 * See `OverviewGrid.tsx` for the widget composition and `OverviewGrid`'s own
 * header comment for the widgets the brief names that have no backing data
 * anywhere in this app yet.
 */

/** Same shape/behaviour as every sibling analytics screen's local
 * `RangeControl` (`AcquisitionClient.tsx`, `EventsExplorerClient.tsx`, …) —
 * this is "the shared date-range + compare control" the brief refers to;
 * there is no separate shared component file to import, only a shared
 * convention, so it is reproduced here rather than invented differently. */
function RangeControl({
  range,
  onChange,
}: {
  range: AnalyticsRangeState;
  onChange: (next: Partial<AnalyticsRangeState>) => void;
}) {
  return (
    <div className="dash-filters" style={{ marginBottom: 0 }}>
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
      <label className="dash-checkbox-label" style={{ marginLeft: 8 }}>
        <input
          type="checkbox"
          className="dash-checkbox"
          checked={range.compare}
          onChange={(e) => onChange({ compare: e.target.checked })}
        />
        Compare to previous period
      </label>
    </div>
  );
}

/** Small, always-on freshness note next to the range control — distinct from
 * the louder degraded banner below, which only appears when something is
 * actually behind. */
function FreshnessIndicator({ freshness }: { freshness: AnalyticsFreshness }) {
  if (!freshness.rollupLastOkAt) return null;
  const minutesAgo = Math.max(0, Math.round((Date.now() - new Date(freshness.rollupLastOkAt).getTime()) / 60_000));
  const label = minutesAgo === 0 ? 'just now' : `${minutesAgo} minute${minutesAgo === 1 ? '' : 's'} ago`;
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
  const [editMode, setEditMode] = useState(false);

  // Stable across the component's lifetime — the registry/composed-widget
  // list doesn't change at runtime, so this only needs to be computed once.
  const defaultLayout = useMemo(() => buildDefaultOverviewLayout(), []);
  const [layout, dispatch] = useReducer(layoutReducer, defaultLayout, loadLayout);

  // Every dispatch flows straight into localStorage — `saveLayout` is a
  // synchronous, side-effect-free write, so doing it inline (rather than in
  // a useEffect) avoids a render's worth of lag between an edit and it
  // surviving a refresh, and there is no cleanup to skip on unmount.
  function dispatchAndPersist(action: Parameters<typeof dispatch>[0]) {
    const next = layoutReducer(layout, action);
    dispatch(action);
    saveLayout(next);
  }

  // `useAudienceSummary` is already fetched by the first default widget —
  // React Query dedupes by key, so reading it again here for the header's
  // freshness indicator and the degraded banner is a cache hit, not a
  // second request. This component doesn't need a widget-shaped query of
  // its own.
  const freshnessProbe = useAudienceSummary(range);
  const freshness = freshnessProbe.data?.freshness;
  const degraded = !!freshness?.rollupLastOkAt && freshness.staleBuckets > 0;

  function handleAdd(id: string) {
    const widget = ANALYTICS_OVERVIEW_WIDGETS.find((w) => w.id === id);
    dispatchAndPersist({ type: 'add', id, size: widget?.defaultSize });
  }

  function handleReset() {
    dispatchAndPersist({ type: 'reset', defaults: defaultLayout });
  }

  return (
    <>
      <AnalyticsSubnav />

      <div className="dash-page-header">
        <h1 className="dash-page-title">Analytics overview</h1>
        <button
          type="button"
          className={editMode ? 'dash-btn-primary' : 'dash-btn-secondary'}
          onClick={() => setEditMode((v) => !v)}
          aria-pressed={editMode}
        >
          {editMode ? 'Done editing' : 'Edit layout'}
        </button>
      </div>

      <div className="dash-analytics-toolbar">
        <RangeControl range={range} onChange={setRange} />
        {freshness ? <FreshnessIndicator freshness={freshness} /> : null}
      </div>

      {degraded && freshness ? <CollectionDegradedBanner staleBuckets={freshness.staleBuckets} /> : null}

      <OverviewGrid
        widgets={ANALYTICS_OVERVIEW_WIDGETS}
        layout={layout}
        params={range}
        editMode={editMode}
        dispatch={dispatchAndPersist}
      />

      {editMode ? (
        <div style={{ marginTop: 20 }}>
          <AddWidgetPanel
            widgets={ANALYTICS_OVERVIEW_WIDGETS}
            layout={layout}
            onAdd={handleAdd}
            onReset={handleReset}
          />
        </div>
      ) : null}
    </>
  );
}

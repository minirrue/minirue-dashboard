'use client';

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnalyticsWidgetCard, ANALYTICS_WIDGETS } from '@/lib/analytics/widgets';
import type { AnalyticsWidgetDefinition } from '@/lib/analytics/widgets';
import {
  buildDefaultLayout,
  DEFAULT_WIDGET_SIZE,
} from '@/lib/analytics/layout-store';
import type { LayoutAction, LayoutItem, WidgetSize } from '@/lib/analytics/layout-store';
import {
  buildAnalyticsQueryString,
  egpShort,
} from '@/lib/api/analytics-insights';
import type {
  AnalyticsQueryParams,
  AnalyticsEnvelope,
  AudienceSummary,
  AudienceTimeseriesPoint,
  GeoRow,
  ProductRow,
  TechRow,
  ReconcileReport,
} from '@/lib/api/analytics-insights';
import type { ApiError } from '@/lib/api/client';
import { apiFetch } from '@/lib/api/client';
import { Sparkline } from '@/components/dashboard/charts';
import {
  useAudienceSummary,
  useAudienceTimeseries,
  useProductsTop,
  useTech,
  usePurchaseReconciliation,
} from '@/lib/hooks/use-analytics';
import WidgetEditBar from './WidgetEditBar';

/**
 * Lane 12 — the customisable overview grid. Composition, not invention: every
 * card renders through the already-committed `AnalyticsWidgetCard` (the
 * tappable-card shell, loading/error/no-data states, `.dash-card`) and every
 * layout mutation goes through the already-committed `layoutReducer`. This
 * file's own job is the grid shell, drag/keyboard reorder, and — because the
 * registry (`lib/analytics/widgets.tsx`, owned by another lane, not edited
 * here) only has 8 entries while the brief's default board names 14 — seven
 * additional widget definitions composed locally, below, from real hooks and
 * a real (if not-yet-wrapped) endpoint:
 *
 * - `dau-mau-stickiness`, `revenue-series`, `new-vs-returning` — all reuse an
 *   already-registered hook (`useAudienceSummary`/`useAudienceTimeseries`).
 *   `AudienceSummary`/`AudienceTimeseriesPoint` in
 *   `lib/api/analytics-insights.ts` were reconciled field-by-field against
 *   the real backend DTOs by another agent while this lane was in flight
 *   (see that file's own header comment, "Lane 16 reconciliation") — `dau`,
 *   `mau`, `stickiness` and `revenueMinor`/`bucket` are now properly typed,
 *   so these read them directly rather than through a defensive cast.
 * - `product-funnel-overview` — reuses `useProductsTop` (already registered
 *   for the `top-products` widget), summing `views`/`addToCarts`/`purchases`
 *   (`ProductRow`) across the returned rows into a view → cart → purchase
 *   funnel. Real numbers, no per-product selection to invent.
 * - `device-os-split` — `GET /analytics/tech` returns rows for ONE dimension
 *   per call (`?dimension=device|browser|os|osVersion`), not a combined
 *   `{ devices, browsers, operatingSystems }` object — `useDeviceOsSplit`
 *   below calls the real `useTech` hook twice (`device` and `os`) and
 *   combines the two real results into one shape this widget can render.
 * - `reconciliation-status` — `usePurchaseReconciliation`. The real
 *   `ReconcileReport` shape is a three-way count (`orders`/`purchaseEvents`/
 *   `attribution`) plus a `healthy` boolean, not a `{matched, unmatched}`
 *   pair — `healthy` is an even more direct at-a-glance signal than this
 *   lane's original guess.
 * - `country-split` — `GET /analytics/geo` (`web-analytics.controller.ts`)
 *   is real, but deliberately has no client function in
 *   `lib/api/analytics-insights.ts` yet (see that file's own trailing
 *   "endpoints with no caller" comment) or hook in `lib/hooks/use-analytics.ts`,
 *   and both files are off limits to edit here. Calls the shared low-level
 *   `apiFetch` directly (see `useCountrySplit` below) rather than adding an
 *   export to either — promote this into a real `apiGetGeo` + `useGeo` when
 *   convenient (see the lane-12 report).
 *
 * All 14 of the brief's named default widgets now have a real, non-fabricated
 * data path.
 */

/* ── Composed widgets — real hooks, not in the registry yet ─────────────── */

function NewVsReturningRender({ data }: { data: AnalyticsEnvelope<AudienceSummary> }) {
  if (!data.freshness.rollupLastOkAt) {
    return (
      <p className="dash-widget-empty">
        No visits recorded yet. Data appears within a minute of the first visitor.
      </p>
    );
  }
  if (data.data.visitors === 0) {
    return <p className="dash-widget-empty">No visitors in this range. Try a wider date range.</p>;
  }
  const newPct = Math.round((data.data.newVisitors / data.data.visitors) * 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="mr-num" style={{ fontSize: 26, fontWeight: 600, color: 'var(--mr-fg)' }}>
        {newPct}%
      </span>
      <span style={{ fontSize: 12, color: 'var(--mr-fg-3)' }}>
        new visitors · {100 - newPct}% returning
      </span>
    </div>
  );
}

/**
 * The headline metric this whole feature was built for. `dau`/`mau`/
 * `stickiness` are real, typed fields on `AudienceSummary` (matched against
 * `audience.dto.ts`/`audience.service.ts`'s `deriveAudienceSummary`, which
 * always computes and returns them).
 */
function DauMauRender({ data }: { data: AnalyticsEnvelope<AudienceSummary> }) {
  if (!data.freshness.rollupLastOkAt) {
    return (
      <p className="dash-widget-empty">
        No visits recorded yet. Data appears within a minute of the first visitor.
      </p>
    );
  }
  const { dau, mau, stickiness } = data.data;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="mr-num" style={{ fontSize: 26, fontWeight: 600, color: 'var(--mr-fg)' }}>
        {Math.round(stickiness * 100)}%
      </span>
      <span style={{ fontSize: 12, color: 'var(--mr-fg-3)' }}>
        stickiness · {dau.toLocaleString()} DAU / {mau.toLocaleString()} MAU
      </span>
    </div>
  );
}

/** Revenue over time. `AudienceTimeseriesPoint` (reconciled against the real
 * `dto/audience.dto.ts#TimeseriesPoint`) declares `bucket` and `revenueMinor`
 * directly — the backend returns every `DAY_TIMESERIES_METRICS` field
 * because this client never sends a `metrics` filter
 * (`audience.service.ts`'s `requestedMetrics` default-allowlist behaviour). */
function RevenueSeriesRender({ data }: { data: AnalyticsEnvelope<AudienceTimeseriesPoint[]> }) {
  if (!data.freshness.rollupLastOkAt) {
    return <p className="dash-widget-empty">No revenue recorded yet.</p>;
  }
  const points = data.data;
  if (points.length === 0) {
    return <p className="dash-widget-empty">No data in this range. Try a wider date range.</p>;
  }
  const revenues = points.map((p) => p.revenueMinor);
  const total = revenues.reduce((sum, v) => sum + v, 0);
  const lastLabel = points[points.length - 1].bucket;
  return (
    <>
      <Sparkline values={revenues} />
      <span style={{ fontSize: 12, color: 'var(--mr-fg-3)' }}>
        {egpShort(total)} total · {egpShort(revenues[revenues.length - 1])} on {lastLabel}
      </span>
    </>
  );
}

/** Aggregate view → cart → purchase across the top products in this range —
 * real per-product funnel fields (`views`/`addToCarts`/`purchases` on
 * `ProductRow`), summed rather than picking one arbitrary product to
 * spotlight (which felt like inventing a selection rule, not composing real
 * data). Reuses `useProductsTop`, already fetched for the registry's
 * `top-products` widget — a cache hit, not a second request. */
function ProductFunnelRender({ data }: { data: AnalyticsEnvelope<ProductRow[]> }) {
  if (!data.freshness.rollupLastOkAt) {
    return <p className="dash-widget-empty">No product activity recorded yet.</p>;
  }
  const rows = data.data;
  if (rows.length === 0) {
    return <p className="dash-widget-empty">No product activity in this range. Try a wider date range.</p>;
  }
  const totalViews = rows.reduce((sum, r) => sum + r.views, 0);
  const totalAdds = rows.reduce((sum, r) => sum + r.addToCarts, 0);
  const totalPurchases = rows.reduce((sum, r) => sum + r.purchases, 0);
  const stages: { label: string; value: number }[] = [
    { label: 'Viewed', value: totalViews },
    { label: 'Added to cart', value: totalAdds },
    { label: 'Purchased', value: totalPurchases },
  ];
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {stages.map((stage) => {
        const rate = totalViews > 0 ? (stage.value / totalViews) * 100 : 0;
        return (
          <li key={stage.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--mr-fg-2)' }}>
            <span>{stage.label}</span>
            <span className="mr-num">{stage.value.toLocaleString()} · {rate.toFixed(1)}%</span>
          </li>
        );
      })}
    </ul>
  );
}

// GeoRow and buildAnalyticsQueryString now live in lib/api/analytics-insights.ts —
// promoted once Acquisition needed them too, so there is one copy, not two.

/** `GET /analytics/geo` is real (`web-analytics.controller.ts`) but has no
 * client function or hook yet — see this file's header comment for why this
 * calls `apiFetch` directly instead of adding one to `analytics-insights.ts`
 * or `use-analytics.ts`. Mirrors `useEnvelopeQuery` in `use-analytics.ts`
 * closely enough to drop in as a real `useGeo` later with no call-site
 * changes here. */
function useCountrySplit(params: AnalyticsQueryParams) {
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

function CountrySplitRender({ data }: { data: AnalyticsEnvelope<GeoRow[]> }) {
  if (!data.freshness.rollupLastOkAt) {
    return <p className="dash-widget-empty">No visits recorded yet.</p>;
  }
  if (data.data.length === 0) {
    return <p className="dash-widget-empty">No country data in this range. Try a wider date range.</p>;
  }
  const top = [...data.data].sort((a, b) => b.visitors - a.visitors).slice(0, 3);
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {top.map((row) => (
        <li key={row.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--mr-fg-2)' }}>
          <span>{row.key}</span>
          <span className="mr-num">{row.visitors.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

interface DeviceOsSplitData {
  devices: TechRow[];
  os: TechRow[];
}

/** `GET /analytics/tech` returns rows for exactly one dimension per call
 * (`TechRow[]`, not a combined `{ devices, browsers, operatingSystems }`
 * object) — calls the real `useTech` hook twice (`device`, `os`) and merges
 * the two real results into one `{data, isLoading, isError}` shape, the same
 * contract every other widget's `useData` satisfies. Both calls share the
 * registry's `useTech` implementation and query-key factory; nothing here
 * duplicates fetch/cache logic, just combines two real results. */
function useDeviceOsSplit(params: AnalyticsQueryParams) {
  const device = useTech(params, 'device');
  const os = useTech(params, 'os');
  const data: AnalyticsEnvelope<DeviceOsSplitData> | undefined =
    device.data && os.data
      ? {
          range: device.data.range,
          freshness: device.data.freshness,
          data: { devices: device.data.data, os: os.data.data },
        }
      : undefined;
  return {
    data,
    isLoading: device.isLoading || os.isLoading,
    isError: device.isError || os.isError,
  };
}

function DeviceOsRender({ data }: { data: AnalyticsEnvelope<DeviceOsSplitData> }) {
  if (!data.freshness.rollupLastOkAt) {
    return <p className="dash-widget-empty">No visits recorded yet.</p>;
  }
  const devices = [...data.data.devices].sort((a, b) => b.sessions - a.sessions);
  const os = [...data.data.os].sort((a, b) => b.sessions - a.sessions);
  if (devices.length === 0 && os.length === 0) {
    return <p className="dash-widget-empty">No device data in this range. Try a wider date range.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ShareList label="Device" rows={devices} />
      <ShareList label="Operating system" rows={os} />
    </div>
  );
}

/**
 * A ranked breakdown with each row's share of the total drawn as a bar.
 *
 * This widget used to print only `devices[0]` and `os[0]` — "top device" and
 * "top OS" — which answers "what is most common" but not the question anyone
 * actually opens it for: how the audience SPLITS. Knowing mobile leads is
 * worthless without knowing whether it is 55% or 95%; those two numbers imply
 * completely different decisions about where design effort goes.
 *
 * The bar is the measurement, not decoration: its width IS the share, so the
 * proportions are readable before any number is. Shares are computed against
 * the summed total rather than against the largest row, so they add to 100%
 * and can be read as "this much of my traffic".
 */
function ShareList({
  label,
  rows,
}: {
  label: string;
  rows: { key: string; sessions: number }[];
}) {
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, r) => sum + r.sessions, 0);
  if (total === 0) return null;

  // Five keeps a medium widget readable; anything beyond it is long-tail noise
  // that the Acquisition screen shows in full.
  const shown = rows.slice(0, 5);
  const remainder = rows.slice(5).reduce((sum, r) => sum + r.sessions, 0);

  return (
    <div>
      <p
        style={{
          margin: '0 0 6px',
          fontSize: 11,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--mr-fg-4)',
        }}
      >
        {label}
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {shown.map((row) => {
          const pct = (row.sessions / total) * 100;
          return (
            <li key={row.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: 'var(--mr-fg-2)' }}>
                {/* Capitalised for display only — the API returns lowercase keys
                    like `mobile`, and rewriting them at the source would break
                    the Acquisition screen's dimension filters. */}
                <span style={{ textTransform: 'capitalize' }}>{row.key || 'Unknown'}</span>
                <span className="mr-num" style={{ color: 'var(--mr-fg-3)', whiteSpace: 'nowrap' }}>
                  {pct.toFixed(pct < 10 ? 1 : 0)}% · {row.sessions.toLocaleString()}
                </span>
              </div>
              <div
                aria-hidden="true"
                style={{
                  marginTop: 3,
                  height: 3,
                  borderRadius: 2,
                  background: 'var(--mr-line-2, rgba(0,0,0,0.07))',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    // Hairline minimum so a 0.2% row is still visibly present
                    // rather than rendering as an empty track.
                    width: `${Math.max(pct, 1.5)}%`,
                    height: '100%',
                    background: 'var(--mr-gold-400)',
                  }}
                />
              </div>
            </li>
          );
        })}
        {remainder > 0 ? (
          <li style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--mr-fg-4)' }}>
            <span>{rows.length - shown.length} more</span>
            <span className="mr-num">{((remainder / total) * 100).toFixed(0)}%</span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </svg>
  );
}

/**
 * The one widget on this page that is not decoration (see DESIGN.md / lane
 * brief): when tracked purchases and real orders diverge, every other figure
 * on the page is suspect, so this has to read at a glance — an icon plus a
 * label, never colour alone, using the same status token pairs as
 * `StatusBadge` elsewhere in the dashboard. `ReconcileReport` (reconciled
 * against `dto/reconcile.dto.ts`) is a three-way count — orders, tracked
 * purchase events, and attribution rows — plus a `healthy` boolean, not the
 * `{matched, unmatched}` pair this lane originally guessed. `healthy` is an
 * even more direct signal: false the moment ANY side disagrees.
 */
function ReconciliationRender({ data }: { data: AnalyticsEnvelope<ReconcileReport> }) {
  if (!data.freshness.rollupLastOkAt) {
    return (
      <p className="dash-widget-empty">
        No purchases recorded yet. Reconciliation begins once the first tracked purchase and the
        first order both land.
      </p>
    );
  }
  const { orders, purchaseEvents, attribution, healthy, mismatches } = data.data;
  if (orders.count === 0 && purchaseEvents.count === 0) {
    return <p className="dash-widget-empty">No purchases in this range. Try a wider date range.</p>;
  }
  const mismatchCount =
    mismatches.ordersMissingAttribution.length +
    mismatches.attributionMissingOrder.length +
    mismatches.purchaseEventsMissingOrder.length +
    mismatches.ordersMissingPurchaseEvent.length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="dash-status" data-status={healthy ? 'ok' : 'danger'} style={{ alignSelf: 'flex-start' }}>
        {healthy ? <CheckIcon /> : <AlertIcon />}
        {healthy ? 'Reconciled' : `${mismatchCount.toLocaleString()} mismatch${mismatchCount === 1 ? '' : 'es'}`}
      </span>
      <span style={{ fontSize: 13, color: 'var(--mr-fg-2)' }}>
        {orders.count.toLocaleString()} orders · {purchaseEvents.count.toLocaleString()} tracked purchases ·{' '}
        {attribution.count.toLocaleString()} attributed
      </span>
      {!healthy && (
        <span style={{ fontSize: 12, color: 'var(--mr-fg-3)' }}>
          Figures on this page may be unreliable until this is resolved.
        </span>
      )}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any -- matches
   `lib/analytics/widgets.tsx`'s own registry array: a list mixing different
   `T`s per entry is inherently heterogeneous, and every consumer here
   iterates the array generically rather than widening one entry's `T`. */
const LOCAL_WIDGETS: AnalyticsWidgetDefinition<any>[] = [
  {
    id: 'dau-mau-stickiness',
    title: 'Stickiness (DAU/MAU)',
    description: 'Daily active over monthly active — how often visitors come back. The headline metric this feature was built for.',
    defaultSize: 'sm',
    href: '/analytics/visitors',
    useData: useAudienceSummary,
    Render: DauMauRender,
  },
  {
    id: 'revenue-series',
    title: 'Revenue trend',
    description: 'Daily revenue across the range.',
    defaultSize: 'md',
    href: '/analytics/visitors',
    useData: useAudienceTimeseries,
    Render: RevenueSeriesRender,
  },
  {
    id: 'new-vs-returning',
    title: 'New vs returning',
    description: 'Share of visitors new to the site in this range.',
    defaultSize: 'sm',
    href: '/analytics/visitors',
    useData: useAudienceSummary,
    Render: NewVsReturningRender,
  },
  {
    id: 'product-funnel-overview',
    title: 'Product funnel',
    description: 'View → add to cart → purchase, summed across the top products in this range.',
    defaultSize: 'md',
    href: '/analytics/products',
    useData: useProductsTop,
    Render: ProductFunnelRender,
  },
  {
    id: 'device-os-split',
    title: 'Devices & OS',
    // Was "Leading device type and operating system" — the widget now shows the
    // whole split, and the split is the point: "mobile leads" is not actionable,
    // "mobile is 78%" is.
    description: 'How your traffic splits across device types and operating systems.',
    // Promoted from md: five device rows plus five OS rows need the height, and
    // this is the widget marketing decisions are made from.
    defaultSize: 'lg',
    href: '/analytics/acquisition',
    useData: useDeviceOsSplit,
    Render: DeviceOsRender,
  },
  {
    id: 'country-split',
    title: 'Countries',
    description: 'Visitors by country in this range.',
    defaultSize: 'sm',
    href: '/analytics/acquisition',
    useData: useCountrySplit,
    Render: CountrySplitRender,
  },
  {
    id: 'reconciliation-status',
    title: 'Purchase reconciliation',
    description: "Tracked purchases checked against real orders — the trust check for every other number on this page.",
    defaultSize: 'lg',
    href: '/analytics/events',
    useData: usePurchaseReconciliation,
    Render: ReconciliationRender,
  },
];

/** Every widget available to the overview: the committed registry plus the
 * seven composed above. `AddWidgetPanel` and the default-layout builder both
 * read from this, never from `ANALYTICS_WIDGETS` directly, so a widget
 * hidden today can always be found and re-added. */
export const ANALYTICS_OVERVIEW_WIDGETS: AnalyticsWidgetDefinition<any>[] = [
  ...ANALYTICS_WIDGETS,
  ...LOCAL_WIDGETS,
];
// Disable stays in effect below: `OverviewGridProps.widgets` and the
// visible-widget lookup are the same heterogeneous-array shape.

/**
 * The default board, in the order the brief specifies, filtered to the ids
 * that actually resolve to a widget (registry ids are stable and owned
 * elsewhere; this list should never silently drop one, but a `find` guard
 * costs nothing and keeps a future registry rename from crashing the page
 * instead of just leaving a widget off the default board).
 *
 * All 14 of the brief's named widgets are here now — see this file's header
 * comment for how `dau-mau-stickiness`, `revenue-series`,
 * `product-funnel-overview` and `country-split` are backed by real data
 * despite not (yet) having a registered hook of their own.
 */
const DEFAULT_WIDGET_ORDER = [
  'dau-mau-stickiness',
  'audience-summary',
  'audience-trend',
  'realtime',
  'revenue-series',
  'new-vs-returning',
  'top-pages',
  'top-products',
  'product-funnel-overview',
  'checkout-funnel',
  'acquisition',
  'device-os-split',
  'country-split',
  'reconciliation-status',
];

export function buildDefaultOverviewLayout(): LayoutItem[] {
  return buildDefaultLayout(
    DEFAULT_WIDGET_ORDER.map((id) => {
      const widget = ANALYTICS_OVERVIEW_WIDGETS.find((w) => w.id === id);
      return { id, defaultSize: widget?.defaultSize ?? DEFAULT_WIDGET_SIZE };
    }),
  );
}

const SIZE_ORDER: WidgetSize[] = ['sm', 'md', 'lg', 'full'];

/** sm → md → lg → full → sm — the edit-mode size-cycle button's mapping. */
export function nextSize(size: WidgetSize): WidgetSize {
  const i = SIZE_ORDER.indexOf(size);
  return SIZE_ORDER[(i + 1) % SIZE_ORDER.length];
}

const SIZE_CLASS: Record<WidgetSize, string> = {
  sm: 'dash-widget-sm',
  md: 'dash-widget-md',
  lg: 'dash-widget-lg',
  full: 'dash-widget-full',
};

export interface OverviewGridProps {
  /** All widgets that could appear — `ANALYTICS_OVERVIEW_WIDGETS` in
   * production, a smaller fixture in tests. */
  widgets: AnalyticsWidgetDefinition<any>[];
  layout: LayoutItem[];
  params: AnalyticsQueryParams;
  editMode: boolean;
  dispatch: (action: LayoutAction) => void;
}

export default function OverviewGrid({ widgets, layout, params, editMode, dispatch }: OverviewGridProps) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [justMovedId, setJustMovedId] = useState<string | null>(null);

  // Clears the "just moved" pulse ~200ms after a reorder — long enough to
  // read as motion, short enough to never look like a lingering highlight.
  // Collapses to nothing under prefers-reduced-motion via the global rule in
  // mr-tokens.css (animation-duration: 0.01ms !important).
  useEffect(() => {
    if (justMovedId == null) return;
    const timer = setTimeout(() => setJustMovedId(null), 220);
    return () => clearTimeout(timer);
  }, [justMovedId]);

  function reorderTo(id: string, toOrder: number) {
    dispatch({ type: 'reorder', id, toOrder: Math.max(0, toOrder) });
    setJustMovedId(id);
  }

  const visible = layout
    .filter((item) => item.visible)
    .sort((a, b) => a.order - b.order)
    .map((item) => ({ item, widget: widgets.find((w) => w.id === item.id) }))
    .filter((entry): entry is { item: LayoutItem; widget: AnalyticsWidgetDefinition<any> } => !!entry.widget);

  if (visible.length === 0) {
    return (
      <div className="dash-card" style={{ padding: 32, textAlign: 'center' }}>
        <p className="dash-help-text" style={{ margin: 0 }}>
          Every widget is hidden. Turn on Edit layout to add one back, or reset to the default board.
        </p>
      </div>
    );
  }

  return (
    <div className="dash-widget-grid" role="list" aria-label="Analytics overview widgets">
      {visible.map(({ item, widget }, index) => {
        const classes = [
          'dash-widget-slot',
          SIZE_CLASS[item.size],
          dragOverId === item.id ? 'is-drag-over' : '',
          justMovedId === item.id ? 'just-moved' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div
            key={item.id}
            role="listitem"
            className={classes}
            onDragOver={(e) => {
              if (!editMode) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverId !== item.id) setDragOverId(item.id);
            }}
            onDragLeave={() => setDragOverId((current) => (current === item.id ? null : current))}
            onDrop={(e) => {
              if (!editMode) return;
              e.preventDefault();
              setDragOverId(null);
              const sourceId = e.dataTransfer.getData('text/plain');
              if (!sourceId || sourceId === item.id) return;
              reorderTo(sourceId, item.order);
            }}
          >
            {editMode ? (
              <WidgetEditBar
                title={widget.title}
                size={item.size}
                position={index + 1}
                total={visible.length}
                onMoveEarlier={() => reorderTo(item.id, item.order - 1)}
                onMoveLater={() => reorderTo(item.id, item.order + 1)}
                onResize={() => dispatch({ type: 'resize', id: item.id, size: nextSize(item.size) })}
                onRemove={() => dispatch({ type: 'remove', id: item.id })}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', item.id);
                }}
              />
            ) : null}
            <AnalyticsWidgetCard widget={widget} params={params} />
          </div>
        );
      })}
    </div>
  );
}

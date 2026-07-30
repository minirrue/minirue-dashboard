'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
// Chart kit owned by Lane 4 (`components/dashboard/charts/**`) — not touched
// here, only imported.
import { Sparkline } from '@/components/dashboard/charts';
import type { AnalyticsEnvelope, AnalyticsQueryParams } from '@/lib/api/analytics-insights';
import type {
  AudienceSummary,
  AudienceTimeseriesPoint,
  LiveSummary,
  PageRow,
  ProductRow,
  SourceRow,
  CheckoutFunnelStep,
  SearchRow,
} from '@/lib/api/analytics-insights';
import {
  useAudienceSummary,
  useAudienceTimeseries,
  useRealtime,
  useTopPages,
  useProductsTop,
  useSources,
  useCheckoutFunnel,
  useSearchTerms,
} from '@/lib/hooks/use-analytics';
import type { WidgetSize } from './layout-store';

/**
 * The widget registry for the customisable analytics overview. A later lane
 * (12 — "Overview rebuild + widget grid rendering") reads this array plus
 * `layout-store.ts`'s persisted layout to lay out the actual grid; this
 * lane builds the entries and the tappable-card shell they render through.
 */

/** Structural subset of `UseQueryResult` — every hook in
 * `lib/hooks/use-analytics.ts` satisfies this, so a registry entry's
 * `useData` can point straight at one of them with no adapter. */
export interface AnalyticsWidgetQueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
}

export interface AnalyticsWidgetDefinition<T> {
  id: string;
  title: string;
  description: string;
  defaultSize: WidgetSize;
  /** The drill-down this widget summarises. The whole card links here —
   * widgets are never mouse-only affordances. */
  href: string;
  useData: (params: AnalyticsQueryParams) => AnalyticsWidgetQueryResult<T>;
  Render: ComponentType<{ data: T }>;
}

function StatLine({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span className="mr-num" style={{ fontSize: 26, fontWeight: 600, color: 'var(--mr-fg)' }}>
        {value}
      </span>
      <span style={{ fontSize: 12, color: 'var(--mr-fg-4)' }}>{label}</span>
    </div>
  );
}

/* ── Render components — every number below comes straight off the hook's
   envelope; there is no placeholder path (DESIGN.md bans fabricated metric
   data outright). An empty range renders as an honest zero, never a made-up
   sample figure. ── */

function AudienceSummaryRender({ data }: { data: AnalyticsEnvelope<AudienceSummary> }) {
  return <StatLine value={data.data.visitors.toLocaleString()} label="visitors in range" />;
}

function AudienceTrendRender({ data }: { data: AnalyticsEnvelope<AudienceTimeseriesPoint[]> }) {
  const points = data.data;
  if (points.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--mr-fg-4)', margin: 0 }}>No data in this range.</p>;
  }
  return (
    <>
      <Sparkline values={points.map((p) => p.visitors)} />
      <span style={{ fontSize: 12, color: 'var(--mr-fg-4)' }}>
        {points[points.length - 1].visitors.toLocaleString()} visitors on {points[points.length - 1].bucket}
      </span>
    </>
  );
}

function RealtimeRender({ data }: { data: AnalyticsEnvelope<LiveSummary> }) {
  return <StatLine value={data.data.onlineNow.toLocaleString()} label="active right now" />;
}

function TopPagesRender({ data }: { data: AnalyticsEnvelope<PageRow[]> }) {
  const top = data.data.slice(0, 3);
  if (top.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--mr-fg-4)', margin: 0 }}>No page views in this range.</p>;
  }
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {top.map((page) => (
        <li key={page.path} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--mr-fg-2)' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page.path}</span>
          <span className="mr-num">{page.pageviews.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

function TopProductsRender({ data }: { data: AnalyticsEnvelope<ProductRow[]> }) {
  const top = data.data.slice(0, 3);
  if (top.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--mr-fg-4)', margin: 0 }}>No product activity in this range.</p>;
  }
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {top.map((product) => (
        <li key={product.productId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--mr-fg-2)' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name ?? product.productId}</span>
          <span className="mr-num">{product.purchases.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

function AcquisitionRender({ data }: { data: AnalyticsEnvelope<SourceRow[]> }) {
  const top = data.data.slice(0, 3);
  if (top.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--mr-fg-4)', margin: 0 }}>No traffic sources in this range.</p>;
  }
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {top.map((source) => (
        <li key={source.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--mr-fg-2)' }}>
          <span>{source.key}</span>
          <span className="mr-num">{source.visitors.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

function CheckoutFunnelRender({ data }: { data: AnalyticsEnvelope<CheckoutFunnelStep[]> }) {
  const steps = data.data;
  if (steps.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--mr-fg-4)', margin: 0 }}>No checkout activity in this range.</p>;
  }
  const first = steps[0];
  const last = steps[steps.length - 1];
  const reachRate = first.count > 0 ? (last.count / first.count) * 100 : 0;
  return <StatLine value={`${reachRate.toFixed(1)}%`} label={`reach "${last.step}"`} />;
}

function SearchRender({ data }: { data: AnalyticsEnvelope<SearchRow[]> }) {
  const top = data.data.slice(0, 3);
  if (top.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--mr-fg-4)', margin: 0 }}>No searches in this range.</p>;
  }
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {top.map((term) => (
        <li key={term.queryText} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--mr-fg-2)' }}>
          <span>{term.queryText}</span>
          <span className="mr-num">{term.searches.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any -- a registry mixing
   different `T`s per entry is inherently heterogeneous; consumers iterate
   the array generically and never widen a single entry's own `T`. */
export const ANALYTICS_WIDGETS: AnalyticsWidgetDefinition<any>[] = [
  {
    id: 'audience-summary',
    title: 'Visitors',
    description: 'Unique visitors and sessions in the selected range.',
    defaultSize: 'md',
    href: '/analytics/visitors',
    useData: useAudienceSummary,
    Render: AudienceSummaryRender,
  },
  {
    id: 'audience-trend',
    title: 'Traffic trend',
    description: 'Daily visitors across the range.',
    defaultSize: 'md',
    href: '/analytics/visitors',
    useData: useAudienceTimeseries,
    Render: AudienceTrendRender,
  },
  {
    id: 'realtime',
    title: 'Right now',
    description: 'Visitors active on the site this minute.',
    defaultSize: 'sm',
    href: '/analytics/realtime',
    useData: useRealtime,
    Render: RealtimeRender,
  },
  {
    id: 'top-pages',
    title: 'Top pages',
    description: 'Most viewed pages in the range.',
    defaultSize: 'lg',
    href: '/analytics/pages',
    useData: useTopPages,
    Render: TopPagesRender,
  },
  {
    id: 'top-products',
    title: 'Top products',
    description: 'Best performing products by purchases.',
    defaultSize: 'lg',
    href: '/analytics/products',
    useData: useProductsTop,
    Render: TopProductsRender,
  },
  {
    id: 'acquisition',
    title: 'Acquisition',
    description: 'Where visitors are coming from.',
    defaultSize: 'md',
    href: '/analytics/acquisition',
    useData: useSources,
    Render: AcquisitionRender,
  },
  {
    id: 'checkout-funnel',
    title: 'Checkout funnel',
    description: 'Conversion through the checkout steps.',
    defaultSize: 'md',
    href: '/analytics/checkout',
    useData: useCheckoutFunnel,
    Render: CheckoutFunnelRender,
  },
  {
    id: 'search',
    title: 'Site search',
    description: 'What visitors are searching for.',
    defaultSize: 'sm',
    href: '/analytics/events',
    useData: useSearchTerms,
    Render: SearchRender,
  },
];
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * The tappable widget card: the whole card is the link (not just a "view
 * more" affordance inside it), keyboard-reachable, with the browser's
 * default focus ring left intact (nothing in this file or in
 * `dashboard.css`/`mr-tokens.css` suppresses `:focus-visible` on an anchor).
 */
export function AnalyticsWidgetCard<T>({
  widget,
  params,
}: {
  widget: AnalyticsWidgetDefinition<T>;
  params: AnalyticsQueryParams;
}) {
  const { data, isLoading, isError } = widget.useData(params);

  return (
    <Link
      href={widget.href}
      className="dash-card"
      data-trace-id={`PG-DASHBOARD-ANL-000::EL-LINK-widget-${widget.id}`}
      style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 140, textDecoration: 'none' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="dash-section-title" style={{ margin: 0 }}>{widget.title}</span>
        <span style={{ fontSize: 12, color: 'var(--mr-fg-4)' }}>{widget.description}</span>
      </div>
      {isLoading ? (
        <span className="dash-skeleton" style={{ width: '70%', height: 28 }} />
      ) : isError ? (
        <p className="dash-inline-error" style={{ margin: 0 }}>Couldn&apos;t load.</p>
      ) : data === undefined ? (
        <p style={{ fontSize: 13, color: 'var(--mr-fg-4)', margin: 0 }}>No data in this range.</p>
      ) : (
        <widget.Render data={data} />
      )}
    </Link>
  );
}

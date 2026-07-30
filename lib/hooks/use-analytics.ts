import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as api from '@/lib/api/analytics-insights';
import type { AnalyticsEnvelope, AnalyticsQueryParams } from '@/lib/api/analytics-insights';
import type { ApiError } from '@/lib/api/client';

/**
 * React Query hooks for the visitor-analytics query API. `RootQueryProvider`
 * is already mounted at `app/layout.tsx`, so every hook below just calls
 * `useQuery` directly — no local `useState`/`useMountedEffect` plumbing like
 * the current (pre-Lane-6) analytics screens use.
 */

/** Daily-grain data doesn't need to be fresher than this — matches the
 * brief exactly and keeps every non-realtime screen from refetching on
 * every focus/mount. */
const DAILY_STALE_TIME = 60_000;
const REALTIME_INTERVAL = 10_000;

const BASE_KEY = ['analytics'] as const;

/** Shared query-key factory so cache entries and invalidation stay coherent
 * across every screen that reads the same endpoint with different params. */
export const analyticsKeys = {
  all: BASE_KEY,
  audienceSummary: (p: AnalyticsQueryParams) => [...BASE_KEY, 'audience-summary', p] as const,
  audienceTimeseries: (p: AnalyticsQueryParams) => [...BASE_KEY, 'audience-timeseries', p] as const,
  live: (p: AnalyticsQueryParams) => [...BASE_KEY, 'live', p] as const,
  liveVisitors: (p: AnalyticsQueryParams) => [...BASE_KEY, 'live-visitors', p] as const,
  topPages: (p: AnalyticsQueryParams) => [...BASE_KEY, 'pages-top', p] as const,
  entryPages: (p: AnalyticsQueryParams) => [...BASE_KEY, 'pages-entry', p] as const,
  exitPages: (p: AnalyticsQueryParams) => [...BASE_KEY, 'pages-exit', p] as const,
  productsTop: (p: AnalyticsQueryParams) => [...BASE_KEY, 'products-top', p] as const,
  productFunnel: (productId: string, p: AnalyticsQueryParams) =>
    [...BASE_KEY, 'product-funnel', productId, p] as const,
  sources: (p: AnalyticsQueryParams) => [...BASE_KEY, 'sources', p] as const,
  campaignDetail: (campaign: string, p: AnalyticsQueryParams) =>
    [...BASE_KEY, 'campaign-detail', campaign, p] as const,
  tech: (p: AnalyticsQueryParams) => [...BASE_KEY, 'tech', p] as const,
  checkoutFunnel: (p: AnalyticsQueryParams) => [...BASE_KEY, 'checkout-funnel', p] as const,
  paymentsFunnel: (p: AnalyticsQueryParams) => [...BASE_KEY, 'payments-funnel', p] as const,
  abandonedCheckouts: (p: AnalyticsQueryParams) => [...BASE_KEY, 'checkout-abandoned', p] as const,
  cartFunnel: (p: AnalyticsQueryParams) => [...BASE_KEY, 'cart-funnel', p] as const,
  searchTerms: (p: AnalyticsQueryParams) => [...BASE_KEY, 'search', p] as const,
  visitors: (p: AnalyticsQueryParams) => [...BASE_KEY, 'visitors', p] as const,
  visitorDetail: (id: string, p: AnalyticsQueryParams) => [...BASE_KEY, 'visitor', id, p] as const,
  visitorJourney: (id: string, p: AnalyticsQueryParams) =>
    [...BASE_KEY, 'visitor-journey', id, p] as const,
  quality: (p: AnalyticsQueryParams) => [...BASE_KEY, 'quality', p] as const,
  reconcilePurchases: (p: AnalyticsQueryParams) => [...BASE_KEY, 'reconcile-purchases', p] as const,
};

interface EnvelopeQueryOptions {
  staleTime?: number;
  enabled?: boolean;
  refetchInterval?: number | false;
}

/**
 * `apiFetch` rejects with `ApiError` (`{ status, message }`), not an `Error`
 * instance — pinning `TError` here means every screen's `.error` is already
 * `ApiError | null`, with no per-call-site cast (and no `Error`-vs-`ApiError`
 * type-overlap error) needed to read `.error?.message`.
 */
function useEnvelopeQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<AnalyticsEnvelope<T>>,
  options: EnvelopeQueryOptions = {},
) {
  return useQuery<AnalyticsEnvelope<T>, ApiError>({
    queryKey,
    queryFn,
    staleTime: options.staleTime ?? DAILY_STALE_TIME,
    enabled: options.enabled,
    refetchInterval: options.refetchInterval,
  });
}

/** True while the tab/window is visible. Realtime polling pauses on `false`
 * rather than burning requests (and the user's data plan) on a backgrounded
 * tab — mirrors `useSupportLiveSync`'s visibilitychange pattern. */
function usePageVisible(): boolean {
  const [visible, setVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
  );
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

/* ── Audience ─────────────────────────────────────────────────────────── */

export function useAudienceSummary(params: AnalyticsQueryParams) {
  return useEnvelopeQuery(analyticsKeys.audienceSummary(params), () => api.apiGetAudienceSummary(params));
}

export function useAudienceTimeseries(params: AnalyticsQueryParams) {
  return useEnvelopeQuery(analyticsKeys.audienceTimeseries(params), () =>
    api.apiGetAudienceTimeseries(params),
  );
}

/* ── Realtime — 10s poll, paused when the tab is hidden ──────────────── */

export function useRealtime(params: AnalyticsQueryParams) {
  const visible = usePageVisible();
  return useEnvelopeQuery(analyticsKeys.live(params), () => api.apiGetLiveSummary(params), {
    staleTime: 0,
    refetchInterval: visible ? REALTIME_INTERVAL : false,
  });
}

export function useLiveVisitors(params: AnalyticsQueryParams) {
  const visible = usePageVisible();
  return useEnvelopeQuery(analyticsKeys.liveVisitors(params), () => api.apiGetLiveVisitors(params), {
    staleTime: 0,
    refetchInterval: visible ? REALTIME_INTERVAL : false,
  });
}

/* ── Pages ────────────────────────────────────────────────────────────── */

export function useTopPages(params: AnalyticsQueryParams) {
  return useEnvelopeQuery(analyticsKeys.topPages(params), () => api.apiGetTopPages(params));
}

export function useEntryPages(params: AnalyticsQueryParams) {
  return useEnvelopeQuery(analyticsKeys.entryPages(params), () => api.apiGetEntryPages(params));
}

export function useExitPages(params: AnalyticsQueryParams) {
  return useEnvelopeQuery(analyticsKeys.exitPages(params), () => api.apiGetExitPages(params));
}

/* ── Products ─────────────────────────────────────────────────────────── */

export function useProductsTop(params: AnalyticsQueryParams) {
  return useEnvelopeQuery(analyticsKeys.productsTop(params), () => api.apiGetProductsTop(params));
}

export function useProductFunnel(productId: string | undefined, params: AnalyticsQueryParams) {
  return useEnvelopeQuery(
    analyticsKeys.productFunnel(productId ?? '', params),
    () => api.apiGetProductFunnel(productId as string, params),
    { enabled: !!productId },
  );
}

/* ── Acquisition ──────────────────────────────────────────────────────── */

export function useSources(params: AnalyticsQueryParams) {
  return useEnvelopeQuery(analyticsKeys.sources(params), () => api.apiGetSources(params));
}

export function useCampaignDetail(campaign: string | undefined, params: AnalyticsQueryParams) {
  return useEnvelopeQuery(
    analyticsKeys.campaignDetail(campaign ?? '', params),
    () => api.apiGetCampaignDetail(campaign as string, params),
    { enabled: !!campaign },
  );
}

export function useTech(params: AnalyticsQueryParams) {
  return useEnvelopeQuery(analyticsKeys.tech(params), () => api.apiGetTech(params));
}

/* ── Checkout ─────────────────────────────────────────────────────────── */

export function useCheckoutFunnel(params: AnalyticsQueryParams) {
  return useEnvelopeQuery(analyticsKeys.checkoutFunnel(params), () => api.apiGetCheckoutFunnel(params));
}

export function usePaymentsFunnel(params: AnalyticsQueryParams) {
  return useEnvelopeQuery(analyticsKeys.paymentsFunnel(params), () => api.apiGetPaymentsFunnel(params));
}

export function useAbandonedCheckouts(params: AnalyticsQueryParams) {
  return useEnvelopeQuery(analyticsKeys.abandonedCheckouts(params), () =>
    api.apiGetAbandonedCheckouts(params),
  );
}

export function useCartFunnel(params: AnalyticsQueryParams) {
  return useEnvelopeQuery(analyticsKeys.cartFunnel(params), () => api.apiGetCartFunnel(params));
}

/* ── Events / search / data health ────────────────────────────────────── */

export function useSearchTerms(params: AnalyticsQueryParams) {
  return useEnvelopeQuery(analyticsKeys.searchTerms(params), () => api.apiGetSearchTerms(params));
}

export function useDataQuality(params: AnalyticsQueryParams) {
  return useEnvelopeQuery(analyticsKeys.quality(params), () => api.apiGetDataQuality(params));
}

export function usePurchaseReconciliation(params: AnalyticsQueryParams) {
  return useEnvelopeQuery(analyticsKeys.reconcilePurchases(params), () =>
    api.apiGetPurchaseReconciliation(params),
  );
}

/* ── Visitors ─────────────────────────────────────────────────────────── */

export function useVisitors(params: AnalyticsQueryParams) {
  return useEnvelopeQuery(analyticsKeys.visitors(params), () => api.apiGetVisitors(params));
}

export function useVisitorDetail(visitorId: string | undefined, params: AnalyticsQueryParams) {
  return useEnvelopeQuery(
    analyticsKeys.visitorDetail(visitorId ?? '', params),
    () => api.apiGetVisitorDetail(visitorId as string, params),
    { enabled: !!visitorId },
  );
}

export function useVisitorJourney(visitorId: string | undefined, params: AnalyticsQueryParams) {
  return useEnvelopeQuery(
    analyticsKeys.visitorJourney(visitorId ?? '', params),
    () => api.apiGetVisitorJourney(visitorId as string, params),
    { enabled: !!visitorId },
  );
}

/* ── Range state, held in the URL so a filtered view is shareable and
   survives a refresh ─────────────────────────────────────────────────── */

export interface AnalyticsRangeState {
  from: string;
  to: string;
  compare: boolean;
}

const DEFAULT_WINDOW_DAYS = 30;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultWindow(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (DEFAULT_WINDOW_DAYS - 1));
  return { from: isoDate(from), to: isoDate(to) };
}

/**
 * Reads/writes `from`, `to` and `compare` on the current URL's query string.
 * Uses `next/navigation`'s `useSearchParams`, which opts the calling route
 * into dynamic (client) rendering — expected here since every analytics
 * screen is already behind the `ADMIN_ONLY` auth guard and has nothing
 * static to prerender.
 */
export function useAnalyticsRange(): {
  range: AnalyticsRangeState;
  setRange: (next: Partial<AnalyticsRangeState>) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const range = useMemo<AnalyticsRangeState>(() => {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const compare = searchParams.get('compare') === 'true';
    if (from && to) return { from, to, compare };
    return { ...defaultWindow(), compare };
  }, [searchParams]);

  const setRange = useCallback(
    (next: Partial<AnalyticsRangeState>) => {
      const merged = { ...range, ...next };
      const params = new URLSearchParams(searchParams.toString());
      params.set('from', merged.from);
      params.set('to', merged.to);
      if (merged.compare) params.set('compare', 'true');
      else params.delete('compare');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [range, router, pathname, searchParams],
  );

  return { range, setRange };
}

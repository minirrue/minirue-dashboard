import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as api from '@/lib/api/analytics-insights';
import { apiFetch } from '@/lib/api/client';
import { buildAnalyticsQuery, readRange, writeRange, type AnalyticsRangeState } from '@/lib/analytics/range';
import { apiGetAllPeople, apiGetVisitorStory, PEOPLE_CAP, type PersonRow, type VisitorStory } from '@/lib/api/story';
import { apiListTrafficFlags, type TrafficFlag } from '@/lib/api/traffic-flags';
import { apiGetStaffDeviceStatus, type StaffDeviceStatus } from '@/lib/api/analytics';
import { listCategories, listProducts } from '@/lib/catalog/api';
import type { Category, ProductListItem } from '@/lib/catalog/types';
import type {
  AnalyticsEnvelope,
  AnalyticsQueryParams,
  VisitorsPage,
  PageSort,
  ProductSort,
  SourceGroupBy,
  TechDimension,
} from '@/lib/api/analytics-insights';
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
  topPages: (p: AnalyticsQueryParams, sortBy?: PageSort) => [...BASE_KEY, 'pages-top', p, sortBy] as const,
  entryPages: (p: AnalyticsQueryParams, sortBy?: PageSort) => [...BASE_KEY, 'pages-entry', p, sortBy] as const,
  exitPages: (p: AnalyticsQueryParams, sortBy?: PageSort) => [...BASE_KEY, 'pages-exit', p, sortBy] as const,
  productsTop: (p: AnalyticsQueryParams, sortBy?: ProductSort) =>
    [...BASE_KEY, 'products-top', p, sortBy] as const,
  productFunnel: (productId: string, p: AnalyticsQueryParams) =>
    [...BASE_KEY, 'product-funnel', productId, p] as const,
  sources: (p: AnalyticsQueryParams, groupBy?: SourceGroupBy) =>
    [...BASE_KEY, 'sources', p, groupBy] as const,
  campaignDetail: (campaign: string, p: AnalyticsQueryParams) =>
    [...BASE_KEY, 'campaign-detail', campaign, p] as const,
  tech: (p: AnalyticsQueryParams, dimension?: TechDimension) => [...BASE_KEY, 'tech', p, dimension] as const,
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

export function useTopPages(params: AnalyticsQueryParams, sortBy?: PageSort) {
  return useEnvelopeQuery(analyticsKeys.topPages(params, sortBy), () => api.apiGetTopPages(params, sortBy));
}

export function useEntryPages(params: AnalyticsQueryParams, sortBy?: PageSort) {
  return useEnvelopeQuery(analyticsKeys.entryPages(params, sortBy), () => api.apiGetEntryPages(params, sortBy));
}

export function useExitPages(params: AnalyticsQueryParams, sortBy?: PageSort) {
  return useEnvelopeQuery(analyticsKeys.exitPages(params, sortBy), () => api.apiGetExitPages(params, sortBy));
}

/* ── Products ─────────────────────────────────────────────────────────── */

export function useProductsTop(params: AnalyticsQueryParams, sortBy?: ProductSort) {
  return useEnvelopeQuery(analyticsKeys.productsTop(params, sortBy), () => api.apiGetProductsTop(params, sortBy));
}

export function useProductFunnel(productId: string | undefined, params: AnalyticsQueryParams) {
  return useEnvelopeQuery(
    analyticsKeys.productFunnel(productId ?? '', params),
    () => api.apiGetProductFunnel(productId as string, params),
    { enabled: !!productId },
  );
}

/* ── Acquisition ──────────────────────────────────────────────────────── */

export function useSources(params: AnalyticsQueryParams, groupBy?: SourceGroupBy) {
  return useEnvelopeQuery(analyticsKeys.sources(params, groupBy), () => api.apiGetSources(params, groupBy));
}

export function useCampaignDetail(campaign: string | undefined, params: AnalyticsQueryParams) {
  return useEnvelopeQuery(
    analyticsKeys.campaignDetail(campaign ?? '', params),
    () => api.apiGetCampaignDetail(campaign as string, params),
    { enabled: !!campaign },
  );
}

export function useTech(params: AnalyticsQueryParams, dimension?: TechDimension) {
  return useEnvelopeQuery(analyticsKeys.tech(params, dimension), () => api.apiGetTech(params, dimension));
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
   survives a refresh (reader/writer: lib/analytics/range.ts) ───────────── */

export type { TrafficScope, AnalyticsRangeState } from '@/lib/analytics/range';

/**
 * Reads/writes `from`, `to`, `compare` and `traffic` on the current URL.
 * `useSearchParams` opts the route into client rendering, which every
 * analytics screen already is (behind the ADMIN_ONLY guard).
 */
export function useAnalyticsRange(): {
  range: AnalyticsRangeState;
  setRange: (next: Partial<AnalyticsRangeState>) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const range = useMemo<AnalyticsRangeState>(() => readRange(searchParams), [searchParams]);

  const setRange = useCallback(
    (next: Partial<AnalyticsRangeState>) => {
      const params = writeRange(new URLSearchParams(searchParams.toString()), { ...range, ...next });
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [range, router, pathname, searchParams],
  );

  return { range, setRange };
}

/* ── The Analytics shell's data (dashboard#128) ───────────────────────── */

export interface PeopleAll {
  rows: PersonRow[];
  /** The list stopped at PEOPLE_CAP; figures cover the most recent people only. */
  capped: boolean;
  /** Served by the older `/visitors` list, which lacks source and stage detail. */
  legacy: boolean;
  fetchedAt: number;
}

/**
 * Everyone in the range, every page of `/people` walked, in one cache entry.
 * This is the spine of Overview, People, Journeys, Sources and Flow: each of
 * them counts these rows through `countedVisitors`, so they always agree.
 */
export function usePeopleAll(params: AnalyticsQueryParams) {
  return useQuery<PeopleAll, ApiError>({
    queryKey: [...BASE_KEY, 'people-all', params.from, params.to, params.traffic ?? 'real'],
    staleTime: DAILY_STALE_TIME,
    queryFn: async () => {
      let out = { rows: [] as PersonRow[], capped: false, legacy: false };
      await apiGetAllPeople(
        params,
        {},
        { sort: 'lastSeenAt' },
        (rows, done, legacy) => {
          out = { rows, capped: done && rows.length >= PEOPLE_CAP, legacy };
        },
        { aborted: false },
      );
      return { ...out, fetchedAt: Date.now() };
    },
  });
}

/** Visits and pages per visitor (all time) from `/visitors`, walked back to `from`. */
export function useVisitCounts(params: AnalyticsQueryParams) {
  return useQuery<Map<string, { sessions: number; pages: number }>, ApiError>({
    queryKey: [...BASE_KEY, 'visit-counts', params.from, params.to, params.traffic ?? 'real'],
    staleTime: DAILY_STALE_TIME,
    queryFn: async () => {
      const map = new Map<string, { sessions: number; pages: number }>();
      let cursor: string | null = null;
      for (let page = 0; page < 15; page += 1) {
        const res: AnalyticsEnvelope<VisitorsPage> = await apiFetch(
          `/analytics/visitors?${buildAnalyticsQuery(params, { limit: '200', cursor })}`,
          { auth: true },
        );
        for (const r of res.data.rows) map.set(r.visitorId, { sessions: r.sessionCount, pages: r.pageviewCount });
        cursor = res.data.nextCursor;
        const last = res.data.rows[res.data.rows.length - 1];
        // Newest first and not bounded by the range: stop once it is older than `from`.
        if (!cursor || !last || last.lastSeenAt.slice(0, 10) < params.from) break;
      }
      return map;
    },
  });
}

export function useVisitorStory(visitorId: string | null | undefined, params: AnalyticsQueryParams) {
  return useQuery<VisitorStory, ApiError>({
    queryKey: [...BASE_KEY, 'story', visitorId ?? '', params.from, params.to, params.traffic ?? 'real'],
    enabled: !!visitorId,
    staleTime: DAILY_STALE_TIME,
    queryFn: async () => (await apiGetVisitorStory(visitorId as string, params)).data,
  });
}

/** Every "This is us" verdict, active and revoked: the exclusion list and its history. */
export function useTrafficFlags() {
  return useQuery<TrafficFlag[], ApiError>({
    queryKey: [...BASE_KEY, 'flags'],
    staleTime: DAILY_STALE_TIME,
    queryFn: async () => (await apiListTrafficFlags(false)).items,
  });
}

/** Whether this browser is excluded, and why. Public by design; never fails the screen. */
export function useStaffDevice() {
  return useQuery<StaffDeviceStatus | null, ApiError>({
    queryKey: [...BASE_KEY, 'staff-device'],
    staleTime: DAILY_STALE_TIME,
    queryFn: async () => {
      try {
        return await apiGetStaffDeviceStatus();
      } catch {
        return null;
      }
    },
  });
}

/** The shop's categories and published products: the real routes an ad can land on. */
export function useCatalogueRoutes(enabled = true) {
  return useQuery<{ categories: Category[]; products: ProductListItem[] }, ApiError>({
    queryKey: [...BASE_KEY, 'catalogue-routes'],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [cats, prods] = await Promise.all([listCategories(), listProducts({ status: 'PUBLISHED', limit: 200 })]);
      return { categories: cats.items, products: prods.items };
    },
  });
}

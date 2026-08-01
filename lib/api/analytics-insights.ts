import { apiFetch } from './client';

/**
 * Typed client for the first-party visitor-analytics query API
 * (specs/2026-07-31-visitor-analytics, Lane 6/11/16).
 *
 * Lane 16 reconciliation (2026-07-31): the backend
 * (`apps/minirue-backend/src/analytics-web/query/`) has now landed. Every
 * interface below has been checked field-by-field against the real DTOs in
 * `.../dto/*.dto.ts`, the envelope in `.../interfaces/envelope.interface.ts`,
 * and the 26 routes in `.../web-analytics.controller.ts`. Nothing here is a
 * guess anymore — see `lane-16-report.md` for the full list of what the
 * original guesses got wrong (wrong field names, wrong nullability, and a
 * couple of endpoints whose response shape wasn't merely renamed but
 * structurally different from what was assumed, e.g. `tech`, `funnel/*`,
 * `visitors`, `quality`, `reconcile/purchases`).
 *
 * Every endpoint takes `from`/`to` (inclusive, `YYYY-MM-DD`) and an optional
 * `compare` flag. `compare` is modelled as a boolean at this layer (and
 * throughout every screen/hook) because the only comparison the UI offers is
 * "the same-length period immediately before `from`" — `buildQuery` below is
 * the one place that turns that into the real query value the backend
 * expects (`compare=previous`; the schema is actually a
 * `'previous' | 'year' | 'none'` enum, not a boolean — see lane-16 report).
 */

export interface AnalyticsRange {
  from: string;
  to: string;
  timezone: string;
}

export interface AnalyticsFreshness {
  /** ISO timestamp of the last rollup that completed without error, or
   * `null` if the rollup has never completed — the signal this lane's UI
   * uses to tell "nothing has happened yet" apart from "nothing happened in
   * this date range". */
  rollupLastOkAt: string | null;
  /** Count of buckets in the requested range whose rollup is stale/missing.
   * > 0 means some of what's on screen may be behind, not wrong. */
  staleBuckets: number;
}

export interface AnalyticsEnvelope<T> {
  range: AnalyticsRange;
  freshness: AnalyticsFreshness;
  data: T;
  /** Present only when `compare` was requested and the backend could resolve
   * a comparison range. Not every endpoint supports it — see the per-endpoint
   * functions below. */
  previous?: T;
}

export interface AnalyticsQueryParams {
  from: string;
  to: string;
  compare?: boolean;
}

function buildQuery(params: AnalyticsQueryParams, extra?: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  q.set('from', params.from);
  q.set('to', params.to);
  // The backend's `compare` query param is `'previous' | 'year' | 'none'`
  // (`BaseQuerySchema` in `common.dto.ts`), not a boolean — sending
  // `compare=true` fails schema validation with a 422 on every request where
  // the "Compare to previous period" checkbox is on. The UI only ever offers
  // that one comparison, so `previous` is the correct (and only) mapping.
  if (params.compare) q.set('compare', 'previous');
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) q.set(key, value);
    }
  }
  return q.toString();
}

/**
 * Money formatting for the `…Minor` (piastres) fields this API returns.
 * Moved here from `AnalyticsClient.tsx` (which keeps its own private copy
 * for now — that screen is rebuilt in a later lane) so every new analytics
 * screen shares one implementation instead of re-deriving it.
 */
export function egp(minor: number): string {
  return `EGP ${(minor / 100).toLocaleString('en-EG', { minimumFractionDigits: 2 })}`;
}

export function egpShort(minor: number): string {
  const val = minor / 100;
  if (val >= 1_000_000) return `EGP ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `EGP ${(val / 1_000).toFixed(1)}K`;
  return egp(minor);
}

/* ── Data shapes — matched field-for-field against the backend DTOs ─────── */

/** `GET /analytics/audience/summary` → `dto/audience.dto.ts#AudienceSummary`. */
export interface AudienceSummary {
  visitors: number;
  newVisitors: number;
  returningVisitors: number;
  sessions: number;
  pageviews: number;
  bouncedSessions: number;
  engagedSessions: number;
  bounceRate: number;
  sessionDurationSeconds: number;
  avgSessionDurationSeconds: number;
  productViews: number;
  addToCarts: number;
  beginCheckouts: number;
  paymentsInitiated: number;
  purchases: number;
  revenueMinor: number;
  /** Average of the daily unique-visitor count over the requested range. */
  dau: number;
  /** Exact unique visitors over the trailing 30 days ending at `to`. */
  mau: number;
  /** dau / mau, 0 when mau is 0. */
  stickiness: number;
}

/**
 * `GET /analytics/audience/timeseries` → `dto/audience.dto.ts#TimeseriesPoint`.
 * The backend type is actually `{ bucket: string; [metric: string]: number |
 * string }` — the exact metric keys present depend on the `metrics` query
 * param, which this client never sends, so the backend fills in every metric
 * in `DAY_TIMESERIES_METRICS` (its default-allowlist behaviour when `metrics`
 * is omitted). This interface names that full default set rather than the
 * open index signature so every screen gets real property names instead of
 * `number | string` everywhere. If a screen ever needs `granularity=hour` or
 * a `metrics` subset, `apiGetAudienceTimeseries` needs new parameters and
 * this type needs to go back to the open-index shape.
 */
export interface AudienceTimeseriesPoint {
  bucket: string;
  visitors: number;
  newVisitors: number;
  returningVisitors: number;
  sessions: number;
  pageviews: number;
  bouncedSessions: number;
  engagedSessions: number;
  productViews: number;
  addToCarts: number;
  beginCheckouts: number;
  paymentsInitiated: number;
  purchases: number;
  revenueMinor: number;
}

/** `GET /analytics/live` → `dto/live.dto.ts#LiveSummary`. */
export interface LiveSummary {
  onlineNow: number;
  byPath: { path: string; count: number }[];
  byCountry: { country: string; count: number }[];
  byDevice: { deviceType: string; count: number }[];
  /** One-minute buckets covering the last 30 minutes, oldest first. */
  pulse: { minute: string; count: number }[];
}

/** `GET /analytics/live/visitors` → `dto/live.dto.ts#LiveVisitor`. */
export interface LiveVisitor {
  visitorId: string;
  path: string | null;
  pageCode: string | null;
  title: string | null;
  country: string | null;
  deviceType: string | null;
  userId: string | null;
  productId: string | null;
  enteredAt: string;
  lastSeenAt: string;
  secondsOnPage: number;
}

/** `GET /analytics/pages/{top,entry,exit}` → `dto/pages.dto.ts#PageRow`. */
export interface PageRow {
  path: string;
  pageCode: string | null;
  pageviews: number;
  uniqueVisitors: number;
  entries: number;
  exits: number;
  bouncedEntries: number;
  bounceRate: number;
  avgTimeOnPageSeconds: number;
  avgScrollDepth: number;
}

export const PAGE_SORTS = ['pageviews', 'entries', 'exits', 'bounceRate'] as const;
export type PageSort = (typeof PAGE_SORTS)[number];

/** `GET /analytics/products/top` → `dto/products.dto.ts#ProductRow`. */
export interface ProductRow {
  productId: string;
  name: string | null;
  slug: string | null;
  impressions: number;
  listClicks: number;
  views: number;
  uniqueViewers: number;
  addToCarts: number;
  removeFromCarts: number;
  wishlistAdds: number;
  beginCheckouts: number;
  purchases: number;
  unitsSold: number;
  revenueMinor: number;
  impressionToViewRate: number;
  viewToAddToCartRate: number;
  addToCartToPurchaseRate: number;
}

export const PRODUCT_SORTS = ['impressions', 'views', 'addToCarts', 'purchases', 'revenueMinor'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

/**
 * `GET /analytics/products/{id}/funnel` → `dto/products.dto.ts#ProductFunnel`.
 * NOT a `{ stages }` funnel — it is a daily series plus a variant split and a
 * source split. There is no backend-computed "stage" concept for a single
 * product; a view→cart→purchase funnel view has to be derived client-side by
 * summing the real `series` numbers (done in `ProductFunnelDetailClient`),
 * not invented.
 */
export interface ProductFunnel {
  productId: string;
  name: string | null;
  series: {
    day: string;
    impressions: number;
    views: number;
    addToCarts: number;
    beginCheckouts: number;
    purchases: number;
    unitsSold: number;
    revenueMinor: number;
  }[];
  variantSplit: {
    variantId: string;
    addToCarts: number;
    purchases: number;
    revenueMinor: number;
  }[];
  sourceSplit: { channel: string; purchases: number; revenueMinor: number }[];
}

export const SOURCE_GROUP_BY = ['channel', 'source', 'medium', 'campaign', 'referrer'] as const;
export type SourceGroupBy = (typeof SOURCE_GROUP_BY)[number];

/** `GET /analytics/sources` → `dto/sources.dto.ts#SourceRow`. */
export interface SourceRow {
  key: string;
  sessions: number;
  visitors: number;
  newVisitors: number;
  pageviews: number;
  bouncedSessions: number;
  bounceRate: number;
  addToCarts: number;
  beginCheckouts: number;
  orders: number;
  revenueMinor: number;
}

/**
 * `GET /analytics/sources/campaigns/{campaign}` →
 * `dto/sources.dto.ts#CampaignDetail`. There is no `landingPages` field —
 * the real breakdown is by content/term/referrer plus a daily series.
 */
export interface CampaignDetail {
  campaign: string;
  series: { day: string; sessions: number; orders: number; revenueMinor: number }[];
  byContent: { key: string; sessions: number; orders: number; revenueMinor: number }[];
  byTerm: { key: string; sessions: number; orders: number; revenueMinor: number }[];
  byReferrer: { key: string; sessions: number; orders: number; revenueMinor: number }[];
}

export const TECH_DIMENSIONS = ['device', 'browser', 'os', 'osVersion'] as const;
export type TechDimension = (typeof TECH_DIMENSIONS)[number];

/**
 * `GET /analytics/tech` → `dto/tech.dto.ts#TechRow`. One dimension per call
 * (`?dimension=device|browser|os|osVersion`, default `device`) — the
 * response is a flat array of rows for THAT dimension, never a combined
 * `{ browsers, devices, operatingSystems }` breakdown in one response.
 */
export interface TechRow {
  key: string;
  sessions: number;
  visitors: number;
  pageviews: number;
  bouncedSessions: number;
  bounceRate: number;
  addToCarts: number;
  orders: number;
  revenueMinor: number;
  avgViewportW: number;
  avgViewportH: number;
}

/**
 * `GET /analytics/funnel/checkout` → `dto/funnel.dto.ts#CheckoutFunnelStep`.
 * The envelope's `data` is the array itself, not `{ stages: [...] }`. A
 * browser-counted step and a server-counted step are different units — see
 * `source`/`unit` on each row — so a chart that pretends they're directly
 * comparable misrepresents the checkout → paid boundary.
 */
export interface CheckoutFunnelStep {
  step: string;
  stepOrder: number;
  source: 'browser' | 'server';
  unit: 'session' | 'attempt' | 'order';
  count: number;
  visitors: number | null;
  droppedHere: number | null;
  conversionFromPrevious: number;
}

/**
 * `GET /analytics/funnel/payments` → `dto/funnel.dto.ts#PaymentMethodRow`.
 * NOT a funnel — a per-payment-method breakdown. `successRate` is `null` for
 * COD (pending-until-delivery, not a meaningful rate over a dashboard window)
 * and must render as "not applicable", never as 0%.
 */
export interface PaymentMethodRow {
  method: string;
  gateway: string;
  attempts: number;
  orders: number;
  amountMinor: number;
  succeededAttempts: number;
  failedAttempts: number;
  pendingAttempts: number;
  successRate: number | null;
  avgResolutionSeconds: number;
  topFailureReasons: { failureCode: string; count: number; sample: string | null }[];
}

export type AbandonedDetector = 'behavioural' | 'cart' | 'payment';

/**
 * `GET /analytics/checkout/abandoned` → `dto/checkout.dto.ts#AbandonedRow`.
 * There is no `email` field anywhere in this schema — the original client
 * guess invented one. Contact is `contactable: boolean` plus `userId`, not a
 * literal address.
 */
export interface AbandonedRow {
  cartId: string | null;
  visitorId: string | null;
  userId: string | null;
  itemCount: number;
  valueMinor: number;
  /** Furthest funnel step reached, or `PAYMENT_STUCK` for the payment-level detector. */
  stage: string;
  lastSeenAt: string;
  channel: string | null;
  campaign: string | null;
  contactable: boolean;
  detectors: AbandonedDetector[];
}

/**
 * `GET /analytics/cart/funnel` → `dto/checkout.dto.ts#CartFunnelStep`. The
 * envelope's `data` is the array itself. The backend schema tracks five
 * stages, not six — this client renders however many rows come back rather
 * than assuming a fixed count.
 */
export interface CartFunnelStep {
  step: string;
  count: number;
  conversionFromPrevious: number;
}

/** `GET /analytics/search` → `dto/search.dto.ts#SearchRow`. */
export interface SearchRow {
  queryText: string;
  searches: number;
  sessions: number;
  zeroResults: number;
  zeroResultRate: number;
  resultClicks: number;
  addToCarts: number;
}

/**
 * `GET /analytics/visitors` → `dto/visitors.dto.ts#VisitorsPage`. The
 * envelope's `data` is `{ rows, nextCursor }`, NOT a bare array of visitors.
 */
export interface VisitorListRow {
  visitorId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  sessionCount: number;
  pageviewCount: number;
  orderCount: number;
  revenueMinor: number;
  country: string | null;
  firstChannel: string;
}

export interface VisitorsPage {
  rows: VisitorListRow[];
  nextCursor: string | null;
}

export interface VisitorSessionSummary {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  pageviewCount: number;
  isBounce: boolean;
  entryPath: string | null;
  exitPath: string | null;
  channel: string;
  deviceType: string;
  country: string;
  hadPurchase: boolean;
  revenueMinor: number;
}

/** `GET /analytics/visitors/{id}` → `dto/visitors.dto.ts#VisitorProfile`. */
export interface VisitorProfile {
  visitorId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  sessionCount: number;
  pageviewCount: number;
  orderCount: number;
  revenueMinor: number;
  lastUserId: string | null;
  firstChannel: string;
  firstUtmSource: string | null;
  firstUtmMedium: string | null;
  firstUtmCampaign: string | null;
  firstLandingPath: string | null;
  country: string | null;
  isBot: boolean;
  sessions: VisitorSessionSummary[];
}

/** `GET /analytics/visitors/{id}/journey` → `dto/visitors.dto.ts#JourneyEvent`. */
export interface JourneyEvent {
  eventId: string;
  occurredAt: string;
  eventName: string;
  path: string | null;
  productId: string | null;
  orderId: string | null;
  valueMinor: number | null;
  props: unknown;
}

/**
 * `GET /analytics/quality` → `dto/quality.dto.ts#QualityReport`.
 * `bufferDrops` is ALWAYS `null` — no persisted counter exists yet for
 * write-buffer drops. Render it as "not tracked yet", never as 0.
 */
export interface QualityReport {
  botShareByReason: { reason: string; count: number; shareOfTotal: number }[];
  totalEvents: number;
  botEvents: number;
  visitorSourceSplit: { visitorSource: string; visitors: number }[];
  ingestRejects: { reason: string; count: number }[];
  bufferDrops: null;
  rollupJobs: {
    job: string;
    watermarkAt: string | null;
    timezone: string;
    lastRunAt: string | null;
    lastOkAt: string | null;
    lastDurationMs: number | null;
    lastRowsWritten: number | null;
    lastError: string | null;
    consecutiveFailures: number;
  }[];
  volumeByEventName: { eventName: string; count: number }[];
}

export interface ReconcileSide {
  count: number;
  revenueMinor: number;
}

/** `GET /analytics/reconcile/purchases` → `dto/reconcile.dto.ts#ReconcileReport`. */
export interface ReconcileReport {
  orders: ReconcileSide;
  purchaseEvents: ReconcileSide;
  attribution: ReconcileSide;
  /** The top-level accuracy guarantee: false the moment any side disagrees. */
  healthy: boolean;
  mismatches: {
    ordersMissingAttribution: string[];
    attributionMissingOrder: string[];
    purchaseEventsMissingOrder: string[];
    ordersMissingPurchaseEvent: string[];
  };
}

/* ── Endpoints — one function per path, all authenticated ───────────────── */

export async function apiGetAudienceSummary(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<AudienceSummary>>(
    `/analytics/audience/summary?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetAudienceTimeseries(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<AudienceTimeseriesPoint[]>>(
    `/analytics/audience/timeseries?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetLiveSummary(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<LiveSummary>>(
    `/analytics/live?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetLiveVisitors(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<LiveVisitor[]>>(
    `/analytics/live/visitors?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetTopPages(params: AnalyticsQueryParams, sortBy?: PageSort) {
  return apiFetch<AnalyticsEnvelope<PageRow[]>>(
    `/analytics/pages/top?${buildQuery(params, { sortBy })}`,
    { auth: true },
  );
}

export async function apiGetEntryPages(params: AnalyticsQueryParams, sortBy?: PageSort) {
  return apiFetch<AnalyticsEnvelope<PageRow[]>>(
    `/analytics/pages/entry?${buildQuery(params, { sortBy })}`,
    { auth: true },
  );
}

export async function apiGetExitPages(params: AnalyticsQueryParams, sortBy?: PageSort) {
  return apiFetch<AnalyticsEnvelope<PageRow[]>>(
    `/analytics/pages/exit?${buildQuery(params, { sortBy })}`,
    { auth: true },
  );
}

export async function apiGetProductsTop(params: AnalyticsQueryParams, sortBy?: ProductSort) {
  return apiFetch<AnalyticsEnvelope<ProductRow[]>>(
    `/analytics/products/top?${buildQuery(params, { sortBy })}`,
    { auth: true },
  );
}

export async function apiGetProductFunnel(productId: string, params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<ProductFunnel>>(
    `/analytics/products/${encodeURIComponent(productId)}/funnel?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetSources(
  params: AnalyticsQueryParams,
  groupBy?: SourceGroupBy,
  attribution?: 'last' | 'first',
) {
  return apiFetch<AnalyticsEnvelope<SourceRow[]>>(
    `/analytics/sources?${buildQuery(params, { groupBy, attribution })}`,
    { auth: true },
  );
}

export async function apiGetCampaignDetail(campaign: string, params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<CampaignDetail>>(
    `/analytics/sources/campaigns/${encodeURIComponent(campaign)}?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetTech(params: AnalyticsQueryParams, dimension?: TechDimension) {
  return apiFetch<AnalyticsEnvelope<TechRow[]>>(
    `/analytics/tech?${buildQuery(params, { dimension })}`,
    { auth: true },
  );
}

export async function apiGetCheckoutFunnel(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<CheckoutFunnelStep[]>>(
    `/analytics/funnel/checkout?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetPaymentsFunnel(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<PaymentMethodRow[]>>(
    `/analytics/funnel/payments?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetAbandonedCheckouts(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<AbandonedRow[]>>(
    `/analytics/checkout/abandoned?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetCartFunnel(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<CartFunnelStep[]>>(
    `/analytics/cart/funnel?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetSearchTerms(params: AnalyticsQueryParams, zeroOnly?: boolean) {
  return apiFetch<AnalyticsEnvelope<SearchRow[]>>(
    `/analytics/search?${buildQuery(params, { zeroOnly: zeroOnly ? 'true' : undefined })}`,
    { auth: true },
  );
}

export async function apiGetVisitors(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<VisitorsPage>>(
    `/analytics/visitors?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetVisitorDetail(visitorId: string, params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<VisitorProfile>>(
    `/analytics/visitors/${encodeURIComponent(visitorId)}?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetVisitorJourney(visitorId: string, params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<JourneyEvent[]>>(
    `/analytics/visitors/${encodeURIComponent(visitorId)}/journey?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetDataQuality(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<QualityReport>>(
    `/analytics/quality?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetPurchaseReconciliation(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<ReconcileReport>>(
    `/analytics/reconcile/purchases?${buildQuery(params)}`,
    { auth: true },
  );
}

/*
 * Endpoints that exist on the real controller but have no caller anywhere in
 * this app (none of the screens in `app/dashboard/analytics/**` reference
 * them), so no client function is added for them here — see the lane-16
 * report's "missing" section:
 *   - GET  /analytics/pages/detail        (per-page drill-down)
 *   - GET  /analytics/geo                 (country/region/city breakdown)
 *   - DELETE /analytics/visitors/{id}     (SUPERADMIN-only erasure)
 *   - POST /analytics/rollups/run         (SUPERADMIN-only manual backfill;
 *     acknowledges but does not yet dispatch — see the controller comment)
 */

/* ── Geo ────────────────────────────────────────────────────────────────── */

/**
 * `GET /analytics/geo?dimension=country` → one row per country.
 *
 * Promoted here from `OverviewGrid.tsx` once a second screen (Acquisition)
 * needed it. It lived local to that file while there was exactly one caller;
 * two is where a private copy stops being pragmatic and starts being drift.
 */
export interface GeoRow {
  key: string;
  sessions: number;
  visitors: number;
  revenueMinor: number;
}

/**
 * Query string for the endpoints that have no typed client function yet.
 *
 * `compare` is deliberately mapped, not passed through: the backend takes
 * `'previous' | 'year' | 'none'` (BaseQuerySchema in common.dto.ts), never a
 * boolean. Sending `compare=true` returns 422 — the exact bug the rest of this
 * file was reconciled to avoid.
 */
export function buildAnalyticsQueryString(
  params: AnalyticsQueryParams,
  extra?: Record<string, string>,
): string {
  const q = new URLSearchParams();
  q.set('from', params.from);
  q.set('to', params.to);
  if (params.compare) q.set('compare', 'previous');
  if (extra) {
    for (const [key, value] of Object.entries(extra)) q.set(key, value);
  }
  return q.toString();
}

import { apiFetch } from './client';

/**
 * Typed client for the first-party visitor-analytics query API
 * (specs/2026-07-31-visitor-analytics, Lane 6/11).
 *
 * The backend (Lane 11, `packages/contracts` Lane 2) is being built in
 * parallel with this file — these are the AGREED paths and the AGREED
 * envelope shape, but the `data` payload interfaces below are this lane's
 * best-effort read of what each endpoint returns, inferred from its name and
 * the money-is-always-minor-units rule. Reconcile field names against the
 * real backend DTOs when Lane 11 lands; nothing here should be treated as
 * gospel beyond the envelope, the query params, and the `…Minor` money
 * convention.
 *
 * Every endpoint takes `from`/`to` (inclusive, `YYYY-MM-DD`) and an optional
 * `compare` flag. `compare` is modelled as a boolean rather than an explicit
 * second range: it asks the backend for "the same-length period immediately
 * before `from`" rather than the caller computing and passing that range
 * itself — simpler for a first cut, and easy to widen to an explicit
 * `compareFrom`/`compareTo` pair later without changing every call site
 * (only `buildQuery` below would change).
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
  if (params.compare) q.set('compare', 'true');
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

/* ── Data shapes (best-effort — see file header) ───────────────────────── */

export interface AudienceSummary {
  visitors: number;
  sessions: number;
  pageviews: number;
  avgSessionDurationSeconds: number;
  bounceRate: number;
  newVisitorRate: number;
}

export interface AudienceTimeseriesPoint {
  date: string;
  visitors: number;
  sessions: number;
  pageviews: number;
}

export interface LiveSummary {
  activeVisitors: number;
  activeSessions: number;
  pageviewsLastMinute: number;
}

export interface LiveVisitor {
  visitorId: string;
  currentPath: string;
  enteredAt: string;
  country?: string;
  device?: string;
  referrer?: string;
}

export interface PageMetric {
  path: string;
  views: number;
  uniqueVisitors: number;
  avgTimeOnPageSeconds: number;
  /** Only populated by the entry/exit endpoints. */
  rate?: number;
}

export interface ProductMetric {
  productId: string;
  productName: string;
  views: number;
  addToCart: number;
  purchases: number;
  revenueMinor: number;
}

export interface FunnelStage {
  label: string;
  count: number;
  rateFromStart: number;
  dropOffRate: number;
}

export interface ProductFunnel {
  productId: string;
  productName: string;
  stages: FunnelStage[];
}

export interface SourceMetric {
  source: string;
  medium?: string;
  campaign?: string;
  visitors: number;
  sessions: number;
  conversions: number;
  revenueMinor: number;
}

export interface CampaignDetail extends SourceMetric {
  landingPages: PageMetric[];
}

export interface TechCount {
  name: string;
  count: number;
}

export interface TechBreakdown {
  browsers: TechCount[];
  devices: TechCount[];
  operatingSystems: TechCount[];
}

export interface CheckoutFunnel {
  stages: FunnelStage[];
}

export interface PaymentsFunnel {
  stages: FunnelStage[];
}

export interface AbandonedCheckout {
  checkoutId: string;
  visitorId?: string;
  email?: string;
  cartValueMinor: number;
  abandonedAt: string;
  lastStepReached: string;
}

export interface CartFunnel {
  stages: FunnelStage[];
}

export interface SearchTerm {
  term: string;
  searchCount: number;
  avgResultCount: number;
  conversions: number;
}

export interface VisitorSummary {
  visitorId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  sessions: number;
  pageviews: number;
  isReturning: boolean;
  country?: string;
  device?: string;
}

export interface VisitorDetail extends VisitorSummary {
  totalRevenueMinor: number;
  orderCount: number;
}

export interface VisitorJourneyEvent {
  eventId: string;
  type: string;
  path?: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface DataQuality {
  duplicateEventRate: number;
  missingSessionRate: number;
  botFilteredRate: number;
  lastCheckedAt: string;
}

export interface PurchaseReconciliationRow {
  orderId: string;
  reason: string;
}

export interface PurchaseReconciliation {
  matched: number;
  unmatched: number;
  discrepancies: PurchaseReconciliationRow[];
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

export async function apiGetTopPages(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<PageMetric[]>>(
    `/analytics/pages/top?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetEntryPages(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<PageMetric[]>>(
    `/analytics/pages/entry?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetExitPages(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<PageMetric[]>>(
    `/analytics/pages/exit?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetProductsTop(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<ProductMetric[]>>(
    `/analytics/products/top?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetProductFunnel(productId: string, params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<ProductFunnel>>(
    `/analytics/products/${encodeURIComponent(productId)}/funnel?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetSources(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<SourceMetric[]>>(
    `/analytics/sources?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetCampaignDetail(campaign: string, params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<CampaignDetail>>(
    `/analytics/sources/campaigns/${encodeURIComponent(campaign)}?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetTech(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<TechBreakdown>>(
    `/analytics/tech?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetCheckoutFunnel(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<CheckoutFunnel>>(
    `/analytics/funnel/checkout?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetPaymentsFunnel(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<PaymentsFunnel>>(
    `/analytics/funnel/payments?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetAbandonedCheckouts(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<AbandonedCheckout[]>>(
    `/analytics/checkout/abandoned?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetCartFunnel(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<CartFunnel>>(
    `/analytics/cart/funnel?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetSearchTerms(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<SearchTerm[]>>(
    `/analytics/search?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetVisitors(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<VisitorSummary[]>>(
    `/analytics/visitors?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetVisitorDetail(visitorId: string, params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<VisitorDetail>>(
    `/analytics/visitors/${encodeURIComponent(visitorId)}?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetVisitorJourney(visitorId: string, params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<VisitorJourneyEvent[]>>(
    `/analytics/visitors/${encodeURIComponent(visitorId)}/journey?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetDataQuality(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<DataQuality>>(
    `/analytics/quality?${buildQuery(params)}`,
    { auth: true },
  );
}

export async function apiGetPurchaseReconciliation(params: AnalyticsQueryParams) {
  return apiFetch<AnalyticsEnvelope<PurchaseReconciliation>>(
    `/analytics/reconcile/purchases?${buildQuery(params)}`,
    { auth: true },
  );
}

import { apiFetch } from './client';
import type { AnalyticsQueryParams } from './analytics-insights';

/**
 * Story Flow (dashboard#123): the visitor graph. Every figure resolves to
 * real, single visitors — a flow of where people came from to what they
 * paid, the people inside any part of it, and each person's full story.
 */

export type FlowDimension = 'platform' | 'campaign' | 'landing' | 'product' | 'stage';
/** Flow columns, plus two filter-only keys (country ISO-2, device). */
export type FlowFilterKey = FlowDimension | 'country' | 'device';
export type FlowFilter = Partial<Record<FlowFilterKey, string>>;

export interface FlowNode {
  dimension: FlowDimension;
  value: string;
  /** Human label; `value` is what filters. */
  label: string;
  visitors: number;
  /** Paid / social / organic / direct … for platform nodes. */
  medium?: string | null;
}

export interface FlowLink {
  from: { dimension: FlowDimension; value: string };
  to: { dimension: FlowDimension; value: string };
  visitors: number;
}

export interface FlowResponse {
  nodes: FlowNode[];
  links: FlowLink[];
  totalVisitors: number;
}

export type TrafficClass = 'REAL' | 'OWNER' | 'INTERNAL' | 'BOT' | 'SUSPICIOUS' | 'TRUSTED';

export interface PersonRow {
  visitorId: string;
  visitorNumber: number | null;
  trafficClass: TrafficClass;
  customer: { id: string; name: string | null } | null;
  country: string | null;
  city: string | null;
  device: string | null;
  platform: string | null;
  medium: string | null;
  campaign: string | null;
  landingPath: string | null;
  productsViewed: string[];
  furthestStage: string | null;
  cartValueMinor: number | null;
  orders: number;
  revenueMinor: number;
  contactable: boolean;
  lastSeenAt: string;
  firstSeenAt: string;
}

export interface PeoplePage {
  rows: PersonRow[];
  nextCursor: string | null;
  total?: number;
}

export interface StoryStep {
  at: string;
  kind: string;
  label: string;
  path?: string | null;
  seconds?: number | null;
  scrollPct?: number | null;
  valueMinor?: number | null;
  productName?: string | null;
  orderNumber?: string | null;
}

export interface StorySession {
  sessionId: string | null;
  startedAt: string;
  endedAt: string | null;
  touch: { platform: string | null; medium: string | null; campaign: string | null; clickId: string | null; landingPath: string | null; referrer?: string | null };
  summary: string;
  steps: StoryStep[];
}

export interface VisitorStory {
  visitorId: string;
  visitorNumber: number | null;
  trafficClass: TrafficClass;
  customer: { id: string; name: string | null; email?: string | null; phone?: string | null } | null;
  sessions: StorySession[];
}

function scopeQuery(params: AnalyticsQueryParams, extra: Record<string, string | undefined> = {}): string {
  const q = new URLSearchParams({ from: params.from, to: params.to });
  if (params.traffic === 'all') q.set('includeBots', 'true');
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== '') q.set(k, v);
  return q.toString();
}

const filterParam = (f: FlowFilter) => (Object.keys(f).length ? JSON.stringify(f) : undefined);

export function apiGetFlow(params: AnalyticsQueryParams, filter: FlowFilter): Promise<{ data: FlowResponse }> {
  return apiFetch(`/analytics/flow?${scopeQuery(params, { filter: filterParam(filter) })}`, { auth: true });
}

export function apiGetPeople(
  params: AnalyticsQueryParams,
  filter: FlowFilter,
  opts: { q?: string; sort?: string; cursor?: string | null } = {},
): Promise<{ data: PeoplePage }> {
  return apiFetch(
    `/analytics/people?${scopeQuery(params, { filter: filterParam(filter), q: opts.q, sort: opts.sort, cursor: opts.cursor ?? undefined })}`,
    { auth: true },
  );
}

export function apiGetVisitorStory(visitorId: string, params: AnalyticsQueryParams): Promise<{ data: VisitorStory }> {
  return apiFetch(`/analytics/visitors/${encodeURIComponent(visitorId)}/story?${scopeQuery(params)}`, { auth: true });
}

/** Full-set export path (server builds it); the page downloads through apiFetch. */
export function exportPath(dataset: 'people' | 'flow' | 'story', format: 'csv' | 'json', params: AnalyticsQueryParams, filter: FlowFilter): string {
  return `/analytics/export/${dataset}?${scopeQuery(params, { format, filter: filterParam(filter) })}`;
}

export const DIMENSION_LABEL: Record<FlowFilterKey, string> = {
  country: 'Country',
  device: 'Device',
  platform: 'Came from',
  campaign: 'Campaign / ad',
  landing: 'Landed on',
  product: 'Looked at',
  stage: 'Got to',
};

export const STAGE_LABEL: Record<string, string> = {
  viewed: 'Browsed only',
  product: 'Viewed a product',
  bag: 'Added to bag',
  checkout: 'Started checkout',
  checkout_contact: 'Checkout · contact',
  checkout_address: 'Checkout · address',
  checkout_shipping: 'Checkout · shipping',
  checkout_payment: 'Checkout · payment',
  paid: 'Paid',
  refunded: 'Refunded',
};

export function personName(p: { visitorNumber: number | null; visitorId: string; customer?: { name: string | null } | null }): string {
  if (p.customer?.name) return p.customer.name;
  return p.visitorNumber ? `Visitor #${p.visitorNumber.toLocaleString('en-US')}` : `Visitor ${p.visitorId.slice(0, 6)}`;
}

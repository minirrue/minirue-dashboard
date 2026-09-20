import { API_BASE, apiFetch, CLIENT_AUDIENCE, CLIENT_HEADER } from './client';
import { getAccessToken } from '@/lib/auth/tokens';
import type { ApiError } from './client';
import { apiGetVisitorJourney } from './analytics-insights';
import type { AnalyticsQueryParams, JourneyEvent, VisitorsPage } from './analytics-insights';

/**
 * Visitors & journeys (dashboard#123): the visitor graph. Every figure
 * resolves to real, single visitors — a flow from where people came from to
 * what they paid (or why they didn't), the people inside any part of it, and
 * each person's full story.
 *
 * Every call has a live fallback while its #123 endpoint is still shipping,
 * so the screen always shows current data rather than a placeholder.
 */

export type FlowDimension = 'platform' | 'campaign' | 'landing' | 'product' | 'stage';
/** Flow columns, plus filter-only keys. */
export type FlowFilterKey = FlowDimension | 'country' | 'device' | 'reason';
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
  /** Why non-buyers stopped (#123 stop reasons). */
  reasons?: { reason: string; label: string; visitors: number }[];
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
  /** The exact URL they arrived from, host and path (backend#223). */
  referrerUrl?: string | null;
  /** The page they landed on, with its utm tags and no click ids. */
  landingUrl?: string | null;
  productsViewed: string[];
  furthestStage: string | null;
  cartValueMinor: number | null;
  orders: number;
  revenueMinor: number;
  contactable: boolean;
  lastSeenAt: string;
  firstSeenAt: string;
  /** Why they didn't buy, and the one-line human reading of it (#123). */
  stopReason?: string | null;
  stopDetail?: string | null;
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
  verdict?: { reason: string; detail: string | null } | null;
}

function scopeQuery(params: AnalyticsQueryParams, extra: Record<string, string | undefined> = {}): string {
  const q = new URLSearchParams({ from: params.from, to: params.to });
  if (params.traffic === 'all') q.set('includeBots', 'true');
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== '') q.set(k, v);
  return q.toString();
}

/** The backend names the landing column `landingPath`; everything else matches. */
const filterParam = (f: FlowFilter) => {
  if (!Object.keys(f).length) return undefined;
  const { landing, ...rest } = f;
  return JSON.stringify(landing ? { ...rest, landingPath: landing } : rest);
};

const notYet = (e: unknown) => {
  const st = (e as ApiError | undefined)?.status;
  return st === 404 || st === 501;
};

export function apiGetFlow(params: AnalyticsQueryParams, filter: FlowFilter): Promise<{ data: FlowResponse }> {
  return apiFetch(`/analytics/flow?${scopeQuery(params, { filter: filterParam(filter) })}`, { auth: true });
}

/**
 * The people behind a filter. Uses `/people` (#123) when the backend has it;
 * until then falls back to the existing visitors list — which already names
 * visitors (number / customer) and filters by search and country.
 */
export async function apiGetPeople(
  params: AnalyticsQueryParams,
  filter: FlowFilter,
  opts: { q?: string; sort?: PeopleSort; cursor?: string | null; limit?: number } = {},
): Promise<{ data: PeoplePage; legacy?: boolean }> {
  const limit = opts.limit ? String(opts.limit) : undefined;
  try {
    return await apiFetch(
      `/analytics/people?${scopeQuery(params, { filter: filterParam(filter), q: opts.q, sort: opts.sort, cursor: opts.cursor ?? undefined, limit })}`,
      { auth: true },
    );
  } catch (e) {
    if (!notYet(e)) throw e;
  }
  const legacy = await apiFetch<{ data: VisitorsPage }>(
    `/analytics/visitors?${scopeQuery(params, {
      q: opts.q,
      country: filter.country,
      hasOrder: filter.stage === 'paid' ? 'true' : undefined,
      cursor: opts.cursor ?? undefined,
      limit,
    })}`,
    { auth: true },
  );
  return {
    legacy: true,
    data: {
      nextCursor: legacy.data.nextCursor,
      rows: legacy.data.rows.map((r) => ({
        visitorId: r.visitorId,
        visitorNumber: r.visitorNumber ?? null,
        trafficClass: 'REAL' as TrafficClass,
        customer: r.customer ?? null,
        country: r.country,
        city: null,
        device: null,
        platform: r.firstChannel ? r.firstChannel.charAt(0) + r.firstChannel.slice(1).toLowerCase() : null,
        medium: null,
        campaign: null,
        landingPath: null,
        productsViewed: [],
        furthestStage: r.orderCount > 0 ? 'paid' : null,
        cartValueMinor: null,
        orders: r.orderCount,
        revenueMinor: r.revenueMinor,
        contactable: false,
        lastSeenAt: r.lastSeenAt,
        firstSeenAt: r.firstSeenAt,
        // What the visitors list can tell: bought, left after one page, or browsed and left.
        stopReason: r.orderCount > 0 ? 'bought' : r.pageviewCount <= 1 ? 'bounced' : 'browsed_left',
        stopDetail:
          r.orderCount > 0
            ? null
            : `${r.sessionCount} ${r.sessionCount === 1 ? 'visit' : 'visits'} · ${r.pageviewCount} ${r.pageviewCount === 1 ? 'page' : 'pages'} · no order`,
      })),
    },
  };
}

export type PeopleSort = 'lastSeenAt' | 'firstSeenAt' | 'revenueMinor' | 'orders';

/** More than any real range holds today; past it the screen says so and export stays exact. */
export const PEOPLE_CAP = 5000;

/**
 * Everyone in the range, not a first page: walks the cursor 200 at a time,
 * reporting progress so the list fills in as it loads. `signal.aborted`
 * stops it when the filters change mid-walk.
 */
export async function apiGetAllPeople(
  params: AnalyticsQueryParams,
  filter: FlowFilter,
  opts: { q?: string; sort?: PeopleSort },
  onPage: (rows: PersonRow[], done: boolean, legacy: boolean) => void,
  signal: { aborted: boolean },
): Promise<void> {
  let cursor: string | null = null;
  let all: PersonRow[] = [];
  do {
    const r = await apiGetPeople(params, filter, { ...opts, cursor, limit: 200 });
    if (signal.aborted) return;
    all = all.concat(r.data.rows);
    cursor = r.data.nextCursor;
    const done = !cursor || all.length >= PEOPLE_CAP;
    onPage(all, done, !!r.legacy);
    if (done) return;
  } while (cursor);
}

const EVENT_LABEL: Record<string, string> = {
  page_view: 'Viewed page',
  product_view: 'Viewed product',
  product_impression: 'Saw product in a list',
  add_to_cart: 'Added to bag',
  remove_from_cart: 'Removed from bag',
  cart_view: 'Opened the bag',
  begin_checkout: 'Started checkout',
  checkout_step_view: 'Checkout step',
  checkout_address_entered: 'Entered address',
  checkout_shipping_selected: 'Chose delivery',
  payment_initiated: 'Started payment',
  purchase: 'Paid',
  search: 'Searched',
};

const NOISE = new Set(['scroll_depth', 'page_leave', 'web_vitals', 'ui_click', 'product_impression']);

/** Until `/story` ships: a timeline from the journey events, sessions split on 30-minute gaps. */
export function storyFromJourney(
  visitorId: string,
  events: JourneyEvent[],
  identity: { visitorNumber: number | null; customer: { id: string; name: string | null } | null } | null,
): VisitorStory {
  const sorted = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const sessions: StorySession[] = [];
  let cur: StorySession | null = null;
  let last = 0;
  for (const ev of sorted) {
    const t = new Date(ev.occurredAt).getTime();
    if (!cur || t - last > 30 * 60 * 1000) {
      cur = {
        sessionId: null,
        startedAt: ev.occurredAt,
        endedAt: ev.occurredAt,
        touch: { platform: null, medium: null, campaign: null, clickId: null, landingPath: ev.path },
        summary: '',
        steps: [],
      };
      sessions.push(cur);
    }
    last = t;
    cur.endedAt = ev.occurredAt;
    if (NOISE.has(ev.eventName)) continue;
    const prev = cur.steps[cur.steps.length - 1];
    // Collapse repeats of the same step on the same page into one line.
    if (prev && prev.kind === ev.eventName && prev.path === ev.path) continue;
    cur.steps.push({
      at: ev.occurredAt,
      kind: ev.eventName,
      label: `${EVENT_LABEL[ev.eventName] ?? ev.eventName.replace(/_/g, ' ')}${ev.path ? ` · ${ev.path}` : ''}`,
      path: ev.path,
      valueMinor: ev.valueMinor,
    });
  }
  for (const ss of sessions) {
    const has = (k: string) => ss.steps.some((st) => st.kind === k);
    const products = ss.steps.filter((st) => st.kind === 'product_view').length;
    ss.summary = has('purchase')
      ? 'Bought.'
      : has('begin_checkout')
        ? 'Started checkout, did not pay.'
        : has('add_to_cart')
          ? has('remove_from_cart')
            ? 'Added to bag, then removed it.'
            : 'Added to bag, did not check out.'
          : products
            ? `Looked at ${products} product${products === 1 ? '' : 's'}, added nothing.`
            : 'Browsed, opened no product.';
  }
  return {
    visitorId,
    visitorNumber: identity?.visitorNumber ?? null,
    trafficClass: 'REAL',
    customer: identity?.customer ?? null,
    sessions: sessions.reverse(),
  };
}

export async function apiGetVisitorStory(visitorId: string, params: AnalyticsQueryParams): Promise<{ data: VisitorStory }> {
  try {
    return await apiFetch(`/analytics/visitors/${encodeURIComponent(visitorId)}/story?${scopeQuery(params)}`, { auth: true });
  } catch (e) {
    if (!notYet(e)) throw e;
  }
  const j = await apiGetVisitorJourney(visitorId, params);
  return { data: storyFromJourney(visitorId, j.data, j.identity) };
}

/**
 * Download the whole filtered set as the server builds it (backend 0.132,
 * streamed, capped at 2,000 visitors) — not just the rows loaded on screen.
 * Resolves false when the server export isn't available, so the caller can
 * fall back to exporting what it has.
 */
export async function downloadServerExport(
  dataset: 'people' | 'flow' | 'story',
  format: 'csv' | 'json',
  params: AnalyticsQueryParams,
  filter: FlowFilter,
  filename: string,
): Promise<boolean> {
  try {
    const headers = new Headers({ [CLIENT_HEADER]: CLIENT_AUDIENCE });
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const res = await fetch(`${API_BASE}${exportPath(dataset, format, params, filter)}`, { headers, credentials: 'include' });
    if (!res.ok) return false;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${params.from}-to-${params.to}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

/** Full-set export path (server builds it). */
export function exportPath(dataset: 'people' | 'flow' | 'story', format: 'csv' | 'json', params: AnalyticsQueryParams, filter: FlowFilter): string {
  return `/analytics/export/${dataset}?${scopeQuery(params, { format, filter: filterParam(filter) })}`;
}

export const DIMENSION_LABEL: Record<FlowFilterKey, string> = {
  reason: 'Stopped because',
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
  checkout_step: 'Started checkout',
  checkout_contact: 'Checkout · contact',
  checkout_address: 'Checkout · address',
  checkout_shipping: 'Checkout · shipping',
  checkout_payment: 'Checkout · payment',
  paid: 'Paid',
  refunded: 'Refunded',
};

/** Why a visitor didn't buy, in the owner's words (#123). */
export const STOP_REASON_LABEL: Record<string, string> = {
  bounced: 'Left within seconds',
  browsed_no_product: 'Browsed, opened no product',
  browsed_left: 'Browsed, then left',
  viewed_not_added: 'Looked, did not add',
  added_then_removed: 'Added, then removed',
  left_in_bag: 'Left it in the bag',
  left_checkout_contact: 'Left at checkout · contact',
  left_checkout_address: 'Left at checkout · address',
  left_checkout_shipping: 'Left at checkout · delivery',
  left_checkout_payment: 'Left at checkout · payment',
  payment_failed: 'Payment failed',
  bought: 'Bought',
  refunded: 'Refunded',
};

/**
 * Facebook and Instagram share one Meta pixel, so the dashboard shows them
 * apart (the ads tag utm_source=fb / ig) and totals them under Meta
 * (backend#223). "Meta" alone is a click whose placement is unknowable.
 */
export const PLATFORM_NETWORK: Record<string, string> = {
  Facebook: 'Meta',
  Instagram: 'Meta',
  Meta: 'Meta',
  TikTok: 'TikTok',
};

export function personName(p: { visitorNumber: number | null; visitorId: string; customer?: { name: string | null } | null }): string {
  if (p.customer?.name) return p.customer.name;
  return p.visitorNumber ? `Visitor #${p.visitorNumber.toLocaleString('en-US')}` : `Visitor ${p.visitorId.slice(0, 6)}`;
}

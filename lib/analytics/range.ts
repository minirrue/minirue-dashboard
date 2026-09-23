import { shopDateInput } from '@/lib/dates/end-of-shop-day';
import { rangeLabel } from './format';

/**
 * The date range and traffic scope every Analytics screen asks with
 * (dashboard#128): one reader and one writer for the URL, one query-string
 * builder for every endpoint, and the presets the toolbar offers.
 *
 * Replaces three query builders (`buildQuery`, `buildAnalyticsQueryString`,
 * the story client's `scopeQuery`) and two `withScope` link helpers. The
 * default window used to be computed in UTC, so between midnight and 2–3 AM
 * Cairo time "today" was still yesterday; it is the shop's own day now.
 */

/**
 * Whose traffic a screen shows (dashboard#90, #115). `real`, the default,
 * leaves out bots, staff, the owner and anything an admin flagged; `all`
 * shows everything, for checking the exclusions themselves.
 */
export type TrafficScope = 'real' | 'all';

export interface AnalyticsRangeState {
  from: string;
  to: string;
  compare: boolean;
  traffic: TrafficScope;
}

/** The query every analytics endpoint takes. */
export interface ScopeQuery {
  from: string;
  to: string;
  compare?: boolean;
  traffic?: TrafficScope;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const DEFAULT_WINDOW_DAYS = 30;

/** Today's `YYYY-MM-DD` in Cairo. */
export function shopToday(now: number = Date.now()): string {
  return shopDateInput(new Date(now).toISOString());
}

/** `YYYY-MM-DD` plus `n` calendar days. */
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Inclusive number of days in a range. */
export function daySpan(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000) + 1;
}

export type RangePreset = 'today' | '7d' | '30d' | 'month';

export const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
];

export function presetRange(id: RangePreset, now: number = Date.now()): { from: string; to: string } {
  const to = shopToday(now);
  switch (id) {
    case 'today':
      return { from: to, to };
    case '7d':
      return { from: addDays(to, -6), to };
    case 'month':
      return { from: `${to.slice(0, 8)}01`, to };
    default:
      return { from: addDays(to, -(DEFAULT_WINDOW_DAYS - 1)), to };
  }
}

/** Which preset a range is, if any, so the menu can mark it. */
export function matchPreset(range: { from: string; to: string }, now: number = Date.now()): RangePreset | null {
  for (const p of RANGE_PRESETS) {
    const r = presetRange(p.id, now);
    if (r.from === range.from && r.to === range.to) return p.id;
  }
  return null;
}

type ParamReader = { get(key: string): string | null };

/** The range in the URL, or the last 30 Cairo days. */
export function readRange(params: ParamReader | null, now: number = Date.now()): AnalyticsRangeState {
  const from = params?.get('from') ?? '';
  const to = params?.get('to') ?? '';
  const compare = params?.get('compare') === 'true';
  const traffic: TrafficScope = params?.get('traffic') === 'all' ? 'all' : 'real';
  if (DAY_RE.test(from) && DAY_RE.test(to) && from <= to) return { from, to, compare, traffic };
  return { ...presetRange('30d', now), compare, traffic };
}

/** Writes the range onto a copy of the params; defaults are left out of the URL. */
export function writeRange(params: URLSearchParams, state: AnalyticsRangeState): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  next.set('from', state.from);
  next.set('to', state.to);
  if (state.compare) next.set('compare', 'true');
  else next.delete('compare');
  if (state.traffic === 'all') next.set('traffic', 'all');
  else next.delete('traffic');
  return next;
}

/**
 * The query string for every analytics endpoint.
 *
 * `compare` is mapped, not passed through: the backend takes
 * `'previous' | 'year' | 'none'` (BaseQuerySchema), never a boolean, and
 * `compare=true` answers 422. Excluded traffic (bots, staff, owner, flagged)
 * is dropped unless `traffic` is `all` (#115, #122). Empty extras are skipped.
 */
export function buildAnalyticsQuery(params: ScopeQuery, extra?: Record<string, string | undefined | null>): string {
  const q = new URLSearchParams();
  q.set('from', params.from);
  q.set('to', params.to);
  if (params.compare) q.set('compare', 'previous');
  if (params.traffic === 'all') q.set('includeBots', 'true');
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined && value !== null && value !== '') q.set(key, value);
    }
  }
  return q.toString();
}

const SCOPE_KEYS = ['from', 'to', 'compare', 'traffic'] as const;

/** A link that keeps the current range and traffic scope. */
export function withScope(href: string, scope: ParamReader | AnalyticsRangeState | null): string {
  if (!scope) return href;
  const keep = new URLSearchParams();
  for (const key of SCOPE_KEYS) {
    const raw =
      'get' in scope && typeof scope.get === 'function'
        ? (scope as ParamReader).get(key)
        : (scope as AnalyticsRangeState)[key];
    const v = typeof raw === 'boolean' ? (raw ? 'true' : null) : raw === 'real' ? null : raw;
    if (v) keep.set(key, String(v));
  }
  const qs = keep.toString();
  if (!qs) return href;
  return `${href}${href.includes('?') ? '&' : '?'}${qs}`;
}

/** "23 Aug – 21 Sep 2026", the range as the toolbar and exports print it. */
export const scopeRangeLabel = (r: { from: string; to: string }) => rangeLabel(r.from, r.to);

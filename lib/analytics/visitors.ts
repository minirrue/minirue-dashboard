import type { PersonRow } from '@/lib/api/story';
import type { TrafficScope } from './range';
import { channelOf, CHANNELS, CHANNEL_ORDER, sourceLabel, type Channel } from './source';
import { deviceLabel, placeLabel, realOrNull } from './format';

/**
 * Who a visitor is, and who counts (dashboard#128).
 *
 * `countedVisitors` is THE canonical unique-visitor definition, the single
 * function Overview, People, Journeys, Sources and Flow all count through.
 * Before it, Overview counted the daily rollup (every non-bot visitor-day)
 * while People counted the numbered people list, and the owner saw
 * "240 real visitors" over a list of 174. Now every figure on every section
 * is a count of the same rows, so they agree by construction, and Data
 * quality shows the rollup beside them only to explain the gap.
 */

export const VISITOR_DEFINITION =
  'One person is one browser visitor ID that has passed the human check and got a visitor number. ' +
  'Fingerprints are not merged across days. Bots, you, your staff and anyone marked “This is us” are left out ' +
  'unless Who counts is set to everyone.';

/** Traffic classes counted as real people. TRUSTED is a real customer an admin vouched for. */
const REAL_CLASSES = new Set(['REAL', 'TRUSTED']);

/**
 * The canonical unique visitors: one row per visitor ID, and in the default
 * `real` scope only numbered, unflagged people (the backend's own rule,
 * backend#224, restated here so the dashboard can never count differently).
 */
export function countedVisitors(rows: readonly PersonRow[], scope: TrafficScope): PersonRow[] {
  const seen = new Set<string>();
  const out: PersonRow[] = [];
  for (const r of rows) {
    if (!r.visitorId || seen.has(r.visitorId)) continue;
    if (scope === 'real') {
      if (!REAL_CLASSES.has(r.trafficClass)) continue;
      if (r.visitorNumber == null && r.trafficClass !== 'TRUSTED') continue;
    }
    seen.add(r.visitorId);
    out.push(r);
  }
  return out;
}

/* ── Names ──────────────────────────────────────────────────────────────── */

export interface VisitorIdentity {
  visitorId?: string | null;
  visitorNumber?: number | null;
  customer?: { id?: string | null; name: string | null } | null;
}

/**
 * The one way a visitor is named anywhere in the dashboard (owner,
 * 2026-09-19): a signed-up customer by name, everyone else "Visitor #1042".
 * The raw id never shows. Replaces `visitorLabel`, `personName` and the open
 * carts' own `name()`.
 */
export function visitorLabel(v: VisitorIdentity): string {
  if (v.customer?.name) return v.customer.name;
  // An id, not a quantity: no thousands separator ("Visitor #1187").
  if (v.visitorNumber) return `Visitor #${v.visitorNumber}`;
  if (v.customer) return 'Customer';
  return v.visitorId ? `Visitor ·${v.visitorId.slice(0, 4).toUpperCase()}` : 'Visitor';
}

/* ── The global filters: Source, Campaign, Device, Location ─────────────── */

export type FilterKey = 'source' | 'campaign' | 'device' | 'location';
export type Filters = Record<FilterKey, string[]>;

export const FILTER_DEFS: { key: FilterKey; label: string; param: string }[] = [
  { key: 'source', label: 'Source', param: 'source' },
  { key: 'campaign', label: 'Campaign', param: 'campaign' },
  { key: 'device', label: 'Device', param: 'device' },
  { key: 'location', label: 'Location', param: 'place' },
];

export function emptyFilters(): Filters {
  return { source: [], campaign: [], device: [], location: [] };
}

export function activeFilterCount(f: Filters): number {
  return f.source.length + f.campaign.length + f.device.length + f.location.length;
}

/** The value a person has for each filter. */
export function filterValue(p: PersonRow, key: FilterKey): string {
  switch (key) {
    case 'source':
      return channelOf(p.medium);
    case 'campaign':
      return sourceLabel(p);
    case 'device':
      return realOrNull(p.device)?.toLowerCase() ?? 'unknown';
    case 'location':
      return placeLabel(p.city, p.country);
  }
}

export function filterLabel(key: FilterKey, value: string): string {
  if (key === 'source') return CHANNELS[value as Channel]?.label ?? value;
  if (key === 'device') return value === 'unknown' ? 'Device unknown' : deviceLabel(value);
  return value;
}

export function matchesFilters(p: PersonRow, f: Filters): boolean {
  return (Object.keys(f) as FilterKey[]).every((k) => !f[k].length || f[k].includes(filterValue(p, k)));
}

/** Counted visitors under the active filters: what every section shows. */
export function peopleInView(rows: readonly PersonRow[], scope: TrafficScope, f: Filters): PersonRow[] {
  return countedVisitors(rows, scope).filter((p) => matchesFilters(p, f));
}

/** Every value each filter can take in this range, with its people count, most people first. */
export function filterOptions(people: readonly PersonRow[]): Record<FilterKey, { value: string; label: string; count: number }[]> {
  const out = {} as Record<FilterKey, { value: string; label: string; count: number }[]>;
  for (const { key } of FILTER_DEFS) {
    const counts = new Map<string, number>();
    for (const p of people) {
      const v = filterValue(p, key);
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    let rows = [...counts].map(([value, count]) => ({ value, label: filterLabel(key, value), count }));
    if (key === 'source') {
      rows = CHANNEL_ORDER.map((c) => rows.find((r) => r.value === c) ?? { value: c, label: CHANNELS[c].label, count: 0 });
    } else {
      rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    }
    out[key] = rows;
  }
  return out;
}

export function readFilters(params: { getAll(key: string): string[] } | null): Filters {
  const f = emptyFilters();
  if (!params) return f;
  for (const d of FILTER_DEFS) f[d.key] = params.getAll(d.param).filter(Boolean);
  return f;
}

export function writeFilters(params: URLSearchParams, f: Filters): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  for (const d of FILTER_DEFS) {
    next.delete(d.param);
    for (const v of f[d.key]) next.append(d.param, v);
  }
  return next;
}

/** "Source: Paid ads · Device: Mobile", or "None". */
export function filterContext(f: Filters): string {
  const parts: string[] = [];
  for (const d of FILTER_DEFS) for (const v of f[d.key]) parts.push(`${d.label}: ${filterLabel(d.key, v)}`);
  return parts.length ? parts.join(' · ') : 'None';
}

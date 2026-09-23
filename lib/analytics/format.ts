import { formatDateTime, formatTime } from '@/lib/dates/format';

/**
 * The one set of number, money, place and time formatters for Analytics
 * (dashboard#128, "merge and unify"). Every screen, table, answer line and
 * export used to carry its own `n`, `egp`, `pct` and `countryName`; they
 * disagreed on rounding (EGP 1,139 vs EGP 1,139.00), on the empty case
 * (`0%` vs `—`) and on the clock. They all come from here now.
 *
 * Times are always 12-hour Cairo time, whatever the browser's zone
 * (`lib/dates/format`, owner 2026-09-19).
 */

/** "1,380". Null and undefined read as 0. */
export function fmtInt(n: number | null | undefined): string {
  return Math.round(n ?? 0).toLocaleString('en-US');
}

/** "1 landing", "5 landings" (regular plurals only; pass `many` for the rest). */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${fmtInt(n)} ${n === 1 ? one : many}`;
}

/** Share of `whole`, as a percentage rounded to one decimal. 0 when `whole` is 0. */
export function pctOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

/** "56.9%", "50%", or "—" when there is nothing to divide by. */
export function fmtPct(part: number, whole: number): string {
  if (!(whole > 0)) return '—';
  return `${String(pctOf(part, whole)).replace(/\.0$/, '')}%`;
}

/** Whole pounds from piastres: "EGP 1,139". */
export function egp(minor: number | null | undefined): string {
  return `EGP ${Math.round((minor ?? 0) / 100).toLocaleString('en-US')}`;
}

/** Exact pounds from piastres: "EGP 1,139.00". */
export function egpExact(minor: number | null | undefined): string {
  return `EGP ${((minor ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "EGP 1.2K", "EGP 3.4M" when space is tight; exact ("EGP 12.50") below 1,000. */
export function egpShort(minor: number | null | undefined): string {
  const val = (minor ?? 0) / 100;
  if (Math.abs(val) >= 1_000_000) return `EGP ${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `EGP ${(val / 1_000).toFixed(1)}K`;
  return egpExact(minor);
}

/** Whole pounds as a plain number, for exports: 1139. */
export function egpNumber(minor: number | null | undefined): number {
  return Math.round((minor ?? 0) / 100);
}

/** "19 Sep, 7:40 PM" in Cairo. */
export const cairoDateTime = (v: string | number | Date) => formatDateTime(v);
/** "7:40 PM" in Cairo. */
export const cairoTime = (v: string | number | Date) => formatTime(v);
/** "22 Sep 2026, 1:45 PM" in Cairo: the stamp on exports and freshness lines. */
export const cairoStamp = (v: string | number | Date) => formatDateTime(v, { year: true });

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A `YYYY-MM-DD` calendar day as "23 Aug" (or "23 Aug 2026"). No time-zone shift. */
export function dayLabel(ymd: string, withYear = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return ymd;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}${withYear ? ` ${m[1]}` : ''}`;
}

/** "23 Aug – 21 Sep 2026", "21 Sep 2026" for one day, years on both ends when they differ. */
export function rangeLabel(from: string, to: string): string {
  if (from === to) return dayLabel(from, true);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${dayLabel(from, !sameYear)} – ${dayLabel(to, true)}`;
}

/** "1 min 40 s", "6 s", "2 h 5 min". */
export function durationLabel(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(seconds ?? 0));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) {
    const rest = s % 60;
    return rest ? `${m} min ${rest} s` : `${m} min`;
  }
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** "Egypt" for "EG". Falls back to the code when the runtime has no region names. */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/**
 * The collector writes the literal string "unknown" for a city or region it
 * cannot resolve (the MaxMind city database is not live, backend#177), so a
 * bare `city ?? country` printed "unknown" over perfectly good country data.
 */
export function realOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  return v && !/^(unknown|undefined|null|n\/a|-)$/i.test(v) ? v : null;
}

/** "Cairo · Egypt", "Egypt", or "Country unknown": never the word "unknown" alone. */
export function placeLabel(
  city: string | null | undefined,
  country: string | null | undefined,
  nameOf: (code: string) => string = countryName,
): string {
  const c = realOrNull(city);
  const cc = realOrNull(country);
  if (c && cc) return `${c} · ${nameOf(cc)}`;
  if (c) return c;
  if (cc) return nameOf(cc);
  return 'Country unknown';
}

/** "Mobile" for "mobile"; "Device unknown" for nothing. */
export function deviceLabel(device: string | null | undefined): string {
  const d = realOrNull(device);
  return d ? d.charAt(0).toUpperCase() + d.slice(1) : 'Device unknown';
}

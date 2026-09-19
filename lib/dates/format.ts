import { SHOP_TIME_ZONE } from './end-of-shop-day';

/**
 * One clock for the whole dashboard (owner, 2026-09-19): 12-hour, Cairo time,
 * whatever the browser's locale or zone. "19 Sep, 7:40 PM".
 */
const opts = (extra: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions => ({
  timeZone: SHOP_TIME_ZONE,
  hour12: true,
  ...extra,
});

const toDate = (v: string | number | Date) => (v instanceof Date ? v : new Date(v));

/** "19 Sep, 7:40 PM" (add `year: true` for "19 Sep 2026, 7:40 PM"). */
export function formatDateTime(v: string | number | Date, o: { year?: boolean; seconds?: boolean } = {}): string {
  const d = toDate(v);
  if (Number.isNaN(d.getTime())) return '—';
  // en-US parts, reassembled day-first: en-GB spells September "Sept".
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: SHOP_TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(d);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
  const date = `${get('day')} ${get('month')}${o.year ? ` ${get('year')}` : ''}`;
  return `${date}, ${formatTime(d, o)}`;
}

/** "7:40 PM". */
export function formatTime(v: string | number | Date, o: { seconds?: boolean } = {}): string {
  const d = toDate(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', opts({ hour: 'numeric', minute: '2-digit', ...(o.seconds ? { second: '2-digit' } : {}) }));
}

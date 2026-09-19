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

/**
 * A stored 24-hour clock value ("14:00", "09:30", or the "24:00" end-of-day
 * sentinel) shown the shop's way: "2 PM", "9:30 AM", "12 AM".
 */
export function formatClock(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const h = Number(m[1]) % 24;
  const min = m[2];
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${min === '00' ? '' : `:${min}`} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "7:40 PM". */
export function formatTime(v: string | number | Date, o: { seconds?: boolean } = {}): string {
  const d = toDate(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', opts({ hour: 'numeric', minute: '2-digit', ...(o.seconds ? { second: '2-digit' } : {}) }));
}

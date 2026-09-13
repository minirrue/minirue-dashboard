/**
 * The shop's own calendar day, as the backend's analytics reckon it
 * (`ANALYTICS_TIMEZONE`, default Africa/Cairo).
 */
export const SHOP_TIME_ZONE = 'Africa/Cairo';

/**
 * The last instant of a calendar day in the shop's time zone, as an ISO string.
 *
 * An `<input type="date">` gives `"2026-09-20"`, and `new Date("2026-09-20")`
 * is **midnight UTC** — 02:00 or 03:00 on the 20th in Cairo. A discount set to
 * end "on the 20th" was therefore switched off in the small hours of the 20th,
 * losing the whole day it was meant to run through, and one set to end *today*
 * was already expired by the time anyone opened the shop (frontend#83). The
 * admin means "through the end of that day, where the shop is".
 *
 * Cairo observes daylight saving (UTC+2 / UTC+3), so the offset is looked up
 * for that specific date through `Intl` rather than hard-coded.
 */
export function endOfShopDayIso(dateInput: string, timeZone: string = SHOP_TIME_ZONE): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.trim());
  if (!match) return null;
  const [, y, m, d] = match.map(Number) as unknown as [number, number, number, number];

  // 23:59:59.999 on that date as if it were UTC, then shifted by the zone's
  // offset at that moment. Computed twice so a DST change on the day itself
  // settles on the correct side.
  const wallClockUtc = Date.UTC(y, m - 1, d, 23, 59, 59, 999);
  let instant = wallClockUtc - offsetMs(wallClockUtc, timeZone);
  instant = wallClockUtc - offsetMs(instant, timeZone);
  return new Date(instant).toISOString();
}

/** The zone's offset from UTC at a given instant, in milliseconds. */
function offsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/** An ISO instant back to the `YYYY-MM-DD` the shop calls that day, for a date input. */
export function shopDateInput(iso: string | null | undefined, timeZone: string = SHOP_TIME_ZONE): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

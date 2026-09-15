import type { DeliveryLocation, DeliveryWindow } from '@/lib/api/orders';

/**
 * "Open in Google Maps" for a same-day order's pinned location
 * (dashboard#84). `{ lat, lng }` builds the coordinate search URL the issue
 * specifies; `{ mapsUrl }` is whatever link the customer pasted at checkout
 * and is returned verbatim — it already points at the right place, and
 * re-deriving one from it would risk sending the courier somewhere else.
 *
 * Returns null when there is no location to link to (a STANDARD order, or a
 * same-day order that somehow has neither shape).
 */
export function mapsLinkFor(location: DeliveryLocation | null | undefined): string | null {
  if (!location) return null;
  if ('mapsUrl' in location && location.mapsUrl) return location.mapsUrl;
  if ('lat' in location && 'lng' in location && Number.isFinite(location.lat) && Number.isFinite(location.lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
  }
  return null;
}

/**
 * "Today, 19:00–24:00" / "Tomorrow, 19:00–24:00" for a same-day order's
 * delivery window. `window.date` is the Africa/Cairo calendar date the
 * backend computed at checkout (today before the settings cutoff, tomorrow
 * at/after it — see backend#186's `delivery-window.spec.ts`); this only
 * compares it against the viewer's own local calendar date, which is a
 * reasonable proxy since the shop and its admins are both in Egypt.
 */
export function formatDeliveryWindow(window: DeliveryWindow | null | undefined): string {
  if (!window) return '—';
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  let dayLabel = window.date;
  if (window.date === todayStr) dayLabel = 'Today';
  else if (window.date === tomorrowStr) dayLabel = 'Tomorrow';

  return `${dayLabel}, ${window.start}–${window.end}`;
}

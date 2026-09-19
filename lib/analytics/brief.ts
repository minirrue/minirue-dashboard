/**
 * The written brief at the top of Analytics & Media (dashboard#115): the two
 * sentences a media buyer would say if you asked "how's it going?", composed
 * from the same numbers the screen shows. Pure and deterministic, so it is
 * tested, and so it never claims anything the figures below do not show.
 *
 * Channels are whatever keys the data carries — any source the shop ever
 * gets appears by its own name (owner: "compatible with any dynamic campaign").
 */

export interface ChannelFigures {
  key: string;
  visitors: number;
  addToCarts: number;
  beginCheckouts: number;
  orders: number;
  revenueMinor: number;
}

export interface BriefInput {
  visitors: number;
  orders: number;
  revenueMinor: number;
  channels: ChannelFigures[];
  openCarts?: { count: number; valueMinor: number };
}

const KNOWN: Record<string, string> = {
  DIRECT: 'Direct visits',
  ORGANIC: 'Organic search',
  PAID: 'Paid ads',
  SOCIAL: 'Social',
  REFERRAL: 'Referrals',
  EMAIL: 'Email',
  UNKNOWN: 'Unattributed',
};

/** "PAID" → "Paid ads"; an unfamiliar key is shown as itself, tidied. */
export function channelName(key: string): string {
  if (KNOWN[key]) return KNOWN[key];
  const t = key.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Unattributed';
}

export function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

function egpWhole(minor: number): string {
  return `EGP ${Math.round(minor / 100).toLocaleString('en-US')}`;
}

/** Up to two sentences; the first is always the most important fact. */
export function composeBrief(input: BriefInput): string[] {
  const { visitors, orders, channels } = input;
  const out: string[] = [];

  if (visitors === 0) {
    return ['No real visitors in this range yet. Once shoppers arrive, this is where the day is summed up.'];
  }

  if (orders === 0) {
    const carts = channels.reduce((s, c) => s + c.addToCarts, 0);
    out.push(
      `${visitors.toLocaleString('en-US')} real ${visitors === 1 ? 'visitor' : 'visitors'} and no orders yet` +
        (carts > 0 ? ` — ${carts} ${carts === 1 ? 'add to cart' : 'adds to cart'} so far.` : '.'),
    );
  } else {
    const byOrders = [...channels].filter((c) => c.orders > 0).sort((a, b) => b.orders - a.orders || b.revenueMinor - a.revenueMinor);
    const lead = byOrders[0];
    if (lead) {
      out.push(
        `${channelName(lead.key)} drove ${lead.orders} of ${orders} ${orders === 1 ? 'order' : 'orders'}` +
          ` (${egpWhole(lead.revenueMinor)}, ${pct(lead.orders, orders)}% of sales).`,
      );
    } else {
      out.push(`${orders} ${orders === 1 ? 'order' : 'orders'} from ${visitors.toLocaleString('en-US')} real visitors.`);
    }
  }

  // Second sentence: where traffic and buying disagree — the thing to act on.
  const meaningful = channels.filter((c) => c.visitors >= 5);
  if (meaningful.length >= 2) {
    const byTraffic = [...meaningful].sort((a, b) => b.visitors - a.visitors)[0];
    const byConversion = [...meaningful].sort(
      (a, b) => pct(b.orders, b.visitors) - pct(a.orders, a.visitors) || b.orders - a.orders,
    )[0];
    if (byTraffic.key !== byConversion.key && byConversion.orders > 0) {
      out.push(
        `${channelName(byTraffic.key)} brought the most visitors, but ${channelName(byConversion.key)} converted best` +
          ` (${pct(byConversion.orders, byConversion.visitors)}% vs ${pct(byTraffic.orders, byTraffic.visitors)}%).`,
      );
    }
  }

  if (out.length < 2 && input.openCarts && input.openCarts.count > 0) {
    out.push(
      `${input.openCarts.count} ${input.openCarts.count === 1 ? 'cart is' : 'carts are'} still open, worth ${egpWhole(input.openCarts.valueMinor)}.`,
    );
  }
  return out.slice(0, 2);
}

/**
 * What this server can take, and where the numbers came from.
 *
 * Every constant here was MEASURED against the live stack on a dated run, not
 * estimated. That distinction is the whole reason this file exists: a capacity
 * figure nobody can trace is a number people argue with instead of plan
 * against. Each one carries its provenance so a future reader can decide
 * whether it still applies.
 *
 * When the hardware, the code, or the traffic shape changes, RE-MEASURE and
 * update `MEASURED_AT`. Do not adjust these by intuition — an unmeasured number
 * that looks like a measured one is worse than no number.
 *
 * How to re-measure: `apps/minirue-backend/loadtest/` (k6 scenarios, a
 * server-side probe, and the method notes). Run the generator OFF the server —
 * k6 on the same box competes with the thing it measures and understates it by
 * roughly a quarter.
 */

/** ISO date of the run these figures come from. */
export const MEASURED_AT = '2026-08-01';

export interface CapacityCeiling {
  /** Requests (or orders) per second the stack sustained cleanly. */
  sustained: number;
  /** Where it stopped scaling — past this, latency collapses. */
  ceiling: number;
  /** p95 latency in ms AT the sustained figure, not at the ceiling. */
  p95Ms: number;
  /** One line on what actually limits this path. */
  limitedBy: string;
}

/**
 * Reads: browsing, search, product pages. Cacheable, and mostly cached.
 *
 * 200 rps sustained at p95 251ms with zero failures; degrades past ~230.
 * Measured through Traefik from an external generator, so it includes the
 * proxy — this is what the internet sees, not a loopback best case.
 */
export const READ_CAPACITY: CapacityCeiling = {
  sustained: 200,
  ceiling: 230,
  p95Ms: 251,
  limitedBy:
    'Traefik and Node CPU. Postgres is nearly idle on this path since the Redis read cache absorbs repeat traffic.',
};

/**
 * Writes: add to cart, checkout, order placement. Cannot be cached.
 *
 * ~10 orders/sec, and this is the number that actually binds. It is roughly a
 * twentieth of the read figure because every order is a multi-table
 * transaction that holds a pooled connection and takes a row lock on stock.
 */
export const WRITE_CAPACITY: CapacityCeiling = {
  sustained: 10,
  ceiling: 20,
  p95Ms: 820,
  limitedBy:
    'Checkout transaction length. Each order writes several tables and locks the stock row, so throughput is set by how long that transaction holds, not by CPU.',
};

/** The machine these figures describe. Change it and they stop being true. */
export const MEASURED_HARDWARE = {
  cores: 4,
  memoryGb: 7.7,
  swapGb: 0,
  note: 'Single node. Postgres, Redis, Traefik and the API share these four cores.',
};

/**
 * Requests one visitor generates, from the storefront's own code rather than
 * from a rule of thumb.
 *
 * PAGE_VIEW: a page load fans out to roughly five API calls (chrome, the page
 * payload, settings, categories, analytics beacon).
 *
 * CHAT_WIDGET_PER_MIN: SupportWidget.tsx polls on three timers — messages every
 * 4s, meta every 8s, presence every 20s. Only while the panel is OPEN and a
 * conversation exists, so it applies to a minority of sessions, but for those it
 * dwarfs their browsing cost.
 */
export const REQUEST_COST = {
  perPageView: 5,
  pagesPerSession: 7,
  perSession: 35,
  chatWidgetPerMin: 25.5,
};

/**
 * How real traffic is shaped over a day.
 *
 * PEAK_HOUR_SHARE: the busiest hour of an e-commerce day is ~10% of its
 * traffic. BURST_HEADROOM: inside that hour, arrivals are not flat either, so
 * half the peak-hour capacity is reserved for the spikes within it.
 *
 * These two are industry shape, NOT measured on this shop — the only figures
 * here that are not. They are the reason the headline DAU number is an order
 * of magnitude rather than a promise, and the page says so.
 */
export const TRAFFIC_SHAPE = {
  peakHourShare: 0.1,
  burstHeadroom: 2,
  sessionsPerUserPerDay: 1.3,
  /** Share of monthly users active on a given day — used only for the MAU hint. */
  dauToMauRatio: 0.25,
};

export interface CapacityProjection {
  safePeakRps: number;
  peakHourRequests: number;
  dailyRequests: number;
  sessionsPerDay: number;
  dau: number;
  mau: number;
  concurrentBrowsers: number;
}

/**
 * Turns a sustained rps figure into the numbers a person actually plans with.
 *
 * Deliberately a pure function of the constants above so the page cannot drift
 * from the model, and so changing one input (a bigger server, a cheaper page)
 * moves every derived number at once.
 */
export function project(sustainedRps: number = READ_CAPACITY.sustained): CapacityProjection {
  const safePeakRps = sustainedRps / TRAFFIC_SHAPE.burstHeadroom;
  const peakHourRequests = safePeakRps * 3600;
  const dailyRequests = peakHourRequests / TRAFFIC_SHAPE.peakHourShare;
  const sessionsPerDay = dailyRequests / REQUEST_COST.perSession;
  const dau = sessionsPerDay / TRAFFIC_SHAPE.sessionsPerUserPerDay;

  return {
    safePeakRps,
    peakHourRequests,
    dailyRequests,
    sessionsPerDay,
    dau,
    mau: dau / TRAFFIC_SHAPE.dauToMauRatio,
    // A browsing visitor issues roughly one request every ten seconds, so each
    // one occupies 0.1 rps of the budget.
    concurrentBrowsers: sustainedRps / 0.1,
  };
}

/**
 * The failure mode worth designing for.
 *
 * Daily volume is not the risk — concentration is. This returns how long a
 * given number of simultaneous buyers takes to clear at the write ceiling, so
 * "500 people at a drop" becomes a duration instead of a feeling.
 */
export function drainTimeSeconds(buyers: number): number {
  return buyers / WRITE_CAPACITY.sustained;
}

/** Orders/sec implied by a daily order count spread evenly. Reality is spikier. */
export function ordersPerSecond(ordersPerDay: number): number {
  return ordersPerDay / 86_400;
}

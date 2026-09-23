/**
 * The funnel: five stages, counted in people, the same everywhere
 * (dashboard#128). Overview's ledger, the source table, the flow paths and the
 * People outcomes all read a person's stage through `stageRank`, so "reached
 * checkout" cannot mean one thing in one table and another in the next.
 *
 * A person's stage is the backend's `furthestStage` (dashboard#123), the
 * furthest point they ever reached, plus their paid orders.
 */

export type StageKey = 'visited' | 'product' | 'bag' | 'checkout' | 'purchased';

export interface StageDef {
  key: StageKey;
  label: string;
  /** Key into the metric definitions, for the info tooltip. */
  def: string;
}

export const FUNNEL: StageDef[] = [
  { key: 'visited', label: 'Visited', def: 'visitors' },
  { key: 'product', label: 'Viewed a product', def: 'viewed' },
  { key: 'bag', label: 'Added to bag', def: 'bag' },
  { key: 'checkout', label: 'Reached checkout', def: 'checkout' },
  { key: 'purchased', label: 'Purchased', def: 'purchased' },
];

const RANK_OF_FURTHEST: Record<string, number> = {
  viewed: 1,
  product: 1,
  bag: 2,
  checkout: 3,
  checkout_step: 3,
  checkout_contact: 3,
  checkout_address: 3,
  checkout_shipping: 3,
  checkout_payment: 3,
  paid: 4,
  refunded: 4,
};

export const STAGE_INDEX: Record<StageKey, number> = { visited: 0, product: 1, bag: 2, checkout: 3, purchased: 4 };

export interface StagedPerson {
  furthestStage?: string | null;
  orders?: number;
}

/** 0 visited · 1 viewed a product · 2 bag · 3 checkout · 4 purchased. */
export function stageRank(p: StagedPerson): number {
  const r = p.furthestStage ? (RANK_OF_FURTHEST[p.furthestStage] ?? 0) : 0;
  return (p.orders ?? 0) > 0 ? 4 : r;
}

export function reached(p: StagedPerson, key: StageKey): boolean {
  return stageRank(p) >= STAGE_INDEX[key];
}

export type StageCounts = Record<StageKey, number>;

export function emptyCounts(): StageCounts {
  return { visited: 0, product: 0, bag: 0, checkout: 0, purchased: 0 };
}

/** People who reached each stage. */
export function countStages(people: StagedPerson[]): StageCounts {
  const c = emptyCounts();
  for (const p of people) {
    const r = stageRank(p);
    c.visited += 1;
    if (r >= 1) c.product += 1;
    if (r >= 2) c.bag += 1;
    if (r >= 3) c.checkout += 1;
    if (r >= 4) c.purchased += 1;
  }
  return c;
}

export function addCounts(a: StageCounts, b: StageCounts): StageCounts {
  return {
    visited: a.visited + b.visited,
    product: a.product + b.product,
    bag: a.bag + b.bag,
    checkout: a.checkout + b.checkout,
    purchased: a.purchased + b.purchased,
  };
}

export interface FunnelStep extends StageDef {
  n: number;
  /** People at the previous stage; null for Visited. */
  prev: number | null;
  /** People lost since the previous stage. */
  lost: number;
}

export function funnelSteps(c: StageCounts): FunnelStep[] {
  return FUNNEL.map((s, i) => {
    const prev = i === 0 ? null : c[FUNNEL[i - 1].key];
    return { ...s, n: c[s.key], prev, lost: prev === null ? 0 : Math.max(0, prev - c[s.key]) };
  });
}

/** Index of the step that lost the most people; -1 when nobody was lost. */
export function biggestDrop(steps: FunnelStep[]): number {
  let at = -1;
  let max = 0;
  steps.forEach((s, i) => {
    if (i > 0 && s.lost > max) {
      max = s.lost;
      at = i;
    }
  });
  return at;
}

/**
 * The red rule, one definition for every table: a step that lost more than
 * 90% of at least 5 people.
 */
export function isSteepDrop(prev: number | null | undefined, n: number): boolean {
  return prev != null && prev >= 5 && n / prev < 0.1;
}

/* ── Labels ─────────────────────────────────────────────────────────────── */

export const STAGE_LABEL: Record<string, string> = {
  viewed: 'Viewed a product',
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

/** Why a visitor didn't buy, in the owner's words (dashboard#123). */
export const STOP_REASON_LABEL: Record<string, string> = {
  bounced: 'Bounced',
  browsed_no_product: 'Browsed, no product',
  browsed_left: 'Browsed, then left',
  viewed_not_added: 'Viewed, not added',
  added_then_removed: 'Added, then removed',
  left_in_bag: 'Left in bag',
  left_checkout_contact: 'Left at checkout · contact',
  left_checkout_address: 'Left at checkout · address',
  left_checkout_shipping: 'Left at checkout · delivery',
  left_checkout_payment: 'Left at checkout · payment',
  payment_failed: 'Payment failed',
  bought: 'Bought',
  refunded: 'Refunded',
};

/** How a journey ended, grouped the way "How journeys ended" shows it. */
export type Outcome = 'viewed_not_added' | 'bounced' | 'browsed_no_product' | 'left_in_bag' | 'left_checkout' | 'bought';

export const OUTCOMES: { key: Outcome; label: string; color: string }[] = [
  { key: 'viewed_not_added', label: 'Viewed, never added', color: 'var(--mr-chart-1)' },
  { key: 'bounced', label: 'Bounced', color: 'var(--mr-ink-300)' },
  { key: 'browsed_no_product', label: 'Browsed, no product', color: 'var(--mr-chart-3)' },
  { key: 'left_in_bag', label: 'Left in bag', color: 'var(--mr-chart-4)' },
  { key: 'left_checkout', label: 'Left in checkout', color: 'var(--mr-chart-2)' },
  { key: 'bought', label: 'Bought', color: 'var(--mr-chart-5)' },
];

export function outcomeOf(p: StagedPerson & { stopReason?: string | null }): Outcome {
  const r = p.stopReason ?? '';
  if (r === 'bought' || r === 'refunded' || (p.orders ?? 0) > 0) return 'bought';
  if (r.startsWith('left_checkout') || r === 'payment_failed') return 'left_checkout';
  if (r === 'left_in_bag' || r === 'added_then_removed') return 'left_in_bag';
  if (r === 'viewed_not_added') return 'viewed_not_added';
  if (r === 'browsed_no_product' || r === 'browsed_left') return 'browsed_no_product';
  if (r === 'bounced') return 'bounced';
  // No reason from the server: read it off the furthest stage.
  const rank = stageRank(p);
  if (rank >= 3) return 'left_checkout';
  if (rank === 2) return 'left_in_bag';
  if (rank === 1) return 'viewed_not_added';
  return 'bounced';
}

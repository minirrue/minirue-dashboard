import { describe, expect, it } from '@jest/globals';
import { biggestDrop, countStages, funnelSteps, isSteepDrop, outcomeOf, reached, stageRank } from '@/lib/analytics/funnel';
import { ariaSort, compareValues, nextSort, sortRows } from '@/lib/analytics/sort';

describe('funnel stages (people, not events)', () => {
  it('ranks the furthest stage, and a paid order is always purchased', () => {
    expect(stageRank({ furthestStage: null })).toBe(0);
    expect(stageRank({ furthestStage: 'viewed' })).toBe(1);
    expect(stageRank({ furthestStage: 'bag' })).toBe(2);
    expect(stageRank({ furthestStage: 'checkout_step' })).toBe(3);
    expect(stageRank({ furthestStage: 'refunded' })).toBe(4);
    expect(stageRank({ furthestStage: 'viewed', orders: 1 })).toBe(4);
    expect(reached({ furthestStage: 'bag' }, 'product')).toBe(true);
    expect(reached({ furthestStage: 'bag' }, 'checkout')).toBe(false);
  });

  it('counts each person once at every stage they passed', () => {
    const c = countStages([{ furthestStage: null }, { furthestStage: 'viewed' }, { furthestStage: 'viewed' }, { furthestStage: 'checkout_step' }]);
    expect(c).toEqual({ visited: 4, product: 3, bag: 1, checkout: 1, purchased: 0 });
  });

  it('names the biggest drop by people lost', () => {
    const steps = funnelSteps({ visited: 195, product: 111, bag: 2, checkout: 1, purchased: 0 });
    expect(steps.map((s) => s.lost)).toEqual([0, 84, 109, 1, 1]);
    expect(steps[biggestDrop(steps)].key).toBe('bag');
    expect(biggestDrop(funnelSteps({ visited: 0, product: 0, bag: 0, checkout: 0, purchased: 0 }))).toBe(-1);
  });

  it('the red rule: more than 90% of at least 5 people', () => {
    expect(isSteepDrop(111, 2)).toBe(true);
    expect(isSteepDrop(4, 0)).toBe(false);
    expect(isSteepDrop(10, 1)).toBe(false);
    expect(isSteepDrop(null, 0)).toBe(false);
  });

  it('groups how a journey ended', () => {
    expect(outcomeOf({ stopReason: 'left_checkout_shipping' })).toBe('left_checkout');
    expect(outcomeOf({ stopReason: 'added_then_removed' })).toBe('left_in_bag');
    expect(outcomeOf({ stopReason: 'browsed_left' })).toBe('browsed_no_product');
    expect(outcomeOf({ stopReason: null, furthestStage: 'viewed' })).toBe('viewed_not_added');
    expect(outcomeOf({ stopReason: 'bounced', orders: 1 })).toBe('bought');
  });
});

describe('table sorting', () => {
  const rows = [
    { n: 3, s: 'b', e: null as string | null },
    { n: 10, s: 'a', e: 'x' },
    { n: 1, s: 'C', e: 'y' },
  ];

  it('numbers numerically, text case-insensitively, empties last both ways', () => {
    expect(sortRows(rows, { key: 'n', dir: 'desc' }, (r, k) => r[k as 'n']).map((r) => r.n)).toEqual([10, 3, 1]);
    expect(sortRows(rows, { key: 's', dir: 'asc' }, (r, k) => r[k as 's']).map((r) => r.s)).toEqual(['a', 'b', 'C']);
    expect(sortRows(rows, { key: 'e', dir: 'asc' }, (r) => r.e).map((r) => r.e)).toEqual(['x', 'y', null]);
    expect(sortRows(rows, { key: 'e', dir: 'desc' }, (r) => r.e).map((r) => r.e)).toEqual(['y', 'x', null]);
    expect(compareValues('Visitor 9', 'Visitor 10')).toBeLessThan(0);
  });

  it('flips on the same column, starts fresh on a new one', () => {
    expect(nextSort({ key: 'n', dir: 'desc' }, 'n')).toEqual({ key: 'n', dir: 'asc' });
    expect(nextSort({ key: 'n', dir: 'asc' }, 's', 'asc')).toEqual({ key: 's', dir: 'asc' });
    expect(ariaSort({ key: 'n', dir: 'desc' }, 'n')).toBe('descending');
    expect(ariaSort({ key: 'n', dir: 'desc' }, 's')).toBeUndefined();
  });
});

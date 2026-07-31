import {
  seriesColor,
  seriesColorOrOther,
  rampColor,
  niceTicks,
  formatEgpMinor,
  formatCompact,
} from '@/components/dashboard/charts/chart-utils';

/**
 * These pin the two rules the lane-4 brief calls out explicitly: the
 * categorical slot order never wraps (a wrapped 9th series would be
 * indistinguishable from the 1st and silently misrepresent the data), and
 * the ordinal ramp never grows past its validated 5 steps.
 */
describe('seriesColor', () => {
  it('returns the fixed --mr-chart-N slots in order', () => {
    expect(seriesColor(0)).toBe('var(--mr-chart-1)');
    expect(seriesColor(1)).toBe('var(--mr-chart-2)');
    expect(seriesColor(7)).toBe('var(--mr-chart-8)');
  });

  it('throws past index 7 instead of wrapping back to slot 1', () => {
    expect(() => seriesColor(8)).toThrow(RangeError);
    expect(() => seriesColor(20)).toThrow(RangeError);
  });

  it('throws for negative or non-integer indices', () => {
    expect(() => seriesColor(-1)).toThrow(RangeError);
    expect(() => seriesColor(1.5)).toThrow(RangeError);
  });

  it('never returns the same colour for two different in-range indices', () => {
    const colors = new Set(Array.from({ length: 8 }, (_, i) => seriesColor(i)));
    expect(colors.size).toBe(8);
  });
});

describe('seriesColorOrOther', () => {
  it('matches seriesColor within range', () => {
    expect(seriesColorOrOther(3)).toBe(seriesColor(3));
  });

  it('folds to a neutral "Other" colour past index 7 rather than cycling', () => {
    const other = seriesColorOrOther(8);
    expect(other).toBe('var(--mr-fg-4)');
    expect(other).not.toBe(seriesColor(0));
  });
});

describe('rampColor', () => {
  it('indexes the 5-step ordinal ramp', () => {
    expect(rampColor(0)).toBe('var(--mr-chart-ramp-1)');
    expect(rampColor(4)).toBe('var(--mr-chart-ramp-5)');
  });

  it('clamps rather than inventing a 6th step', () => {
    expect(rampColor(5)).toBe('var(--mr-chart-ramp-5)');
    expect(rampColor(99)).toBe('var(--mr-chart-ramp-5)');
    expect(rampColor(-3)).toBe('var(--mr-chart-ramp-1)');
  });
});

describe('niceTicks', () => {
  it('handles an all-zero domain without dividing by a zero span', () => {
    const ticks = niceTicks(0, 0);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.every(Number.isFinite)).toBe(true);
    expect(ticks).toContain(0);
  });

  it('handles a single non-zero point by padding a domain around it', () => {
    const ticks = niceTicks(42, 42);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.every(Number.isFinite)).toBe(true);
  });

  it('handles an entirely negative domain', () => {
    const ticks = niceTicks(-50, -10);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.every(Number.isFinite)).toBe(true);
    expect(Math.max(...ticks)).toBeLessThanOrEqual(0);
  });

  it('handles a huge domain with human-friendly steps', () => {
    const ticks = niceTicks(0, 15_000_000, 5);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.every(Number.isFinite)).toBe(true);
    expect(Math.max(...ticks)).toBeGreaterThan(0);
  });

  it('falls back to a single tick for non-finite input rather than crashing', () => {
    expect(niceTicks(NaN, 10)).toEqual([0]);
  });
});

describe('formatEgpMinor', () => {
  it('formats whole cents as a fixed 2-decimal EGP figure', () => {
    expect(formatEgpMinor(123456)).toBe('EGP 1,234.56');
  });

  it('formats zero minor units', () => {
    expect(formatEgpMinor(0)).toBe('EGP 0.00');
  });

  it('rounds fractional minor units to 2 decimal places', () => {
    // 12.34999 EGP rounds up to 12.35 at 2 decimal places.
    expect(formatEgpMinor(1234.999)).toBe('EGP 12.35');
    // 12.344 EGP rounds down to 12.34.
    expect(formatEgpMinor(1234.4)).toBe('EGP 12.34');
  });

  it('falls back rather than crashing on non-finite input', () => {
    expect(formatEgpMinor(NaN)).toBe('EGP 0.00');
  });
});

describe('formatCompact', () => {
  it('leaves small numbers untouched', () => {
    expect(formatCompact(42)).toBe('42');
  });

  it('compacts thousands and millions', () => {
    expect(formatCompact(4_200)).toBe('4.2K');
    expect(formatCompact(4_200_000)).toBe('4.2M');
  });

  it('falls back rather than crashing on non-finite input', () => {
    expect(formatCompact(NaN)).toBe('0');
  });
});

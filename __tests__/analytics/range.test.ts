import { describe, expect, it } from '@jest/globals';
import {
  addDays,
  buildAnalyticsQuery,
  daySpan,
  matchPreset,
  presetRange,
  readRange,
  shopToday,
  withScope,
  writeRange,
} from '@/lib/analytics/range';

// 23:30 UTC on 21 Sep is already 02:30 on 22 Sep in Cairo.
const LATE = Date.parse('2026-09-21T23:30:00.000Z');
const NOON = Date.parse('2026-09-21T10:00:00.000Z');

describe('the shop’s own day', () => {
  it('is Cairo’s calendar day, not UTC’s', () => {
    expect(shopToday(LATE)).toBe('2026-09-22');
    expect(shopToday(NOON)).toBe('2026-09-21');
  });

  it('adds days across months and counts inclusive spans', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-09-21', -29)).toBe('2026-08-23');
    expect(daySpan('2026-08-23', '2026-09-21')).toBe(30);
  });
});

describe('presets', () => {
  it('last 30 days is 23 Aug – 21 Sep on 21 Sep', () => {
    expect(presetRange('30d', NOON)).toEqual({ from: '2026-08-23', to: '2026-09-21' });
    expect(presetRange('7d', NOON)).toEqual({ from: '2026-09-15', to: '2026-09-21' });
    expect(presetRange('today', LATE)).toEqual({ from: '2026-09-22', to: '2026-09-22' });
    expect(presetRange('month', NOON)).toEqual({ from: '2026-09-01', to: '2026-09-21' });
  });

  it('recognises a preset range, and nothing else', () => {
    expect(matchPreset({ from: '2026-09-15', to: '2026-09-21' }, NOON)).toBe('7d');
    expect(matchPreset({ from: '2026-09-02', to: '2026-09-21' }, NOON)).toBeNull();
  });
});

describe('the range in the URL', () => {
  it('defaults to the last 30 Cairo days, real traffic', () => {
    expect(readRange(new URLSearchParams(''), NOON)).toEqual({ from: '2026-08-23', to: '2026-09-21', compare: false, traffic: 'real' });
  });

  it('reads a valid range and rejects a backwards or malformed one', () => {
    expect(readRange(new URLSearchParams('from=2026-09-01&to=2026-09-10&traffic=all&compare=true'), NOON)).toEqual({
      from: '2026-09-01',
      to: '2026-09-10',
      compare: true,
      traffic: 'all',
    });
    expect(readRange(new URLSearchParams('from=2026-09-10&to=2026-09-01'), NOON).from).toBe('2026-08-23');
    expect(readRange(new URLSearchParams('from=yesterday&to=today'), NOON).to).toBe('2026-09-21');
  });

  it('writes it back, keeping other params and leaving defaults out', () => {
    const p = writeRange(new URLSearchParams('section=flow&compare=true'), { from: '2026-09-01', to: '2026-09-10', compare: false, traffic: 'real' });
    expect(p.toString()).toBe('section=flow&from=2026-09-01&to=2026-09-10');
  });
});

describe('one query builder for every endpoint', () => {
  it('maps compare to "previous" and traffic=all to includeBots', () => {
    expect(buildAnalyticsQuery({ from: 'a', to: 'b', compare: true, traffic: 'all' })).toBe('from=a&to=b&compare=previous&includeBots=true');
    expect(buildAnalyticsQuery({ from: 'a', to: 'b' })).toBe('from=a&to=b');
  });

  it('skips empty extras', () => {
    expect(buildAnalyticsQuery({ from: 'a', to: 'b' }, { sortBy: 'views', cursor: null, q: '', limit: undefined })).toBe('from=a&to=b&sortBy=views');
  });
});

describe('links keep the scope', () => {
  it('from URL params or a range', () => {
    expect(withScope('/analytics/pages', new URLSearchParams('from=2026-09-01&to=2026-09-10&traffic=all&x=1'))).toBe(
      '/analytics/pages?from=2026-09-01&to=2026-09-10&traffic=all',
    );
    expect(withScope('/analytics?section=people', { from: 'a', to: 'b', compare: false, traffic: 'real' })).toBe('/analytics?section=people&from=a&to=b');
    expect(withScope('/x', null)).toBe('/x');
  });
});

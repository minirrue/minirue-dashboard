import { describe, expect, it } from '@jest/globals';
import {
  cairoDateTime,
  cairoStamp,
  cairoTime,
  dayLabel,
  deviceLabel,
  durationLabel,
  egp,
  egpExact,
  egpNumber,
  egpShort,
  fmtInt,
  fmtPct,
  pctOf,
  plural,
  rangeLabel,
} from '@/lib/analytics/format';

/** dashboard#128: one set of formatters for every Analytics number, amount and time. */
describe('numbers', () => {
  it('uses thousands separators and treats null as 0', () => {
    expect(fmtInt(1380)).toBe('1,380');
    expect(fmtInt(null)).toBe('0');
    expect(fmtInt(12.6)).toBe('13');
  });

  it('shares to one decimal, dropping .0, and "—" when there is nothing to divide by', () => {
    expect(fmtPct(111, 195)).toBe('56.9%');
    expect(fmtPct(1, 2)).toBe('50%');
    expect(fmtPct(0, 0)).toBe('—');
    expect(pctOf(1087, 1380)).toBe(78.8);
    expect(pctOf(3, 0)).toBe(0);
  });

  it('pluralises regular nouns with the count', () => {
    expect(plural(1, 'landing')).toBe('1 landing');
    expect(plural(1200, 'job')).toBe('1,200 jobs');
    expect(plural(2, 'person', 'people')).toBe('2 people');
  });
});

describe('money (piastres in, EGP out)', () => {
  it('whole pounds by default', () => {
    expect(egp(113900)).toBe('EGP 1,139');
    expect(egp(null)).toBe('EGP 0');
    expect(egpNumber(227800)).toBe(2278);
  });

  it('exact and short forms', () => {
    expect(egpExact(113950)).toBe('EGP 1,139.50');
    expect(egpShort(113900)).toBe('EGP 1.1K');
    expect(egpShort(250000000)).toBe('EGP 2.5M');
    expect(egpShort(1250)).toBe('EGP 12.50');
  });
});

describe('time is 12-hour Cairo time, whatever the browser', () => {
  // 18:08 UTC on 18 Sep 2026 is 9:08 PM in Cairo (UTC+3, summer time).
  const t = '2026-09-18T18:08:00.000Z';

  it('formats the time and the stamp', () => {
    expect(cairoTime(t)).toBe('9:08 PM');
    expect(cairoDateTime(t)).toBe('18 Sep, 9:08 PM');
    expect(cairoStamp(t)).toBe('18 Sep 2026, 9:08 PM');
  });

  it('reads calendar days without a time-zone shift', () => {
    expect(dayLabel('2026-08-23')).toBe('23 Aug');
    expect(dayLabel('2026-08-23', true)).toBe('23 Aug 2026');
    expect(rangeLabel('2026-08-23', '2026-09-21')).toBe('23 Aug – 21 Sep 2026');
    expect(rangeLabel('2025-12-20', '2026-01-10')).toBe('20 Dec 2025 – 10 Jan 2026');
    expect(rangeLabel('2026-09-21', '2026-09-21')).toBe('21 Sep 2026');
  });

  it('spells durations the way the journey reads them', () => {
    expect(durationLabel(6)).toBe('6 s');
    expect(durationLabel(100)).toBe('1 min 40 s');
    expect(durationLabel(240)).toBe('4 min');
    expect(durationLabel(7500)).toBe('2 h 5 min');
  });
});

describe('devices', () => {
  it('capitalises, and never prints "unknown"', () => {
    expect(deviceLabel('mobile')).toBe('Mobile');
    expect(deviceLabel('unknown')).toBe('Device unknown');
    expect(deviceLabel(null)).toBe('Device unknown');
  });
});

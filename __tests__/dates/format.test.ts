import { describe, expect, it } from '@jest/globals';
import { formatDateTime, formatTime } from '@/lib/dates/format';

describe('12-hour Cairo time everywhere', () => {
  it('formats in Cairo, 12-hour', () => {
    // 16:40 UTC = 19:40 Cairo (UTC+3, summer time).
    expect(formatTime('2026-09-19T16:40:00Z')).toBe('7:40 PM');
    expect(formatDateTime('2026-09-19T16:40:00Z')).toBe('19 Sep, 7:40 PM');
    expect(formatDateTime('2026-09-19T16:40:00Z', { year: true })).toBe('19 Sep 2026, 7:40 PM');
  });
  it('crosses midnight by Cairo, not UTC', () => {
    expect(formatDateTime('2026-09-19T22:30:00Z')).toBe('20 Sep, 1:30 AM');
  });
  it('never throws on junk', () => {
    expect(formatDateTime('nope')).toBe('—');
  });
});

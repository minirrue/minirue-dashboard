import { endOfShopDayIso, shopDateInput } from '@/lib/dates/end-of-shop-day';

/**
 * A discount's end date means the END of that day in Cairo (frontend#83).
 *
 * `new Date("2026-09-20")` is midnight UTC — the small hours of the 20th in
 * Cairo — so an offer "ending on the 20th" lost the whole 20th, and one ending
 * today was already expired.
 */
describe('endOfShopDayIso', () => {
  it('ends at 23:59:59.999 Cairo summer time (UTC+3), i.e. 20:59:59.999 UTC', () => {
    // Egypt observes DST from late April to late October.
    expect(endOfShopDayIso('2026-09-20')).toBe('2026-09-20T20:59:59.999Z');
  });

  it('ends at 23:59:59.999 Cairo winter time (UTC+2), i.e. 21:59:59.999 UTC', () => {
    expect(endOfShopDayIso('2026-12-20')).toBe('2026-12-20T21:59:59.999Z');
  });

  it('is later than the naive UTC-midnight parse by most of a day', () => {
    const fixed = new Date(endOfShopDayIso('2026-09-20') as string).getTime();
    const naive = new Date('2026-09-20').getTime();
    expect(fixed - naive).toBeGreaterThan(20 * 3600 * 1000);
  });

  it('returns null for anything that is not a date input value', () => {
    expect(endOfShopDayIso('')).toBeNull();
    expect(endOfShopDayIso('20/09/2026')).toBeNull();
  });

  it('round-trips to the same calendar day for the date input', () => {
    expect(shopDateInput(endOfShopDayIso('2026-09-20'))).toBe('2026-09-20');
    expect(shopDateInput(endOfShopDayIso('2026-12-31'))).toBe('2026-12-31');
    expect(shopDateInput(null)).toBe('');
  });
});

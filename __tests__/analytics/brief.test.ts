import { describe, expect, it } from '@jest/globals';
import { channelName, composeBrief } from '@/lib/analytics/brief';
import { toCsv } from '@/lib/analytics/export';

const ch = (key: string, visitors: number, orders: number, revenueMinor = orders * 116900, addToCarts = 0) => ({
  key,
  visitors,
  addToCarts,
  beginCheckouts: 0,
  orders,
  revenueMinor,
});

describe('composeBrief (dashboard#115)', () => {
  it('leads with the channel that drove the most orders, and names where traffic and buying disagree', () => {
    const lines = composeBrief({
      visitors: 704,
      orders: 17,
      revenueMinor: 1987300,
      channels: [ch('PAID', 312, 9, 1052100), ch('DIRECT', 190, 4), ch('SOCIAL', 150, 1), ch('ORGANIC', 52, 3)],
    });
    expect(lines[0]).toBe('Paid ads drove 9 of 17 orders (EGP 10,521, 52.9% of sales).');
    expect(lines[1]).toBe('Paid ads brought the most visitors, but Organic search converted best (5.8% vs 2.9%).');
  });

  it('says plainly when there are visitors but no orders yet', () => {
    const [line] = composeBrief({ visitors: 40, orders: 0, revenueMinor: 0, channels: [ch('PAID', 40, 0, 0, 3)] });
    expect(line).toBe('40 real visitors and no orders yet — 3 adds to cart so far.');
  });

  it('mentions open carts when nothing else needs saying', () => {
    const lines = composeBrief({
      visitors: 10,
      orders: 1,
      revenueMinor: 116900,
      channels: [ch('DIRECT', 10, 1)],
      openCarts: { count: 2, valueMinor: 346800 },
    });
    expect(lines[1]).toBe('2 carts are still open, worth EGP 3,468.');
  });

  it('names any new source by itself instead of dropping it', () => {
    expect(channelName('SNAPCHAT_ADS')).toBe('Snapchat ads');
    expect(channelName('PAID')).toBe('Paid ads');
  });
});

describe('toCsv', () => {
  it('quotes, neutralises spreadsheet formulas, and keeps UTF-8 for Excel', () => {
    const csv = toCsv([{ campaign: '=HYPERLINK("x")', note: 'a,b', revenue: 10 }]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"a,b"');
  });
});

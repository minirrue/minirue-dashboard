import { describe, expect, it } from '@jest/globals';
import {
  activeFilterCount,
  countedVisitors,
  emptyFilters,
  filterContext,
  filterOptions,
  matchesFilters,
  peopleInView,
  readFilters,
  visitorLabel,
  writeFilters,
} from '@/lib/analytics/visitors';
import { instagram, person, tiktokNamed } from './people-fixture';

/** dashboard#128 acceptance: ONE canonical unique-visitor definition. */
describe('countedVisitors: the canonical unique visitor', () => {
  const a = person();
  const rows = [
    a,
    { ...a }, // the same visitor twice (a paging overlap) counts once
    person({ trafficClass: 'OWNER' }),
    person({ trafficClass: 'BOT' }),
    person({ visitorNumber: null }), // not yet a qualified human
    person({ visitorNumber: null, trafficClass: 'TRUSTED' }), // vouched for by an admin
  ];

  it('real scope: one row per visitor id, numbered, unflagged (TRUSTED always counts)', () => {
    const out = countedVisitors(rows, 'real');
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(a);
    expect(out[1].trafficClass).toBe('TRUSTED');
  });

  it('all scope: everyone, still once each', () => {
    expect(countedVisitors(rows, 'all')).toHaveLength(5);
  });
});

describe('visitorLabel: one name everywhere', () => {
  it('customer name, then Visitor #N without a thousands separator, never a raw id', () => {
    expect(visitorLabel({ visitorNumber: 1187, customer: { id: 'c', name: 'Mariam' } })).toBe('Mariam');
    expect(visitorLabel({ visitorNumber: 1187 })).toBe('Visitor #1187');
    expect(visitorLabel({ visitorId: 'abcd1234' })).toBe('Visitor ·ABCD');
    expect(visitorLabel({ customer: { id: 'c', name: null } })).toBe('Customer');
  });
});

describe('the global filters', () => {
  const people = [tiktokNamed({ city: 'Giza' }), tiktokNamed(), instagram({ device: 'desktop' }), person()];

  it('match by channel, campaign, device and place', () => {
    const f = { ...emptyFilters(), source: ['paid'] };
    expect(people.filter((p) => matchesFilters(p, f))).toHaveLength(2);
    expect(peopleInView(people, 'real', { ...emptyFilters(), location: ['Giza · Egypt'] })).toHaveLength(1);
    expect(peopleInView(people, 'real', { ...emptyFilters(), device: ['desktop'], source: ['social'] })).toHaveLength(1);
    expect(peopleInView(people, 'real', { ...emptyFilters(), campaign: ['TikTok · Minirueshop'] })).toHaveLength(2);
  });

  it('offers every value with its count; Source always lists the four channels in order', () => {
    const o = filterOptions(people);
    expect(o.source.map((x) => [x.label, x.count])).toEqual([
      ['Paid ads', 2],
      ['Social', 1],
      ['Direct', 1],
      ['Referral / other', 0],
    ]);
    expect(o.campaign[0]).toEqual({ value: 'TikTok · Minirueshop', label: 'TikTok · Minirueshop', count: 2 });
    expect(o.device.map((x) => x.value)).toEqual(['mobile', 'desktop']);
  });

  it('round-trips through the URL and prints its context', () => {
    const f = { ...emptyFilters(), source: ['paid', 'social'], device: ['mobile'] };
    const p = writeFilters(new URLSearchParams('section=flow'), f);
    expect(p.toString()).toBe('section=flow&source=paid&source=social&device=mobile');
    expect(readFilters(p)).toEqual(f);
    expect(activeFilterCount(f)).toBe(3);
    expect(filterContext(f)).toBe('Source: Paid ads · Source: Social · Device: Mobile');
    expect(filterContext(emptyFilters())).toBe('None');
  });
});

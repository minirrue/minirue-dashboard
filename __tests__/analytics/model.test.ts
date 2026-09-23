import { describe, expect, it } from '@jest/globals';
import { buildModel, type ModelInputs } from '@/lib/analytics/model';
import { emptyFilters } from '@/lib/analytics/visitors';
import { sectionExport } from '@/lib/analytics/export-sections';
import { DEFAULT_VIEW } from '@/lib/analytics/view-state';
import { buildCsvDocument, buildJsonDocument, exportFileName, toCsv } from '@/lib/analytics/export';
import type { AbandonedRow, QualityReport, ReconcileReport } from '@/lib/api/analytics-insights';
import { instagram, metaIdOnly, person, tiktokMacro, tiktokNamed } from './people-fixture';

const bag = tiktokNamed({ visitorNumber: 1187, furthestStage: 'bag', stopReason: 'left_in_bag', cartValueMinor: 113900, productsViewed: ['Arencia Retinal Booster Shot'] });
const checkout = person({ visitorNumber: 1203, furthestStage: 'checkout_step', stopReason: 'left_checkout_shipping', cartValueMinor: 113900, productsViewed: ['Arencia Vitamin C Booster Shot'], landingPath: '/shop/skincare/arencia-vitamin-c-booster-shot' });
const people = [
  bag,
  checkout,
  ...Array.from({ length: 12 }, (_, i) => tiktokNamed({ furthestStage: i % 3 ? 'viewed' : null, stopReason: i % 3 ? 'viewed_not_added' : 'bounced', productsViewed: i % 3 ? ['Arencia Retinal Booster Shot'] : [] })),
  ...Array.from({ length: 4 }, () => tiktokMacro()),
  ...Array.from({ length: 3 }, () => metaIdOnly()),
  ...Array.from({ length: 5 }, () => instagram({ furthestStage: 'viewed', stopReason: 'viewed_not_added', productsViewed: ['Arencia Vitamin C Booster Shot'] })),
  person({ landingPath: '/shop/skincaree' }),
  person({ trafficClass: 'OWNER' }), // "This is us": never counted
];

const carts: AbandonedRow[] = [
  { visitorNumber: 1187, customer: null, cartId: 'c1', visitorId: bag.visitorId, userId: null, itemCount: 1, valueMinor: 113900, stage: 'CART_ACTIVE', lastSeenAt: '2026-09-18T18:08:00.000Z', channel: 'PAID', campaign: 'Minirueshop', contactable: false, detectors: ['cart'] },
  { visitorNumber: 1203, customer: null, cartId: 'c2', visitorId: checkout.visitorId, userId: null, itemCount: 1, valueMinor: 113900, stage: 'BEGIN_CHECKOUT', lastSeenAt: '2026-09-20T11:32:00.000Z', channel: 'DIRECT', campaign: null, contactable: false, detectors: ['behavioural'] },
  { visitorNumber: null, customer: null, cartId: 'c3', visitorId: null, userId: null, itemCount: 2, valueMinor: 50000, stage: 'CART_ACTIVE', lastSeenAt: '2026-09-19T11:32:00.000Z', channel: null, campaign: null, contactable: true, detectors: ['cart'] },
];

const quality: QualityReport = {
  botShareByReason: [
    { reason: 'UA_PATTERN', count: 1087, shareOfTotal: 0.788 },
    { reason: 'INTERNAL', count: 64, shareOfTotal: 0.046 },
  ],
  totalEvents: 1380,
  botEvents: 1151,
  visitorSourceSplit: [],
  ingestRejects: [],
  bufferDrops: null,
  rollupJobs: [{ job: 'daily', watermarkAt: null, timezone: 'Africa/Cairo', lastRunAt: null, lastOkAt: null, lastDurationMs: null, lastRowsWritten: null, lastError: null, consecutiveFailures: 0 }],
  volumeByEventName: [],
};
const recon: ReconcileReport = {
  orders: { count: 0, revenueMinor: 0 },
  purchaseEvents: { count: 0, revenueMinor: 0 },
  attribution: { count: 0, revenueMinor: 0 },
  healthy: true,
  mismatches: { ordersMissingAttribution: [], attributionMissingOrder: [], purchaseEventsMissingOrder: [], ordersMissingPurchaseEvent: [] },
};

const input = (o: Partial<ModelInputs> = {}): ModelInputs => ({
  range: { from: '2026-08-23', to: '2026-09-21', compare: false, traffic: 'real' },
  filters: emptyFilters(),
  people,
  carts,
  quality,
  recon,
  summary: null,
  routes: { categories: new Set(['skincare']), products: new Set(['arencia-vitamin-c-booster-shot', 'arencia-retinal-booster-shot']) },
  ...o,
});

describe('one visitor count, every section (dashboard#128 acceptance)', () => {
  const m = buildModel(input());
  const n = people.length - 1; // the OWNER row never counts

  it('Overview, People, Journeys, Sources and Flow all count the same people', () => {
    expect(m.counts.visited).toBe(n);
    expect(m.people).toHaveLength(n);
    expect(m.outcomes.reduce((s, o) => s + o.n, 0)).toBe(n);
    expect(m.channels.reduce((s, c) => s + c.visited, 0)).toBe(n);
    expect(m.sources.reduce((s, c) => s + c.visited, 0)).toBe(n);
    expect(m.paths.reduce((s, p) => s + p.visited, 0)).toBe(n);
    expect(m.landings.reduce((s, l) => s + l.visited, 0)).toBe(n);
  });

  it('the funnel and its biggest drop', () => {
    expect(m.counts).toEqual({ visited: n, product: 15, bag: 2, checkout: 1, purchased: 0 });
    expect(m.steps[m.leak].key).toBe('bag');
    expect(m.answers.overview.strong).toBe('The biggest drop is between viewed a product and added to bag: 13 people lost.');
  });

  it('uncredited paid visitors, by cause', () => {
    expect(m.uncredited).toEqual({ total: 7, macro: 4, idOnly: 3, missing: 0, paid: 20 });
    expect(m.sources.find((s) => s.label === 'TikTok · campaign name missing')?.flag).toBe('Untagged');
    expect(m.sources.find((s) => s.label === 'Facebook · unnamed campaign')?.flag).toBe('ID only');
    expect(m.answers.sources.strong).toContain('7 paid visitors can’t be credited');
  });

  it('open carts: only counted people, plus an unlinked cart when nothing is filtered', () => {
    expect(m.carts.map((c) => c.label)).toEqual(['Visitor #1203', 'Unlinked cart', 'Visitor #1187']);
    expect(m.cartsValueMinor).toBe(277800);
    expect(m.answers.people.text).toBe(`2 of the ${n} counted visitors left something in the bag, `);
    expect(m.answers.people.strong).toBe('and none of them left a phone number.');
  });

  it('what to do next, only what the data supports', () => {
    expect(m.todo.map((s) => s.id)).toEqual(['spend', 'leak', 'names', 'capi', 'carts', 'diag']);
    expect(m.todo.find((s) => s.id === 'spend')?.filters).toEqual({ source: ['paid'] });
    expect(m.todo.find((s) => s.id === 'leak')?.detail).toContain('Start with Arencia Retinal Booster Shot');
  });

  it('ads checks read the campaigns and links from the data', () => {
    const names = m.ads.find((a) => a.id === 'names')!;
    expect(names.tiktok).toMatchObject({ status: 'warn', label: '1 of 2' });
    expect(names.meta).toMatchObject({ status: 'bad', label: '0 of 1' });
    expect(m.ads.find((a) => a.id === 'pixel')!.meta.note).toBe('Pixel 2165922481025159');
    expect(m.ads.find((a) => a.id === 'account')!.tiktok.label).toBe('Needs access');
    expect(m.scores.meta.verdict).toBe('not-ready');
  });

  it('exclusions and QA are real numbers or say "Not measured yet"', () => {
    expect(m.exclusions.map((e) => [e.label, e.events])).toEqual([
      ['Known bots and crawlers', 1087],
      ['You and staff', 64],
      ['Counted', 229],
    ]);
    const tags = Object.fromEntries(m.qa.map((q) => [q.id, q.tag]));
    expect(tags).toMatchObject({ rejects: 'Pass', rollups: 'Pass', totals: 'Pass', names: 'Fix in ads', paths: 'Kept', dupes: 'Not measured yet', sequence: 'Not measured yet' });
  });
});

describe('filters narrow every section together', () => {
  it('Source = Paid ads', () => {
    const m = buildModel(input({ filters: { ...emptyFilters(), source: ['paid'] } }));
    expect(m.counts.visited).toBe(20);
    expect(m.channels.map((c) => c.channel)).toEqual(['paid']);
    // Carts outside the filter, and the unlinked one, drop out.
    expect(m.carts.map((c) => c.label)).toEqual(['Visitor #1187']);
  });

  it('Everyone scope counts the owner too', () => {
    expect(buildModel(input({ range: { from: 'a', to: 'b', compare: false, traffic: 'all' } })).counts.visited).toBe(people.length);
  });
});

describe('the export is the screen', () => {
  const m = buildModel(input());

  it('each section exports its answer and every row it shows', () => {
    const ov = sectionExport('overview', m, DEFAULT_VIEW);
    expect(ov.answer).toBe(`${m.answers.overview.text}${m.answers.overview.strong}`.replace(/\s+/g, ' ').trim());
    const funnel = ov.tables.find((t) => t.title === 'Funnel')!;
    expect(funnel.rows.map((r) => r.people)).toEqual(m.steps.map((s) => s.n));
    const ppl = sectionExport('people', m, DEFAULT_VIEW).tables[0];
    expect(ppl.rows).toHaveLength(m.people.length);
    expect(ppl.rows[0].visitor).toBe(m.people.slice().sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))[0].label);
  });

  it('a search on screen is a search in the file', () => {
    const t = sectionExport('people', m, { ...DEFAULT_VIEW, peopleQuery: '1187' }).tables[0];
    expect(t.title).toBe('People matching “1187”');
    expect(t.rows.map((r) => r.visitor)).toEqual(['Visitor #1187']);
  });

  it('raw values appear only when they are on screen', () => {
    const hidden = sectionExport('sources', m, DEFAULT_VIEW).tables[0].columns.map((c) => c.key);
    const shown = sectionExport('sources', m, { ...DEFAULT_VIEW, sourcesRaw: true }).tables[0].columns.map((c) => c.key);
    expect(hidden).not.toContain('raw');
    expect(shown).toContain('raw');
  });

  it('the CSV keeps the structure and the context; JSON carries the same', () => {
    const ctx = { from: '2026-08-23', to: '2026-09-21', rangeLabel: '23 Aug – 21 Sep 2026', filters: 'None', whoCounts: 'Excluding you, staff & bots', generatedAt: '22 Sep 2026, 1:45 PM' };
    const sections = [sectionExport('overview', m, DEFAULT_VIEW), sectionExport('quality', m, DEFAULT_VIEW, { recon })];
    const csv = buildCsvDocument(ctx, sections);
    expect(csv.startsWith('﻿MiniRue analytics export')).toBe(true);
    expect(csv).toContain('Date range,23 Aug – 21 Sep 2026,2026-08-23 to 2026-09-21');
    expect(csv).toContain('Generated,22 Sep 2026 (Cairo time)'.replace('22 Sep 2026', '"22 Sep 2026, 1:45 PM'));
    expect(csv).toContain('Section: Overview');
    expect(csv).toContain('Section: Data quality');
    expect(csv).toContain('Stage,People,Of previous step,Lost,Biggest drop');
    const json = JSON.parse(buildJsonDocument(ctx, sections));
    expect(json.sections).toEqual(['Overview', 'Data quality']);
    expect(json.data[0].tables[0].rows[0]).toEqual({ Stage: 'Visited', People: m.counts.visited, 'Of previous step': '', Lost: '', 'Biggest drop': '' });
  });

  it('neutralises spreadsheet formulas and names the file', () => {
    expect(toCsv([{ a: '=HYPERLINK("x")', b: 'plain' }])).toBe('﻿a,b\r\n"\'=HYPERLINK(""x"")",plain');
    expect(exportFileName('overview', 'csv', { from: '2026-08-23', to: '2026-09-21' })).toBe('minirue-analytics_overview_2026-08-23_2026-09-21.csv');
  });
});

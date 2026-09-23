import type { AudienceSummary, ReconcileReport } from '@/lib/api/analytics-insights';
import type { ExportSection, ExportTable } from './export';
import { fmtPct, egpNumber, cairoStamp } from './format';
import { FUNNEL } from './funnel';
import { CHANNELS } from './source';
import { SECTIONS, platformScore, type AnalyticsModel, type SectionId, type CountedRow, type Answer } from './model';
import { visiblePaths, visiblePeople, type ViewState } from './view-state';
import { VISITOR_DEFINITION } from './visitors';

/**
 * Each section as export tables, from the same model and view state the
 * screen renders (dashboard#128: "exported values match the on-screen
 * values for the same state"). Tables carry every row, not a summary.
 */

export interface ExportExtras {
  summary?: AudienceSummary | null;
  recon?: ReconcileReport | null;
  /** The journey open in Journeys, as its steps. */
  journey?: { visitor: string; rows: Record<string, string | number | null>[] } | null;
}

const STAGE_COLS = [
  { key: 'visited', label: 'Visited' },
  { key: 'product', label: 'Viewed a product' },
  { key: 'bag', label: 'Added to bag' },
  { key: 'checkout', label: 'Reached checkout' },
  { key: 'purchased', label: 'Purchased' },
];

function stageRow(r: CountedRow): Record<string, number> {
  return { visited: r.visited, product: r.product, bag: r.bag, checkout: r.checkout, purchased: r.purchased };
}

export function answerText(a: Answer): string {
  return `${a.text}${a.strong ?? ''}`.replace(/\s+/g, ' ').trim();
}

function overview(m: AnalyticsModel): ExportTable[] {
  return [
    {
      title: 'Funnel',
      note: 'Unique people. Biggest drop marked.',
      columns: [
        { key: 'stage', label: 'Stage' },
        { key: 'people', label: 'People' },
        { key: 'of_prev', label: 'Of previous step' },
        { key: 'lost', label: 'Lost' },
        { key: 'biggest_drop', label: 'Biggest drop' },
      ],
      rows: m.steps.map((s, i) => ({
        stage: s.label,
        people: s.n,
        of_prev: s.prev == null ? '' : fmtPct(s.n, s.prev),
        lost: s.prev == null ? '' : s.lost,
        biggest_drop: i === m.leak ? 'yes' : '',
      })),
    },
    {
      title: 'What to do next',
      columns: [
        { key: 'rank', label: 'Rank' },
        { key: 'severity', label: 'Severity' },
        { key: 'step', label: 'Step' },
        { key: 'detail', label: 'Why' },
      ],
      rows: m.todo.map((s, i) => ({ rank: i + 1, severity: s.severity, step: s.title, detail: s.detail })),
    },
    {
      title: 'Where visitors came from',
      note: 'Unique people, by channel and campaign.',
      columns: [{ key: 'source', label: 'Source' }, { key: 'level', label: 'Level' }, ...STAGE_COLS, { key: 'view_to_bag', label: 'View → bag' }],
      rows: m.channels.flatMap((c) => [
        { source: CHANNELS[c.channel].label, level: 'Channel', ...stageRow(c), view_to_bag: fmtPct(c.bag, c.product) },
        ...c.campaigns.map((k) => ({ source: `${k.label}${k.flag ? ` (${k.flag})` : ''}`, level: 'Campaign', ...stageRow(k), view_to_bag: fmtPct(k.bag, k.product) })),
      ]),
    },
    {
      title: 'Where they landed',
      columns: [{ key: 'landing', label: 'Landing page' }, { key: 'visited', label: 'Visitors' }, { key: 'product', label: 'Viewed a product' }, { key: 'bag', label: 'Added to bag' }, { key: 'unknown', label: 'Unknown path' }],
      rows: m.landings.map((l) => ({ landing: l.label, visited: l.visited, product: l.product, bag: l.bag, unknown: l.unknown ? 'yes' : '' })),
    },
    {
      title: 'Visitors per day',
      note: 'Daily count from the rollup: a person who comes back on two days counts on both days. Not narrowed by filters.',
      columns: [{ key: 'day', label: 'Day' }, { key: 'visitors', label: 'Visitors' }],
      rows: m.daily.map((d) => ({ day: d.day, visitors: d.visitors })),
    },
    {
      title: 'Open carts',
      columns: [
        { key: 'visitor', label: 'Visitor' },
        { key: 'value_egp', label: 'Value (EGP)' },
        { key: 'items', label: 'Items' },
        { key: 'stage', label: 'Stage' },
        { key: 'source', label: 'Came from' },
        { key: 'contact', label: 'Can be contacted' },
        { key: 'last_seen', label: 'Last seen (Cairo)' },
      ],
      rows: m.carts.map((c) => ({
        visitor: c.label,
        value_egp: egpNumber(c.valueMinor),
        items: c.items,
        stage: c.stage,
        source: c.source,
        contact: c.contactable ? 'yes' : 'no',
        last_seen: cairoStamp(c.lastSeenAt),
      })),
    },
    {
      title: 'Products people looked at',
      columns: [{ key: 'product', label: 'Product' }, { key: 'viewers', label: 'Viewers (people)' }, { key: 'atc', label: 'Add-to-bag events' }],
      rows: m.products.map((p) => ({ product: p.name, viewers: p.viewers, atc: p.addToCartEvents })),
    },
  ];
}

function people(m: AnalyticsModel, v: ViewState): ExportTable[] {
  const rows = visiblePeople(m.people, v.peopleQuery, v.peopleSort);
  return [
    {
      title: `People${v.peopleQuery ? ` matching “${v.peopleQuery}”` : ''}`,
      note: 'Visits and pages are all-time counts for each visitor.',
      columns: [
        { key: 'visitor', label: 'Visitor' },
        { key: 'visitor_id', label: 'Visitor ID' },
        { key: 'source', label: 'Came from' },
        { key: 'location', label: 'Location' },
        { key: 'device', label: 'Device' },
        { key: 'sessions', label: 'Visits' },
        { key: 'pages', label: 'Pages' },
        { key: 'outcome', label: 'Outcome' },
        { key: 'bag_egp', label: 'Bag (EGP)' },
        { key: 'orders', label: 'Orders' },
        { key: 'revenue_egp', label: 'Revenue (EGP)' },
        { key: 'contact', label: 'Can be contacted' },
        { key: 'landing', label: 'Landed on' },
        { key: 'products', label: 'Looked at' },
        { key: 'first_seen', label: 'First seen (Cairo)' },
        { key: 'last_seen', label: 'Last seen (Cairo)' },
      ],
      rows: rows.map((p) => ({
        visitor: p.label,
        visitor_id: p.id,
        source: p.source,
        location: p.place,
        device: p.device,
        sessions: p.sessions,
        pages: p.pages,
        outcome: p.outcomeLabel,
        bag_egp: p.cartMinor ? egpNumber(p.cartMinor) : null,
        orders: p.orders,
        revenue_egp: egpNumber(p.revenueMinor),
        contact: p.contactable ? 'yes' : 'no',
        landing: p.landingPath,
        products: p.products.join(' | '),
        first_seen: cairoStamp(p.firstSeenAt),
        last_seen: cairoStamp(p.lastSeenAt),
      })),
    },
  ];
}

function journeys(m: AnalyticsModel, x: ExportExtras): ExportTable[] {
  const t: ExportTable[] = [
    {
      title: 'How journeys ended',
      columns: [{ key: 'outcome', label: 'Outcome' }, { key: 'people', label: 'People' }, { key: 'share', label: 'Share' }],
      rows: m.outcomes.map((o) => ({ outcome: o.label, people: o.n, share: fmtPct(o.n, m.view.length) })),
    },
  ];
  if (x.journey) {
    t.push({
      title: `Journey · ${x.journey.visitor}`,
      columns: [
        { key: 'session', label: 'Session' },
        { key: 'at', label: 'Time (Cairo)' },
        { key: 'page', label: 'Page type' },
        { key: 'step', label: 'Step' },
        { key: 'source', label: 'Came from' },
        { key: 'detail', label: 'Detail' },
      ],
      rows: x.journey.rows,
    });
  }
  return t;
}

function sources(m: AnalyticsModel, v: ViewState): ExportTable[] {
  return [
    {
      title: 'Sources and campaigns',
      note: 'Unique people. Each source is followed by its landing pages.',
      columns: [
        { key: 'source', label: 'Source / campaign' },
        { key: 'level', label: 'Level' },
        { key: 'channel', label: 'Channel' },
        { key: 'visited', label: 'Visitors' },
        { key: 'product', label: 'Viewed a product' },
        { key: 'bag', label: 'Added to bag' },
        { key: 'purchased', label: 'Purchased' },
        { key: 'flag', label: 'Flag' },
        // Raw values are exported when they are on screen (the Raw values toggle).
        ...(v.sourcesRaw ? [{ key: 'raw', label: 'Raw values' }] : []),
      ],
      rows: m.sources.flatMap((s) => [
        { source: s.label, level: 'Source', channel: CHANNELS[s.channel].label, visited: s.visited, product: s.product, bag: s.bag, purchased: s.purchased, flag: s.flag ?? '', raw: s.raw },
        ...s.landings.map((l) => ({ source: l.label, level: 'Landing page', channel: '', visited: l.visited, product: l.product, bag: l.bag, purchased: l.purchased, flag: '', raw: l.raw })),
      ]),
    },
    {
      title: 'Can’t be credited',
      columns: [{ key: 'issue', label: 'Issue' }, { key: 'visitors', label: 'Visitors' }],
      rows: [
        { issue: 'Ad sends a placeholder such as __CAMPAIGN_NAME__', visitors: m.uncredited.macro },
        { issue: 'Campaign known only by its ID', visitors: m.uncredited.idOnly },
        { issue: 'Paid visit with no campaign', visitors: m.uncredited.missing },
        ...m.unknownLandings.map((l) => ({ issue: `Landed on an unknown path: ${l.path}`, visitors: l.n })),
      ],
    },
  ];
}

function flow(m: AnalyticsModel, v: ViewState, x: ExportExtras): ExportTable[] {
  if (v.flowMode === 'events') {
    const s = x.summary;
    return [
      {
        title: 'Events by stage',
        note: 'Range totals from the rollup, all counted traffic. Per-path event counts are not measured yet.',
        columns: [{ key: 'stage', label: 'Stage' }, { key: 'events', label: 'Events' }],
        rows: s
          ? [
              { stage: 'Page views', events: s.pageviews },
              { stage: 'Product views', events: s.productViews },
              { stage: 'Add to bag', events: s.addToCarts },
              { stage: 'Checkouts started', events: s.beginCheckouts },
              { stage: 'Purchases', events: s.purchases },
            ]
          : [],
      },
    ];
  }
  const rows = visiblePaths(m.paths, v.flowQuery, v.flowSort);
  return [
    {
      title: `Visitor flow${v.flowQuery ? ` matching “${v.flowQuery}”` : ''}`,
      note: 'Unique people per path: source → landing → product → bag → checkout → purchase.',
      columns: [
        { key: 'source', label: 'Source' },
        { key: 'landing', label: 'Landing' },
        ...FUNNEL.map((f) => ({ key: f.key, label: f.label })),
        { key: 'view_to_bag', label: 'View → bag' },
      ],
      rows: rows.map((r) => ({ source: r.source, landing: r.landing, ...stageRow(r), view_to_bag: fmtPct(r.bag, r.product) })),
    },
  ];
}

function ads(m: AnalyticsModel): ExportTable[] {
  const meta = platformScore(m.ads, 'meta');
  const tiktok = platformScore(m.ads, 'tiktok');
  const verdict = (s: typeof meta) => (s.verdict === 'ready' ? 'Ready' : s.verdict === 'almost' ? 'Almost ready' : 'Not ready');
  return [
    {
      title: 'Verdicts',
      columns: [{ key: 'platform', label: 'Platform' }, { key: 'verdict', label: 'Verdict' }, { key: 'ready', label: 'Checks ready' }, { key: 'partial', label: 'Partial' }, { key: 'missing', label: 'Missing' }, { key: 'access', label: 'Needs access' }],
      rows: [
        { platform: 'Meta', verdict: verdict(meta), ready: `${meta.ok} of ${meta.total}`, partial: meta.warn, missing: meta.bad, access: meta.unk },
        { platform: 'TikTok', verdict: verdict(tiktok), ready: `${tiktok.ok} of ${tiktok.total}`, partial: tiktok.warn, missing: tiktok.bad, access: tiktok.unk },
      ],
    },
    {
      title: 'Checks by platform',
      columns: [
        { key: 'group', label: 'Group' },
        { key: 'check', label: 'Check' },
        { key: 'meta', label: 'Meta' },
        { key: 'meta_note', label: 'Meta note' },
        { key: 'tiktok', label: 'TikTok' },
        { key: 'tiktok_note', label: 'TikTok note' },
        { key: 'from', label: 'Checked from' },
      ],
      rows: m.ads.map((c) => ({
        group: c.group,
        check: c.name,
        meta: c.meta.label ?? c.meta.status,
        meta_note: c.meta.note ?? '',
        tiktok: c.tiktok.label ?? c.tiktok.status,
        tiktok_note: c.tiktok.note ?? '',
        from: c.from === 'code' ? 'Our code' : c.from === 'data' ? 'Our data' : 'Ad platform',
      })),
    },
    {
      title: 'Live ad links',
      note: 'utm_id is not stored by analytics yet.',
      columns: [
        { key: 'platform', label: 'Platform' },
        { key: 'campaign', label: 'Campaign' },
        { key: 'landing', label: 'Landing' },
        { key: 'visitors', label: 'Visitors' },
        { key: 'source', label: 'utm_source' },
        { key: 'medium', label: 'utm_medium' },
        { key: 'utm_campaign', label: 'utm_campaign' },
        { key: 'content', label: 'utm_content' },
        { key: 'term', label: 'utm_term' },
      ],
      rows: m.adLinks.map((l) => ({
        platform: l.platform,
        campaign: l.campaign,
        landing: l.path,
        visitors: l.visitors,
        source: l.utm.source,
        medium: l.utm.medium,
        utm_campaign: l.utm.campaign,
        content: l.utm.content,
        term: l.utm.term,
      })),
    },
  ];
}

function quality(m: AnalyticsModel, x: ExportExtras): ExportTable[] {
  const r = x.recon;
  return [
    {
      title: 'One visitor number, everywhere',
      note: VISITOR_DEFINITION,
      columns: [{ key: 'view', label: 'View' }, { key: 'visitors', label: 'Visitors' }, { key: 'how', label: 'How it counts' }],
      rows: [
        { view: 'Overview', visitors: m.all.length, how: 'Canonical visitors' },
        { view: 'People', visitors: m.all.length, how: 'Canonical visitors' },
        { view: 'Journeys', visitors: m.all.length, how: 'Canonical visitors' },
        { view: 'Daily rollup (reference)', visitors: m.rollupVisitors, how: 'Every non-bot browser, numbered or not' },
      ],
    },
    {
      title: 'Purchases vs real orders',
      columns: [{ key: 'side', label: 'Side' }, { key: 'count', label: 'Count' }, { key: 'egp', label: 'EGP' }],
      rows: r
        ? [
            { side: 'Backend orders', count: r.orders.count, egp: egpNumber(r.orders.revenueMinor) },
            { side: 'Tracked purchases', count: r.purchaseEvents.count, egp: egpNumber(r.purchaseEvents.revenueMinor) },
            { side: 'Ad-attributed', count: r.attribution.count, egp: egpNumber(r.attribution.revenueMinor) },
            { side: r.healthy ? 'Reconciled' : 'Not reconciled', count: null, egp: null },
          ]
        : [],
    },
    {
      title: 'Checks',
      columns: [{ key: 'check', label: 'Check' }, { key: 'status', label: 'Status' }, { key: 'detail', label: 'Detail' }],
      rows: m.qa.map((q) => ({ check: q.title, status: q.tag, detail: q.detail })),
    },
    {
      title: 'What was left out, and why',
      columns: [{ key: 'reason', label: 'Reason' }, { key: 'events', label: 'Events' }, { key: 'share', label: 'Share of raw' }, { key: 'rule', label: 'Rule' }],
      rows: m.exclusions.map((e) => ({ reason: e.label, events: e.events, share: `${e.share}%`, rule: e.rule })),
    },
  ];
}

export function sectionExport(id: SectionId, m: AnalyticsModel, v: ViewState, x: ExportExtras = {}): ExportSection {
  const title = SECTIONS.find((s) => s.id === id)!.label;
  const tables =
    id === 'overview'
      ? overview(m)
      : id === 'people'
        ? people(m, v)
        : id === 'journeys'
          ? journeys(m, x)
          : id === 'sources'
            ? sources(m, v)
            : id === 'flow'
              ? flow(m, v, x)
              : id === 'ads'
                ? ads(m)
                : quality(m, x);
  return { id, title, answer: answerText(m.answers[id]), tables };
}

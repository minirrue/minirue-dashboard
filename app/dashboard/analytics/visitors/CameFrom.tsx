'use client';

import React, { useMemo, useState } from 'react';
import { PLATFORM_NETWORK, type FlowFilter, type FlowFilterKey, type PersonRow } from '@/lib/api/story';
import { downloadRows } from '@/lib/analytics/export';
import type { AnalyticsQueryParams } from '@/lib/api/analytics-insights';

/**
 * Sources & campaigns — Acquisition, rebuilt inside Visitors (dashboard#90
 * "one organized acquisition component"; owner 2026-09-19 "merge it inside
 * visitors … so we can differentiate who came from which source").
 *
 * Counted from the very people listed below, so every number is a set of real
 * visitors: drill Kind → Platform → Campaign → Landing page, group by any
 * dimension, search, sort any column, export — and click to show only them.
 */

type Dim = 'medium' | 'network' | 'platform' | 'campaign' | 'landing' | 'country' | 'device';

const DIM_LABEL: Record<Dim, string> = {
  medium: 'Kind',
  network: 'Network',
  platform: 'Platform',
  campaign: 'Campaign',
  landing: 'Landing page',
  country: 'Country',
  device: 'Device',
};
/** The drill-down chain (#90: Channel → Source → Campaign → Landing URL). */
const CHAIN: Dim[] = ['medium', 'network', 'platform', 'campaign', 'landing'];
/** Where a click narrows the people and the flow. */
const FILTER_OF: Partial<Record<Dim, FlowFilterKey>> = {
  platform: 'platform',
  campaign: 'campaign',
  landing: 'landing',
  country: 'country',
  device: 'device',
};

const MEDIUM_LABEL: Record<string, string> = {
  paid: 'Paid ads',
  social: 'Social',
  organic: 'Search',
  email: 'Email',
  referral: 'Other sites',
  direct: 'Direct',
  other: 'Other',
};

const PLACEHOLDER = /^(__.*__|\{\{.*\}\}|\(none\)|none|null|undefined)$/i;

function keyOf(p: PersonRow, dim: Dim): string {
  switch (dim) {
    case 'medium':
      return (p.medium ?? (p.platform ? 'other' : 'direct')).toLowerCase();
    case 'network':
      // Facebook and Instagram share one Meta pixel: shown apart, totalled here.
      return p.platform ? PLATFORM_NETWORK[p.platform] ?? p.platform : 'Direct';
    case 'platform':
      return p.platform ?? 'Direct';
    case 'campaign':
      return p.campaign && !PLACEHOLDER.test(p.campaign.trim()) ? p.campaign : '';
    case 'landing':
      return p.landingPath ? p.landingPath.split('?')[0] || '/' : '';
    case 'country':
      return p.country ?? '';
    case 'device':
      return p.device ?? '';
  }
}

const CHECKOUT_STAGES = new Set(['checkout', 'checkout_step', 'checkout_contact', 'checkout_address', 'checkout_shipping', 'checkout_payment', 'paid', 'refunded']);
const BAG_STAGES = new Set(['bag', ...CHECKOUT_STAGES]);

interface Row {
  key: string;
  dim: Dim;
  visitors: number;
  newVisitors: number;
  bag: number;
  checkout: number;
  buyers: number;
  revenueMinor: number;
  people: PersonRow[];
}

function group(people: PersonRow[], dim: Dim, rangeFrom: string): Row[] {
  const m = new Map<string, Row>();
  for (const p of people) {
    const k = keyOf(p, dim);
    const r = m.get(k) ?? { key: k, dim, visitors: 0, newVisitors: 0, bag: 0, checkout: 0, buyers: 0, revenueMinor: 0, people: [] };
    r.visitors += 1;
    if (p.firstSeenAt >= rangeFrom) r.newVisitors += 1;
    if (p.furthestStage && BAG_STAGES.has(p.furthestStage)) r.bag += 1;
    if (p.furthestStage && CHECKOUT_STAGES.has(p.furthestStage)) r.checkout += 1;
    if (p.orders > 0) r.buyers += 1;
    r.revenueMinor += p.revenueMinor;
    r.people.push(p);
    m.set(k, r);
  }
  return [...m.values()];
}

type SortKey = 'visitors' | 'newVisitors' | 'bag' | 'checkout' | 'buyers' | 'conv' | 'revenueMinor';
const COLS: { key: SortKey; label: string; title: string }[] = [
  { key: 'visitors', label: 'Visitors', title: 'Real visitors' },
  { key: 'newVisitors', label: 'New', title: 'First seen in this range' },
  { key: 'bag', label: 'Bag', title: 'Added to bag or further' },
  { key: 'checkout', label: 'Checkout', title: 'Started checkout or further' },
  { key: 'buyers', label: 'Bought', title: 'Visitors with an order' },
  { key: 'conv', label: 'Conv.', title: 'Bought ÷ visitors' },
  { key: 'revenueMinor', label: 'Revenue', title: 'Revenue from these visitors' },
];

const n = (v: number) => v.toLocaleString('en-US');
const egp = (minor: number) => `EGP ${Math.round(minor / 100).toLocaleString('en-US')}`;
const conv = (r: Row) => (r.visitors ? r.buyers / r.visitors : 0);
const pct = (x: number) => (x === 0 ? '0%' : x < 0.1 ? `${(x * 100).toFixed(1)}%` : `${Math.round(x * 100)}%`);

export default function CameFrom({
  rows,
  done,
  filter,
  setKey,
  countryName,
  range,
}: {
  rows: PersonRow[];
  done: boolean;
  filter: FlowFilter;
  setKey: (key: FlowFilterKey, value: string) => void;
  countryName: (code: string) => string;
  range: AnalyticsQueryParams;
}) {
  const [dim, setDim] = useState<Dim>('medium');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'visitors', desc: true });
  const [open, setOpen] = useState<Set<string>>(new Set());

  const label = (d: Dim, k: string) => {
    if (d === 'medium') return MEDIUM_LABEL[k] ?? k[0]?.toUpperCase() + k.slice(1);
    if (d === 'landing' && k) return k;
    if (!k) return d === 'campaign' ? 'Untagged — no campaign on the link' : d === 'landing' ? 'Unknown' : 'Unknown';
    if (d === 'country') return countryName(k);
    if (d === 'device') return k[0].toUpperCase() + k.slice(1);
    return k;
  };

  const sorter = (a: Row, b: Row) => {
    const va = sort.key === 'conv' ? conv(a) : a[sort.key];
    const vb = sort.key === 'conv' ? conv(b) : b[sort.key];
    return (sort.desc ? vb - va : va - vb) || b.visitors - a.visitors;
  };

  const top = useMemo(() => group(rows, dim, range.from), [rows, dim, range.from]);
  const needle = q.trim().toLowerCase();
  const visible = top
    .filter((r) => !needle || label(r.dim, r.key).toLowerCase().includes(needle) || r.people.some((p) => CHAIN.some((d) => keyOf(p, d).toLowerCase().includes(needle))))
    .sort(sorter);

  const total = useMemo(() => group(rows, 'medium', range.from).reduce(
    (t, r) => ({ ...t, visitors: t.visitors + r.visitors, newVisitors: t.newVisitors + r.newVisitors, bag: t.bag + r.bag, checkout: t.checkout + r.checkout, buyers: t.buyers + r.buyers, revenueMinor: t.revenueMinor + r.revenueMinor }),
    { key: 'all', dim: 'medium' as Dim, visitors: 0, newVisitors: 0, bag: 0, checkout: 0, buyers: 0, revenueMinor: 0, people: [] as PersonRow[] },
  ), [rows, range.from]);
  const maxVisitors = Math.max(1, ...visible.map((r) => r.visitors));

  const toggleOpen = (path: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const pick = (r: Row) => {
    const f = FILTER_OF[r.dim];
    if (!f || !r.key) return;
    setKey(f, filter[f] === r.key ? '' : r.key);
  };

  const exportRows = (format: 'csv' | 'json') =>
    downloadRows(
      `sources-by-${DIM_LABEL[dim].toLowerCase().replace(/\s+/g, '-')}`,
      visible.map((r) => ({
        [DIM_LABEL[dim]]: label(r.dim, r.key),
        visitors: r.visitors,
        new_visitors: r.newVisitors,
        reached_bag: r.bag,
        reached_checkout: r.checkout,
        bought: r.buyers,
        conversion_pct: Math.round(conv(r) * 1000) / 10,
        revenue_egp: Math.round(r.revenueMinor / 100),
      })),
      format,
      range,
    );

  const renderRow = (r: Row, depth: number, path: string): React.ReactNode => {
    const chainAt = CHAIN.indexOf(r.dim);
    const childDim = chainAt >= 0 && chainAt < CHAIN.length - 1 ? CHAIN[chainAt + 1] : null;
    const isOpen = open.has(path);
    const f = FILTER_OF[r.dim];
    const selected = f ? filter[f] === r.key && !!r.key : false;
    const children = isOpen && childDim ? group(r.people, childDim, range.from).sort(sorter) : [];
    return (
      <React.Fragment key={path}>
        <div className="src-row" role="row" data-depth={depth} data-selected={selected || undefined}>
          <span role="cell" className="src-row__name" style={{ paddingInlineStart: depth * 18 }}>
            {childDim ? (
              <button type="button" className="src-row__twisty" aria-expanded={isOpen} aria-label={`${isOpen ? 'Collapse' : 'Break down'} ${label(r.dim, r.key)} by ${DIM_LABEL[childDim].toLowerCase()}`} onClick={() => toggleOpen(path)}>
                {isOpen ? '▾' : '▸'}
              </button>
            ) : (
              <span className="src-row__twisty" aria-hidden="true" />
            )}
            <span className="src-row__label" data-untagged={!r.key || undefined}>{label(r.dim, r.key)}</span>
            {f && r.key && (
              <button type="button" className="src-row__follow" aria-pressed={selected} onClick={() => pick(r)}>
                {selected ? 'Showing' : 'Show people'}
              </button>
            )}
          </span>
          <span role="cell" className="src-row__bar" aria-hidden="true">
            <span style={{ width: `${(r.visitors / maxVisitors) * 100}%` }} />
          </span>
          <span role="cell" className="src-num src-num--strong">{n(r.visitors)}</span>
          <span role="cell" className="src-num">{n(r.newVisitors)}</span>
          <span role="cell" className="src-num">{n(r.bag)}</span>
          <span role="cell" className="src-num">{n(r.checkout)}</span>
          <span role="cell" className="src-num">{n(r.buyers)}</span>
          <span role="cell" className="src-num">{pct(conv(r))}</span>
          <span role="cell" className="src-num">{r.revenueMinor ? egp(r.revenueMinor) : '—'}</span>
        </div>
        {children.map((c) => renderRow(c, depth + 1, `${path}/${c.dim}:${c.key}`))}
      </React.Fragment>
    );
  };

  if (!rows.length) return null;
  return (
    <section className="src" aria-label="Sources and campaigns">
      <header className="src__head">
        <div>
          <h2 className="cc-block__title">Sources &amp; campaigns</h2>
          <p className="cc-block__sub">
            Who came from where, and who bought — {done ? `all ${n(rows.length)} people` : `${n(rows.length)} people so far`}
            {Object.keys(filter).length ? ' matching your filters' : ''}. Open a row to break it down; &ldquo;Show people&rdquo; narrows everything on this page.
          </p>
        </div>
        <div className="ppl__exports">
          <button type="button" className="flow-pill-btn" onClick={() => exportRows('csv')}>Export CSV</button>
          <button type="button" className="flow-pill-btn" onClick={() => exportRows('json')}>JSON</button>
        </div>
      </header>

      <dl className="src-kpis">
        {[
          ['Visitors', n(total.visitors)],
          ['New', n(total.newVisitors)],
          ['Reached bag', n(total.bag)],
          ['Reached checkout', n(total.checkout)],
          ['Bought', n(total.buyers)],
          ['Conversion', pct(conv(total))],
          ['Revenue', egp(total.revenueMinor)],
        ].map(([k, v]) => (
          <div key={k} className="flow-figure">
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <div className="src__toolbar">
        <div className="src-seg" role="group" aria-label="Group by">
          {(Object.keys(DIM_LABEL) as Dim[]).map((d) => (
            <button key={d} type="button" aria-pressed={dim === d} onClick={() => { setDim(d); setOpen(new Set()); }}>
              {DIM_LABEL[d]}
            </button>
          ))}
        </div>
        <label className="ppl-field src__search" htmlFor="src-q">
          <span className="dash-sr-only">Search sources</span>
          <input id="src-q" className="dash-input dash-input-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search platform, campaign, page…" />
        </label>
      </div>

      <div className="src-table" role="table" aria-label={`Visitors by ${DIM_LABEL[dim].toLowerCase()}`}>
        <div className="src-row src-row--head" role="row">
          <span role="columnheader">{DIM_LABEL[dim]}</span>
          <span role="columnheader" aria-hidden="true" />
          {COLS.map((c) => (
            <span key={c.key} role="columnheader" className="src-num" aria-sort={sort.key === c.key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
              <button type="button" title={`${c.title} — sort`} onClick={() => setSort((s) => ({ key: c.key, desc: s.key === c.key ? !s.desc : true }))}>
                {c.label}
                {sort.key === c.key ? (sort.desc ? ' ↓' : ' ↑') : ''}
              </button>
            </span>
          ))}
        </div>
        {visible.map((r) => renderRow(r, 0, `${r.dim}:${r.key}`))}
        {!visible.length && <p className="flow-note" style={{ padding: 12 }}>Nothing matches &ldquo;{q}&rdquo;.</p>}
      </div>
    </section>
  );
}

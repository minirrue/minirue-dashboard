'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AnalyticsSubnav from '@/components/dashboard/AnalyticsSubnav';
import AnalyticsScopeBar from '@/components/dashboard/analytics/AnalyticsScopeBar';
import { useSearchParams } from 'next/navigation';
import { useAnalyticsRange, useAudienceSummary, useAudienceTimeseries } from '@/lib/hooks/use-analytics';
import { LineChart } from '@/components/dashboard/charts';
import {
  apiGetFlow,
  apiGetAllPeople,
  downloadServerExport,
  PEOPLE_CAP,
  apiGetVisitorStory,
  DIMENSION_LABEL,
  personName,
  STAGE_LABEL,
  STOP_REASON_LABEL,
  type FlowDimension,
  type FlowFilter,
  type FlowFilterKey,
  type FlowResponse,
  type PeopleSort,
  type PersonRow,
  type VisitorStory,
} from '@/lib/api/story';
import type { ApiError } from '@/lib/api/client';
import { downloadRows, type ExportRow } from '@/lib/analytics/export';
import PeopleTable, { type PeopleOptions } from './PeopleTable';
import CameFrom from './CameFrom';
import { formatDateTime } from '@/lib/dates/format';
import './flow.css';

const COLUMNS: FlowDimension[] = ['platform', 'campaign', 'landing', 'product', 'stage'];
/** Everything a link from another screen can pin (`/analytics/visitors?campaign=…`). */
const FILTER_KEYS: FlowFilterKey[] = ['reason', 'country', 'device', ...COLUMNS];

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
const NODE_H = 46;
const NODE_GAP = 8;

const n = (v: number | null | undefined) => (v ?? 0).toLocaleString('en-US');
const egp = (minor: number | null | undefined) => `EGP ${Math.round((minor ?? 0) / 100).toLocaleString('en-US')}`;

function nodeLabel(dim: FlowFilterKey, value: string, label?: string) {
  if (dim === 'stage') return STAGE_LABEL[value] ?? label ?? value;
  if (dim === 'reason') return STOP_REASON_LABEL[value] ?? label ?? value;
  if (dim === 'country') return countryName(value);
  return label ?? value;
}

type Load<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'offline' } | { state: 'error'; message: string };

function isNotYet(e: unknown): boolean {
  const s = (e as ApiError | undefined)?.status;
  return s === 404 || s === 501;
}

function peopleExportRows(rows: PersonRow[]): ExportRow[] {
  return rows.map((p) => ({
    visitor: personName(p),
    visitor_id: p.visitorId,
    customer_id: p.customer?.id ?? null,
    came_from: p.platform,
    medium: p.medium,
    campaign: p.campaign,
    landed_on: p.landingPath,
    looked_at: p.productsViewed.join(' | '),
    got_to: p.furthestStage ? STAGE_LABEL[p.furthestStage] ?? p.furthestStage : null,
    stopped_because: p.stopReason ? STOP_REASON_LABEL[p.stopReason] ?? p.stopReason : null,
    stop_detail: p.stopDetail ?? null,
    bag_egp: p.cartValueMinor != null ? Math.round(p.cartValueMinor / 100) : null,
    orders: p.orders,
    revenue_egp: Math.round(p.revenueMinor / 100),
    contactable: p.contactable,
    country: p.country,
    city: p.city,
    device: p.device,
    first_seen: p.firstSeenAt,
    last_seen: p.lastSeenAt,
  }));
}

/* ── The flow canvas ───────────────────────────────────────────────────── */

function FlowCanvas({
  flow,
  filter,
  onToggle,
}: {
  flow: FlowResponse;
  filter: FlowFilter;
  onToggle: (dim: FlowDimension, value: string) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<{ dim: FlowDimension; value: string } | null>(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const byColumn = useMemo(
    () => COLUMNS.map((dim) => flow.nodes.filter((nd) => nd.dimension === dim).sort((a, b) => b.visitors - a.visitors)),
    [flow.nodes],
  );
  const rows = Math.max(1, ...byColumn.map((c) => c.length));
  const height = rows * (NODE_H + NODE_GAP);
  const colW = width / COLUMNS.length;
  const cardW = Math.max(colW - 28, 60);
  const maxLink = Math.max(1, ...flow.links.map((l) => l.visitors));

  const indexOf = (dim: FlowDimension, value: string) => byColumn[COLUMNS.indexOf(dim)].findIndex((nd) => nd.value === value);
  const related = (l: FlowResponse['links'][number]) =>
    !hover || (l.from.dimension === hover.dim && l.from.value === hover.value) || (l.to.dimension === hover.dim && l.to.value === hover.value);

  return (
    <div className="flow-canvas" ref={wrap} style={{ height: height + 30 }}>
      <div className="flow-canvas__heads">
        {COLUMNS.map((dim) => (
          <span key={dim} className="flow-canvas__head">{DIMENSION_LABEL[dim]}</span>
        ))}
      </div>
      {width > 0 && (
        <svg className="flow-canvas__links" width={width} height={height} aria-hidden="true">
          {flow.links.map((l, i) => {
            const fc = COLUMNS.indexOf(l.from.dimension);
            const tc = COLUMNS.indexOf(l.to.dimension);
            const fi = indexOf(l.from.dimension, l.from.value);
            const ti = indexOf(l.to.dimension, l.to.value);
            if (fc < 0 || tc < 0 || fi < 0 || ti < 0) return null;
            const x1 = fc * colW + cardW;
            const x2 = tc * colW;
            const y1 = fi * (NODE_H + NODE_GAP) + NODE_H / 2;
            const y2 = ti * (NODE_H + NODE_GAP) + NODE_H / 2;
            const mx = (x1 + x2) / 2;
            const w = Math.max(1.5, (l.visitors / maxLink) * 18);
            return (
              <path
                key={i}
                d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                strokeWidth={w}
                className="flow-link"
                data-dim={!related(l) || undefined}
              >
                <title>{`${n(l.visitors)} visitors`}</title>
              </path>
            );
          })}
        </svg>
      )}
      <div className="flow-canvas__cols" style={{ gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(0, 1fr))` }}>
        {byColumn.map((nodes, ci) => {
          const colMax = Math.max(1, ...nodes.map((nd) => nd.visitors));
          return (
            <div key={COLUMNS[ci]} className="flow-col">
              {nodes.map((nd) => {
                const selected = filter[nd.dimension] === nd.value;
                return (
                  <button
                    key={nd.value}
                    type="button"
                    className="flow-node"
                    style={{ width: cardW, height: NODE_H }}
                    data-selected={selected || undefined}
                    data-medium={nd.medium ?? undefined}
                    aria-pressed={selected}
                    title={`${nodeLabel(nd.dimension, nd.value, nd.label)} — ${n(nd.visitors)} visitors. Click to follow them.`}
                    onMouseEnter={() => setHover({ dim: nd.dimension, value: nd.value })}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover({ dim: nd.dimension, value: nd.value })}
                    onBlur={() => setHover(null)}
                    onClick={() => onToggle(nd.dimension, nd.value)}
                  >
                    <span className="flow-node__fill" style={{ width: `${(nd.visitors / colMax) * 100}%` }} aria-hidden="true" />
                    <span className="flow-node__label">{nodeLabel(nd.dimension, nd.value, nd.label)}</span>
                    <span className="flow-node__n">{n(nd.visitors)}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Visitor story drawer ──────────────────────────────────────────────── */

function StoryDrawer({ visitorId, range, onClose }: { visitorId: string; range: ReturnType<typeof useAnalyticsRange>['range']; onClose: () => void }) {
  const [story, setStory] = useState<Load<VisitorStory>>({ state: 'loading' });

  useEffect(() => {
    let off = false;
    setStory({ state: 'loading' });
    apiGetVisitorStory(visitorId, range)
      .then((r) => !off && setStory({ state: 'ready', data: r.data }))
      .catch((e) => !off && setStory(isNotYet(e) ? { state: 'offline' } : { state: 'error', message: (e as ApiError).message ?? 'Story unavailable.' }));
    return () => {
      off = true;
    };
  }, [visitorId, range]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const s = story.state === 'ready' ? story.data : null;
  const exportStory = () => {
    if (!s) return;
    downloadRows(
      `visitor-${s.visitorNumber ?? s.visitorId.slice(0, 8)}-story`,
      s.sessions.flatMap((ss, si) =>
        ss.steps.map((st) => ({
          session: si + 1,
          came_from: ss.touch.platform,
          campaign: ss.touch.campaign,
          click_id: ss.touch.clickId,
          at: st.at,
          step: st.label,
          kind: st.kind,
          path: st.path,
          seconds: st.seconds,
          scroll_pct: st.scrollPct,
          value_egp: st.valueMinor != null ? Math.round(st.valueMinor / 100) : null,
          order: st.orderNumber,
        })),
      ),
      'csv',
      range,
    );
  };

  return (
    <div className="flow-drawer" role="dialog" aria-modal="true" aria-label="Visitor story">
      <button type="button" className="flow-drawer__scrim" aria-label="Close story" onClick={onClose} />
      <aside className="flow-drawer__panel">
        <header className="flow-drawer__head">
          <div>
            <p className="flow-eyebrowless">{s ? personName(s) : 'Visitor'}</p>
            {s?.customer && (
              <Link href={`/customers/${s.customer.id}`} className="flow-link-inline">Customer profile →</Link>
            )}
          </div>
          <div className="flow-drawer__actions">
            <button type="button" className="flow-pill-btn" onClick={exportStory} disabled={!s}>Export story</button>
            <Link href={`/analytics/visitors/${visitorId}`} className="flow-pill-btn">Full page</Link>
            <button type="button" className="flow-pill-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </header>
        {story.state === 'loading' && <span className="dash-skeleton" style={{ display: 'block', height: 200, borderRadius: 12 }} />}
        {story.state === 'offline' && <p className="flow-note">The story timeline is being switched on. Open the full visitor page meanwhile.</p>}
        {story.state === 'error' && <p className="dash-inline-error">{story.message}</p>}
        {s && (
          <ol className="flow-sessions">
            {s.sessions.map((ss, i) => (
              <li key={ss.sessionId ?? i} className="flow-session">
                <div className="flow-session__touch">
                  <span className="flow-session__when">{formatDateTime(ss.startedAt)}</span>
                  <span className="flow-session__src" data-medium={ss.touch.medium ?? undefined}>
                    {ss.touch.platform ?? 'Direct'}
                    {ss.touch.campaign ? ` · ${ss.touch.campaign}` : ''}
                  </span>
                </div>
                <p className="flow-session__summary">{ss.summary}</p>
                <ol className="flow-steps">
                  {ss.steps.map((st, j) => (
                    <li key={j} className="flow-step" data-kind={st.kind}>
                      <span className="flow-step__dot" aria-hidden="true" />
                      <span className="flow-step__label">{st.label}</span>
                      <span className="flow-step__meta">
                        {[
                          st.seconds != null ? `${Math.round(st.seconds)}s` : null,
                          st.scrollPct != null ? `${Math.round(st.scrollPct)}% scrolled` : null,
                          st.valueMinor != null ? egp(st.valueMinor) : null,
                          st.orderNumber,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}

/* ── Why they didn't buy ───────────────────────────────────────────────── */

type ReasonRow = { reason: string; label: string; visitors: number };

/**
 * The analysis half of Visitors: for everyone who came and didn't pay, where
 * they stopped. Server-counted reasons when the flow API has them; until then
 * counted from the people loaded below, and it says so.
 */
function WhyNoPurchase({
  reasons,
  sampleOf,
  active,
  onPick,
}: {
  reasons: ReasonRow[];
  /** Set when counted from the loaded people rather than the whole range. */
  sampleOf: number | null;
  active: string | undefined;
  onPick: (reason: string) => void;
}) {
  const lost = reasons.filter((r) => r.reason !== 'bought' && r.reason !== 'refunded');
  const bought = reasons.find((r) => r.reason === 'bought')?.visitors ?? 0;
  const lostTotal = lost.reduce((s, r) => s + r.visitors, 0);
  const max = Math.max(1, ...lost.map((r) => r.visitors));
  if (!lostTotal && !bought) return null;
  return (
    <section className="flow-why" aria-label="Why they didn't buy">
      <header className="flow-why__head">
        <div>
          <h2 className="cc-block__title">Why they didn&apos;t buy</h2>
          <p className="cc-block__sub">
            {n(lostTotal)} left without paying{bought ? ` · ${n(bought)} bought` : ''}
            {sampleOf != null ? ` · counted from the ${n(sampleOf)} people loaded` : ''}. Click a reason to see those people.
          </p>
        </div>
      </header>
      <ul className="flow-why__list">
        {lost
          .sort((a, b) => b.visitors - a.visitors)
          .map((r) => (
            <li key={r.reason}>
              <button
                type="button"
                className="flow-why__row"
                aria-pressed={active === r.reason}
                data-selected={active === r.reason || undefined}
                onClick={() => onPick(r.reason)}
              >
                <span className="flow-why__label">{STOP_REASON_LABEL[r.reason] ?? r.label}</span>
                <span className="flow-why__bar" aria-hidden="true">
                  <span style={{ width: `${(r.visitors / max) * 100}%` }} />
                </span>
                <span className="flow-why__n">
                  {n(r.visitors)} <span className="flow-why__pct">{lostTotal ? Math.round((r.visitors / lostTotal) * 100) : 0}%</span>
                </span>
              </button>
            </li>
          ))}
      </ul>
    </section>
  );
}

/* ── The screen ────────────────────────────────────────────────────────── */

/**
 * Visitors (dashboard#90, #123): every real shopper as one connected picture —
 * where they came from (any platform, grouped), which campaign or ad, where
 * they landed, what they looked at, how far they got — and, for everyone who
 * didn't buy, why. The exact people inside any part of it, each with a full
 * story. Story Flow merged in here (owner, 2026-09-19): the full flow must be
 * visible even for someone who never purchased.
 */
export default function VisitorsClient() {
  const { range, setRange } = useAnalyticsRange();
  const params = useSearchParams();
  const summary = useAudienceSummary(range);
  const trend = useAudienceTimeseries(range);
  // Links from the Overview (campaign, country, device…) arrive pre-filtered.
  const [filter, setFilter] = useState<FlowFilter>(() => {
    const f: FlowFilter = {};
    for (const k of FILTER_KEYS) {
      const v = params.get(k);
      if (v) f[k] = v;
    }
    return f;
  });
  const [flow, setFlow] = useState<Load<FlowResponse>>({ state: 'loading' });
  const [people, setPeople] = useState<{ rows: PersonRow[]; done: boolean; legacy: boolean; error: string | null }>({ rows: [], done: false, legacy: false, error: null });
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<PeopleSort>('lastSeenAt');
  const [openVisitor, setOpenVisitor] = useState<string | null>(() => params.get('visitor'));

  useEffect(() => {
    let off = false;
    setFlow({ state: 'loading' });
    apiGetFlow(range, filter)
      .then((r) => !off && setFlow({ state: 'ready', data: r.data }))
      .catch((e) => !off && setFlow(isNotYet(e) ? { state: 'offline' } : { state: 'error', message: (e as ApiError).message ?? 'The flow could not load.' }));
    return () => {
      off = true;
    };
  }, [range, filter]);

  // Everyone in the range, loaded page after page until the list is whole.
  useEffect(() => {
    const signal = { aborted: false };
    const t = window.setTimeout(() => {
      setPeople({ rows: [], done: false, legacy: false, error: null });
      apiGetAllPeople(range, filter, { q: q.trim() || undefined, sort }, (rows, done, legacy) => setPeople({ rows, done, legacy, error: null }), signal).catch(
        (e) => !signal.aborted && setPeople((p) => ({ ...p, done: true, error: (e as ApiError).message ?? 'People could not load.' })),
      );
    }, q ? 250 : 0);
    return () => {
      signal.aborted = true;
      window.clearTimeout(t);
    };
  }, [range, filter, q, sort]);

  const toggle = (dim: FlowFilterKey, value: string) =>
    setFilter((f) => {
      const next = { ...f };
      if (next[dim] === value) delete next[dim];
      else next[dim] = value;
      return next;
    });

  const chips = FILTER_KEYS.filter((d) => filter[d]);
  const legacy = people.legacy;
  const loaded = people.rows;
  // The visitors-list fallback can't filter by reason server-side; do it here.
  const rows = legacy && filter.reason ? loaded.filter((p) => p.stopReason === filter.reason) : loaded;

  // Options accumulate for the range, so picking one value never hides the others.
  const [pool, setPool] = useState<{ key: string; platform: string[]; country: string[] }>({ key: '', platform: [], country: [] });
  const poolKey = `${range.from}|${range.to}|${range.traffic}`;
  const flowPlatforms = flow.state === 'ready' ? flow.data.nodes.filter((nd) => nd.dimension === 'platform').map((nd) => nd.value) : [];
  const nextPlatforms = [...flowPlatforms, ...loaded.map((p) => p.platform), filter.platform];
  const nextCountries = [...loaded.map((p) => p.country), filter.country];
  const merge = (base: string[], add: (string | null | undefined)[]) => {
    const set = new Set(base);
    for (const v of add) if (v) set.add(v);
    return set.size === base.length ? base : [...set];
  };
  const mergedPlatform = merge(pool.key === poolKey ? pool.platform : [], nextPlatforms);
  const mergedCountry = merge(pool.key === poolKey ? pool.country : [], nextCountries);
  if (pool.key !== poolKey || mergedPlatform !== pool.platform || mergedCountry !== pool.country) {
    // Adjusting state during render from derived data (React's documented pattern).
    setPool({ key: poolKey, platform: mergedPlatform, country: mergedCountry });
  }
  const options = useMemo<PeopleOptions>(
    () => ({
      platform: [...pool.platform].sort(),
      country: [...pool.country].sort((a, b) => countryName(a).localeCompare(countryName(b))),
    }),
    [pool],
  );

  const setKey = (key: FlowFilterKey, value: string) =>
    setFilter((f) => {
      const next = { ...f };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });

  const liveReasons = useMemo<{ rows: ReasonRow[]; sampleOf: number | null }>(() => {
    if (flow.state === 'ready' && flow.data.reasons?.length) return { rows: flow.data.reasons, sampleOf: null };
    const counts = new Map<string, number>();
    for (const p of loaded) if (p.stopReason) counts.set(p.stopReason, (counts.get(p.stopReason) ?? 0) + 1);
    return {
      rows: [...counts].map(([reason, visitors]) => ({ reason, label: STOP_REASON_LABEL[reason] ?? reason, visitors })),
      sampleOf: people.done && loaded.length < PEOPLE_CAP ? null : loaded.length,
    };
  }, [flow, loaded, people.done]);
  // Picking a reason narrows the people to it; the panel keeps showing every
  // reason (from the last complete count) so the others stay one click away.
  const [heldReasons, setHeldReasons] = useState(liveReasons);
  if (!filter.reason && people.done && heldReasons !== liveReasons) setHeldReasons(liveReasons);
  const reasons = filter.reason ? heldReasons : liveReasons;

  const s = summary.data?.data;
  const figures = s
    ? [
        { label: range.traffic === 'all' ? 'Visitors' : 'Real visitors', value: n(s.visitors) },
        { label: 'New', value: s.visitors ? `${Math.round((s.newVisitors / s.visitors) * 100)}%` : '—' },
        { label: 'Visits', value: n(s.sessions) },
        { label: 'Left after one page', value: `${(s.bounceRate * 100).toFixed(0)}%` },
      ]
    : null;

  return (
    <>
      <AnalyticsSubnav />
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title cc-masthead">Visitors</h1>
          <p className="dash-page-subtitle">
            Every real shopper from where they came from to what they paid — and, for everyone who didn&apos;t, where they stopped. Click anything to follow those people.
          </p>
        </div>
      </div>
      <AnalyticsScopeBar range={range} onChange={setRange} showCompare={false} />

      {figures && (
        <dl className="flow-figures">
          {figures.map((f) => (
            <div key={f.label} className="flow-figure">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flow-filterbar" aria-live="polite">
        <span className="flow-filterbar__label">{chips.length ? 'Following' : 'Everyone'}</span>
        {chips.map((d) => (
          <button key={d} type="button" className="flow-chip" onClick={() => toggle(d, filter[d]!)} title="Remove">
            <span className="flow-chip__dim">{DIMENSION_LABEL[d]}</span>
            {nodeLabel(d, filter[d]!)}
            <span aria-hidden="true">✕</span>
          </button>
        ))}
        {chips.length > 0 && (
          <button type="button" className="flow-link-btn" onClick={() => setFilter({})}>Clear</button>
        )}
      </div>

      <CameFrom rows={rows} done={people.done} filter={filter} setKey={setKey} countryName={countryName} range={range} />

      <div className="flow-layout">
        <div className="flow-stack">

          <section className="flow-main" aria-label="Flow">
            {flow.state === 'loading' && <span className="dash-skeleton" style={{ display: 'block', height: 360, borderRadius: 16 }} />}
            {flow.state === 'offline' && (
              // Until the connected flow ships, the canvas slot shows the live daily count.
              <LineChart
                data={trend.data?.data ?? []}
                xLabel={(p) => p.bucket}
                series={[{ id: 'visitors', label: 'Visitors', y: (p) => p.visitors }]}
                title="Visitors per day"
              />
            )}
            {flow.state === 'error' && <p className="dash-inline-error">{flow.message}</p>}
            {flow.state === 'ready' &&
              (flow.data.totalVisitors === 0 ? (
                <div className="flow-empty">
                  <strong>No real shoppers match</strong>
                  <p>Widen the dates or remove a filter.</p>
                </div>
              ) : (
                <>
                  <p className="flow-total">
                    <span className="flow-total__n">{n(flow.data.totalVisitors)}</span> {chips.length ? 'people match' : 'real shoppers'}
                    <button
                      type="button"
                      className="flow-pill-btn"
                      onClick={() =>
                        void downloadServerExport('flow', 'csv', range, filter, 'visitor-flow').then((ok) => ok || downloadRows(
                          'visitor-flow',
                          flow.data.links.map((l) => ({ from: `${DIMENSION_LABEL[l.from.dimension]}: ${l.from.value}`, to: `${DIMENSION_LABEL[l.to.dimension]}: ${l.to.value}`, visitors: l.visitors })),
                          'csv',
                          range,
                        ))
                      }
                    >
                      Export flow
                    </button>
                  </p>
                  <div className="flow-scroll">
                    <FlowCanvas flow={flow.data} filter={filter} onToggle={toggle} />
                  </div>
                </>
              ))}
          </section>
        </div>
        <WhyNoPurchase reasons={reasons.rows} sampleOf={reasons.sampleOf} active={filter.reason} onPick={(r) => toggle('reason', r)} />

      </div>

      <PeopleTable
        rows={rows}
        loading={!people.done}
        done={people.done}
        error={people.error}
        filter={filter}
        setKey={setKey}
        q={q}
        setQ={setQ}
        sort={sort}
        setSort={setSort}
        options={options}
        countryName={countryName}
        onOpen={setOpenVisitor}
        onExport={(format) => {
          // Everyone matching, built by the server; what's on screen if that fails.
          void downloadServerExport('people', format, range, filter, 'visitors').then((ok) => {
            if (!ok) downloadRows('visitors', peopleExportRows(rows), format, range);
          });
        }}
      />

      {openVisitor && <StoryDrawer visitorId={openVisitor} range={range} onClose={() => setOpenVisitor(null)} />}
    </>
  );
}

'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  CalendarX,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Megaphone,
  MoreHorizontal,
  RefreshCw,
  Route,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import Sheet from '@/components/dashboard/ui/Sheet';
import {
  useAbandonedCheckouts,
  useAudienceSummary,
  useAudienceTimeseries,
  useCatalogueRoutes,
  useDataQuality,
  usePeopleAll,
  useProductsTop,
  usePurchaseReconciliation,
  useStaffDevice,
  useTrafficFlags,
  useVisitCounts,
  useVisitorStory,
} from '@/lib/hooks/use-analytics';
import { readRange, writeRange, presetRange, type TrafficScope } from '@/lib/analytics/range';
import { FILTER_DEFS, filterContext, filterLabel, filterOptions, countedVisitors, peopleInView, readFilters, writeFilters, emptyFilters, type FilterKey, type Filters } from '@/lib/analytics/visitors';
import { buildModel, isSectionId, SECTIONS, type PathRow, type SectionId } from '@/lib/analytics/model';
import { DEFAULT_VIEW, type ViewState } from '@/lib/analytics/view-state';
import { knownRoutes } from '@/lib/analytics/ad-link';
import { viewSessions } from '@/lib/analytics/journey';
import { cairoStamp, cairoTime, fmtInt, pctOf, rangeLabel } from '@/lib/analytics/format';
import { sourceLabel } from '@/lib/analytics/source';
import { ShellContext, useStored, writeStored, type ShellApi } from './context';
import { AnswerLine, Skeleton } from './parts';
import Toolbar from './Toolbar';
import Legend from './Legend';
import Overview from './sections/Overview';
import People from './sections/People';
import Journeys from './sections/Journeys';
import Sources from './sections/Sources';
import Flow from './sections/Flow';
import Ads from './sections/Ads';
import Quality from './sections/Quality';
import VisitorSheet from './sheets/VisitorSheet';
import PathSheet from './sheets/PathSheet';
import ExportSheet from './sheets/ExportSheet';
import WhoCountsSheet, { whoCountsLabel } from './sheets/WhoCountsSheet';
import FilterSheet from './sheets/FilterSheet';
import './analytics.css';

const LEGEND_KEY = 'mr-analytics-legend';

/** Screens that keep their own pages, reachable from here. */
const OTHER_SCREENS = [
  { label: 'Realtime', href: '/analytics/realtime' },
  { label: 'Pages', href: '/analytics/pages' },
  { label: 'Products', href: '/analytics/products' },
  { label: 'Events', href: '/analytics/events' },
  { label: 'Sales', href: '/analytics/sales' },
  { label: 'Who counts (every verdict)', href: '/analytics/flags' },
  { label: 'DevOps', href: '/analytics/devops' },
];

const SECTION_VIEW: Record<SectionId, React.ComponentType> = {
  overview: Overview,
  people: People,
  journeys: Journeys,
  sources: Sources,
  flow: Flow,
  ads: Ads,
  quality: Quality,
};

/** Sections whose every figure is a count of the canonical people. */
const PEOPLE_SECTIONS = new Set<SectionId>(['overview', 'people', 'journeys', 'sources', 'flow']);

type SheetState =
  | { kind: 'visitor'; id: string }
  | { kind: 'path'; row: PathRow }
  | { kind: 'export' }
  | { kind: 'who' }
  | { kind: 'filters' }
  | { kind: 'more' }
  | null;

function StateBox({ tone, icon: Icon, title, children, actions }: { tone: 'bad' | 'muted'; icon: typeof Info; title: string; children: React.ReactNode; actions: React.ReactNode }) {
  return (
    <div className="anx-panel">
      <div className="anx-state">
        <span className="anx-state-ico" data-tone={tone}>
          <Icon className="anx-i" aria-hidden />
        </span>
        <h2>{title}</h2>
        <p>{children}</p>
        <div className="anx-tools">{actions}</div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Skeleton h={44} />
      <div className="anx-ledger">
        {[0, 1, 2, 3, 4].map((i) => (
          <div className="anx-stage" key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton h={12} w="60%" />
            <Skeleton h={28} w="45%" />
            <Skeleton h={4} />
          </div>
        ))}
      </div>
      <div className="anx-grid-2">
        <div className="anx-panel anx-panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} h={18} />
          ))}
        </div>
        <div className="anx-panel anx-panel-b">
          <Skeleton h={150} />
        </div>
      </div>
    </div>
  );
}

/**
 * Analytics (dashboard#128): the approved Clarity design in production.
 * Seven sections under one toolbar, one status row and one legend; every
 * section opens with a plain answer; any visitor opens their full journey in
 * a sheet; one Export covers the whole dashboard.
 */
export default function AnalyticsShell() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qc = useQueryClient();

  const range = useMemo(() => readRange(params), [params]);
  const filters = useMemo(() => readFilters(params), [params]);
  const sectionParam = params.get('section');
  const section: SectionId = isSectionId(sectionParam) ? sectionParam : 'overview';
  const visitorParam = params.get('visitor');

  const [view, setViewState] = useState<ViewState>(DEFAULT_VIEW);
  const setView = (patch: Partial<ViewState>) => setViewState((v) => ({ ...v, ...patch }));
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [sheetState, setSheet] = useState<SheetState>(null);
  // `?visitor=<id>` (old Visitors links) opens that journey until the sheet is closed.
  const sheet: SheetState = sheetState ?? (visitorParam ? { kind: 'visitor', id: visitorParam } : null);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const [announce, setAnnounce] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [enter, setEnter] = useState(0);
  const [otherOpen, setOtherOpen] = useState(false);
  const contentRef = useRef<HTMLElement>(null);
  const legendRaw = useStored(LEGEND_KEY);
  const legendOpen = legendRaw === '1';

  /* ── Data ── */
  const people = usePeopleAll(range);
  const visits = useVisitCounts(range);
  const summary = useAudienceSummary(range);
  const timeseries = useAudienceTimeseries(range);
  const products = useProductsTop(range);
  const carts = useAbandonedCheckouts(range);
  const quality = useDataQuality(range);
  const recon = usePurchaseReconciliation(range);
  const flags = useTrafficFlags();
  const device = useStaffDevice();
  const catalogue = useCatalogueRoutes(true);
  const routes = useMemo(
    () => (catalogue.data ? knownRoutes(catalogue.data.categories, catalogue.data.products) : null),
    [catalogue.data],
  );

  const model = useMemo(
    () =>
      buildModel({
        range,
        filters,
        people: people.data?.rows ?? [],
        peopleCapped: people.data?.capped,
        visits: visits.data,
        summary: summary.data?.data,
        timeseries: timeseries.data?.data,
        products: products.data?.data,
        carts: carts.data?.data,
        quality: quality.data?.data,
        recon: recon.data?.data,
        flags: flags.data,
        staffDevice: device.data,
        routes,
      }),
    [range, filters, people.data, visits.data, summary.data, timeseries.data, products.data, carts.data, quality.data, recon.data, flags.data, device.data, routes],
  );
  const options = useMemo(() => filterOptions(countedVisitors(people.data?.rows ?? [], range.traffic)), [people.data, range.traffic]);

  /* ── URL state ── */
  const replaceParams = (mutate: (p: URLSearchParams) => URLSearchParams) => {
    const next = mutate(new URLSearchParams(params.toString()));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const toastSeq = useRef(0);
  const toast = (msg: string) => {
    toastSeq.current += 1;
    const id = toastSeq.current;
    setToasts((t) => [...t, { id, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  };

  const setFilters = (f: Filters) => {
    replaceParams((p) => writeFilters(p, f));
    setEnter((n) => n + 1);
  };

  const go: ShellApi['go'] = (next, opts) => {
      replaceParams((p) => {
        let q = p;
        q.set('section', next);
        if (opts?.filters) q = writeFilters(q, { ...emptyFilters(), ...opts.filters });
        return q;
      });
      if (opts?.search !== undefined) {
        if (next === 'people') setView({ peopleQuery: opts.search });
        if (next === 'flow') setView({ flowQuery: opts.search });
      }
      if (opts?.visitorId) setJourneyId(opts.visitorId);
      setEnter((n) => n + 1);
      window.setTimeout(() => {
        if (opts?.anchor) {
          const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          document.getElementById(opts.anchor)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        } else {
          contentRef.current?.focus({ preventScroll: true });
        }
      }, 60);
  };

  const onRange = (r: { from: string; to: string }) => {
    replaceParams((p) => writeRange(p, { ...range, ...r }));
    setEnter((n) => n + 1);
  };
  const onScope = (traffic: TrafficScope) => replaceParams((p) => writeRange(p, { ...range, traffic }));

  const toggleFilter = (key: FilterKey, value: string) => {
    const cur = filters[key];
    const next = { ...filters, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    setFilters(next);
    const n = peopleInView(people.data?.rows ?? [], range.traffic, next).length;
    setAnnounce(`${FILTER_DEFS.find((d) => d.key === key)!.label} filter updated. ${fmtInt(n)} visitors.`);
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await qc.refetchQueries({ queryKey: ['analytics'], type: 'active' });
      toast(`Data refreshed · ${cairoTime(new Date())}`);
    } finally {
      setRefreshing(false);
    }
  };

  const openVisitor = (id: string) => setSheet({ kind: 'visitor', id });
  const openPath = (row: PathRow) => setSheet({ kind: 'path', row });
  const openWhoCounts = () => setSheet({ kind: 'who' });
  const closeSheet = () => {
    if (visitorParam) {
      replaceParams((p) => {
        p.delete('visitor');
        return p;
      });
    }
    setSheet(null);
  };

  // Journeys' open journey, for the export (same cache entry the section reads).
  const selectedJourney = model.people.find((p) => p.id === journeyId) ?? model.people.find((p) => p.cartMinor > 0 && p.orders === 0) ?? model.people[0];
  const journeyStory = useVisitorStory(section === 'journeys' ? selectedJourney?.id : null, range);


  const whoLabel = whoCountsLabel(range.traffic, device.data);
  const rLabel = rangeLabel(range.from, range.to);
  const q = quality.data?.data;
  const botShare = q && q.totalEvents ? pctOf(q.botEvents, q.totalEvents) : null;
  const fresh = summary.data?.freshness;
  const counts: Partial<Record<SectionId, number>> = {
    ads: model.ads.reduce((s, c) => s + (c.meta.status === 'bad' || c.meta.status === 'warn' ? 1 : 0) + (c.tiktok.status === 'bad' || c.tiktok.status === 'warn' ? 1 : 0), 0),
    quality: model.qa.filter((x) => x.status === 'warn' || x.status === 'bad').length,
  };

  const api: ShellApi = {
    model,
    range,
    routes,
    summary: summary.data?.data ?? null,
    recon: recon.data?.data ?? null,
    view,
    setView,
    journeyId,
    setJourneyId,
    go,
    openVisitor,
    openPath,
    openWhoCounts,
    toast,
    loading: people.isLoading,
  };

  const Section = SECTION_VIEW[section];
  const peopleBased = PEOPLE_SECTIONS.has(section);
  const empty = peopleBased && people.isSuccess && model.all.length === 0;
  const noMatch = peopleBased && people.isSuccess && model.all.length > 0 && model.view.length === 0;

  let content: React.ReactNode;
  if (peopleBased && people.isLoading) content = <LoadingState />;
  else if (peopleBased && people.isError)
    content = (
      <StateBox
        tone="bad"
        icon={AlertTriangle}
        title="Analytics couldn’t load"
        actions={
          <>
            <button type="button" className="anx-btn anx-btn-primary" onClick={() => void people.refetch()}>
              <RefreshCw className="anx-i-sm" aria-hidden />
              Retry
            </button>
            <button type="button" className="anx-btn" onClick={() => go('quality')}>
              See data health
            </button>
          </>
        }
      >
        The analytics service didn’t answer ({people.error?.message ?? 'error'}) at {cairoTime(people.errorUpdatedAt)} Cairo time. Your data is safe; it just wasn’t fetched.
      </StateBox>
    );
  else if (empty)
    content = (
      <StateBox
        tone="muted"
        icon={CalendarX}
        title="No visitors in this range yet"
        actions={
          <>
            <button type="button" className="anx-btn anx-btn-primary" onClick={() => onRange(presetRange('30d'))}>
              Show the last 30 days
            </button>
            <button type="button" className="anx-btn" onClick={() => go('quality')}>
              Check tracking health
            </button>
          </>
        }
      >
        {rLabel} has no counted visitors. {q ? `${fmtInt(q.totalEvents)} raw events arrived, ${fmtInt(q.botEvents)} of them left out as bots or staff.` : ''} Pick a longer range to see trends.
      </StateBox>
    );
  else if (noMatch)
    content = (
      <StateBox
        tone="muted"
        icon={Info}
        title="Nobody matches these filters"
        actions={
          <button type="button" className="anx-btn anx-btn-primary" onClick={() => setFilters(emptyFilters())}>
            Clear all filters
          </button>
        }
      >
        {fmtInt(model.all.length)} visitors in {rLabel}, none with {filterContext(filters)}.
      </StateBox>
    );
  else
    content = (
      <>
        <AnswerLine answer={model.answers[section]} onJump={(j) => go(j.section, { anchor: j.anchor })} />
        <Section />
      </>
    );

  const chips = FILTER_DEFS.flatMap((d) => filters[d.key].map((v) => ({ key: d.key, label: d.label, value: v })));

  const exportExtras = {
    summary: summary.data?.data ?? null,
    recon: recon.data?.data ?? null,
    journey:
      section === 'journeys' && selectedJourney && journeyStory.data
        ? {
            visitor: selectedJourney.label,
            rows: viewSessions(journeyStory.data.sessions, routes).flatMap((s, i, all) =>
              s.steps.map((st) => ({
                session: all.length - i,
                at: cairoStamp(st.at),
                page: st.page,
                step: st.label,
                source: sourceLabel({ platform: s.touch.platform, medium: s.touch.medium, campaign: s.touch.campaign }),
                detail: [st.path, st.valueMinor ? `EGP ${Math.round(st.valueMinor / 100)}` : null].filter(Boolean).join(' · '),
              })),
            ),
          }
        : null,
  };

  const bnav: { id: SectionId | 'more'; label: string; Icon: typeof Info }[] = [
    { id: 'overview', label: 'Overview', Icon: BarChart3 },
    { id: 'people', label: 'People', Icon: Users },
    { id: 'flow', label: 'Flow', Icon: Route },
    { id: 'ads', label: 'Ads', Icon: Megaphone },
    { id: 'more', label: 'More', Icon: MoreHorizontal },
  ];
  const inMore = ['journeys', 'sources', 'quality'].includes(section);

  return (
    <ShellContext.Provider value={api}>
      <div className="anx anx-page">
        <header className="anx-head">
          <div>
            <h1>Analytics</h1>
            <p>Where visitors came from, where they dropped, and what to fix next.</p>
          </div>
          <div className="anx-popwrap">
            <button type="button" className="anx-btn anx-btn-ghost" aria-expanded={otherOpen} aria-haspopup="menu" onClick={() => setOtherOpen((v) => !v)}>
              Other screens
              <ChevronDown className="anx-i-sm" aria-hidden />
            </button>
            {otherOpen ? (
              <div className="anx-pop" role="menu" data-align="end" aria-label="Other analytics screens" onKeyDown={(e) => e.key === 'Escape' && setOtherOpen(false)}>
                {OTHER_SCREENS.map((s) => (
                  <Link key={s.href} role="menuitem" className="anx-opt" href={`${s.href}?${writeRange(new URLSearchParams(), range).toString()}`}>
                    {s.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </header>

        <div className="anx-tabs" role="tablist" aria-label="Analytics sections">
          {SECTIONS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`anx-tab-${s.id}`}
              aria-selected={section === s.id}
              aria-controls="anx-content"
              tabIndex={section === s.id ? 0 : -1}
              className="anx-tab"
              onClick={() => go(s.id)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                const next = SECTIONS[(i + (e.key === 'ArrowRight' ? 1 : -1) + SECTIONS.length) % SECTIONS.length];
                go(next.id);
                window.setTimeout(() => document.getElementById(`anx-tab-${next.id}`)?.focus(), 0);
              }}
            >
              {s.label}
              {counts[s.id] ? (
                <span className="anx-tab-count" aria-label={`${counts[s.id]} checks need attention`}>
                  {counts[s.id]}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <Toolbar
          range={range}
          onRange={onRange}
          filters={filters}
          options={options}
          onFilter={toggleFilter}
          onOpenFilterSheet={() => setSheet({ kind: 'filters' })}
          whoLabel={whoLabel}
          whoTone={range.traffic === 'all' ? 'warn' : 'ok'}
          onWho={openWhoCounts}
          onRefresh={() => void refresh()}
          refreshing={refreshing}
          onExport={() => setSheet({ kind: 'export' })}
        />

        {chips.length ? (
          <div className="anx-chips" aria-label="Active filters">
            {chips.map((c) => (
              <span className="anx-chip" key={`${c.key}:${c.value}`}>
                {c.label}: <b>{filterLabel(c.key, c.value)}</b>
                <button
                  type="button"
                  aria-label={`Remove ${c.label} ${filterLabel(c.key, c.value)}`}
                  onClick={() => {
                    setFilters({ ...filters, [c.key]: filters[c.key].filter((v) => v !== c.value) });
                    toast('Filter removed');
                  }}
                >
                  <X className="anx-i-sm" aria-hidden />
                </button>
              </span>
            ))}
            <button
              type="button"
              className="anx-linkbtn"
              onClick={() => {
                setFilters(emptyFilters());
                toast('Filters cleared');
              }}
            >
              Clear all
            </button>
          </div>
        ) : null}

        <div className="anx-status">
          {people.isError ? (
            <span data-tone="bad">
              <AlertTriangle className="anx-i-sm" aria-hidden />
              Data could not load. Numbers below are not current.
            </span>
          ) : (
            <span>
              {fresh?.rollupLastOkAt ? `Updated ${cairoTime(fresh.rollupLastOkAt)} Cairo time` : people.data ? `Fetched ${cairoTime(people.data.fetchedAt)} Cairo time` : 'Loading…'}
              {fresh && fresh.staleBuckets > 0 ? ` · ${fresh.staleBuckets} ${fresh.staleBuckets === 1 ? 'day' : 'days'} still catching up` : ''}
            </span>
          )}
          {recon.data ? (
            recon.data.data.healthy ? (
              <span data-tone="ok">
                <CheckCircle2 className="anx-i-sm" aria-hidden />
                Purchases reconciled to orders
              </span>
            ) : (
              <span data-tone="bad">
                <AlertTriangle className="anx-i-sm" aria-hidden />
                Purchases and orders disagree
              </span>
            )
          ) : null}
          {q ? (
            <span>
              <ShieldCheck className="anx-i-sm" aria-hidden />
              {fmtInt(q.botEvents)} events left out · {botShare}% of raw
            </span>
          ) : null}
          {model.uncredited.total ? (
            <span data-tone="warn">
              <AlertTriangle className="anx-i-sm" aria-hidden />
              {fmtInt(model.uncredited.total)} paid visitors have no campaign name
            </span>
          ) : null}
          {people.data?.capped ? (
            <span data-tone="warn">
              <AlertTriangle className="anx-i-sm" aria-hidden />
              Only the most recent {fmtInt(people.data.rows.length)} people are counted; narrow the dates
            </span>
          ) : null}
          <button type="button" className="anx-linkbtn" onClick={() => go('quality')}>
            Data quality
          </button>
          <button
            type="button"
            className="anx-lg-toggle"
            aria-expanded={legendOpen}
            aria-controls="anx-legend"
            onClick={() => writeStored(LEGEND_KEY, legendOpen ? '0' : '1')}
          >
            <Info className="anx-i-sm" aria-hidden />
            Legend
            <ChevronDown className="anx-chev" aria-hidden />
          </button>
        </div>
        <Legend open={legendOpen} onClose={() => writeStored(LEGEND_KEY, '0')} />

        <main className="anx-content" id="anx-content" tabIndex={-1} ref={contentRef} key={`${section}-${enter}`} data-enter aria-labelledby={`anx-tab-${section}`}>
          {content}
        </main>

        <nav className="anx-bnav" aria-label="Analytics sections">
          {bnav.map((b) => {
            const current = b.id === 'more' ? inMore : section === b.id;
            const label = b.id === 'more' && inMore ? SECTIONS.find((s) => s.id === section)!.short : b.label;
            return (
              <button
                key={b.id}
                type="button"
                aria-current={current ? 'page' : undefined}
                aria-haspopup={b.id === 'more' ? 'dialog' : undefined}
                onClick={() => (b.id === 'more' ? setSheet({ kind: 'more' }) : go(b.id))}
              >
                <b.Icon className="anx-i" aria-hidden />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="anx-toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div className="anx-toast" key={t.id}>
              <CheckCircle2 className="anx-i" aria-hidden />
              {t.msg}
            </div>
          ))}
        </div>
        <div className="anx-sr" role="status" aria-live="polite">
          {announce}
        </div>
      </div>

      {sheet?.kind === 'visitor' ? <VisitorSheet visitorId={sheet.id} onClose={closeSheet} /> : null}
      {sheet?.kind === 'path' ? <PathSheet row={sheet.row} onClose={closeSheet} /> : null}
      {sheet?.kind === 'export' ? (
        <ExportSheet section={section} onClose={closeSheet} rangeLabel={rLabel} filtersLabel={filterContext(filters)} whoCounts={whoLabel} extras={exportExtras} />
      ) : null}
      {sheet?.kind === 'who' ? <WhoCountsSheet onClose={closeSheet} onScope={onScope} /> : null}
      {sheet?.kind === 'filters' ? (
        <FilterSheet
          filters={filters}
          options={options}
          onClose={closeSheet}
          onApply={(f) => {
            setFilters(f);
            closeSheet();
            toast(`${fmtInt(peopleInView(people.data?.rows ?? [], range.traffic, f).length)} visitors match`);
          }}
        />
      ) : null}
      {sheet?.kind === 'more' ? (
        <Sheet scopeClassName="anx" size="narrow" labelId="anx-more-title" title="More sections" onClose={closeSheet}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['journeys', 'sources', 'quality'] as SectionId[]).map((id) => {
              const s = SECTIONS.find((x) => x.id === id)!;
              return (
                <button
                  key={id}
                  type="button"
                  className="anx-choice anx-more-i"
                  aria-current={section === id ? 'page' : undefined}
                  onClick={() => {
                    closeSheet();
                    go(id);
                  }}
                >
                  {s.label}
                  <ChevronRight className="anx-i" aria-hidden />
                </button>
              );
            })}
            <span className="anx-legend-title" style={{ marginTop: 8 }}>
              Other screens
            </span>
            {OTHER_SCREENS.map((s) => (
              <Link key={s.href} className="anx-choice anx-more-i" href={s.href}>
                {s.label}
                <ChevronRight className="anx-i" aria-hidden />
              </Link>
            ))}
          </div>
        </Sheet>
      ) : null}
    </ShellContext.Provider>
  );
}


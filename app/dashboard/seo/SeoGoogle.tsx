'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  apiGetSeoGoogle,
  apiGetSeoGoogleHistory,
  apiRefreshSeoGoogle,
  type SeoGoogleHistoryPoint,
  type SeoGooglePage,
  type SeoGoogleRefreshResponse,
  type SeoGoogleSitemap,
  type SeoGoogleStatus,
  type SeoPageAudit,
} from '@/lib/api/seo';
import { LineChart } from '@/components/dashboard/charts';
import SeoClient, { ExternalIcon, StatusIcon, type SeoExtraColumn, type SeoPagesSlots } from './SeoClient';
import './seo-google.css';

/**
 * Google index status on the SEO tab (minirue-dashboard#70), from backend#172.
 * Fills the slots SeoClient left for it: the Google index card beside the score,
 * Google columns in the pages table, the "Not indexed only" filter and the
 * inspection detail in an opened row. Nothing here invents a number: a null
 * from Google renders as a dash, never as 0.
 */

export const GOOGLE_SETUP_ISSUE = 'https://github.com/minirrue/minirue-backend/issues/173';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/* ── Pure helpers ── */

/** Audit and Google URLs differ in www and trailing slashes; this is the join key. */
export function pageKey(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, '') : '/';
    return `${u.hostname.toLowerCase().replace(/^www\./, '')}${path}${u.search}`;
  } catch {
    return url;
  }
}

export function relTime(iso: string | null, now: number | null): string | null {
  if (!iso || now == null) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const ms = Math.max(0, now - t);
  if (ms < 60_000) return 'just now';
  if (ms < HOUR) {
    const m = Math.floor(ms / 60_000);
    return `${m} minute${m === 1 ? '' : 's'} ago`;
  }
  if (ms < DAY) {
    const h = Math.floor(ms / HOUR);
    return `${h} hour${h === 1 ? '' : 's'} ago`;
  }
  // Rounded: the clock reading can be a few ms older than the data, and
  // "exactly 2 days" must not read as "1 day ago".
  const d = Math.round(ms / DAY);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

function dateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** `INDEXING_ALLOWED` → `Indexing allowed`. Google's free-text states pass through. */
function humanize(v: string | null): string | null {
  if (!v) return null;
  if (!/^[A-Z0-9_]+$/.test(v)) return v;
  const s = v.toLowerCase().replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function crawler(v: string | null): string | null {
  if (v === 'MOBILE') return 'Googlebot smartphone';
  if (v === 'DESKTOP') return 'Googlebot desktop';
  return humanize(v);
}

type Tone = 'ok' | 'warn' | 'danger' | 'muted';

function indexLabel(p: Pick<SeoGooglePage, 'verdict' | 'coverageState' | 'error'>): { text: string; tone: Tone; short: string } {
  if (p.error) return { text: 'Error', tone: 'danger', short: 'Error' };
  if (p.verdict === 'PASS') return { text: 'Indexed', tone: 'ok', short: 'Indexed' };
  const why = p.coverageState ?? humanize(p.verdict);
  return {
    text: why ? `Not indexed: ${why}` : 'Not indexed',
    tone: p.verdict === 'FAIL' ? 'danger' : 'warn',
    short: 'Not indexed',
  };
}

const int = (n: number) => n.toLocaleString('en-US');
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function Dash() {
  return (
    <span className="seo-g-none" aria-label="Not reported by Google">
      —
    </span>
  );
}

function Chip({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return (
    <span className="seo-g-chip" data-tone={tone} title={title}>
      {children}
    </span>
  );
}

function errorText(e: unknown): string {
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === 'string' && m.trim() !== '' ? m.replace(/\.$/, '') : 'the server did not answer';
}

/** The clock for "N days ago", read in an effect so render stays pure. */
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // Same shape as useMinutesAgoLabel: one reading now, then one a minute.
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/* ── Refresh outcome ── */

export interface RefreshNote {
  text: string;
  at?: string | null;
  tone: 'ok' | 'warn';
}

export function describeRefresh(res: SeoGoogleRefreshResponse, single: boolean): RefreshNote {
  const r = res.refresh;
  if (r.ran) {
    const parts = [`Google re-checked ${r.inspected} ${r.inspected === 1 ? 'page' : 'pages'}.`];
    if (r.skippedRecent > 0) {
      parts.push(`${r.skippedRecent} checked in the last hour ${r.skippedRecent === 1 ? 'was' : 'were'} skipped.`);
    }
    if (r.quotaExhausted) parts.push('The daily inspection budget ran out before the rest.');
    return { text: parts.join(' '), tone: r.quotaExhausted ? 'warn' : 'ok', at: r.quotaExhausted ? r.nextAllowedAt : null };
  }
  switch (r.reason) {
    case 'all_recent':
      return {
        text: single ? 'Google checked this page in the last hour.' : 'Every page was checked in the last hour.',
        at: r.nextAllowedAt,
        tone: 'warn',
      };
    case 'quota':
      return { text: 'The daily inspection budget is used up.', at: r.nextAllowedAt, tone: 'warn' };
    case 'not_connected':
      return { text: 'Search Console is not connected, so Google was not asked.', tone: 'warn' };
    case 'error':
      return { text: `Google returned an error: ${res.error?.message ?? 'no details'}`, tone: 'warn' };
    default:
      return { text: 'Google was not asked this time.', tone: 'warn' };
  }
}

function NoteLine({ note }: { note: RefreshNote }) {
  return (
    <p className="seo-g-note" role="status" data-tone={note.tone}>
      {note.text}
      {note.at && (
        <>
          {' '}Ask again after <time dateTime={note.at}>{dateTime(note.at)}</time>.
        </>
      )}
    </p>
  );
}

/* ── Card beside the score ── */

function sitemapCounts(s: SeoGoogleSitemap): string[] {
  const out: string[] = [];
  const submitted = s.contents.reduce((n, c) => n + c.submitted, 0);
  if (s.contents.length > 0) out.push(`${int(submitted)} discovered`);
  const indexed = s.contents.map((c) => c.indexed);
  if (indexed.length > 0 && indexed.every((v): v is number => v != null)) {
    out.push(`${int(indexed.reduce((n, v) => n + v, 0))} indexed`);
  }
  if (s.errors > 0) out.push(`${s.errors} ${s.errors === 1 ? 'error' : 'errors'}`);
  if (s.warnings > 0) out.push(`${s.warnings} ${s.warnings === 1 ? 'warning' : 'warnings'}`);
  return out;
}

function sitemapName(path: string): string {
  try {
    return new URL(path).pathname;
  } catch {
    return path;
  }
}

type GoogleLoad = { kind: 'loading' } | { kind: 'error'; text: string } | { kind: 'ready'; data: SeoGoogleStatus };

function GoogleCard({
  load,
  now,
  busy,
  note,
  onCheckAll,
  onRetry,
}: {
  load: GoogleLoad;
  now: number | null;
  busy: boolean;
  note: RefreshNote | null;
  onCheckAll: () => void;
  onRetry: () => void;
}) {
  const data = load.kind === 'ready' ? load.data : null;
  const connection = data?.connection;
  const badge =
    connection === 'connected'
      ? { text: 'Connected', tone: 'ok' as const }
      : connection === 'error'
        ? { text: 'Error', tone: 'danger' as const }
        : connection === 'not_connected'
          ? { text: 'Not connected', tone: 'muted' as const }
          : null;
  const lastRun = relTime(data?.lastRunAt ?? null, now);

  return (
    <section className="dash-card seo-g-card" aria-labelledby="seo-g-title" aria-busy={load.kind === 'loading'}>
      <div className="seo-g-card-head">
        <h2 id="seo-g-title" className="seo-h2">Google index</h2>
        {badge && (
          <span className="seo-g-conn" data-tone={badge.tone}>
            <span className="seo-g-dot" aria-hidden="true" />
            {badge.text}
          </span>
        )}
      </div>

      {load.kind === 'loading' && <span className="dash-skeleton seo-g-skel" />}

      {load.kind === 'error' && (
        <div className="seo-g-body">
          <p className="dash-inline-error">{load.text}</p>
          <button type="button" className="dash-btn-secondary" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {data && (
        <div className="seo-g-body">
          <p className="seo-g-meta">
            <span className="seo-g-prop">{data.property}</span>
            {lastRun && <span> · Google last asked {lastRun}</span>}
          </p>

          {data.connection === 'not_connected' && (
            <p className="seo-lede seo-g-setup">
              Search Console is not linked to the backend yet, so there is no index data to show. The owner sets it up
              once:{' '}
              <a className="seo-link" href={GOOGLE_SETUP_ISSUE} target="_blank" rel="noopener noreferrer">
                <span>setup steps in backend#173</span>
                <ExternalIcon />
              </a>
              . The live-site checks still work without it.
            </p>
          )}

          {data.connection === 'error' && data.error && (
            <p className="seo-g-error" role="alert">
              <StatusIcon status="fail" size={14} />
              <span>{data.error.message}</span>
            </p>
          )}

          {data.pages.length > 0 && (
            <ul className="seo-g-totals" aria-label="Index coverage">
              <li data-tone="ok">
                <span className="seo-g-total mr-num">{int(data.totals.indexed)}</span>
                <span className="seo-g-total-label">Indexed</span>
              </li>
              <li data-tone="warn">
                <span className="seo-g-total mr-num">{int(data.totals.notIndexed)}</span>
                <span className="seo-g-total-label">Not indexed</span>
              </li>
              <li data-tone="danger">
                <span className="seo-g-total mr-num">{int(data.totals.errors)}</span>
                <span className="seo-g-total-label">Errors</span>
              </li>
            </ul>
          )}

          {data.connection === 'connected' && data.pages.length === 0 && (
            <p className="seo-lede">Google has not been asked about any page yet. Check all pages to start.</p>
          )}

          {data.sitemaps.length > 0 && (
            <ul className="seo-g-sitemaps" aria-label="Sitemaps">
              {data.sitemaps.map((s) => {
                const read = relTime(s.lastDownloaded, now);
                const counts = sitemapCounts(s);
                return (
                  <li key={s.path} aria-label={s.path} className="seo-g-sitemap">
                    <span className="seo-g-sitemap-path">{sitemapName(s.path)}</span>
                    <span className="seo-g-sitemap-facts">
                      {s.isPending ? 'Pending' : read ? `Read ${read}` : 'Not read yet'}
                      {counts.length > 0 && ` · ${counts.join(' · ')}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {data.connection !== 'not_connected' && (
            <div className="seo-g-actions">
              <button
                type="button"
                className="dash-btn-secondary"
                onClick={onCheckAll}
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? 'Asking Google…' : 'Check all pages with Google'}
              </button>
            </div>
          )}
          {note && <NoteLine note={note} />}
        </div>
      )}
    </section>
  );
}

/* ── Table cells ── */

function RichCell({ page }: { page: SeoGooglePage }) {
  if (!page.richResults) return <Dash />;
  if (page.richResults.detected.length === 0) return <span className="seo-g-quiet">None detected</span>;
  return (
    <span className="seo-g-rich">
      {page.richResults.detected.map((d) => {
        const issues = d.items.reduce((n, it) => n + it.issues.length, 0);
        return (
          <span
            key={d.type}
            className="seo-g-rich-item"
            role="img"
            aria-label={`${d.type}: ${issues === 0 ? 'no issues' : `${issues} ${issues === 1 ? 'issue' : 'issues'}`}`}
          >
            <StatusIcon status={issues === 0 ? 'pass' : 'warn'} size={13} />
            <span>{d.type}</span>
          </span>
        );
      })}
    </span>
  );
}

function buildColumns(byKey: Map<string, SeoGooglePage>, now: number | null): SeoExtraColumn[] {
  const g = (p: SeoPageAudit) => byKey.get(pageKey(p.url));
  return [
    {
      id: 'g-status',
      header: 'Google',
      render: (p) => {
        const gp = g(p);
        if (!gp) return <span className="seo-g-quiet">Not checked</span>;
        const l = indexLabel(gp);
        const reason = l.text.startsWith(`${l.short}: `) ? l.text.slice(l.short.length + 2) : null;
        return (
          <span className="seo-g-status">
            <Chip tone={l.tone} title={gp.error ?? undefined}>
              {l.short}
            </Chip>
            {reason && (
              <span className="seo-g-reason">
                <span className="seo-sr">: </span>
                {reason}
              </span>
            )}
          </span>
        );
      },
    },
    {
      id: 'g-crawl',
      header: 'Last crawl',
      render: (p) => {
        const gp = g(p);
        const ago = gp ? relTime(gp.lastCrawlTime, now) : null;
        return ago ? <span className="seo-g-nowrap">{ago}</span> : <Dash />;
      },
    },
    {
      id: 'g-canonical',
      header: 'Canonical',
      render: (p) => {
        const gp = g(p);
        if (!gp) return <Dash />;
        if (gp.canonicalMismatch) {
          return (
            <Chip tone="warn" title={gp.googleCanonical ? `Google chose ${gp.googleCanonical}` : undefined}>
              Mismatch
            </Chip>
          );
        }
        return gp.googleCanonical ? <span className="seo-g-quiet">Match</span> : <Dash />;
      },
    },
    { id: 'g-rich', header: 'Rich results', render: (p) => (g(p) ? <RichCell page={g(p) as SeoGooglePage} /> : <Dash />) },
    {
      id: 'g-clicks',
      header: 'Clicks',
      numeric: true,
      render: (p) => {
        const v = g(p)?.clicks;
        return v == null ? <Dash /> : <span className="mr-num">{int(v)}</span>;
      },
    },
    {
      id: 'g-impr',
      header: 'Impressions',
      numeric: true,
      render: (p) => {
        const v = g(p)?.impressions;
        return v == null ? <Dash /> : <span className="mr-num">{int(v)}</span>;
      },
    },
    {
      id: 'g-pos',
      header: 'Position',
      numeric: true,
      render: (p) => {
        const v = g(p)?.position;
        return v == null ? <Dash /> : <span className="mr-num">{v.toFixed(1)}</span>;
      },
    },
  ];
}

/* ── Opened row ── */

interface Run {
  label: string;
  tone: Tone;
  count: number;
  from: string;
  to: string;
}

export function statusRuns(points: SeoGoogleHistoryPoint[]): Run[] {
  const runs: Run[] = [];
  for (const pt of points) {
    const l = indexLabel(pt);
    const last = runs[runs.length - 1];
    if (last && last.label === l.short) {
      last.count += 1;
      last.to = pt.checkedAt;
    } else {
      runs.push({ label: l.short, tone: l.tone, count: 1, from: pt.checkedAt, to: pt.checkedAt });
    }
  }
  return runs;
}

type HistoryLoad = { kind: 'loading' } | { kind: 'error'; text: string } | { kind: 'ready'; points: SeoGoogleHistoryPoint[] };

function GoogleHistory({ url }: { url: string }) {
  const [load, setLoad] = useState<HistoryLoad>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    apiGetSeoGoogleHistory(url)
      .then((h) => {
        if (!cancelled) setLoad({ kind: 'ready', points: h.points });
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoad({ kind: 'error', text: `Could not load the history: ${errorText(e)}.` });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (load.kind === 'loading') return <span className="dash-skeleton seo-g-skel-chart" aria-busy="true" />;
  if (load.kind === 'error') return <p className="dash-inline-error">{load.text}</p>;
  if (load.points.length === 0) return <p className="seo-g-quiet">Google has no history for this page yet.</p>;

  const runs = statusRuns(load.points);
  const positioned = load.points.filter((p) => p.position != null);

  return (
    <div className="seo-g-history">
      <div className="seo-g-runs-wrap">
        <h4 className="seo-g-h4">Index status over time</h4>
        <ol className="seo-g-runs" aria-label="Index status over time">
          {runs.map((r) => (
            <li
              key={r.from}
              className="seo-g-run"
              data-tone={r.tone}
              style={{ flexGrow: r.count }}
              aria-label={`${r.label}, ${r.count} ${r.count === 1 ? 'check' : 'checks'}, ${shortDate(r.from)} to ${shortDate(r.to)}`}
              title={`${r.label}: ${shortDate(r.from)} to ${shortDate(r.to)}`}
            />
          ))}
        </ol>
        <p className="seo-g-runs-axis" aria-hidden="true">
          <span>{shortDate(load.points[0].checkedAt)}</span>
          <span>{shortDate(load.points[load.points.length - 1].checkedAt)}</span>
        </p>
      </div>
      {positioned.length === 0 ? (
        <p className="seo-g-quiet">Google has not reported a position for this page yet, so there is nothing to chart.</p>
      ) : (
        <LineChart
          data={positioned}
          title="Average position"
          height={180}
          xLabel={(d) => shortDate(d.checkedAt)}
          series={[{ id: 'position', label: 'Position (lower is better)', y: (d) => d.position }]}
          valueFormat={(v) => v.toFixed(1)}
        />
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="seo-g-fact">
      <dt>{label}</dt>
      <dd>{children ?? <Dash />}</dd>
    </div>
  );
}

function GoogleDetail({
  name,
  page,
  connected,
  busy,
  note,
  historyTick,
  onRecheck,
  now,
}: {
  name: string;
  page: SeoGooglePage | undefined;
  connected: boolean;
  busy: boolean;
  note: RefreshNote | null;
  historyTick: number;
  onRecheck: () => void;
  now: number | null;
}) {
  const actions = (
    <div className="seo-g-actions">
      {connected && (
        <button type="button" className="dash-btn-secondary" onClick={onRecheck} disabled={busy} aria-busy={busy}>
          {busy ? 'Asking Google…' : 'Re-check with Google'}
        </button>
      )}
      {page?.inspectionLink && (
        <a className="seo-link" href={page.inspectionLink} target="_blank" rel="noopener noreferrer">
          <span>Request indexing in Search Console</span>
          <ExternalIcon />
        </a>
      )}
    </div>
  );

  return (
    <section className="seo-g-detail" aria-label={`Google inspection for ${name}`}>
      <div className="seo-g-detail-head">
        <h3 className="seo-g-h3">Google</h3>
        {actions}
      </div>
      {note && <NoteLine note={note} />}

      {!page ? (
        <p className="seo-g-quiet">Google has not inspected this page yet.</p>
      ) : (
        <div className="seo-g-detail-grid">
          <div>
            {page.error && (
              <p className="seo-g-error">
                <StatusIcon status="fail" size={14} />
                <span>{page.error}</span>
              </p>
            )}
            <dl className="seo-g-facts">
              <Fact label="Verdict">{humanize(page.verdict)}</Fact>
              <Fact label="Coverage">{page.coverageState}</Fact>
              <Fact label="Indexing">{humanize(page.indexingState)}</Fact>
              <Fact label="robots.txt">{humanize(page.robotsTxtState)}</Fact>
              <Fact label="Page fetch">{humanize(page.pageFetchState)}</Fact>
              <Fact label="Last crawl">
                {page.lastCrawlTime ? `${dateTime(page.lastCrawlTime)} (${relTime(page.lastCrawlTime, now) ?? ''})` : null}
              </Fact>
              <Fact label="Crawled as">{crawler(page.crawledAs)}</Fact>
              <Fact label="Google canonical">
                {page.googleCanonical && (
                  <span className="seo-g-url">
                    {page.canonicalMismatch && <StatusIcon status="warn" size={13} />}
                    {page.googleCanonical}
                  </span>
                )}
              </Fact>
              <Fact label="Your canonical">{page.userCanonical && <span className="seo-g-url">{page.userCanonical}</span>}</Fact>
              <Fact label="In sitemaps">
                {page.sitemaps.length > 0 ? page.sitemaps.map(sitemapName).join(', ') : null}
              </Fact>
              <Fact label="Mobile">
                {page.mobile ? (
                  <>
                    {humanize(page.mobile.verdict) ?? 'No verdict'}
                    {page.mobile.issues.length > 0 && (
                      <ul className="seo-g-issues">
                        {page.mobile.issues.map((i) => (
                          <li key={`${i.type}-${i.message}`}>{i.message}</li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : null}
              </Fact>
              <Fact label="Rich results">
                {page.richResults ? (
                  page.richResults.detected.length === 0 ? (
                    'None detected'
                  ) : (
                    <ul className="seo-g-issues seo-g-rich-list">
                      {page.richResults.detected.map((d) => (
                        <li key={d.type}>
                          <span className="seo-g-rich-type">{d.type}</span>
                          {d.items.flatMap((it) => it.issues).length > 0 && (
                            <ul className="seo-g-issues">
                              {d.items.flatMap((it, ii) =>
                                it.issues.map((iss, k) => <li key={`${ii}-${k}`}>{iss.message}</li>),
                              )}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
              </Fact>
              <Fact label="Asked Google">{dateTime(page.checkedAt)}</Fact>
            </dl>
          </div>

          <div className="seo-g-side">
            <h4 className="seo-g-h4">Top queries, last 28 days</h4>
            {page.topQueries.length === 0 ? (
              <p className="seo-g-quiet">
                {page.impressions == null
                  ? 'Google has no search data for this page yet.'
                  : 'Google reports no queries for this page.'}
              </p>
            ) : (
              <div className="seo-g-queries-wrap">
                <table className="seo-g-queries" aria-label="Top queries">
                  <thead>
                    <tr>
                      <th scope="col">Query</th>
                      <th scope="col">Clicks</th>
                      <th scope="col">Impr.</th>
                      <th scope="col">CTR</th>
                      <th scope="col">Pos.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.topQueries.map((q) => (
                      <tr key={q.query}>
                        <td>{q.query}</td>
                        <td className="mr-num">{int(q.clicks)}</td>
                        <td className="mr-num">{int(q.impressions)}</td>
                        <td className="mr-num">{pct(q.ctr)}</td>
                        <td className="mr-num">{q.position.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <GoogleHistory key={`${page.url}-${historyTick}`} url={page.url} />
          </div>
        </div>
      )}
    </section>
  );
}

/* ── Screen ── */

const ALL = '__all__';

function stripRefresh(res: SeoGoogleRefreshResponse): SeoGoogleStatus {
  const { refresh: _refresh, ...status } = res;
  void _refresh;
  return status;
}

/** The SEO tab with Google Search Console data plugged into SeoClient's slots. */
export default function SeoWithGoogle() {
  const [load, setLoad] = useState<GoogleLoad>({ kind: 'loading' });
  const [notIndexedOnly, setNotIndexedOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, RefreshNote>>({});
  const [historyTick, setHistoryTick] = useState(0);
  const now = useNow();

  const fetchGoogle = useCallback(() => {
    let cancelled = false;
    apiGetSeoGoogle()
      .then((data) => {
        if (!cancelled) setLoad({ kind: 'ready', data });
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoad({ kind: 'error', text: `Could not load Google data: ${errorText(e)}.` });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => fetchGoogle(), [fetchGoogle]);

  const data = load.kind === 'ready' ? load.data : null;

  const byKey = useMemo(() => new Map((data?.pages ?? []).map((p) => [pageKey(p.url), p])), [data]);

  const refresh = useCallback(
    async (url?: string) => {
      const key = url ?? ALL;
      setBusy(key);
      setNotes((n) => {
        const next = { ...n };
        delete next[key];
        return next;
      });
      let note: RefreshNote;
      try {
        const res = await apiRefreshSeoGoogle(url);
        setLoad({ kind: 'ready', data: stripRefresh(res) });
        setHistoryTick((t) => t + 1);
        note = describeRefresh(res, Boolean(url));
      } catch (e) {
        note =
          (e as { status?: number } | null)?.status === 409
            ? { text: 'A Google check is already running. Try again in a minute.', tone: 'warn' }
            : { text: `The re-check did not start: ${errorText(e)}.`, tone: 'warn' };
      } finally {
        setBusy(null);
      }
      setNotes((n) => ({ ...n, [key]: note }));
    },
    [],
  );

  const hasPages = (data?.pages.length ?? 0) > 0;
  const connected = data?.connection === 'connected' || data?.connection === 'error';

  const rowFilter = useCallback(
    (p: SeoPageAudit) => {
      const gp = byKey.get(pageKey(p.url));
      return gp != null && gp.verdict !== 'PASS';
    },
    [byKey],
  );

  const pageSlots: SeoPagesSlots | undefined = useMemo(() => {
    if (!hasPages) return undefined;
    return {
      extraColumns: buildColumns(byKey, now),
      extraFilters: (
        <label className="dash-checkbox-label">
          <input
            type="checkbox"
            className="dash-checkbox"
            checked={notIndexedOnly}
            onChange={(e) => setNotIndexedOnly(e.currentTarget.checked)}
          />
          Not indexed only
        </label>
      ),
      extraRowFilter: notIndexedOnly ? rowFilter : undefined,
      renderDetailExtra: (p: SeoPageAudit) => {
        const gp = byKey.get(pageKey(p.url));
        const url = gp?.url ?? p.url;
        return (
          <GoogleDetail
            name={p.name}
            page={gp}
            connected={connected}
            busy={busy === url}
            note={notes[url] ?? null}
            historyTick={historyTick}
            onRecheck={() => void refresh(url)}
            now={now}
          />
        );
      },
    };
  }, [hasPages, byKey, now, notIndexedOnly, rowFilter, connected, busy, notes, historyTick, refresh]);

  return (
    <SeoClient
      summaryAside={
        <GoogleCard
          load={load}
          now={now}
          busy={busy === ALL}
          note={notes[ALL] ?? null}
          onCheckAll={() => void refresh()}
          onRetry={() => {
            setLoad({ kind: 'loading' });
            fetchGoogle();
          }}
        />
      }
      pageSlots={pageSlots}
    />
  );
}

'use client';

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  apiGetSeoAudit,
  apiRunSeoAudit,
  type SeoAuditReport,
  type SeoCheck,
  type SeoCheckStatus,
  type SeoPageAudit,
  type SeoPageKind,
} from '@/lib/api/seo';
import { useMinutesAgoLabel } from '@/lib/hooks/use-minutes-ago';
import './seo.css';

/* ── Deep links ── */

/** `https://www.minirueshop.com` → `minirueshop.com`, the Search Console domain property. */
function domainOf(storefrontUrl: string): string {
  try {
    return new URL(storefrontUrl).hostname.replace(/^www\./, '');
  } catch {
    return 'minirueshop.com';
  }
}

export function searchConsoleHref(storefrontUrl: string): string {
  const qs = new URLSearchParams({ resource_id: `sc-domain:${domainOf(storefrontUrl)}` });
  return `https://search.google.com/search-console?${qs.toString()}`;
}

export function urlInspectionHref(storefrontUrl: string, pageUrl: string): string {
  return `https://search.google.com/search-console/inspect?resource_id=sc-domain:${domainOf(storefrontUrl)}&id=${encodeURIComponent(pageUrl)}`;
}

export function richResultsHref(pageUrl: string): string {
  return `https://search.google.com/test/rich-results?url=${encodeURIComponent(pageUrl)}`;
}

/**
 * Where a page is edited in the dashboard. The audit carries no ids, so a
 * product is found by the last segment of its `/shop/<category>/<slug>` URL,
 * which is the product slug the editor is keyed on. Categories and sets open
 * their lists; home, shop and plain pages have no editor.
 */
export function dashboardHrefFor(page: SeoPageAudit): string | null {
  switch (page.kind) {
    case 'product': {
      let slug = '';
      try {
        slug = new URL(page.url).pathname.split('/').filter(Boolean).pop() ?? '';
      } catch {
        slug = '';
      }
      return slug ? `/catalogue/products/${encodeURIComponent(slug)}/edit` : '/catalogue/products';
    }
    case 'category':
      return '/catalogue/categories';
    case 'set':
      return '/catalogue/bundles';
    default:
      return null;
  }
}

/* ── Small pieces ── */

const KIND_LABEL: Record<SeoPageKind, string> = {
  home: 'Home',
  shop: 'Shop',
  category: 'Category',
  product: 'Product',
  set: 'Set',
  page: 'Page',
};

const STATUS_WORD: Record<SeoCheckStatus, string> = { pass: 'Pass', warn: 'Warning', fail: 'Fail' };

function tone(score: number): SeoCheckStatus {
  if (score >= 90) return 'pass';
  if (score >= 70) return 'warn';
  return 'fail';
}

function countStatus(checks: SeoCheck[], status: SeoCheckStatus): number {
  return checks.filter((c) => c.status === status).length;
}

function errorText(e: unknown): string {
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === 'string' && m.trim() !== '' ? m.replace(/\.$/, '') : 'the server did not answer';
}

function StatusIcon({ status, size = 16 }: { status: SeoCheckStatus; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: `seo-icon seo-icon-${status}`,
    role: 'img',
    'aria-label': STATUS_WORD[status],
  };
  if (status === 'pass') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9.5" />
        <path d="m7.8 12.3 2.8 2.8 5.6-6" />
      </svg>
    );
  }
  if (status === 'warn') {
    return (
      <svg {...common}>
        <path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        <line x1="12" y1="9.5" x2="12" y2="13.5" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="seo-ext">
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="seo-chevron">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function CheckList({ checks }: { checks: SeoCheck[] }) {
  return (
    <ul className="seo-checks">
      {checks.map((c) => (
        <li key={c.id} className="seo-check">
          <StatusIcon status={c.status} />
          <div className="seo-check-body">
            <span className="seo-check-label">{c.label}</span>
            <span className="seo-check-detail">{c.detail}</span>
            {c.fix && c.status !== 'pass' && (
              <span className="seo-check-fix">
                <span className="seo-check-fix-tag">Fix</span>
                {c.fix}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function RunProgress({ host }: { host: string }) {
  return (
    <div className="seo-progress" role="status">
      <span className="seo-progress-track" aria-hidden="true">
        <span className="seo-progress-bar" />
      </span>
      <span>Checking every page on {host}. This takes up to a minute.</span>
    </div>
  );
}

/* ── Sections ── */

function ScoreHeader({ report, running }: { report: SeoAuditReport; running: boolean }) {
  const ago = useMinutesAgoLabel(report.ranAt);
  const { pass, warn, fail } = report.totals;
  const total = pass + warn + fail || 1;
  const host = domainOf(report.storefrontUrl);
  return (
    <section className="dash-card seo-score" aria-label="SEO score" data-tone={tone(report.score)}>
      <div className="seo-score-number">
        <span className="seo-score-value mr-num">{report.score}</span>
        <span className="seo-score-of mr-num">/ 100</span>
      </div>
      <div className="seo-score-side">
        <div className="seo-score-bar" aria-hidden="true">
          <span className="seo-seg seo-seg-pass" style={{ flexGrow: pass / total }} />
          <span className="seo-seg seo-seg-warn" style={{ flexGrow: warn / total }} />
          <span className="seo-seg seo-seg-fail" style={{ flexGrow: fail / total }} />
        </div>
        <ul className="seo-counts">
          <li><StatusIcon status="pass" size={14} /><span className="mr-num">{pass} pass</span></li>
          <li><StatusIcon status="warn" size={14} /><span className="mr-num">{warn} warn</span></li>
          <li><StatusIcon status="fail" size={14} /><span className="mr-num">{fail} fail</span></li>
        </ul>
        {running ? (
          <RunProgress host={host} />
        ) : (
          <p className="seo-score-meta">
            {ago ? `Last checked ${ago}` : 'Last checked'} · {report.pages.length}{' '}
            {report.pages.length === 1 ? 'page' : 'pages'} on {host}
          </p>
        )}
      </div>
    </section>
  );
}

function SiteHealth({ checks }: { checks: SeoCheck[] }) {
  return (
    <section className="dash-card seo-section" aria-labelledby="seo-site-title">
      <h2 id="seo-site-title" className="seo-h2">Site health</h2>
      <p className="seo-lede">Checks that apply to the whole shop, not to one page.</p>
      {checks.length === 0 ? (
        <p className="seo-muted">The audit returned no site checks.</p>
      ) : (
        <CheckList checks={checks} />
      )}
    </section>
  );
}

/**
 * Slot for columns that are not part of the live-site audit. The Google index
 * columns (minirue-dashboard#70: Google status, last crawl, rich results,
 * clicks / impressions / position) plug in here without touching the table.
 */
export interface SeoExtraColumn {
  id: string;
  header: string;
  numeric?: boolean;
  render: (page: SeoPageAudit) => ReactNode;
}

export interface SeoPagesSlots {
  /** Rendered after Page / Kind / Score / Fails, in order. */
  extraColumns?: SeoExtraColumn[];
  /** Extra filter controls next to "Only problems" (#70: "Not indexed only"). */
  extraFilters?: ReactNode;
  /** Narrows rows after the built-in filters (#70's filter state lives with it). */
  extraRowFilter?: (page: SeoPageAudit) => boolean;
  /** Rendered in an expanded row under the audit checks (#70: Google inspection, queries, history). */
  renderDetailExtra?: (page: SeoPageAudit) => ReactNode;
}

function PagesTable({
  pages,
  extraColumns = [],
  extraFilters,
  extraRowFilter,
  renderDetailExtra,
}: { pages: SeoPageAudit[] } & SeoPagesSlots) {
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [kind, setKind] = useState<'all' | SeoPageKind>('all');
  const [open, setOpen] = useState<string | null>(null);
  const colSpan = 4 + extraColumns.length;

  const kinds = useMemo(
    () => (Object.keys(KIND_LABEL) as SeoPageKind[]).filter((k) => pages.some((p) => p.kind === k)),
    [pages],
  );

  const rows = useMemo(
    () =>
      pages
        .filter((p) => kind === 'all' || p.kind === kind)
        .filter((p) => !onlyProblems || p.checks.some((c) => c.status !== 'pass'))
        .filter((p) => !extraRowFilter || extraRowFilter(p))
        .sort((a, b) => a.score - b.score || countStatus(b.checks, 'fail') - countStatus(a.checks, 'fail')),
    [pages, kind, onlyProblems, extraRowFilter],
  );

  return (
    <section className="dash-card seo-section seo-pages" aria-labelledby="seo-pages-title">
      <div className="seo-pages-head">
        <div>
          <h2 id="seo-pages-title" className="seo-h2">Pages</h2>
          <p className="seo-lede">Worst first. Open a row to see each check and how to fix it.</p>
        </div>
        <div className="seo-filters">
          <label className="dash-checkbox-label">
            <input
              type="checkbox"
              className="dash-checkbox"
              checked={onlyProblems}
              onChange={(e) => setOnlyProblems(e.currentTarget.checked)}
            />
            Only problems
          </label>
          <div className="seo-kind">
            <label htmlFor="seo-kind-select" className="seo-kind-label">Kind</label>
            <select
              id="seo-kind-select"
              className="dash-input seo-kind-select"
              value={kind}
              onChange={(e) => setKind(e.currentTarget.value as 'all' | SeoPageKind)}
            >
              <option value="all">All kinds</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          {extraFilters}
        </div>
      </div>

      <div className="dash-table-wrap">
        <table className="dash-table seo-table" aria-labelledby="seo-pages-title">
          <thead>
            <tr>
              <th scope="col">Page</th>
              <th scope="col" className="seo-col-kind">Kind</th>
              <th scope="col" className="seo-num">Score</th>
              <th scope="col" className="seo-num">Fails</th>
              {extraColumns.map((c) => (
                <th key={c.id} scope="col" className={c.numeric ? 'seo-num' : undefined}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="dash-table-empty">
                  {onlyProblems ? 'No pages with problems here.' : 'No pages of this kind.'}
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const isOpen = open === p.url;
              const fails = countStatus(p.checks, 'fail');
              const panelId = `seo-row-${encodeURIComponent(p.url)}`;
              const editHref = dashboardHrefFor(p);
              return (
                <Fragment key={p.url}>
                  <tr className="seo-row" data-open={isOpen || undefined}>
                    <td>
                      <button
                        type="button"
                        className="seo-row-toggle"
                        aria-expanded={isOpen}
                        aria-controls={isOpen ? panelId : undefined}
                        onClick={() => setOpen(isOpen ? null : p.url)}
                      >
                        <Chevron />
                        <span className="seo-row-name">{p.name}</span>
                      </button>
                      <span className="seo-row-path">{pathOf(p.url)}</span>
                    </td>
                    <td className="seo-col-kind">{KIND_LABEL[p.kind]}</td>
                    <td className="seo-num">
                      <span className="seo-pill mr-num" data-tone={tone(p.score)}>{p.score}</span>
                    </td>
                    <td className="seo-num mr-num" data-zero={fails === 0 || undefined}>{fails}</td>
                    {extraColumns.map((c) => (
                      <td key={c.id} className={c.numeric ? 'seo-num' : undefined}>
                        {c.render(p)}
                      </td>
                    ))}
                  </tr>
                  {isOpen && (
                    <tr className="seo-detail-row">
                      <td colSpan={colSpan} id={panelId}>
                        <div className="seo-detail">
                          <div className="seo-detail-links">
                            {p.httpStatus !== 200 && (
                              <span className="seo-http mr-num">HTTP {p.httpStatus}</span>
                            )}
                            <a href={p.url} target="_blank" rel="noopener noreferrer" className="seo-link">
                              <span>
                                Open <span className="seo-sr">{p.name} </span>on the shop
                              </span>
                              <ExternalIcon />
                            </a>
                            {editHref && (
                              <a href={editHref} className="seo-link">
                                <span>
                                  Edit <span className="seo-sr">{p.name} </span>in the dashboard
                                </span>
                              </a>
                            )}
                          </div>
                          <CheckList checks={p.checks} />
                          {renderDetailExtra?.(p)}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function SearchConsoleBox({ report }: { report: SeoAuditReport }) {
  const candidates = useMemo(() => {
    const products = report.pages.filter((p) => p.kind === 'product');
    return products.length > 0 ? products : report.pages;
  }, [report.pages]);
  const [chosen, setChosen] = useState<string>('');
  const url = candidates.some((p) => p.url === chosen) ? chosen : (candidates[0]?.url ?? report.storefrontUrl);
  const onlyProducts = candidates.some((p) => p.kind === 'product');

  return (
    <section className="dash-card seo-section seo-gsc" aria-labelledby="seo-gsc-title">
      <h2 id="seo-gsc-title" className="seo-h2">Google Search Console</h2>
      <ol className="seo-steps">
        <li>
          Open Search Console for {domainOf(report.storefrontUrl)} and check Pages → Indexing for pages Google
          has not indexed.
        </li>
        <li>Pick a {onlyProducts ? 'product' : 'page'} below and inspect its URL. If it says “URL is not on Google”, press Request indexing.</li>
        <li>Run the Rich Results Test on the same URL. A product should show a valid Product and Breadcrumb result.</li>
      </ol>
      <div className="seo-kind seo-gsc-pick">
        <label htmlFor="seo-gsc-select" className="seo-kind-label">
          {onlyProducts ? 'Product to check' : 'Page to check'}
        </label>
        <select id="seo-gsc-select" className="dash-input" value={url} onChange={(e) => setChosen(e.currentTarget.value)}>
          {candidates.map((p) => (
            <option key={p.url} value={p.url}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="seo-gsc-links">
        <a className="dash-btn-secondary seo-gsc-link" href={searchConsoleHref(report.storefrontUrl)} target="_blank" rel="noopener noreferrer">
          Open Search Console <ExternalIcon />
        </a>
        <a className="dash-btn-secondary seo-gsc-link" href={urlInspectionHref(report.storefrontUrl, url)} target="_blank" rel="noopener noreferrer">
          Inspect URL <ExternalIcon />
        </a>
        <a className="dash-btn-secondary seo-gsc-link" href={richResultsHref(url)} target="_blank" rel="noopener noreferrer">
          Rich Results Test <ExternalIcon />
        </a>
      </div>
    </section>
  );
}

/* ── Screen ── */

type Load = { kind: 'loading' } | { kind: 'error'; text: string } | { kind: 'ready'; report: SeoAuditReport | null };

/**
 * SEO tab (minirue-dashboard#69). Opens on the last cached audit
 * (`GET /v1/seo/audit`); Run check audits the live shop now (`POST`).
 * Every number on screen comes from the report.
 *
 * Google Search Console data (minirue-dashboard#70) is a separate source and
 * plugs into the slots below rather than into the audit components:
 * `summaryAside` sits beside the score (connection card, index coverage) and
 * `pageSlots` adds pages-table columns, a filter and expanded-row content.
 */
export default function SeoClient({
  summaryAside,
  pageSlots,
}: { summaryAside?: ReactNode; pageSlots?: SeoPagesSlots } = {}) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const fetchReport = useCallback(() => {
    let cancelled = false;
    apiGetSeoAudit()
      .then((report) => {
        if (!cancelled) setLoad({ kind: 'ready', report });
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoad({ kind: 'error', text: `Could not load the last SEO check: ${errorText(e)}.` });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => fetchReport(), [fetchReport]);

  const run = async () => {
    if (running) return;
    setRunning(true);
    setRunError(null);
    try {
      const report = await apiRunSeoAudit();
      setLoad({ kind: 'ready', report });
    } catch (e) {
      setRunError(`The check did not finish: ${errorText(e)}. Try again in a minute.`);
    } finally {
      setRunning(false);
    }
  };

  const report = load.kind === 'ready' ? load.report : null;

  const runButton = (
    <button type="button" className="dash-btn-primary seo-run" onClick={() => void run()} disabled={running || load.kind === 'loading'} aria-busy={running}>
      {running ? 'Checking…' : 'Run check'}
    </button>
  );

  return (
    <div className="seo">
      <div className="dash-page-header seo-header">
        <div>
          <h1 className="dash-page-title">SEO</h1>
          <p className="dash-page-subtitle">How the live shop looks to Google and AI search, page by page.</p>
        </div>
        {runButton}
      </div>

      {runError && (
        <p className="dash-inline-error seo-run-error" role="alert">
          {runError}
        </p>
      )}

      {load.kind === 'loading' && (
        <div className="seo-stack" aria-busy="true">
          <span className="dash-skeleton seo-skel-score" />
          <span className="dash-skeleton seo-skel-block" />
        </div>
      )}

      {load.kind === 'error' && (
        <div className="dash-card seo-state">
          <p className="dash-inline-error">{load.text}</p>
          <button type="button" className="dash-btn-secondary" onClick={() => {
              setLoad({ kind: 'loading' });
              fetchReport();
            }}>
            Try again
          </button>
        </div>
      )}

      {load.kind === 'ready' && !report && (
        <div className="dash-card seo-state">
          {running ? (
            <RunProgress host="minirueshop.com" />
          ) : (
            <>
              <h2 className="seo-h2">No check has run yet</h2>
              <p className="seo-lede">
                Press Run check to read every page of the live shop the way Google does and list what is missing.
              </p>
            </>
          )}
        </div>
      )}

      {load.kind === 'ready' && !report && summaryAside && <div className="seo-aside-alone">{summaryAside}</div>}

      {report && (
        <div className="seo-stack">
          <div className="seo-summary" data-has-aside={summaryAside ? true : undefined}>
            <ScoreHeader report={report} running={running} />
            {summaryAside}
          </div>
          <div className="seo-grid">
            <SiteHealth checks={report.site} />
            <SearchConsoleBox report={report} />
          </div>
          <PagesTable pages={report.pages} {...pageSlots} />
        </div>
      )}
    </div>
  );
}

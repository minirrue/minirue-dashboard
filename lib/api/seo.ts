import { apiFetch } from './client';

/**
 * SEO audit (minirue-dashboard#69). Contract pinned in minirrue/minirue-backend#171:
 * the backend fetches the live storefront server-side, scores every page and the
 * site as a whole, and persists the report (backend#106) so it survives a
 * backend restart or deploy — no TTL.
 */

export type SeoCheckStatus = 'pass' | 'warn' | 'fail';

export interface SeoCheck {
  id: string;
  label: string;
  status: SeoCheckStatus;
  detail: string;
  fix?: string;
}

export type SeoPageKind = 'home' | 'shop' | 'category' | 'product' | 'set' | 'page';

export interface SeoPageAudit {
  url: string;
  kind: SeoPageKind;
  name: string;
  httpStatus: number;
  checks: SeoCheck[];
  /** 0–100. */
  score: number;
}

export interface SeoAuditReport {
  ranAt: string;
  storefrontUrl: string;
  site: SeoCheck[];
  pages: SeoPageAudit[];
  totals: { pass: number; warn: number; fail: number };
  /** 0–100. */
  score: number;
}

/** The last persisted report, however long ago it ran, or null when no audit has ever run. */
export async function apiGetSeoAudit(): Promise<SeoAuditReport | null> {
  try {
    const res = await apiFetch<SeoAuditReport | null>('/seo/audit', { auth: true });
    return res ?? null;
  } catch (e) {
    // A controller returning null can send a 200 with an empty body and no
    // content-length, which apiFetch's res.json() rejects. That still means "no report".
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

/** Runs the audit now against the live storefront. Can take up to ~60s. */
export async function apiRunSeoAudit(): Promise<SeoAuditReport> {
  return apiFetch<SeoAuditReport>('/seo/audit', { method: 'POST', auth: true });
}

/*
 * Google Search Console index status (minirue-dashboard#70). Shapes pinned in
 * minirrue/minirue-backend#172 (`src/seo/google/seo-google.types.ts`). Every
 * nullable number means "Google did not return it", never zero.
 */

export type SeoGoogleConnection = 'connected' | 'not_connected' | 'error';
export type SeoGoogleErrorCode = 'forbidden' | 'quota' | 'auth' | 'config' | 'http';

export interface SeoGoogleSitemap {
  path: string;
  type: string | null;
  isPending: boolean;
  isSitemapsIndex: boolean;
  lastSubmitted: string | null;
  lastDownloaded: string | null;
  errors: number;
  warnings: number;
  contents: { type: string; submitted: number; indexed: number | null }[];
}

export interface SeoGoogleRichIssue {
  message: string;
  severity: string;
}

export interface SeoGoogleRichResults {
  verdict: string | null;
  detected: { type: string; items: { name: string; issues: SeoGoogleRichIssue[] }[] }[];
}

export interface SeoGoogleQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SeoGooglePage {
  url: string;
  /** PASS | PARTIAL | FAIL | NEUTRAL | VERDICT_UNSPECIFIED */
  verdict: string | null;
  coverageState: string | null;
  indexingState: string | null;
  robotsTxtState: string | null;
  pageFetchState: string | null;
  lastCrawlTime: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  canonicalMismatch: boolean;
  crawledAs: string | null;
  sitemaps: string[];
  richResults: SeoGoogleRichResults | null;
  mobile: { verdict: string | null; issues: { type: string; severity: string; message: string }[] } | null;
  /** Last 28 days; null = unknown. */
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
  /** Top 5. */
  topQueries: SeoGoogleQuery[];
  inspectionLink: string | null;
  error: string | null;
  checkedAt: string;
}

/**
 * The background "check all pages" run (backend#187). Optional so an older API
 * without it still reads as idle.
 */
export interface SeoGoogleRun {
  status: 'IDLE' | 'RUNNING' | 'DONE' | 'ERROR';
  startedAt: string | null;
  finishedAt: string | null;
  inspected: number;
  total: number;
  error: string | null;
}

export interface SeoGoogleStatus {
  run?: SeoGoogleRun;
  connection: SeoGoogleConnection;
  property: string;
  lastRunAt: string | null;
  error: { code: SeoGoogleErrorCode; message: string } | null;
  sitemaps: SeoGoogleSitemap[];
  pages: SeoGooglePage[];
  totals: { indexed: number; notIndexed: number; errors: number };
}

export interface SeoGoogleHistoryPoint {
  checkedAt: string;
  verdict: string | null;
  coverageState: string | null;
  indexingState: string | null;
  lastCrawlTime: string | null;
  canonicalMismatch: boolean;
  richResultTypes: string[];
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
  error: string | null;
}

export interface SeoGoogleHistory {
  url: string;
  /** Oldest first, up to 400. */
  points: SeoGoogleHistoryPoint[];
}

export type SeoGoogleRefreshReason = 'not_connected' | 'all_recent' | 'error' | 'quota' | null;

export interface SeoGoogleRefreshResult {
  ran: boolean;
  reason: SeoGoogleRefreshReason;
  inspected: number;
  skippedRecent: number;
  quotaExhausted: boolean;
  nextAllowedAt: string | null;
}

export interface SeoGoogleRefreshResponse extends SeoGoogleStatus {
  /** Present for a one-page (synchronous) check; absent on the 202 that starts a full run. */
  refresh?: SeoGoogleRefreshResult;
}

export async function apiGetSeoGoogle(): Promise<SeoGoogleStatus> {
  return apiFetch<SeoGoogleStatus>('/seo/google', { auth: true });
}

export async function apiGetSeoGoogleHistory(url: string): Promise<SeoGoogleHistory> {
  return apiFetch<SeoGoogleHistory>(`/seo/google/history?url=${encodeURIComponent(url)}`, { auth: true });
}

/**
 * Asks Google again, for one page when `url` is given (answers with the result),
 * otherwise for every page: that answers 202 at once with `run.status` RUNNING,
 * and the caller polls `apiGetSeoGoogle` (backend#187). Rejects with
 * `{ status: 409 }` while a run is already going.
 */
export async function apiRefreshSeoGoogle(url?: string): Promise<SeoGoogleRefreshResponse> {
  return apiFetch<SeoGoogleRefreshResponse>('/seo/google/refresh', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(url ? { url } : {}),
  });
}

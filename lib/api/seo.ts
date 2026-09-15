import { apiFetch } from './client';

/**
 * SEO audit (minirue-dashboard#69). Contract pinned in minirrue/minirue-backend#171:
 * the backend fetches the live storefront server-side, scores every page and the
 * site as a whole, and caches the report for ~10 minutes.
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

/** The last cached report, or null when no audit has run yet. */
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

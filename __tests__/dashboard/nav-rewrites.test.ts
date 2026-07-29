import { describe, expect, it } from '@jest/globals';
import { NAV_ITEMS } from '@/components/dashboard/DashboardSidebar';
import nextConfig from '@/next.config';

/**
 * Pages live under app/dashboard/… but are served at clean URLs with the
 * /dashboard prefix stripped, and that mapping is a hand-maintained list in
 * next.config.ts — there is no wildcard. A page with no entry builds fine,
 * appears in the build output, and returns 404 on the live site. Dev mode does
 * not reproduce it.
 *
 * That has already shipped once (Global variants, 2026-07-22). This makes it
 * impossible to ship again: if a tab is in the sidebar, its clean URL has to
 * resolve to something.
 */

type Rewrite = { source: string; destination: string };

async function rewriteSources(): Promise<Set<string>> {
  const config = nextConfig as {
    rewrites?: () => Promise<Rewrite[] | { beforeFiles?: Rewrite[]; afterFiles?: Rewrite[]; fallback?: Rewrite[] }>;
    redirects?: () => Promise<Rewrite[]>;
  };

  const sources = new Set<string>();

  const rewrites = (await config.rewrites?.()) ?? [];
  const flat = Array.isArray(rewrites)
    ? rewrites
    : [
        ...(rewrites.beforeFiles ?? []),
        ...(rewrites.afterFiles ?? []),
        ...(rewrites.fallback ?? []),
      ];
  for (const r of flat) sources.add(r.source);

  // A redirect is an acceptable answer too — the URL resolves either way.
  for (const r of (await config.redirects?.()) ?? []) sources.add(r.source);

  return sources;
}

describe('nav rewrites', () => {
  it('every sidebar tab has a rewrite, or it 404s in production', async () => {
    const sources = await rewriteSources();
    const missing = NAV_ITEMS.flatMap((group) => group.items)
      .map((item) => item.href)
      .filter((href) => !sources.has(href));

    expect(missing).toEqual([]);
  });
});

import { redirect } from 'next/navigation';

/**
 * Story Flow merged into Visitors (owner, 2026-09-19). Old links keep their
 * filters: /analytics/flow?campaign=x → /analytics/visitors?campaign=x.
 */
export default async function AnalyticsFlowPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    for (const one of Array.isArray(v) ? v : v === undefined ? [] : [v]) q.append(k, one);
  }
  const qs = q.toString();
  redirect(qs ? `/analytics/visitors?${qs}` : '/analytics/visitors');
}

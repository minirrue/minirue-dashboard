import { redirect } from 'next/navigation';

/**
 * Merged into Visitors (owner, 2026-09-19): every figure that was here is now
 * a set of real visitors there. Old links keep their dates and filters.
 */
export default async function AnalyticsAcquisitionPage({
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

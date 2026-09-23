import { redirect } from 'next/navigation';
import type { SectionId } from '@/lib/analytics/model';

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The URL an old Analytics screen now lives at: the one Analytics page, on
 * the right section, keeping every query parameter it was opened with
 * (dates, traffic scope, `visitor=` to open a journey). Pure, for tests.
 */
export function sectionHref(sp: SearchParams, section: SectionId): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'section') continue;
    for (const one of Array.isArray(v) ? v : v === undefined ? [] : [v]) q.append(k, one);
  }
  q.set('section', section);
  return `/analytics?${q.toString()}`;
}

/** Old links (Visitors, Flow, Acquisition, Checkout) keep working and land on their section. */
export async function redirectToSection(searchParams: Promise<SearchParams>, section: SectionId): Promise<never> {
  redirect(sectionHref(await searchParams, section));
}

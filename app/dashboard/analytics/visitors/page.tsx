import { redirectToSection } from '../_ui/section-redirect';

/**
 * Visitors became the People section of Analytics (dashboard#128). Old links
 * keep their dates, and `?visitor=<id>` still opens that visitor's journey.
 */
export default async function AnalyticsVisitorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return redirectToSection(searchParams, 'people');
}

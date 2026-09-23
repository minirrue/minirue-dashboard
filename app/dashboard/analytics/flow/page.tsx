import { redirectToSection } from '../_ui/section-redirect';

/** Story Flow is the Flow section of Analytics now (dashboard#128). Old links keep their dates. */
export default async function AnalyticsFlowPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return redirectToSection(searchParams, 'flow');
}

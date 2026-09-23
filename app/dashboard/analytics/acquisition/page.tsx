import { redirectToSection } from '../_ui/section-redirect';

/** Acquisition is the Sources section of Analytics now (dashboard#128). Old links keep their dates. */
export default async function AnalyticsAcquisitionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return redirectToSection(searchParams, 'sources');
}

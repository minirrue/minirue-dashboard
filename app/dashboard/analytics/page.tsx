import { Suspense } from 'react';
import AnalyticsShell from './_ui/AnalyticsShell';

export const metadata = {
  title: 'Analytics — MiniRue Admin',
};

/**
 * Analytics (dashboard#128): Overview, People, Journeys, Sources, Flow,
 * Social ads quality and Data quality on one page, the section in `?section=`.
 * `useSearchParams` needs the Suspense boundary on a prerendered route.
 */
export default function AnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <AnalyticsShell />
    </Suspense>
  );
}

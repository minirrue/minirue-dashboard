import { Suspense } from 'react';
import VisitorsClient from './VisitorsClient';

export const metadata = {
  title: 'Visitors — Analytics — MiniRue Admin',
};

export default function AnalyticsVisitorsPage() {
  return (
    <Suspense fallback={null}>
      <VisitorsClient />
    </Suspense>
  );
}

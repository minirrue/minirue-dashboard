import { Suspense } from 'react';
import AccountingClient from './AccountingClient';

export const metadata = {
  title: 'Accounting — MiniRue Admin',
};

export default function AccountingPage() {
  // AccountingClient reads `?tab=` with useSearchParams; without this boundary
  // Next silently opts the whole route out of prerendering (see refunds/page.tsx).
  return (
    <Suspense fallback={<span className="dash-skeleton" style={{ width: '100%', height: 200 }} />}>
      <AccountingClient />
    </Suspense>
  );
}

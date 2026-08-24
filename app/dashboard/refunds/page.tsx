import { Suspense } from 'react';
import RefundsClient from './RefundsClient';

export const metadata = {
  title: 'Refunds and payments — MiniRue Admin',
};

export default function RefundsPage() {
  /*
   * The Suspense boundary is required, not decorative: RefundsClient reads
   * `?payment=` with useSearchParams to open the Payments tab on the attempt an
   * order linked to, and Next opts the whole route out of prerendering when
   * that hook is not wrapped. The build does not fail — the page just quietly
   * stops being static.
   */
  return (
    <Suspense fallback={<span className="dash-skeleton" style={{ width: '100%', height: 200 }} />}>
      <RefundsClient />
    </Suspense>
  );
}

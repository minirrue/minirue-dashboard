'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  apiCollabOverview,
  type CollabOverview,
} from '@/lib/api/collab-portal';
import type { ApiError } from '@/lib/api/client';

export default function CollabLayoutClient({ children }: { children: ReactNode }) {
  const [overview, setOverview] = useState<CollabOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiCollabOverview()
      .then(setOverview)
      .catch((err: ApiError) => setError(err.message || 'Failed to load partner workspace'));
  }, []);

  return (
    <div className="collab-portal-shell">
      <div
        className="dash-card collab-portal-header"
        data-trace-id="PG-DASHBOARD-COLLAB-004::EL-REGION-portal-header"
      >
        <div data-trace-id="PG-DASHBOARD-COLLAB-004::EL-REGION-portal-title">
          <p className="dash-label collab-portal-brand-label">Partner workspace</p>
          <h1 className="dash-page-title" style={{ margin: 0 }}>
            {overview?.displayName || overview?.brandSlug || 'Your brand'}
          </h1>
        </div>
        {error ? (
          <p
            className="dash-error collab-portal-error"
            data-trace-id="PG-DASHBOARD-COLLAB-004::EL-REGION-portal-error"
          >
            {error}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}


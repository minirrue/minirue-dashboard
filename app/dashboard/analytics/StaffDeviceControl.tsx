'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  apiClearStaffDevice,
  apiGetStaffDeviceStatus,
  type StaffDeviceStatus,
} from '@/lib/api/analytics';
import { apiListTrafficFlags } from '@/lib/api/traffic-flags';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import ExcludeDeviceLink from '@/components/dashboard/analytics/ExcludeDeviceLink';

/**
 * The Exclusions strip at the top of Analytics (dashboard#111): who is being
 * left out of these numbers, and the two ways to leave more out — another
 * device (QR link) or an account/visitor (the flags page).
 */
export default function StaffDeviceControl() {
  const [status, setStatus] = useState<StaffDeviceStatus | null>(null);
  const [activeFlags, setActiveFlags] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [device, flags] = await Promise.allSettled([apiGetStaffDeviceStatus(), apiListTrafficFlags(true)]);
    // This helper must never make the analytics screen fail to render.
    setStatus(device.status === 'fulfilled' ? device.value : null);
    setActiveFlags(flags.status === 'fulfilled' ? flags.value.items.length : null);
  }, []);

  useMountedEffect(() => { void load(); }, [load]);

  async function clearMarker() {
    setClearing(true);
    setError(null);
    try {
      setStatus(await apiClearStaffDevice());
    } catch (e) {
      setError((e as ApiError).message ?? 'Could not update this device.');
    } finally {
      setClearing(false);
    }
  }

  return (
    <section className="dash-exclusions" aria-label="Analytics exclusions">
      <div className="dash-exclusions__facts">
        <p>
          <strong>This device</strong>
          <span>
            {status?.staffDevice
              ? 'Excluded — your own visits here don’t count.'
              : status?.excluded
                ? 'Excluded while signed in to the dashboard. Sign out before visiting the shop for visits here to count; signing in to the dashboard again marks it again.'
                : 'Counted.'}
          </span>
          {status?.staffDevice && (
            <button type="button" className="dash-link-button" disabled={clearing} onClick={() => void clearMarker()}>
              {clearing ? 'Updating…' : 'Count it again'}
            </button>
          )}
        </p>
        <p>
          <strong>Flagged</strong>
          <span>
            {activeFlags === null
              ? '—'
              : activeFlags === 0
                ? 'No accounts or visitors excluded yet.'
                : `${activeFlags} ${activeFlags === 1 ? 'account or visitor' : 'accounts or visitors'} with a verdict.`}
          </span>
          <Link href="/analytics/flags" className="dash-link-button">Manage</Link>
        </p>
      </div>
      <ExcludeDeviceLink />
      {error ? <p className="dash-inline-error" role="alert">{error}</p> : null}
    </section>
  );
}

'use client';

import React, { useCallback, useState } from 'react';
import {
  apiClearStaffDevice,
  apiGetStaffDeviceStatus,
  type StaffDeviceStatus,
} from '@/lib/api/analytics';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

export default function StaffDeviceControl() {
  const [status, setStatus] = useState<StaffDeviceStatus | null>(null);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await apiGetStaffDeviceStatus());
    } catch {
      // This helper must never make the analytics screen fail to render.
      setStatus(null);
    }
  }, []);

  useMountedEffect(() => { void load(); }, [load]);

  async function clearMarker() {
    setClearing(true);
    setError(null);
    try {
      setStatus(await apiClearStaffDevice());
      setCleared(true);
    } catch (e) {
      setError((e as ApiError).message ?? 'Could not update this device.');
    } finally {
      setClearing(false);
    }
  }

  if (!status) return null;

  if (cleared) {
    return (
      <div className="dash-staff-device-note" role="status">
        <strong>Staff marker cleared.</strong>
        <span>
          {status.excluded
            ? ' This dashboard session is still excluded. Sign out before visiting the shop for this device\'s visits to count again.'
            : ' Storefront visits from this device can now count again.'}
          {' '}Signing in to the dashboard again will mark this device as staff again.
        </span>
      </div>
    );
  }

  if (!status.staffDevice) return null;

  return (
    <div className="dash-staff-device-control">
      <div>
        <strong>This device is excluded from shop analytics</strong>
        <p>Clear its staff marker when you want future storefront visits from this device counted.</p>
      </div>
      <button
        type="button"
        className="dash-btn-secondary"
        disabled={clearing}
        onClick={() => void clearMarker()}
      >
        {clearing ? 'Updating…' : 'Count this device again'}
      </button>
      {error ? <p className="dash-inline-error" role="alert">{error}</p> : null}
    </div>
  );
}

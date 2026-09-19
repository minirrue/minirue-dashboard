'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import AnalyticsSubnav from '@/components/dashboard/AnalyticsSubnav';
import ExcludeDeviceLink from '@/components/dashboard/analytics/ExcludeDeviceLink';
import { affectedLine } from '@/components/dashboard/analytics/TrafficFlagPanel';
import {
  apiListTrafficFlags,
  apiRevokeTrafficFlag,
  TRAFFIC_CLASS_COPY,
  type TrafficClass,
  type TrafficFlag,
} from '@/lib/api/traffic-flags';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

type View = 'active' | 'history';
const CLASS_FILTERS: ('ALL' | TrafficClass)[] = ['ALL', 'OWNER', 'INTERNAL', 'SUSPICIOUS', 'BOT', 'TRUSTED'];

function subjectHref(f: TrafficFlag): string {
  return f.subjectType === 'USER' ? `/customers/${f.subjectId}` : `/analytics/visitors/${f.subjectId}`;
}

/**
 * Every verdict on who counts (dashboard#111): one list, newest first, each
 * row saying what it excluded and linking to the account or visitor it is on.
 */
export default function FlagsClient() {
  const [flags, setFlags] = useState<TrafficFlag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('active');
  const [cls, setCls] = useState<'ALL' | TrafficClass>('ALL');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setFlags((await apiListTrafficFlags(false)).items);
    } catch (e) {
      setError((e as ApiError).message ?? 'Flags could not load.');
    }
  }, []);

  useMountedEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (flags ?? []).filter(
      (f) =>
        (view === 'active' ? f.revokedAt === null : f.revokedAt !== null) &&
        (cls === 'ALL' || f.trafficClass === cls) &&
        (!q || f.subjectId.includes(q) || (f.reason ?? '').toLowerCase().includes(q)),
    );
  }, [flags, view, cls, query]);

  async function revoke(f: TrafficFlag) {
    setBusyId(f.id);
    try {
      await apiRevokeTrafficFlag(f.id);
      await load();
    } catch (e) {
      setError((e as ApiError).message ?? 'Could not remove the flag.');
    } finally {
      setBusyId(null);
    }
  }

  const activeCount = (flags ?? []).filter((f) => f.revokedAt === null).length;

  return (
    <>
      <AnalyticsSubnav />
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title cc-masthead">Who counts</h1>
          <p className="dash-page-subtitle">
            Accounts and visitors left out of analytics, or verified as real. Every verdict corrects past data too.
          </p>
        </div>
        <ExcludeDeviceLink />
      </div>

      <div className="dash-filters dash-flags-filters">
        <div className="dash-segmented" role="tablist" aria-label="Show">
          {(['active', 'history'] as View[]).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} data-active={view === v} onClick={() => setView(v)}>
              {v === 'active' ? `Active${flags ? ` (${activeCount})` : ''}` : 'Removed'}
            </button>
          ))}
        </div>
        <label className="dash-field dash-flags-filters__class">
          <span className="dash-label">Verdict</span>
          <select className="dash-select" value={cls} onChange={(e) => setCls(e.target.value as 'ALL' | TrafficClass)}>
            {CLASS_FILTERS.map((c) => (
              <option key={c} value={c}>{c === 'ALL' ? 'All verdicts' : TRAFFIC_CLASS_COPY[c].label}</option>
            ))}
          </select>
        </label>
        <label className="dash-field dash-flags-filters__search">
          <span className="dash-label">Search</span>
          <input className="dash-input dash-input-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Reason or ID…" />
        </label>
      </div>

      {error && <p className="dash-inline-error" role="alert">{error}</p>}

      {flags === null && !error ? (
        <div className="dash-card"><span className="dash-skeleton" style={{ display: 'block', height: 120 }} /></div>
      ) : rows.length === 0 ? (
        <div className="dash-card dash-flags-empty">
          <strong>{view === 'active' ? 'Nothing excluded by hand yet' : 'No removed verdicts'}</strong>
          <p>
            Open a customer or a visitor and choose <em>Exclude or verify</em> in its Analytics panel, or exclude a
            phone with the QR link above.
          </p>
        </div>
      ) : (
        <div className="dash-card" style={{ padding: 0 }}>
          <div className="dash-table-wrap">
            <table className="dash-table dash-flags-table">
              <thead>
                <tr>
                  <th scope="col">Verdict</th>
                  <th scope="col">On</th>
                  <th scope="col">Reason</th>
                  <th scope="col">What it changed</th>
                  <th scope="col">{view === 'active' ? 'Set' : 'Removed'}</th>
                  {view === 'active' && <th scope="col"><span className="dash-sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.id}>
                    <td><span className="dash-flag-chip" data-class={f.trafficClass}>{TRAFFIC_CLASS_COPY[f.trafficClass].short}</span></td>
                    <td>
                      <Link href={subjectHref(f)} className="dash-link">
                        {f.subjectType === 'USER' ? 'Account' : 'Visitor'} <span className="dash-flags-id">{f.subjectId.slice(0, 8)}</span>
                      </Link>
                    </td>
                    <td className="dash-flags-reason">{f.reason ?? <span className="dash-help-text">—</span>}</td>
                    <td className="mr-num">{affectedLine(f)}</td>
                    <td className="mr-num" style={{ whiteSpace: 'nowrap' }}>
                      {new Date(f.revokedAt ?? f.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    {view === 'active' && (
                      <td style={{ textAlign: 'right' }}>
                        <button type="button" className="dash-btn-ghost" disabled={busyId === f.id} onClick={() => void revoke(f)}>
                          {busyId === f.id ? 'Removing…' : f.trafficClass === 'TRUSTED' ? 'Unverify' : 'Count again'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import Sheet from '@/components/dashboard/ui/Sheet';
import ExcludeDeviceLink from '@/components/dashboard/analytics/ExcludeDeviceLink';
import { apiClearStaffDevice, type StaffDeviceStatus } from '@/lib/api/analytics';
import { apiRevokeTrafficFlag, TRAFFIC_CLASS_COPY, type TrafficFlag } from '@/lib/api/traffic-flags';
import { useStaffDevice, useTrafficFlags } from '@/lib/hooks/use-analytics';
import { cairoDateTime, dayLabel, fmtInt } from '@/lib/analytics/format';
import { visitorLabel } from '@/lib/analytics/visitors';
import type { TrafficScope } from '@/lib/analytics/range';
import type { ApiError } from '@/lib/api/client';
import { useShell } from '../context';
import { Skeleton } from '../parts';

/** What this browser's exclusion means, in the owner's words (dashboard#111). */
export function deviceLine(status: StaffDeviceStatus | null | undefined): string {
  if (!status) return 'Checking this browser…';
  if (status.staffDevice) return 'Excluded: your own visits from this browser don’t count.';
  if (status.excluded)
    return 'Excluded while signed in to the dashboard. Sign out before visiting the shop for visits here to count; signing in to the dashboard again marks it again.';
  return 'Counted.';
}

/** The pill in the toolbar: who is being left out right now. */
export function whoCountsLabel(scope: TrafficScope, device: StaffDeviceStatus | null | undefined): string {
  if (scope === 'all') return 'Counting everyone, bots included';
  return device?.excluded ? 'Excluding you, staff & bots' : 'Excluding staff & bots';
}

function flagWho(f: TrafficFlag, names: Map<string, string>): string {
  if (f.subjectType === 'USER') return names.get(f.subjectId) ?? 'An account';
  return names.get(f.subjectId) ?? visitorLabel({ visitorId: f.subjectId });
}

/**
 * Who counts ("This is us", dashboard#111 and #128): one place for every
 * exclusion. The traffic scope, this browser's marker, a link that excludes
 * another device, the people marked as us (restorable), and the history of
 * every verdict. All of it writes through the existing flags API.
 */
export default function WhoCountsSheet({ onClose, onScope }: { onClose: () => void; onScope: (scope: TrafficScope) => void }) {
  const { range, model, toast } = useShell();
  const qc = useQueryClient();
  const device = useStaffDevice();
  const flags = useTrafficFlags();
  const [scope, setScope] = useState<TrafficScope>(range.traffic);
  const [clearing, setClearing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const names = new Map(model.people.map((p) => [p.id, p.label]));
  const all = flags.data ?? [];
  const active = all.filter((f) => !f.revokedAt);
  const ours = active.filter((f) => f.trafficClass === 'OWNER' || f.trafficClass === 'INTERNAL');
  const others = active.length - ours.length;
  const history = [...all]
    .flatMap((f) => [
      { at: f.createdAt, f, kind: 'set' as const },
      ...(f.revokedAt ? [{ at: f.revokedAt, f, kind: 'revoked' as const }] : []),
    ])
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12);

  const clearMarker = async () => {
    setClearing(true);
    setError(null);
    try {
      const next = await apiClearStaffDevice();
      qc.setQueryData(['analytics', 'staff-device'], next);
      toast('This browser is counted again');
    } catch (e) {
      setError((e as ApiError).message ?? 'Could not update this browser.');
    } finally {
      setClearing(false);
    }
  };

  const restore = async (f: TrafficFlag) => {
    setBusy(f.id);
    setError(null);
    try {
      await apiRevokeTrafficFlag(f.id);
      await qc.invalidateQueries({ queryKey: ['analytics'] });
      toast(`${flagWho(f, names)} counts again`);
    } catch {
      setError('That one could not be restored. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet
      scopeClassName="anx"
      size="narrow"
      labelId="anx-who-title"
      title="Who counts"
      subtitle="Analytics settings · “This is us”"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="anx-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="anx-btn anx-btn-primary"
            onClick={() => {
              if (scope !== range.traffic) {
                onScope(scope);
                toast(scope === 'all' ? 'Now counting everyone, bots included' : 'Now counting real shoppers only');
              }
              onClose();
            }}
          >
            Save
          </button>
        </>
      }
    >
      <p className="anx-note">
        <Info className="anx-i" aria-hidden />
        <span>Changes apply to every section and every export. Marking someone rewrites their past visits too; the numbers catch up within a few minutes.</span>
      </p>

      <fieldset>
        <legend>Who these numbers count</legend>
        <label className="anx-choice">
          <input type="radio" name="anx-traffic" checked={scope === 'real'} onChange={() => setScope('real')} data-autofocus={scope === 'real' || undefined} />
          <span>
            <b>Real shoppers only</b>
            <small>Leaves out bots, you, your staff and everyone marked “This is us”. The default.</small>
          </span>
        </label>
        <label className="anx-choice">
          <input type="radio" name="anx-traffic" checked={scope === 'all'} onChange={() => setScope('all')} data-autofocus={scope === 'all' || undefined} />
          <span>
            <b>Everyone, bots included</b>
            <small>For checking the exclusions themselves. The numbers will include you.</small>
          </span>
        </label>
      </fieldset>

      <div>
        <span className="anx-legend-title">This browser</span>
        <p className="anx-p">{device.isLoading ? 'Checking this browser…' : deviceLine(device.data)}</p>
        {device.data?.staffDevice ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start', marginTop: 8 }}>
            <button type="button" className="anx-btn" disabled={clearing} onClick={() => void clearMarker()}>
              {clearing ? 'Updating…' : 'Count this device again'}
            </button>
            <span className="anx-field-hint">Your own visits from this browser will show up in the numbers from now on.</span>
          </div>
        ) : null}
      </div>

      <div className="anx-exclude-slot">
        <span className="anx-legend-title">Another device</span>
        <p className="anx-p" style={{ marginBottom: 8 }}>
          Your phone, or an in-app browser (Instagram, TikTok, Facebook each keep their own). Scan or open the link there and it stops counting.
        </p>
        <ExcludeDeviceLink />
      </div>

      <div>
        <span className="anx-legend-title">Marked “This is us”</span>
        {flags.isLoading ? (
          <Skeleton h={48} />
        ) : flags.isError ? (
          <p className="anx-p">The list could not load.</p>
        ) : ours.length ? (
          <div className="anx-audit">
            {ours.map((f) => (
              <div key={f.id}>
                <time dateTime={f.createdAt}>{dayLabel(f.createdAt.slice(0, 10), true)}</time>
                <span>
                  <b>{flagWho(f, names)}</b> · {TRAFFIC_CLASS_COPY[f.trafficClass].short}
                  {f.affected.events ? ` · ${fmtInt(f.affected.events)} events` : ''}
                  {f.reason ? ` · “${f.reason}”` : ''}
                </span>
                <button type="button" className="anx-btn" disabled={busy === f.id} onClick={() => void restore(f)}>
                  {busy === f.id ? 'Restoring…' : 'Restore'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="anx-p">Nobody is marked. Use “This is us” on a visitor to leave them out.</p>
        )}
        <p className="anx-field-hint" style={{ marginTop: 8 }}>
          {others ? `${fmtInt(others)} more ${others === 1 ? 'verdict' : 'verdicts'} (bot, suspicious, verified real). ` : ''}
          <Link href="/analytics/flags" className="anx-link">
            Manage every verdict
          </Link>
        </p>
      </div>

      <div>
        <span className="anx-legend-title">Change history</span>
        {history.length ? (
          <div className="anx-audit">
            {history.map((h) => (
              <div key={`${h.f.id}-${h.kind}`}>
                <time dateTime={h.at}>{cairoDateTime(h.at)}</time>
                <span style={{ gridColumn: 'span 2' }}>
                  {h.kind === 'set' ? (
                    <>
                      <b>{flagWho(h.f, names)}</b> marked {TRAFFIC_CLASS_COPY[h.f.trafficClass].label.toLowerCase()}
                      {h.f.reason ? ` · “${h.f.reason}”` : ''}
                    </>
                  ) : (
                    <>
                      <b>{flagWho(h.f, names)}</b> counted again
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="anx-p">No changes yet.</p>
        )}
      </div>
      {error ? (
        <p className="anx-field-err" role="alert">
          {error}
        </p>
      ) : null}
    </Sheet>
  );
}

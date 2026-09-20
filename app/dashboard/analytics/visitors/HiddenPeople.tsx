'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiListTrafficFlags, apiRevokeTrafficFlag, type TrafficFlag } from '@/lib/api/traffic-flags';
import { formatDateTime } from '@/lib/dates/format';

/**
 * Everyone marked "This is us" (owner, 2026-09-20: "we may tap on wrong cx so
 * add a new button where we see the hided ones to restore"). Hidden people are
 * out of People, the flow, the figures and every export until they are put
 * back — and putting one back restores their history too, not just what
 * happens next.
 */
export default function HiddenPeople({ onChange }: { onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [flags, setFlags] = useState<TrafficFlag[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    apiListTrafficFlags(true)
      .then((r) => setFlags(r.items.filter((f) => f.trafficClass === 'OWNER' || f.trafficClass === 'INTERNAL')))
      .catch(() => setError('The hidden list could not load.'));
  }, []);

  useEffect(() => {
    if (open && flags === null) load();
  }, [open, flags, load]);

  const restore = async (flag: TrafficFlag) => {
    setBusy(flag.id);
    try {
      await apiRevokeTrafficFlag(flag.id);
      setFlags((f) => (f ?? []).filter((x) => x.id !== flag.id));
      onChange();
    } catch {
      setError('That one could not be restored. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const count = flags?.length;

  return (
    <section className="hidden-people">
      <button type="button" className="flow-link-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide' : 'Show'} the people marked “This is us”
        {count !== undefined ? ` (${count})` : ''}
      </button>

      {open && (
        <div className="hidden-people__body">
          {error && <p className="dash-inline-error">{error}</p>}
          {flags === null && !error && <span className="dash-skeleton" style={{ display: 'block', height: 60, borderRadius: 10 }} />}
          {flags?.length === 0 && <p className="flow-note">Nobody is hidden. Everyone in the range is a real shopper.</p>}
          {!!flags?.length && (
            <ul className="hidden-people__list">
              {flags.map((f) => (
                <li key={f.id}>
                  <span className="hidden-people__who">
                    <strong>{f.subjectType === 'USER' ? 'Account' : 'Visitor'}</strong>
                    <code>{f.subjectId.slice(0, 8)}…</code>
                    <span className="hidden-people__when">marked {formatDateTime(f.createdAt)}</span>
                    {f.reason && <span className="hidden-people__reason">{f.reason}</span>}
                  </span>
                  <button type="button" className="flow-pill-btn" disabled={busy === f.id} onClick={() => void restore(f)}>
                    {busy === f.id ? 'Restoring…' : 'Restore to analytics'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

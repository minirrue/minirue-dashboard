'use client';

import React from 'react';
import {
  listDiscounts,
  setAutomatic,
  stopAutomatic,
  type Discount,
} from '@/lib/api/discounts';
import { errorMessageToText } from '@/lib/api/client';

/**
 * The sitewide markdown — a percentage off everything MiniRue makes, with no
 * code to type.
 *
 * Only one can run at a time. Starting a new one retires the running one in the
 * same breath, because two live markdowns is not a smaller problem than a wrong
 * percentage: it is an unanswerable question about which one an order got.
 */
export default function SitewidePanel({
  onChanged,
  refreshToken,
}: {
  onChanged: () => void;
  refreshToken: number;
}) {
  const [live, setLive] = React.useState<Discount | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [percent, setPercent] = React.useState('10');
  const [expiresAt, setExpiresAt] = React.useState('');
  const [note, setNote] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await listDiscounts(false);
      setLive(
        all.find((d) => d.kind === 'AUTOMATIC' && d.isActive && !d.killedAt) ??
          null,
      );
    } catch (e) {
      setError(errorMessageToText(e, 'Could not load the sitewide discount'));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load, refreshToken]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await setAutomatic({
        percent: Number(percent),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        note: note.trim() || null,
      });
      setNote('');
      onChanged();
      await load();
    } catch (e) {
      setError(errorMessageToText(e, 'Could not start the sitewide discount'));
    } finally {
      setSaving(false);
    }
  }

  async function stop() {
    if (!window.confirm('Stop the sitewide discount now?')) return;
    setError(null);
    try {
      await stopAutomatic();
      onChanged();
      await load();
    } catch (e) {
      setError(errorMessageToText(e, 'Could not stop the sitewide discount'));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {error && <p className="dash-error">{error}</p>}

      <section className="dash-card">
        <h2 className="dash-card-title">Running now</h2>
        {loading ? (
          <p className="dash-muted">Loading…</p>
        ) : live ? (
          <>
            <p>
              <strong>{live.percent}% off</strong> everything MiniRue makes.
              {live.expiresAt
                ? ` Ends ${new Date(live.expiresAt).toLocaleDateString()}.`
                : ' No end date.'}
              {live.note ? ` — ${live.note}` : ''}
            </p>
            <div className="dash-form-actions">
              <button type="button" className="dash-btn-danger" onClick={() => void stop()}>
                Stop it
              </button>
            </div>
          </>
        ) : (
          <p className="dash-panel-empty">Nothing running. Prices are normal.</p>
        )}
      </section>

      <section className="dash-card">
        <h2 className="dash-card-title">
          {live ? 'Replace it' : 'Start a sitewide discount'}
        </h2>
        <form onSubmit={start}>
          <div className="dash-form-grid">
            <div className="dash-field">
              <label className="dash-label" htmlFor="auto-percent">Percent off</label>
              {/* See CodesPanel: step counts from min, so 0.5 put whole numbers
                  off the grid and a plain 10 was refused. */}
              <input
                id="auto-percent"
                className="dash-input"
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                required
              />
            </div>
            <div className="dash-field">
              <label className="dash-label" htmlFor="auto-expires">Ends</label>
              <input
                id="auto-expires"
                className="dash-input"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <div className="dash-field">
              <label className="dash-label" htmlFor="auto-note">Note to yourself</label>
              <input
                id="auto-note"
                className="dash-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Eid week"
              />
            </div>
          </div>

          <div className="dash-form-actions">
            <button type="submit" className="dash-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : live ? 'Replace' : 'Start'}
            </button>
          </div>

          <p className="dash-help-text">
            Shoppers see the old price struck through and the new one beside it.
            This never adds to a typed code — whoever&rsquo;s bag it is gets
            whichever of the two saves them more, never both. It applies to
            MiniRue&rsquo;s own products only, so any wording you use elsewhere
            should say MiniRue rather than &ldquo;everything&rdquo;.
          </p>
        </form>
      </section>
    </div>
  );
}

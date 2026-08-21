'use client';

import React from 'react';
import {
  createDiscount,
  killDiscount,
  listDiscounts,
  type Discount,
} from '@/lib/api/discounts';
import { errorMessageToText } from '@/lib/api/client';

function money(minor: number): string {
  return (minor / 100).toFixed(2);
}

function describeValue(d: Discount): string {
  return d.valueType === 'PERCENT'
    ? `${d.percent}% off`
    : `EGP ${money(d.amountMinor ?? 0)} off`;
}

/**
 * Codes — create, watch, stop.
 *
 * There is no field for the code text. It is generated from a 32-character
 * alphabet that leaves out O, 0, I and 1, the four characters people confuse
 * when reading a code aloud — and a hand-typed code would eventually collide
 * with one already issued.
 */
export default function CodesPanel({
  onChanged,
  refreshToken,
}: {
  onChanged: () => void;
  refreshToken: number;
}) {
  const [rows, setRows] = React.useState<Discount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showStopped, setShowStopped] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [justCreated, setJustCreated] = React.useState<string | null>(null);

  const [kind, setKind] = React.useState<'GLOBAL' | 'PERSONAL'>('GLOBAL');
  const [valueType, setValueType] = React.useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [percent, setPercent] = React.useState('10');
  const [amount, setAmount] = React.useState('50');
  const [ownerCustomerId, setOwnerCustomerId] = React.useState('');
  const [maxRedemptions, setMaxRedemptions] = React.useState('');
  const [maxPerCustomer, setMaxPerCustomer] = React.useState('1');
  const [expiresAt, setExpiresAt] = React.useState('');
  const [note, setNote] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listDiscounts(showStopped));
    } catch (e) {
      setError(errorMessageToText(e, 'Could not load discounts'));
    } finally {
      setLoading(false);
    }
  }, [showStopped]);

  React.useEffect(() => {
    void load();
  }, [load, refreshToken]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const created = await createDiscount({
        kind,
        valueType,
        ...(valueType === 'PERCENT'
          ? { percent: Number(percent) }
          : { amountMinor: Math.round(Number(amount) * 100) }),
        ownerCustomerId: kind === 'PERSONAL' ? ownerCustomerId.trim() : null,
        maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : null,
        maxPerCustomer: Number(maxPerCustomer) || 1,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        note: note.trim() || null,
      });
      // Shown on its own rather than left to be found in the list: this is the
      // moment the code has to be copied, and hunting for it among similar
      // codes is how the wrong one gets sent to a customer.
      setJustCreated(created.code);
      setNote('');
      setOwnerCustomerId('');
      onChanged();
      await load();
    } catch (e) {
      setError(errorMessageToText(e, 'Could not create the code'));
    } finally {
      setCreating(false);
    }
  }

  async function stop(d: Discount) {
    const reason = window.prompt(
      `Stop ${d.code}? Orders already placed keep their discount — this only stops the next use.\n\nReason:`,
    );
    if (!reason) return;
    setError(null);
    try {
      await killDiscount(d.id, reason);
      onChanged();
      await load();
    } catch (e) {
      setError(errorMessageToText(e, 'Could not stop the code'));
    }
  }

  const codes = rows.filter((d) => d.kind !== 'AUTOMATIC');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {error && <p className="dash-error">{error}</p>}

      {justCreated && (
        <p className="dash-inline-ok">
          Created <strong>{justCreated}</strong> — copy it now and send it to
          whoever it is for.{' '}
          <button
            type="button"
            className="dash-btn-secondary"
            onClick={() => void navigator.clipboard?.writeText(justCreated)}
          >
            Copy
          </button>
        </p>
      )}

      <section className="dash-card">
        <h2 className="dash-card-title">New code</h2>
        <form onSubmit={submit}>
          <div className="dash-form-grid">
            <div className="dash-field">
              <label className="dash-label" htmlFor="disc-kind">Who can use it</label>
              <select
                id="disc-kind"
                className="dash-select"
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
              >
                <option value="GLOBAL">Anyone</option>
                <option value="PERSONAL">One customer only</option>
              </select>
            </div>

            {kind === 'PERSONAL' && (
              <div className="dash-field">
                <label className="dash-label" htmlFor="disc-owner">
                  Customer id <span className="dash-required">*</span>
                </label>
                <input
                  id="disc-owner"
                  className="dash-input"
                  value={ownerCustomerId}
                  onChange={(e) => setOwnerCustomerId(e.target.value)}
                  placeholder="the customer's id"
                  required
                />
              </div>
            )}

            <div className="dash-field">
              <label className="dash-label" htmlFor="disc-type">Takes off</label>
              <select
                id="disc-type"
                className="dash-select"
                value={valueType}
                onChange={(e) => setValueType(e.target.value as typeof valueType)}
              >
                <option value="PERCENT">A percentage</option>
                <option value="FIXED">A fixed amount</option>
              </select>
            </div>

            {valueType === 'PERCENT' ? (
              <div className="dash-field">
                <label className="dash-label" htmlFor="disc-percent">Percent</label>
                {/* step counts FROM min, so min 0.01 with the old step 0.5
                    made the valid values 0.01, 0.51 … 9.51, 10.01 — and a round
                    10 was refused as invalid (owner, 2026-08-21). Two decimals
                    accepts any real percentage. min stays 0.01 rather than 0: a
                    0% code is a no-op that still looks like a live offer. */}
                <input
                  id="disc-percent"
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
            ) : (
              <div className="dash-field">
                <label className="dash-label" htmlFor="disc-amount">Amount (EGP)</label>
                <input
                  id="disc-amount"
                  className="dash-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="dash-field">
              <label className="dash-label" htmlFor="disc-max">Total uses</label>
              <input
                id="disc-max"
                className="dash-input"
                type="number"
                min="1"
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                placeholder="blank = unlimited"
              />
            </div>

            <div className="dash-field">
              <label className="dash-label" htmlFor="disc-per">Uses per customer</label>
              <input
                id="disc-per"
                className="dash-input"
                type="number"
                min="1"
                value={maxPerCustomer}
                onChange={(e) => setMaxPerCustomer(e.target.value)}
              />
            </div>

            <div className="dash-field">
              <label className="dash-label" htmlFor="disc-expires">Expires</label>
              <input
                id="disc-expires"
                className="dash-input"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>

            <div className="dash-field">
              <label className="dash-label" htmlFor="disc-note">Note to yourself</label>
              <input
                id="disc-note"
                className="dash-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ramadan campaign, complaint 412…"
              />
            </div>
          </div>

          <div className="dash-form-actions">
            <button type="submit" className="dash-btn-primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create code'}
            </button>
          </div>
          <p className="dash-help-text">
            Codes apply to MiniRue&rsquo;s own products only — never a
            partner&rsquo;s price, and never a bundle.
          </p>
        </form>
      </section>

      <section className="dash-card">
        <div className="dash-panel-head">
          <h2 className="dash-card-title">Codes</h2>
          <label className="dash-checkbox-label">
            <input
              type="checkbox"
              className="dash-checkbox"
              checked={showStopped}
              onChange={(e) => setShowStopped(e.target.checked)}
            />
            <span>Show stopped</span>
          </label>
        </div>

        {loading ? (
          <p className="dash-muted">Loading…</p>
        ) : codes.length === 0 ? (
          <p className="dash-panel-empty">
            No codes yet. Create one above and it appears here.
          </p>
        ) : (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Takes off</th>
                  <th>Who</th>
                  <th>Used</th>
                  <th>Expires</th>
                  <th>Note</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {codes.map((d) => (
                  <tr key={d.id} style={{ opacity: d.killedAt ? 0.55 : 1 }}>
                    <td>
                      <code className="dash-slug">{d.code}</code>
                      {d.source === 'SUPPORT' && (
                        <span className="dash-status"> support</span>
                      )}
                    </td>
                    <td>{describeValue(d)}</td>
                    <td>{d.kind === 'PERSONAL' ? 'One customer' : 'Anyone'}</td>
                    <td>
                      {d.usedCount} / {d.maxRedemptions === null ? '∞' : d.maxRedemptions}
                    </td>
                    <td>
                      {d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : '—'}
                    </td>
                    <td>{d.note ?? '—'}</td>
                    <td>
                      {d.killedAt ? (
                        <span className="dash-muted">Stopped</span>
                      ) : (
                        <button
                          type="button"
                          className="dash-btn-secondary"
                          onClick={() => void stop(d)}
                        >
                          Stop
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

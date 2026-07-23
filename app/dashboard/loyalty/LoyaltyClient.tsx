'use client';

import React, {useState, useCallback } from 'react';
import { apiAdminListLoyaltyAccounts, apiAdminManualAdjust } from '@/lib/api/loyalty';
import type { LoyaltyAccountDto } from '@/lib/api/loyalty';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

function SkeletonRows() {
  return (
    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>{['Customer ID', 'Balance', 'Lifetime Earned', 'Lifetime Redeemed', ''].map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 5 }).map((_, j) => (
                <td key={j}><span className="dash-skeleton" style={{ display: 'block', width: j === 0 ? 120 : 70, height: 14 }} /></td>
              ))}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdjustModal({
  account,
  onClose,
  onDone,
}: {
  account: LoyaltyAccountDto;
  onClose: () => void;
  onDone: (updated: LoyaltyAccountDto) => void;
}) {
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = parseInt(delta, 10);
    if (!d) { setError('Enter a non-zero integer.'); return; }
    setBusy(true);
    setError(null);
    try {
      const updated = await apiAdminManualAdjust({ customerId: account.customerId, delta: d, note: note || undefined });
      onDone(updated);
    } catch (err) {
      setError((err as ApiError).message ?? 'Adjust failed');
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ background: 'var(--mr-bg-raised)', border: '1px solid var(--mr-border)', borderRadius: 'var(--mr-radius-lg)', padding: 28, minWidth: 'min(340px, calc(100vw - 32px))', maxWidth: 'min(440px, calc(100vw - 32px))' }}>
        <h2 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 600 }}>Manual Points Adjust</h2>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--mr-fg-3)' }}>
          Customer: <code style={{ fontSize: 12 }}>{account.customerId.slice(0, 8)}…</code><br />
          Current balance: <strong>{account.balance.toLocaleString()}</strong>
        </p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--mr-fg-4)', display: 'block', marginBottom: 4 }}>Delta (positive = add, negative = deduct)</label>
            <input
              type="number"
              className="dash-input"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="e.g. 100 or -50"
              required
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--mr-fg-4)', display: 'block', marginBottom: 4 }}>Note (optional)</label>
            <input type="text" className="dash-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for adjustment" />
          </div>
          {error && <p className="dash-inline-error">{error}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="dash-btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="dash-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Apply'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoyaltyClient() {
  const [accounts, setAccounts] = useState<LoyaltyAccountDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<LoyaltyAccountDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiAdminListLoyaltyAccounts({ limit: 100 });
      // A response with no data key set accounts to undefined, and the
      // reduce() below then took the whole page down with "Cannot read
      // properties of undefined" — same shape of bug as the Settings crash.
      setAccounts(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setError((e as ApiError).message ?? 'Failed to load loyalty data');
    } finally {
      setLoading(false);
    }
  }, []);

  useMountedEffect(() => { load(); }, [load]);

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalEarned = accounts.reduce((s, a) => s + a.lifetimeEarned, 0);

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Loyalty</h1>
      </div>

      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div className="dash-card dash-stat-card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="dash-section-title" style={{ margin: 0 }}>Total Outstanding</span>
              <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--mr-fg)', lineHeight: 1 }}>{totalBalance.toLocaleString()}</span>
            </div>
          </div>
          <div className="dash-card dash-stat-card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="dash-section-title" style={{ margin: 0 }}>Lifetime Earned</span>
              <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--mr-fg)', lineHeight: 1 }}>{totalEarned.toLocaleString()}</span>
            </div>
          </div>
          <div className="dash-card dash-stat-card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="dash-section-title" style={{ margin: 0 }}>Active Accounts</span>
              <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--mr-fg)', lineHeight: 1 }}>{accounts.length}</span>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonRows />
      ) : error ? (
        <div className="dash-card">
          <p className="dash-inline-error">{error}</p>
          <button className="dash-btn-secondary" style={{ marginTop: 12 }} onClick={load}>Retry</button>
        </div>
      ) : (
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Customer ID</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                  <th style={{ textAlign: 'right' }}>Lifetime Earned</th>
                  <th style={{ textAlign: 'right' }}>Lifetime Redeemed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr><td colSpan={5} className="dash-table-empty">No loyalty accounts yet.</td></tr>
                ) : (
                  accounts.map((row) => (
                    <tr key={row.id}>
                      <td><code style={{ fontSize: 12 }}>{row.customerId.slice(0, 8)}…</code></td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.balance.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--mr-fg-3)' }}>{row.lifetimeEarned.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--mr-fg-3)' }}>{row.lifetimeRedeemed.toLocaleString()}</td>
                      <td>
                        <div className="dash-row-actions">
                          <button className="dash-btn-ghost" onClick={() => setAdjustTarget(row)}>Adjust</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adjustTarget && (
        <AdjustModal
          account={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onDone={(updated) => {
            setAccounts((prev) => prev.map((a) => (a.customerId === updated.customerId ? { ...a, ...updated } : a)));
            setAdjustTarget(null);
          }}
        />
      )}
    </>
  );
}

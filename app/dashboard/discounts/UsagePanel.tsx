'use client';

import React from 'react';
import Link from 'next/link';
import {
  getWarnings,
  listRedemptions,
  type Redemption,
  type Warnings,
} from '@/lib/api/discounts';
import { errorMessageToText } from '@/lib/api/client';

function money(minor: number): string {
  return (minor / 100).toFixed(2);
}

/**
 * Every use of every code, and the four things worth worrying about.
 *
 * The same rows appear on a customer's own page — one query, two views, so the
 * two can never disagree about whether somebody has been compensated already.
 */
export default function UsagePanel({ refreshToken }: { refreshToken: number }) {
  const [rows, setRows] = React.useState<Redemption[]>([]);
  const [warnings, setWarnings] = React.useState<Warnings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [codeFilter, setCodeFilter] = React.useState('');
  const [applied, setApplied] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [redemptions, warns] = await Promise.all([
        listRedemptions(applied ? { code: applied } : undefined),
        getWarnings(),
      ]);
      setRows(redemptions);
      setWarnings(warns);
    } catch (e) {
      setError(errorMessageToText(e, 'Could not load usage'));
    } finally {
      setLoading(false);
    }
  }, [applied]);

  React.useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const flags = React.useMemo(() => {
    if (!warnings) return [];
    const out: string[] = [];
    for (const g of warnings.guessing) {
      out.push(
        `${g.failures} wrong codes in the last hour from ${
          g.customer_id ? `customer ${g.customer_id.slice(0, 8)}` : 'one device'
        } — somebody is guessing.`,
      );
    }
    for (const s of warnings.serialRedeemer) {
      out.push(
        `Customer ${s.customer_id.slice(0, 8)} has used ${s.distinct_offers} different codes in 30 days, worth EGP ${money(s.total_minor)}.`,
      );
    }
    for (const s of warnings.sharedIdentity) {
      out.push(
        `${s.accounts} different accounts at the same address used one code, worth EGP ${money(s.total_minor)} — likely one person.`,
      );
    }
    for (const l of warnings.leakedPersonal) {
      out.push(
        `${l.code_text} was tried ${l.attempts} times by people who do not own it — it has leaked. Stop it.`,
      );
    }
    return out;
  }, [warnings]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {error && <p className="dash-error">{error}</p>}

      <section className="dash-card">
        <h2 className="dash-card-title">Worth a look</h2>
        {loading ? (
          <p className="dash-muted">Loading…</p>
        ) : flags.length === 0 ? (
          <p className="dash-panel-empty">
            Nothing unusual. No guessing, no repeat claimers, no shared
            addresses, no leaked personal codes.
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="dash-card">
        <div className="dash-panel-head">
          <h2 className="dash-card-title">Every use</h2>
          <form
            className="dash-inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              setApplied(codeFilter.trim());
            }}
          >
            <input
              className="dash-input dash-input-search"
              value={codeFilter}
              onChange={(e) => setCodeFilter(e.target.value)}
              placeholder="Filter by code"
              aria-label="Filter by code"
            />
            <button type="submit" className="dash-btn-secondary">
              Filter
            </button>
            {applied && (
              <button
                type="button"
                className="dash-btn-ghost"
                onClick={() => {
                  setCodeFilter('');
                  setApplied('');
                }}
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {loading ? (
          <p className="dash-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="dash-panel-empty">
            {applied
              ? 'No uses of that code.'
              : 'No codes have been used yet.'}
          </p>
        ) : (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Code</th>
                  <th>Customer</th>
                  <th>Order</th>
                  <th>Saved</th>
                  <th>From</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                    <td>
                      <code className="dash-slug">{r.code ?? 'bundle'}</code>
                    </td>
                    <td>
                      <Link
                        className="dash-link"
                        href={`/customers/${r.customerId}`}
                      >
                        {r.customerId.slice(0, 8)}
                      </Link>
                    </td>
                    <td>
                      <Link className="dash-link" href={`/orders/${r.orderId}`}>
                        {r.orderNumber ?? r.orderId.slice(0, 8)}
                      </Link>
                    </td>
                    <td>
                      {r.currency} {money(r.amountMinor)}
                    </td>
                    <td>{r.source === 'SUPPORT' ? 'Support' : 'Campaign'}</td>
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

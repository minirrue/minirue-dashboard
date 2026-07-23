'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  apiListCollaborators,
  apiGetCollaboratorAnalytics,
  type CollaboratorListItem,
  type CollaboratorAnalytics,
} from '@/lib/api/collaborators';
import { listAccounts, signInAsAccount } from '@/lib/api/platform';
import { beginActingAs } from '@/lib/auth/acting-session';
import {
  CollaboratorStatusBadge,
  CollaboratorModuleChips,
  formatEgp,
} from '@/components/collab/collab-ui';
import type { ApiError } from '@/lib/api/client';
import { useUser } from '@/lib/hooks/use-auth';
import { Role } from '@/lib/auth/role';

const TRACE = 'PG-DASHBOARD-PTR-001';

type Period = '7d' | '30d' | '90d';

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
];

/** Per-partner analytics load state — kept separate so one slow or failing
 *  partner never blocks the rest of the table. */
type StatsState =
  | { status: 'loading' }
  | { status: 'ready'; data: CollaboratorAnalytics }
  | { status: 'error' };

/**
 * Partners oversight — admins and super admins watch over brand partners.
 * specs/2026-07-23-partner-oversight
 *
 * A monitoring view, not a management one: it reads each partner's standing,
 * access and sales, and hands off to the existing collaborator screen for
 * changes. A super admin can also open the dashboard as a partner to see
 * exactly what they see.
 */
export default function PartnersOversightClient() {
  const { data: user } = useUser();
  const isSuperAdmin = user?.role === Role.SUPERADMIN;

  const [partners, setPartners] = useState<CollaboratorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('30d');
  const [stats, setStats] = useState<Record<string, StatsState>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [openAsTarget, setOpenAsTarget] = useState<CollaboratorListItem | null>(null);

  // Load the partner list once.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiListCollaborators({ limit: 100 })
      .then((res) => {
        if (!cancelled) setPartners(Array.isArray(res?.items) ? res.items : []);
      })
      .catch((e) => {
        if (!cancelled) setError((e as ApiError).message ?? 'Could not load partners.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load each partner's sales for the chosen period. Reloads when the period
  // changes. Resilient: one partner's failure marks only that row.
  const loadStats = useCallback(
    (list: CollaboratorListItem[], p: Period) => {
      setStats(Object.fromEntries(list.map((c) => [c.id, { status: 'loading' } as StatsState])));
      for (const partner of list) {
        apiGetCollaboratorAnalytics(partner.id, p)
          .then((data) =>
            setStats((prev) => ({ ...prev, [partner.id]: { status: 'ready', data } })),
          )
          .catch(() =>
            setStats((prev) => ({ ...prev, [partner.id]: { status: 'error' } })),
          );
      }
    },
    [],
  );

  useEffect(() => {
    if (partners.length > 0) loadStats(partners, period);
  }, [partners, period, loadStats]);

  const activeCount = useMemo(
    () => partners.filter((p) => p.status === 'ACTIVE').length,
    [partners],
  );

  function statCell(id: string, pick: (a: CollaboratorAnalytics) => string) {
    const s = stats[id];
    if (!s || s.status === 'loading') return <span className="dash-muted">…</span>;
    if (s.status === 'error') return <span className="dash-muted">n/a</span>;
    return <>{pick(s.data)}</>;
  }

  return (
    <div data-trace-id={`${TRACE}::EL-REGION-partners`}>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Partners</h1>
          <p className="dash-help-text" style={{ marginTop: 4 }}>
            Keep an eye on your brand partners — their standing, what they can
            use, and how they are selling.
          </p>
        </div>
        <Link href="/collaborators" className="dash-btn-secondary">
          Manage partners
        </Link>
      </div>

      {notice && <p className="dash-inline-error" style={{ marginBottom: 12 }}>{notice}</p>}

      <div className="dash-filters" role="tablist" aria-label="Time period">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={period === p.id}
            className={period === p.id ? 'dash-btn-primary' : 'dash-btn-secondary'}
            onClick={() => setPeriod(p.id)}
            data-trace-id={`${TRACE}::EL-BTN-period-${p.id}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="dash-card">
          <p className="dash-inline-error">{error}</p>
        </div>
      ) : loading ? (
        <div className="dash-card">
          <p className="dash-muted">Loading partners…</p>
        </div>
      ) : partners.length === 0 ? (
        <div className="dash-card">
          <p style={{ marginTop: 0 }}>You have no brand partners yet.</p>
          <Link href="/collaborators/new" className="dash-btn-primary">
            Add a partner
          </Link>
        </div>
      ) : (
        <>
          <p className="dash-muted" style={{ marginBottom: 16 }}>
            {partners.length} partner{partners.length === 1 ? '' : 's'} · {activeCount} active
          </p>

          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th scope="col">Brand</th>
                  <th scope="col">Status</th>
                  <th scope="col">Access</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Orders</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Revenue</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Live products</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner) => (
                  <tr key={partner.id} className="dash-table-row-hover">
                    <td>
                      <Link
                        href={`/collaborators/${partner.id}`}
                        className="dash-link"
                        data-trace-id={`${TRACE}::EL-LINK-partner@${partner.id}`}
                      >
                        {partner.brandName}
                      </Link>
                      <div className="dash-muted" style={{ fontSize: 12 }}>{partner.email}</div>
                    </td>
                    <td><CollaboratorStatusBadge status={partner.status} /></td>
                    <td><CollaboratorModuleChips modules={partner.modules} /></td>
                    <td style={{ textAlign: 'right' }}>
                      {statCell(partner.id, (a) => String(a.kpis.ordersCount))}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {statCell(partner.id, (a) => formatEgp(a.kpis.revenueCents / 100))}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {statCell(partner.id, (a) => String(a.kpis.productsActive))}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Link
                          href={`/collaborators/${partner.id}`}
                          className="dash-btn-ghost"
                          data-trace-id={`${TRACE}::EL-LINK-manage@${partner.id}`}
                        >
                          Manage
                        </Link>
                        {isSuperAdmin && (
                          <button
                            type="button"
                            className="dash-btn-secondary"
                            onClick={() => setOpenAsTarget(partner)}
                            data-trace-id={`${TRACE}::EL-BTN-open-as@${partner.id}`}
                          >
                            Open as them
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {openAsTarget && (
        <OpenAsPartnerDialog
          partner={openAsTarget}
          onClose={() => setOpenAsTarget(null)}
          onError={(msg) => {
            setNotice(msg);
            setOpenAsTarget(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Confirms the super admin's own password, then opens the dashboard as the
 * partner. The partner's login account is looked up by email — the
 * collaborator record does not carry the user id that sign-in-as needs.
 */
function OpenAsPartnerDialog({
  partner,
  onClose,
  onError,
}: {
  partner: CollaboratorListItem;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const accounts = await listAccounts({ email: partner.email, limit: 1 });
      const account = accounts.data[0];
      if (!account) {
        onError(`Could not find the sign-in account for ${partner.brandName}.`);
        return;
      }
      const result = await signInAsAccount(account.id, password);
      beginActingAs(result.accessToken, result.expiresIn, result.actingAs);
      // Full reload: the sidebar, cached queries and role brief were all built
      // for the super admin, not the partner.
      window.location.href = '/collab/workspace';
    } catch (e) {
      setError((e as ApiError).message ?? 'Could not open that partner.');
      setBusy(false);
    }
  }

  return (
    <section className="dash-card" style={{ marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>Open the dashboard as {partner.brandName}</h2>
      <p style={{ maxWidth: 520 }}>
        You will see exactly what they see, with only what they are allowed to
        open. Your own session is kept safe and a bar at the top switches you
        back. Anything you do while opened as them is recorded against your
        account too.
      </p>
      <form onSubmit={handleSubmit} style={{ maxWidth: 460 }}>
        <div className="dash-field">
          <label className="dash-label" htmlFor="open-as-confirm">
            Your own password <span className="dash-required">*</span>
          </label>
          <input
            id="open-as-confirm"
            className="dash-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            autoComplete="current-password"
            required
            data-trace-id={`${TRACE}::EL-INPUT-open-as-confirm`}
          />
        </div>

        {error && <p className="dash-inline-error">{error}</p>}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="submit"
            className="dash-btn-primary"
            disabled={busy || !password}
            data-trace-id={`${TRACE}::EL-BTN-confirm-open-as`}
          >
            {busy ? 'Opening…' : 'Open as them'}
          </button>
          <button
            type="button"
            className="dash-btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

'use client';

import React, {useState, useCallback } from 'react';
import Link from 'next/link';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';
import { apiAdminListCustomers } from '@/lib/api/customers';
import type { CustomerListItem, TierLevel } from '@/lib/api/customers';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import { useClearNavBadge } from '@/lib/hooks/use-clear-nav-badge';
import { HREF_CATEGORIES } from '@/lib/notifications/nav-counts';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-EG', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

const TIER_DATA_ATTR: Record<TierLevel, string> = {
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
  PLATINUM: 'platinum',
};

function TierBadge({ tier }: { tier: TierLevel }) {
  return (
    <span className="dash-status" data-status={TIER_DATA_ATTR[tier]}>
      <span className="dash-status-dot" />
      {tier.charAt(0) + tier.slice(1).toLowerCase()}
    </span>
  );
}

/**
 * First name then last name — the owner explicitly asked for the real name
 * here, not the customer's chosen display name (a row was showing just
 * "Youssef" for a customer whose full name is "Youssef Abdelrahman", because
 * this used to prefer `displayName`). Falls back to `displayName`, then a
 * truncated id, only when both real names are blank.
 */
function fullName(row: Pick<CustomerListItem, 'firstName' | 'lastName' | 'displayName' | 'customerId'>): string {
  const full = `${row.firstName} ${row.lastName}`.trim();
  if (full) return full;
  if (row.displayName) return row.displayName;
  return row.customerId.slice(0, 8);
}

/** Row shape augmented with the precomputed sort/search key so DashboardTable's
 * generic `row[col.key]` sort can order by the same full name being rendered —
 * `displayName` alone sorted almost nothing, since most rows have it unset. */
type CustomerRow = CustomerListItem & { _fullName: string };

function SkeletonRows() {
  return (
    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              {['Name', 'Tier', 'Lifetime Spend', 'Addresses', 'Joined'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 5 }).map((_, j) => (
                  <td key={j}>
                    <span
                      className="dash-skeleton"
                      style={{ display: 'block', width: j === 0 ? 140 : 80, height: 14 }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TIER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All tiers' },
  { value: 'BRONZE', label: 'Bronze' },
  { value: 'SILVER', label: 'Silver' },
  { value: 'GOLD', label: 'Gold' },
  { value: 'PLATINUM', label: 'Platinum' },
];

/**
 * One customer's picture, or the shared silhouette.
 *
 * Its own component so the error fallback has somewhere to live: a replaced
 * photo lands on a fresh key and its first request is a cold miss through the
 * whole image pipeline, so one failure must degrade to the silhouette rather
 * than leave a broken frame in every row.
 */
function CustomerAvatar({ url }: { url: string | null }) {
  const [errored, setErrored] = React.useState(false);
  React.useEffect(() => setErrored(false), [url]);

  const size = 28;
  if (!url || errored) {
    return (
      <span
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--mr-dash-sub, #f4f1ec)',
          border: '1px solid var(--mr-dash-hair)',
          color: 'var(--mr-dash-sidebar-muted, #8A8376)',
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        {/* A drawn silhouette, not a letter. */}
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M4.8 20c0-3.4 3.2-5.6 7.2-5.6s7.2 2.2 7.2 5.6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      onError={() => setErrored(true)}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0,
        border: '1px solid var(--mr-dash-hair)',
      }}
    />
  );
}

const COLUMNS: Column<CustomerRow>[] = [
  {
    key: '_fullName',
    label: 'Name',
    sortable: true,
    // The face beside the name. A list of names alone is slow to scan when
    // half of them are similar, and the shop already knows what these people
    // look like (owner, 2026-08-21). Generic silhouette when there is no
    // photo — never an initial letter, which is the storefront-wide rule.
    render: (row) => (
      <Link
        href={`/customers/${row.customerId}`}
        className="dash-link"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}
      >
        <CustomerAvatar url={row.avatarUrl} />
        <span style={{ minWidth: 0, overflowWrap: 'break-word' }}>{row._fullName}</span>
      </Link>
    ),
  },
  {
    key: 'tier',
    label: 'Tier',
    render: (row) => <TierBadge tier={row.tier} />,
  },
  {
    key: 'lifetimeSpendAmount',
    label: 'Lifetime Spend',
    sortable: true,
    align: 'right',
    render: (row) => `${row.lifetimeSpendCurrency} ${parseFloat(row.lifetimeSpendAmount).toLocaleString('en-EG', { minimumFractionDigits: 2 })}`,
  },
  {
    key: 'addressCount',
    label: 'Addresses',
    align: 'right',
  },
  {
    key: 'createdAt',
    label: 'Joined',
    sortable: true,
    render: (row) => formatDate(row.createdAt),
  },
  {
    key: '_actions',
    label: '',
    align: 'right',
    render: (row) => (
      <Link href={`/customers/${row.customerId}`} className="dash-btn-ghost">
        View
      </Link>
    ),
  },
];

export default function CustomersClient() {
  // Clears the Customers badge the moment this screen is open, instead of
  // leaving it lit until the next 60s poll — same pattern as Orders/Refunds.
  useClearNavBadge(HREF_CATEGORIES['/customers']);
  const [allCustomers, setAllCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');

  const load = useCallback(async (tier?: TierLevel) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiAdminListCustomers({ limit: 200, tier });
      // Guarded: a response missing this key set state to undefined and the
      // next .map()/.reduce() blanked the whole tab. Same bug as Settings
      // and Loyalty had.
      setAllCustomers(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setError((e as ApiError).message ?? 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useMountedEffect(() => {
    load(tierFilter ? (tierFilter as TierLevel) : undefined);
  }, [load, tierFilter]);

  // First and last name are matched individually — not just as the combined
  // "First Last" string — so a bare surname search ("Abdelrahman") finds a
  // customer even when it's the only word typed. displayName is still checked
  // too, since an admin may know the customer only by their chosen nickname.
  const withFullName: CustomerRow[] = allCustomers.map((c) => ({
    ...c,
    _fullName: fullName(c),
  }));

  const customers = search.trim()
    ? withFullName.filter((c) => {
        const q = search.trim().toLowerCase();
        return (
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q) ||
          (c.displayName ?? '').toLowerCase().includes(q) ||
          c._fullName.toLowerCase().includes(q) ||
          c.customerId.includes(q)
        );
      })
    : withFullName;

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Customers</h1>
      </div>

      <div className="dash-filters">
        <input
          type="search"
          className="dash-input dash-input-search"
          placeholder="Search by name or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="dash-select"
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
        >
          {TIER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <SkeletonRows />
      ) : error ? (
        <div className="dash-card">
          <p className="dash-inline-error">{error}</p>
          <button
            className="dash-btn-secondary"
            style={{ marginTop: 12 }}
            onClick={() => load(tierFilter ? (tierFilter as TierLevel) : undefined)}
          >
            Retry
          </button>
        </div>
      ) : (
        <DashboardTable<CustomerRow>
          columns={COLUMNS}
          data={customers}
          pageSize={25}
          emptyMessage={
            search ? 'No customers match that search.' : 'No customers yet.'
          }
        />
      )}
    </>
  );
}

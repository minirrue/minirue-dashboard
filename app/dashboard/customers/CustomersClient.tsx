'use client';

import React, {useState, useCallback } from 'react';
import Link from 'next/link';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';
import { apiAdminListCustomers } from '@/lib/api/customers';
import type { CustomerListItem, TierLevel } from '@/lib/api/customers';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

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

function displayName(row: CustomerListItem): string {
  if (row.displayName) return row.displayName;
  const full = `${row.firstName} ${row.lastName}`.trim();
  return full || row.customerId.slice(0, 8);
}

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

const COLUMNS: Column<CustomerListItem>[] = [
  {
    key: 'displayName',
    label: 'Name',
    sortable: true,
    render: (row) => (
      <Link href={`/customers/${row.customerId}`} className="dash-link">
        {displayName(row)}
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
      setAllCustomers(res.data);
    } catch (e) {
      setError((e as ApiError).message ?? 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useMountedEffect(() => {
    load(tierFilter ? (tierFilter as TierLevel) : undefined);
  }, [load, tierFilter]);

  const customers = search.trim()
    ? allCustomers.filter((c) => {
        const name = displayName(c).toLowerCase();
        const q = search.trim().toLowerCase();
        return name.includes(q) || c.customerId.includes(q);
      })
    : allCustomers;

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
          style={{ minWidth: 140 }}
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
        <DashboardTable<CustomerListItem>
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

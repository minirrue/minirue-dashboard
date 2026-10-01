'use client';

import React, {useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';
import { SideSheet } from '@/components/dashboard/AnimatedControls';
import { apiAdminGetGuestCustomer, apiAdminListCustomers } from '@/lib/api/customers';
import type {
  CustomerListItem,
  CustomerListRow,
  GuestCustomerDetail,
  GuestCustomerListItem,
  GuestSource,
  TierLevel,
} from '@/lib/api/customers';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import { useClearNavBadge } from '@/lib/hooks/use-clear-nav-badge';
import { HREF_CATEGORIES } from '@/lib/notifications/nav-counts';
import './collected-profiles.css';
import './customers-guests.css';

/** Pages fetched for the client-side table: 10 × 100 rows. */
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

const SOURCE_LABEL: Record<GuestSource, string> = { BOOTH: 'Booth', ONLINE: 'Online' };

/** A buyer with no account. Registered rows carry `registered: true` or nothing. */
function isGuestCustomer<T extends CustomerListRow>(row: T): row is T & GuestCustomerListItem {
  return row.registered === false;
}

function formatMoney(currency: string, amount: string): string {
  return `${currency} ${parseFloat(amount).toLocaleString('en-EG', { minimumFractionDigits: 2 })}`;
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
}

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

/** A buyer with no account has no real first/last name — only what was typed. */
function guestName(row: GuestCustomerListItem): string {
  return row.displayName?.trim() || 'Unnamed buyer';
}

/** Row shape augmented with the precomputed sort/search key so DashboardTable's
 * generic `row[col.key]` sort can order by the same full name being rendered —
 * `displayName` alone sorted almost nothing, since most rows have it unset.
 * `_spend` and `_since` give registered and guest rows one sort key each. */
type CustomerRow = CustomerListRow & { _fullName: string; _spend: number; _since: string };

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

/** "Not registered" plus where they bought and the end of their phone. */
function GuestMeta({ row }: { row: GuestCustomerListItem }) {
  return (
    <span className="cg-meta">
      <span className="collected-status">Not registered</span>
      <span>{row.sources.map((s) => SOURCE_LABEL[s]).join(' & ')}</span>
      {row.phoneTail && <span dir="ltr">••• {row.phoneTail}</span>}
    </span>
  );
}

const buildColumns = (openGuest: (row: GuestCustomerListItem) => void): Column<CustomerRow>[] => [
  {
    key: '_fullName',
    label: 'Name',
    sortable: true,
    // The face beside the name. A list of names alone is slow to scan when
    // half of them are similar, and the shop already knows what these people
    // look like (owner, 2026-08-21). Generic silhouette when there is no
    // photo — never an initial letter, which is the storefront-wide rule.
    render: (row) => isGuestCustomer(row) ? (
      <button type="button" className="dash-link cg-name" onClick={() => openGuest(row)}>
        <CustomerAvatar url={null} />
        <span className="cg-name-text">
          <span>{row._fullName}</span>
          <GuestMeta row={row} />
        </span>
      </button>
    ) : (
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
    render: (row) => isGuestCustomer(row)
      ? <span className="cg-muted">No tier</span>
      : <TierBadge tier={row.tier} />,
  },
  {
    key: '_spend',
    label: 'Lifetime Spend',
    sortable: true,
    align: 'right',
    render: (row) => isGuestCustomer(row) ? (
      <span className="cg-stack cg-stack-end">
        <span>{formatMoney(row.totalSpendCurrency, row.totalSpendAmount)}</span>
        <small className="cg-sub">{plural(row.orderCount, 'order')}</small>
      </span>
    ) : formatMoney(row.lifetimeSpendCurrency, row.lifetimeSpendAmount),
  },
  {
    key: 'addressCount',
    label: 'Addresses',
    align: 'right',
    render: (row) => isGuestCustomer(row)
      ? <span className="cg-muted" aria-label="Not applicable">—</span>
      : row.addressCount,
  },
  {
    key: '_since',
    label: 'Joined',
    sortable: true,
    render: (row) => isGuestCustomer(row) ? (
      <span className="cg-stack">
        <span>{formatDate(row.firstOrderAt)}</span>
        <small className="cg-sub">
          First purchase{formatDate(row.lastOrderAt) !== formatDate(row.firstOrderAt) ? ` · last ${formatDate(row.lastOrderAt)}` : ''}
        </small>
      </span>
    ) : formatDate(row.createdAt),
  },
  {
    key: '_actions',
    label: '',
    align: 'right',
    render: (row) => isGuestCustomer(row) ? (
      <button type="button" className="dash-btn-ghost" onClick={() => openGuest(row)}>
        View orders
      </button>
    ) : (
      <Link href={`/customers/${row.customerId}`} className="dash-btn-ghost">
        View
      </Link>
    ),
  },
];

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  REFUNDED: 'Refunded',
};

/** One unregistered buyer: their orders, and the points waiting on an account. */
function GuestSheet({ guest, onClose }: { guest: GuestCustomerListItem | null; onClose: () => void }) {
  const request = useRef(0);
  const [detail, setDetail] = useState<GuestCustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = guest?.buyerKey ?? null;

  const load = useCallback(async (buyerKey: string) => {
    const mine = ++request.current;
    setDetail(null); setError(null); setLoading(true);
    try {
      const res = await apiAdminGetGuestCustomer(buyerKey);
      if (mine === request.current) setDetail(res);
    } catch (e) {
      if (mine === request.current) setError((e as ApiError).message ?? 'Could not load this buyer\'s orders.');
    } finally {
      if (mine === request.current) setLoading(false);
    }
  }, []);

  useMountedEffect(() => { if (key) void load(key); }, [key, load]);

  const shown = detail ?? guest;
  return (
    <SideSheet
      open={!!guest}
      onClose={onClose}
      title={guest ? guestName(guest) : 'Buyer'}
      description={guest ? `Not registered · ${guest.sources.map((s) => SOURCE_LABEL[s]).join(' & ')}${guest.phoneTail ? ` · phone ending ${guest.phoneTail}` : ''}` : ''}
      footer={<button type="button" className="dash-btn-secondary" onClick={onClose}>Close</button>}
    >
      {shown && (
        <dl className="cg-stats">
          <div><dt>Orders</dt><dd>{shown.orderCount.toLocaleString()}</dd></div>
          <div><dt>Spend</dt><dd>{formatMoney(shown.totalSpendCurrency, shown.totalSpendAmount)}</dd></div>
          <div><dt>Pending points</dt><dd>{detail ? `${detail.pendingPoints.toLocaleString()} pts` : '…'}</dd></div>
        </dl>
      )}
      <p className="collected-explainer">
        No account yet, so nothing has been credited. Pending points are added only after they create an account and claim these orders.
      </p>
      {loading ? (
        <p role="status">Loading orders…</p>
      ) : error ? (
        <div>
          <p className="dash-inline-error" role="alert">{error}</p>
          <button type="button" className="dash-btn-secondary" onClick={() => key && void load(key)}>Try again</button>
        </div>
      ) : detail?.orders.length ? (
        detail.orders.map((order) => (
          <div className="collected-order" key={order.id}>
            <div>
              <Link href={`/orders/${order.id}`}>{order.orderNumber}</Link>
              <small>{SOURCE_LABEL[order.source]} · {STATUS_LABEL[order.status] ?? order.status} · {formatDate(order.createdAt)}</small>
            </div>
            <strong>{formatMoney(order.totalCurrency, order.totalAmount)}</strong>
          </div>
        ))
      ) : detail ? (
        <p>No completed orders for this buyer.</p>
      ) : null}
    </SideSheet>
  );
}

export default function CustomersClient() {
  // Clears the Customers badge the moment this screen is open, instead of
  // leaving it lit until the next 60s poll — same pattern as Orders/Refunds.
  useClearNavBadge(HREF_CATEGORIES['/customers']);
  const [allCustomers, setAllCustomers] = useState<CustomerListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [openGuest, setOpenGuest] = useState<GuestCustomerListItem | null>(null);
  const columns = useMemo(() => buildColumns(setOpenGuest), []);

  const load = useCallback(async (tier?: TierLevel) => {
    setLoading(true);
    setError(null);
    try {
      // The API caps a page at 100, so a single request silently hid every
      // customer past the 100th. Unregistered buyers make that likelier, so
      // fetch the remaining pages too (bounded).
      const first = await apiAdminListCustomers({ page: 1, limit: PAGE_SIZE, tier, includeGuests: true });
      // Guarded: a response missing this key set state to undefined and the
      // next .map()/.reduce() blanked the whole tab. Same bug as Settings
      // and Loyalty had.
      const rows = Array.isArray(first?.data) ? [...first.data] : [];
      const pages = Math.min(MAX_PAGES, Math.ceil((Number(first?.total) || 0) / PAGE_SIZE));
      if (pages > 1) {
        const rest = await Promise.all(
          Array.from({ length: pages - 1 }, (_, i) =>
            apiAdminListCustomers({ page: i + 2, limit: PAGE_SIZE, tier, includeGuests: true }),
          ),
        );
        for (const page of rest) if (Array.isArray(page?.data)) rows.push(...page.data);
      }
      setAllCustomers(rows);
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
  const withFullName: CustomerRow[] = allCustomers.map((c) =>
    isGuestCustomer(c)
      ? { ...c, _fullName: guestName(c), _spend: parseFloat(c.totalSpendAmount) || 0, _since: c.firstOrderAt }
      : { ...c, _fullName: fullName(c), _spend: parseFloat(c.lifetimeSpendAmount) || 0, _since: c.createdAt },
  );
  const guestCount = withFullName.filter(isGuestCustomer).length;

  const customers = search.trim()
    ? withFullName.filter((c) => {
        const q = search.trim().toLowerCase();
        if (isGuestCustomer(c)) {
          return (
            c._fullName.toLowerCase().includes(q) ||
            (c.phoneTail ?? '').includes(q) ||
            'not registered'.includes(q)
          );
        }
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
        <div>
          <h1 className="dash-page-title">Customers</h1>
          {!loading && !error && (
            <p className="dash-page-subtitle">
              {plural(withFullName.length - guestCount, 'account')} · {guestCount.toLocaleString()} not registered
            </p>
          )}
        </div>
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
          columns={columns}
          data={customers}
          pageSize={25}
          emptyMessage={
            search ? 'No customers match that search.' : 'No customers yet.'
          }
        />
      )}
      <GuestSheet guest={openGuest} onClose={() => setOpenGuest(null)} />
    </>
  );
}

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { apiAdminListOrders, type Order } from '@/lib/api/orders';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import FulfillmentControl from '@/components/dashboard/FulfillmentControl';
import { formatOrderRef } from '@/lib/orders/order-format';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-EG', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

const FULFILLMENT_FILTERS = [
  { value: 'UNFULFILLED', label: 'Awaiting fulfillment' },
  { value: 'FULFILLED', label: 'Fulfilled' },
  { value: '', label: 'All orders' },
] as const;

export default function ManualFulfillmentPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('UNFULFILLED');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiAdminListOrders({ q: q || undefined, limit: 100 });
      setOrders(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setError((e as ApiError).message ?? 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useMountedEffect(() => { load(debouncedSearch || undefined); }, [load, debouncedSearch]);

  const handleUpdated = useCallback((updated: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setActionError(null);
  }, []);

  // Filtering client-side: the backend has no fulfillment_status query param
  // and the admin list is capped at 100 rows anyway.
  const visible = filter
    ? orders.filter((o) => o.fulfillmentStatus === filter)
    : orders;

  return (
    <>
      {actionError && (
        <p className="dash-inline-error" style={{ marginBottom: 12 }}>{actionError}</p>
      )}

      <div className="dash-filters">
        <input
          className="dash-input"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order # or MR-…"
          aria-label="Search orders by reference"
          style={{ minWidth: 220 }}
        />
        <select
          className="dash-select"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter by fulfillment state"
          style={{ minWidth: 190 }}
        >
          {FULFILLMENT_FILTERS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="dash-card">
          <span className="dash-skeleton" style={{ display: 'block', width: '50%', height: 14 }} />
        </div>
      ) : error ? (
        <div className="dash-card">
          <p className="dash-inline-error">{error}</p>
          <button
            className="dash-btn-secondary"
            style={{ marginTop: 12 }}
            onClick={() => load(debouncedSearch || undefined)}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Fulfillment</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="dash-table-empty">
                      {debouncedSearch
                        ? `No order matches "${debouncedSearch}".`
                        : 'Nothing here right now.'}
                    </td>
                  </tr>
                ) : (
                  visible.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/orders/${o.id}`} className="dash-link">
                          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                            {formatOrderRef(o)}
                          </span>
                          <span style={{ color: 'var(--mr-fg-4)', fontSize: 12, marginLeft: 8 }}>
                            {o.orderNumber}
                          </span>
                        </Link>
                      </td>
                      <td style={{ color: 'var(--mr-fg-3)' }}>
                        {o.guestContact?.fullName ?? o.shippingAddressSnapshot?.fullName ?? '—'}
                      </td>
                      <td style={{ color: 'var(--mr-fg-3)' }}>{o.status}</td>
                      <td style={{ color: 'var(--mr-fg-3)' }}>{formatDate(o.createdAt)}</td>
                      <td>
                        <FulfillmentControl
                          order={o}
                          onUpdated={handleUpdated}
                          onError={setActionError}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

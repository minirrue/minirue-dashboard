'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { apiAdminListOrders, type Order } from '@/lib/api/orders';
import type { RefundTicketDto } from '@/lib/api/refunds';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import { formatOrderRef } from '@/lib/orders/order-format';
import RefundOrderModal from '@/components/dashboard/RefundOrderModal';

function egpFromCents(cents: number): string {
  return `EGP ${(cents / 100).toLocaleString('en-EG', { minimumFractionDigits: 2 })}`;
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-EG', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

const REFUND_FILTERS = [
  { value: '', label: 'All orders' },
  { value: 'NOT_REFUNDED', label: 'Not refunded' },
  { value: 'REFUNDED', label: 'Refunded' },
] as const;

/**
 * Owner's requirement: every order shows up here and can be refunded —
 * fulfilled or not. So this lists orders, not refund tickets (that is the
 * History tab) — per assumption A1, tapping Refund is what creates a ticket.
 */
export default function RefundableOrdersPanel({
  onRefunded,
}: {
  onRefunded: (ticket: RefundTicketDto) => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [refunding, setRefunding] = useState<Order | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
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

  useMountedEffect(() => { load(debounced || undefined); }, [load, debounced]);

  const handleRefunded = useCallback((ticket: RefundTicketDto) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === ticket.orderId
          ? {
              ...o,
              refundedAt: new Date().toISOString(),
              refundedAmountCents: ticket.approvedAmountCents ?? ticket.requestedAmountCents,
            }
          : o,
      ),
    );
    setRefunding(null);
    onRefunded(ticket);
  }, [onRefunded]);

  const visible = orders.filter((o) => {
    if (filter === 'REFUNDED') return Boolean(o.refundedAt);
    if (filter === 'NOT_REFUNDED') return !o.refundedAt;
    return true;
  });

  return (
    <>
      <div className="dash-filters">
        <input
          className="dash-input"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order # or MR-…"
          aria-label="Search orders by reference"
          style={{ maxWidth: '100%' }}
        />
        <select
          className="dash-select"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter by refund state"
          style={{ maxWidth: '100%' }}
        >
          {REFUND_FILTERS.map((o) => (
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
          <button className="dash-btn-secondary" style={{ marginTop: 12 }} onClick={() => load(debounced || undefined)}>
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
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Date</th>
                  <th>Refund</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="dash-table-empty">
                      {debounced ? `No order matches "${debounced}".` : 'No orders yet.'}
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
                        {/* Walk-in orders have no customer account — guestContact
                            is the only source of a name for those. */}
                        {o.guestContact?.fullName ?? o.shippingAddressSnapshot?.fullName ?? '—'}
                      </td>
                      <td style={{ color: 'var(--mr-fg-3)' }}>{o.status}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {o.totalCurrency} {parseFloat(o.totalAmount).toLocaleString('en-EG', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ color: 'var(--mr-fg-3)' }}>{formatDate(o.createdAt)}</td>
                      <td>
                        {o.refundedAt ? (
                          <span className="dash-status" data-status="cancelled">
                            <span className="dash-status-dot" />
                            {egpFromCents(o.refundedAmountCents)} refunded
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="dash-btn-ghost"
                            onClick={() => setRefunding(o)}
                          >
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {refunding && (
        <RefundOrderModal
          order={refunding}
          onClose={() => setRefunding(null)}
          onRefunded={handleRefunded}
        />
      )}
    </>
  );
}

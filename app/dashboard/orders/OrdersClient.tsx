'use client';

import React, {useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';
import { apiAdminListOrders, apiAdminTransitionStatus } from '@/lib/api/orders';
import type { Order, OrderStatus } from '@/lib/api/orders';
import type { ApiError } from '@/lib/api/client';
import { ORDER_TRANSITIONS, formatOrderStatus } from '@/lib/orders/transitions';
import { formatOrderRef } from '@/lib/orders/order-format';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import { useClearNavBadge } from '@/lib/hooks/use-clear-nav-badge';
import { HREF_CATEGORIES } from '@/lib/notifications/nav-counts';
import ManualOrderModal from './ManualOrderModal';
import InternalOrderBadge from '@/components/dashboard/InternalOrderBadge';
import RowActionsMenu from '@/components/dashboard/RowActionsMenu';

function formatAmount(amount: string, currency: string): string {
  return `${currency} ${parseFloat(amount).toLocaleString('en-EG', { minimumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const STATUS_DATA_ATTR: Record<OrderStatus, string> = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  // Reuses the cancelled tone: both mean "this order is not money we kept".
  REFUNDED: 'cancelled',
};

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className="dash-status" data-status={STATUS_DATA_ATTR[status]}>
      <span className="dash-status-dot" />
      {formatOrderStatus(status)}
    </span>
  );
}

/** Never disagrees with the order detail page or the Refunds tab: a refund on
 * this order overrides whatever `status` still says, even for a row no repair
 * migration touched. */
function shownStatus(order: Order): OrderStatus {
  return order.refundedAt ? 'REFUNDED' : order.status;
}

/**
 * The button names the ACTION, not the destination status (#124) — "Confirm",
 * not "Confirmed". Any status this map has no entry for (there is none today)
 * falls back to formatOrderStatus, so a future status never renders a blank
 * button.
 */
const NEXT_STEP_ACTION: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'Confirm',
  PROCESSING: 'Mark ready',
  SHIPPED: 'Out for delivery',
  DELIVERED: 'Mark delivered',
  CANCELLED: 'Cancel',
};

/** The one transition that moves the order forward in its normal sequence —
 * everything else (today, only CANCELLED) is a deviation, not a "next step",
 * and belongs in the row's "…" menu instead of the row-end button. */
function primaryTransition(status: OrderStatus): OrderStatus | null {
  return ORDER_TRANSITIONS[status].find((s) => s !== 'CANCELLED') ?? null;
}

function menuTransitions(status: OrderStatus): OrderStatus[] {
  return ORDER_TRANSITIONS[status].filter((s) => s !== primaryTransition(status));
}

/**
 * Row-end order actions (#124): the Status column now holds only the chip,
 * and this is where advancing an order actually happens — one button naming
 * the next step in sequence, rarer transitions (cancel) in the "…" menu, and
 * the existing View link. No button at all for a terminal order.
 */
function OrderRowActions({
  order,
  onTransition,
  onError,
}: {
  order: Order;
  onTransition: (updated: Order) => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const next = primaryTransition(order.status);
  const rest = menuTransitions(order.status);

  const transition = useCallback(
    (status: OrderStatus) => {
      setBusy(true);
      void apiAdminTransitionStatus(order.id, status)
        .then(onTransition)
        .catch((err: ApiError) => onError(err.message ?? 'Invalid status transition'))
        .finally(() => setBusy(false));
    },
    [order.id, onTransition, onError],
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
      {next && (
        <button
          type="button"
          className="dash-btn-secondary"
          disabled={busy}
          onClick={() => transition(next)}
          style={{ fontSize: 12, padding: '6px 10px' }}
        >
          {NEXT_STEP_ACTION[next] ?? formatOrderStatus(next)} →
        </button>
      )}
      {rest.length > 0 && (
        <RowActionsMenu
          label={`More actions for ${order.orderNumber}`}
          items={rest.map((status) => ({
            key: status,
            label: `${NEXT_STEP_ACTION[status] ?? formatOrderStatus(status)}${status === 'CANCELLED' ? '' : ' →'}`,
            tone: status === 'CANCELLED' ? 'danger' : undefined,
            disabled: busy,
            onClick: () => transition(status),
          }))}
        />
      )}
      <Link href={`/orders/${order.id}`} className="dash-btn-ghost">
        View
      </Link>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              {['Order', 'Customer', 'Channel', 'Status', 'Fulfillment', 'Total', 'Date', ''].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 8 }).map((_, j) => (
                  <td key={j}>
                    <span
                      className="dash-skeleton"
                      style={{ display: 'block', width: j === 0 ? 80 : j === 1 ? 140 : 70, height: 14 }}
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

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REFUNDED', label: 'Refunded' },
];

export default function OrdersClient() {
  // Clears the Orders badge (ORDER + PAYMENT) the moment this screen is
  // open, instead of leaving it lit until the next 60s poll.
  useClearNavBadge(HREF_CATEGORIES['/orders']);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [manualOpen, setManualOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState<'' | 'ONLINE' | 'MANUAL'>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // 300ms so typing "1024" is one request, not four.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(
    async (status?: string, channel?: 'ONLINE' | 'MANUAL', q?: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiAdminListOrders({
          status: status ? (status as OrderStatus) : undefined,
          channel,
          q: q || undefined,
          limit: 100,
        });
        // Guarded: a response missing this key set state to undefined and the
        // next .map()/.reduce() blanked the whole tab. Same bug as Settings
        // and Loyalty had.
        setOrders(Array.isArray(res?.data) ? res.data : []);
      } catch (e) {
        const err = e as ApiError;
        setError(err.message ?? 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useMountedEffect(() => {
    load(statusFilter || undefined, channelFilter || undefined, debouncedSearch || undefined);
  }, [load, statusFilter, channelFilter, debouncedSearch]);

  const handleOrderUpdated = useCallback((updated: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setTransitionError(null);
  }, []);

  const columns = useMemo<Column<Order>[]>(
    () => [
      {
        key: 'orderSeq',
        label: 'Order',
        sortable: true,
        render: (row) => (
          <Link href={`/orders/${row.id}`} className="dash-order-reference-link">
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
              {formatOrderRef(row)}
            </span>
            <span style={{ color: 'var(--mr-fg-4)', fontSize: 12, marginLeft: 8 }}>
              {row.orderNumber}
            </span>
            {row.isInternal ? <InternalOrderBadge /> : null}
          </Link>
        ),
      },
      {
        key: 'customer',
        label: 'Customer',
        render: (row) =>
          row.guestContact?.fullName ??
          row.shippingAddressSnapshot?.fullName ??
          '—',
      },
      {
        key: 'channel',
        label: 'Channel',
        render: (row) =>
          row.channel === 'MANUAL' ? (
            <span className="dash-status" data-status="processing">
              <span className="dash-status-dot" />
              Manual
            </span>
          ) : (
            <span style={{ color: 'var(--mr-fg-3)' }}>Storefront</span>
          ),
      },
      {
        key: 'status',
        label: 'Status',
        // Read-only chip only (#124): advancing the order moved to the
        // row-end button/menu in the '' column below.
        render: (row) => <OrderStatusBadge status={shownStatus(row)} />,
      },
      {
        key: 'fulfillment',
        label: 'Fulfillment',
        // Read-only: the channel the customer chose at checkout (#103).
        // Assigning who fulfils the order happens on the Fulfillment
        // screen (#96), not here.
        render: (row) => (
          <span style={{ color: 'var(--mr-fg-3)' }}>
            {row.delivery?.method === 'SAME_DAY' ? 'Same-day' : 'Standard'}
          </span>
        ),
      },
      {
        key: 'totalAmount',
        label: 'Total',
        sortable: true,
        align: 'right',
        render: (row) => formatAmount(row.totalAmount, row.totalCurrency),
      },
      {
        key: 'createdAt',
        label: 'Date',
        sortable: true,
        render: (row) => formatDate(row.createdAt),
      },
      {
        key: '_actions',
        label: '',
        align: 'right',
        render: (row) => (
          <OrderRowActions order={row} onTransition={handleOrderUpdated} onError={setTransitionError} />
        ),
      },
    ],
    [handleOrderUpdated],
  );

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Orders</h1>
        <button type="button" className="dash-btn-primary" onClick={() => setManualOpen(true)}>
          New manual order
        </button>
      </div>

      <div className="dash-filters">
        <input
          className="dash-input"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order # or MR-…"
          aria-label="Search orders by reference"
        />
        <select
          className="dash-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="dash-select"
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value as '' | 'ONLINE' | 'MANUAL')}
          aria-label="Filter by channel"
        >
          <option value="">All channels</option>
          <option value="ONLINE">Storefront</option>
          <option value="MANUAL">Manual</option>
        </select>
      </div>

      {transitionError && (
        <p className="dash-inline-error" style={{ marginBottom: 12 }}>
          {transitionError}
        </p>
      )}

      {loading ? (
        <SkeletonRows />
      ) : error ? (
        <div className="dash-card">
          <p className="dash-inline-error">{error}</p>
          <button
            className="dash-btn-secondary"
            style={{ marginTop: 12 }}
            onClick={() => load(statusFilter || undefined, channelFilter || undefined, debouncedSearch || undefined)}
          >
            Retry
          </button>
        </div>
      ) : (
        <DashboardTable<Order>
          columns={columns}
          data={orders}
          pageSize={20}
          emptyMessage={
            debouncedSearch
              ? `No order matches "${debouncedSearch}".`
              : statusFilter
                ? 'No orders match the selected status.'
                : 'No orders yet.'
          }
        />
      )}

      {manualOpen && (
        <ManualOrderModal
          onClose={() => setManualOpen(false)}
          onCreated={(order) => {
            setManualOpen(false);
            setOrders((prev) => [order, ...prev]);
          }}
        />
      )}
    </>
  );
}

'use client';

import React, {useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';
import { apiAdminListOrders, apiAdminTransitionStatus } from '@/lib/api/orders';
import type { Order, OrderStatus } from '@/lib/api/orders';
import type { ApiError } from '@/lib/api/client';
import { ORDER_TRANSITIONS, formatOrderStatus } from '@/lib/orders/transitions';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import ManualOrderModal from './ManualOrderModal';

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
};

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className="dash-status" data-status={STATUS_DATA_ATTR[status]}>
      <span className="dash-status-dot" />
      {formatOrderStatus(status)}
    </span>
  );
}

function OrderStatusCell({
  order,
  onTransition,
  onError,
}: {
  order: Order;
  onTransition: (updated: Order) => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const next = ORDER_TRANSITIONS[order.status];

  if (next.length === 0) {
    return <OrderStatusBadge status={order.status} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
      <OrderStatusBadge status={order.status} />
      <select
        className="dash-select"
        disabled={busy}
        defaultValue=""
        aria-label={`Update status for ${order.orderNumber}`}
        onChange={(e) => {
          const value = e.target.value as OrderStatus;
          if (!value) return;
          setBusy(true);
          void apiAdminTransitionStatus(order.id, value)
            .then(onTransition)
            .catch((err: ApiError) => {
              onError(err.message ?? 'Invalid status transition');
              e.target.value = '';
            })
            .finally(() => setBusy(false));
        }}
        style={{ fontSize: 12, padding: '4px 8px' }}
      >
        <option value="">Advance…</option>
        {next.map((status) => (
          <option key={status} value={status}>
            → {formatOrderStatus(status)}
          </option>
        ))}
      </select>
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
              {['Order', 'Customer', 'Status', 'Total', 'Date', ''].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
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
];

export default function OrdersClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [manualOpen, setManualOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState<'' | 'ONLINE' | 'MANUAL'>('');

  const load = useCallback(async (status?: string, channel?: 'ONLINE' | 'MANUAL') => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiAdminListOrders({
        status: status ? (status as OrderStatus) : undefined,
        channel,
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
  }, []);

  useMountedEffect(() => {
    load(statusFilter || undefined, channelFilter || undefined);
  }, [load, statusFilter, channelFilter]);

  const handleOrderUpdated = useCallback((updated: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setTransitionError(null);
  }, []);

  const columns = useMemo<Column<Order>[]>(
    () => [
      {
        key: 'orderNumber',
        label: 'Order',
        sortable: true,
        render: (row) => (
          <Link href={`/orders/${row.id}`} className="dash-link">
            {row.orderNumber}
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
        render: (row) => (
          <OrderStatusCell
            order={row}
            onTransition={handleOrderUpdated}
            onError={setTransitionError}
          />
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
          <Link href={`/orders/${row.id}`} className="dash-btn-ghost">
            View
          </Link>
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
        <select
          className="dash-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ minWidth: 160 }}
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
          style={{ minWidth: 160 }}
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
            onClick={() => load(statusFilter || undefined)}
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
            statusFilter
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

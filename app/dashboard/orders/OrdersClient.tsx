'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';
import { apiAdminListOrders } from '@/lib/api/orders';
import type { Order, OrderStatus } from '@/lib/api/orders';
import type { ApiError } from '@/lib/api/client';

/* ── Helpers ── */

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
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

/* ── Skeleton ── */
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

/* ── Filter options ── */
const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

/* ── Columns ── */
const COLUMNS: Column<Order>[] = [
  {
    key: 'orderNumber',
    label: 'Order',
    sortable: true,
    render: (row) => (
      <Link href={`/dashboard/orders/${row.id}`} className="dash-link">
        {row.orderNumber}
      </Link>
    ),
  },
  { key: 'status', label: 'Status', render: (row) => <OrderStatusBadge status={row.status} /> },
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
      <Link href={`/dashboard/orders/${row.id}`} className="dash-btn-ghost">
        View
      </Link>
    ),
  },
];

/* ── Component ── */
export default function OrdersClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const load = useCallback(async (status?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiAdminListOrders({
        status: status ? (status as OrderStatus) : undefined,
        limit: 100,
      });
      setOrders(res.data);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message ?? 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(statusFilter || undefined);
  }, [load, statusFilter]);

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Orders</h1>
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
      </div>

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
          columns={COLUMNS}
          data={orders}
          pageSize={20}
          emptyMessage={
            statusFilter
              ? 'No orders match the selected status.'
              : 'No orders yet.'
          }
        />
      )}
    </>
  );
}

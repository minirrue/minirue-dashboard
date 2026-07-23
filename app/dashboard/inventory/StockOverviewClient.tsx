'use client';

import React, {useState, useCallback } from 'react';
import Link from 'next/link';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';
import { listStockAdmin, stockStatus } from '@/lib/inventory/api';
import type { StockAdminRow, StockStatus } from '@/lib/inventory/api';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

/* ── Skeleton ── */
function SkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              {['Variant ID', 'Warehouse', 'On Hand', 'Reserved', 'Available', 'Threshold', 'Status'].map(
                (h) => <th key={h}>{h}</th>,
              )}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: count }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <td key={j}>
                    <span className="dash-skeleton" style={{ display: 'block', width: j === 0 ? 140 : 60, height: 14 }} />
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

/* ── Status badge for inventory levels ── */
function StockStatusBadge({ status }: { status: StockStatus }) {
  const MAP: Record<StockStatus, { label: string; dataStatus: string }> = {
    OK:  { label: 'OK',  dataStatus: 'published' },
    LOW: { label: 'Low', dataStatus: 'draft' },
    OUT: { label: 'Out', dataStatus: 'archived' },
  };
  const { label, dataStatus } = MAP[status];
  return (
    <span className="dash-status" data-status={dataStatus}>
      <span className="dash-status-dot" />
      {label}
    </span>
  );
}

const STATUS_ORDER: Record<StockStatus, number> = { OUT: 0, LOW: 1, OK: 2 };

type WarehouseOption = '' | string;
type StatusFilter = '' | StockStatus;

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'OUT', label: 'Out of stock' },
  { value: 'LOW', label: 'Low stock' },
  { value: 'OK', label: 'OK' },
];

interface StockRow extends StockAdminRow {
  _status: StockStatus;
}

const COLUMNS: Column<StockRow>[] = [
  {
    key: 'variantId',
    label: 'Variant ID',
    sortable: true,
    render: (row) => <code style={{ fontSize: 11 }}>{row.variantId.slice(0, 8)}…</code>,
  },
  {
    key: 'warehouseName',
    label: 'Warehouse',
    sortable: true,
  },
  {
    key: 'qtyOnHand',
    label: 'On Hand',
    align: 'right' as const,
    sortable: true,
  },
  {
    key: 'qtyReserved',
    label: 'Reserved',
    align: 'right' as const,
    sortable: true,
  },
  {
    key: 'qtyAvailable',
    label: 'Available',
    align: 'right' as const,
    sortable: true,
    render: (row) => (
      <span style={{ fontWeight: row._status !== 'OK' ? 600 : undefined }}>
        {row.qtyAvailable}
      </span>
    ),
  },
  {
    key: 'qtyThreshold',
    label: 'Threshold',
    align: 'right' as const,
    sortable: true,
  },
  {
    key: '_status',
    label: 'Status',
    render: (row) => <StockStatusBadge status={row._status} />,
  },
];

export default function StockOverviewClient() {
  const [allItems, setAllItems] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [warehouseFilter, setWarehouseFilter] = useState<WarehouseOption>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listStockAdmin({ limit: 200 });
      const rows: StockRow[] = res.data.map((r) => ({ ...r, _status: stockStatus(r) }));
      const sorted = [...rows].sort(
        (a, b) => STATUS_ORDER[a._status] - STATUS_ORDER[b._status],
      );
      setAllItems(sorted);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message ?? 'Failed to load stock data');
    } finally {
      setLoading(false);
    }
  }, []);

  useMountedEffect(() => {
    load();
  }, [load]);

  const warehouseOptions = Array.from(new Set(allItems.map((r) => r.warehouseName))).sort();

  const items = allItems.filter((row) => {
    if (warehouseFilter && row.warehouseName !== warehouseFilter) return false;
    if (statusFilter && row._status !== statusFilter) return false;
    return true;
  });

  const lowCount = allItems.filter((r) => r._status === 'LOW').length;
  const outCount = allItems.filter((r) => r._status === 'OUT').length;

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Inventory</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/inventory/receive" className="dash-btn-primary">
            Receive Stock
          </Link>
          <Link href="/inventory/movements" className="dash-btn-secondary">
            Movements
          </Link>
          <Link href="/inventory/warehouses" className="dash-btn-secondary">
            Warehouses
          </Link>
        </div>
      </div>

      {!loading && !error && (outCount > 0 || lowCount > 0) && (
        <div className="dash-filters" style={{ marginBottom: 8 }}>
          {outCount > 0 && (
            <span className="dash-status" data-status="archived">
              <span className="dash-status-dot" />
              {outCount} out of stock
            </span>
          )}
          {lowCount > 0 && (
            <span className="dash-status" data-status="draft">
              <span className="dash-status-dot" />
              {lowCount} low stock
            </span>
          )}
        </div>
      )}

      <div className="dash-filters">
        <select
          className="dash-select"
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
        >
          <option value="">All warehouses</option>
          {warehouseOptions.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        <select
          className="dash-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <SkeletonRows />
      ) : error ? (
        <div className="dash-card">
          <p className="dash-inline-error">{error}</p>
          <button className="dash-btn-secondary" style={{ marginTop: 12 }} onClick={load}>
            Retry
          </button>
        </div>
      ) : (
        <DashboardTable<StockRow>
          columns={COLUMNS}
          data={items}
          pageSize={25}
          emptyMessage={
            statusFilter || warehouseFilter
              ? 'No items match the current filters.'
              : 'No inventory records found. Receive stock to get started.'
          }
        />
      )}
    </>
  );
}

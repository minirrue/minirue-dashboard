'use client';

import React, {useState, useCallback } from 'react';
import Link from 'next/link';
import { apiAdminListShipments, apiUpdateShipmentStatus } from '@/lib/api/fulfillment';
import type { AdminShipmentRow, ShipmentStatus } from '@/lib/api/fulfillment';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-EG', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

const STATUS_DATA_ATTR: Record<ShipmentStatus, string> = {
  CREATED: 'pending',
  PICKED_UP: 'confirmed',
  IN_TRANSIT: 'processing',
  OUT_FOR_DELIVERY: 'processing',
  DELIVERED: 'delivered',
  FAILED_ATTEMPT: 'cancelled',
  RETURNED: 'cancelled',
};

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  CREATED: 'Created',
  PICKED_UP: 'Picked Up',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  FAILED_ATTEMPT: 'Failed',
  RETURNED: 'Returned',
};

function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  return (
    <span className="dash-status" data-status={STATUS_DATA_ATTR[status]}>
      <span className="dash-status-dot" />
      {STATUS_LABELS[status]}
    </span>
  );
}

const NEXT_STATUSES: Partial<Record<ShipmentStatus, ShipmentStatus[]>> = {
  CREATED: ['PICKED_UP'],
  PICKED_UP: ['IN_TRANSIT', 'FAILED_ATTEMPT'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'FAILED_ATTEMPT'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED_ATTEMPT'],
  FAILED_ATTEMPT: ['IN_TRANSIT', 'RETURNED'],
};

function StatusUpdater({
  row,
  onUpdate,
}: {
  row: AdminShipmentRow;
  onUpdate: (id: string, status: ShipmentStatus) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const next = NEXT_STATUSES[row.status];
  if (!next || next.length === 0) return <span style={{ color: 'var(--mr-fg-4)', fontSize: 13 }}>—</span>;

  return (
    <div className="dash-row-actions">
      {next.map((s) => (
        <button
          key={s}
          className="dash-btn-ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onUpdate(row.id, s);
            setBusy(false);
          }}
        >
          {STATUS_LABELS[s]}
        </button>
      ))}
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
              {['Order ID', 'Status', 'Courier', 'Tracking', 'Est. Delivery', 'Action'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j}>
                    <span className="dash-skeleton" style={{ display: 'block', width: j === 0 ? 80 : 90, height: 14 }} />
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
  { value: 'CREATED', label: 'Created' },
  { value: 'PICKED_UP', label: 'Picked Up' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'FAILED_ATTEMPT', label: 'Failed' },
  { value: 'RETURNED', label: 'Returned' },
];

export default function FulfillmentClient() {
  const [shipments, setShipments] = useState<AdminShipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [updateError, setUpdateError] = useState<string | null>(null);

  const load = useCallback(async (status?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiAdminListShipments({
        status: status ? (status as ShipmentStatus) : undefined,
        limit: 100,
      });
      setShipments(res.data);
    } catch (e) {
      setError((e as ApiError).message ?? 'Failed to load shipments');
    } finally {
      setLoading(false);
    }
  }, []);

  useMountedEffect(() => { load(statusFilter || undefined); }, [load, statusFilter]);

  const handleUpdate = useCallback(async (id: string, status: ShipmentStatus) => {
    setUpdateError(null);
    try {
      const updated = await apiUpdateShipmentStatus(id, status);
      setShipments((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (e) {
      setUpdateError((e as ApiError).message ?? 'Failed to update shipment');
    }
  }, []);

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Fulfillment</h1>
      </div>

      {updateError && (
        <p className="dash-inline-error" style={{ marginBottom: 12 }}>{updateError}</p>
      )}

      <div className="dash-filters">
        <select
          className="dash-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ minWidth: 180 }}
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
          <button className="dash-btn-secondary" style={{ marginTop: 12 }} onClick={() => load(statusFilter || undefined)}>
            Retry
          </button>
        </div>
      ) : (
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Status</th>
                  <th>Courier</th>
                  <th>Tracking</th>
                  <th>Est. Delivery</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {shipments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="dash-table-empty">
                      {statusFilter ? 'No shipments match the selected status.' : 'No shipments yet.'}
                    </td>
                  </tr>
                ) : (
                  shipments.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link href={`/orders/${row.orderId}`} className="dash-link">
                          {row.orderId.slice(0, 8)}…
                        </Link>
                      </td>
                      <td><ShipmentStatusBadge status={row.status} /></td>
                      <td style={{ color: 'var(--mr-fg-3)' }}>{row.courierName ?? '—'}</td>
                      <td>
                        {row.trackingNumber ? (
                          <code style={{ fontSize: 12 }}>{row.trackingNumber}</code>
                        ) : (
                          <span style={{ color: 'var(--mr-fg-4)' }}>—</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--mr-fg-3)' }}>{formatDate(row.estimatedDeliveryAt)}</td>
                      <td>
                        <StatusUpdater row={row} onUpdate={handleUpdate} />
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

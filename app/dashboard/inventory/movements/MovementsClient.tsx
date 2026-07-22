'use client';

import React, {useState, useCallback } from 'react';
import Link from 'next/link';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';
import { listMovements } from '@/lib/inventory/api';
import type { MovementRow, MovementType } from '@/lib/inventory/api';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

function SkeletonRows({ count = 10 }: { count?: number }) {
  return (
    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              {['Date', 'Type', 'Stock Item', 'Qty Delta', 'Reference', 'Actor'].map(
                (h) => <th key={h}>{h}</th>,
              )}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: count }).map((_, i) => (
              <tr key={i}>
                {[90, 90, 160, 60, 140, 80].map((w, j) => (
                  <td key={j}>
                    <span className="dash-skeleton" style={{ display: 'block', width: w, height: 14 }} />
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

const TYPE_BADGE_STATUS: Record<MovementType, string> = {
  RECEIVE:  'published',
  RESERVE:  'draft',
  RELEASE:  'confirmed',
  ADJUST:   'archived',
};

const TYPE_LABELS: Record<MovementType, string> = {
  RECEIVE:  'Receive',
  RESERVE:  'Reserve',
  RELEASE:  'Release',
  ADJUST:   'Adjust',
};

function MovementTypeBadge({ type }: { type: MovementType }) {
  return (
    <span className="dash-status" data-status={TYPE_BADGE_STATUS[type] ?? 'pending'}>
      <span className="dash-status-dot" />
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

function DeltaCell({ delta }: { delta: number }) {
  const positive = delta > 0;
  return (
    <span style={{ fontWeight: 600, color: positive ? 'var(--mr-st-ok-fg)' : 'var(--mr-st-danger-fg)' }}>
      {positive ? '+' : ''}{delta}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const TYPE_OPTIONS: Array<{ value: '' | MovementType; label: string }> = [
  { value: '', label: 'All types' },
  { value: 'RECEIVE', label: 'Receive' },
  { value: 'RESERVE', label: 'Reserve' },
  { value: 'RELEASE', label: 'Release' },
  { value: 'ADJUST',  label: 'Adjust' },
];

const COLUMNS: Column<MovementRow>[] = [
  {
    key: 'createdAt',
    label: 'Date',
    sortable: true,
    render: (row) => <span style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{formatDate(row.createdAt)}</span>,
  },
  {
    key: 'movementType',
    label: 'Type',
    render: (row) => <MovementTypeBadge type={row.movementType} />,
  },
  {
    key: 'stockItemId',
    label: 'Stock Item',
    render: (row) => <code style={{ fontSize: 11 }}>{row.stockItemId.slice(0, 8)}…</code>,
  },
  {
    key: 'qtyDelta',
    label: 'Qty Delta',
    align: 'right' as const,
    sortable: true,
    render: (row) => <DeltaCell delta={row.qtyDelta} />,
  },
  {
    key: 'referenceId',
    label: 'Reference',
    render: (row) => (
      <span style={{ fontSize: 12, color: 'var(--mr-fg-3)' }}>
        {row.referenceId ?? '—'}
      </span>
    ),
  },
  {
    key: 'actorUserId',
    label: 'Actor',
    render: (row) => <span style={{ fontSize: 12, color: 'var(--mr-fg-4)' }}>{row.actorUserId ?? '—'}</span>,
  },
];

export default function MovementsClient() {
  const [items, setItems] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'' | MovementType>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listMovements({ movementType: typeFilter || undefined, limit: 100 });
      // Guarded: a response missing this key set state to undefined and the
      // next .map()/.reduce() blanked the whole tab. Same bug as Settings
      // and Loyalty had.
      setItems(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message ?? 'Failed to load movement history');
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useMountedEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Movement History</h1>
        <Link href="/inventory" className="dash-btn-secondary">Back to Inventory</Link>
      </div>

      <div className="dash-filters">
        <select
          className="dash-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as '' | MovementType)}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <SkeletonRows />
      ) : error ? (
        <div className="dash-card">
          <p className="dash-inline-error">{error}</p>
          <button className="dash-btn-secondary" style={{ marginTop: 12 }} onClick={load}>Retry</button>
        </div>
      ) : (
        <DashboardTable<MovementRow>
          columns={COLUMNS}
          data={items}
          pageSize={25}
          emptyMessage="No movement records found."
        />
      )}
    </>
  );
}

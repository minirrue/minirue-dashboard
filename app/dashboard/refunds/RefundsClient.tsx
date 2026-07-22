'use client';

import React, {useState, useCallback } from 'react';
import Link from 'next/link';
import {
  apiAdminListRefunds,
  apiAdminReviewRefund,
  apiAdminMarkRefunded,
} from '@/lib/api/refunds';
import type { RefundTicketDto, RefundStatus, RefundMethod } from '@/lib/api/refunds';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

function egp(cents: number): string {
  return `EGP ${(cents / 100).toLocaleString('en-EG', { minimumFractionDigits: 2 })}`;
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_DATA_ATTR: Record<RefundStatus, string> = {
  REQUESTED: 'pending',
  UNDER_REVIEW: 'processing',
  APPROVED: 'confirmed',
  REFUNDED: 'delivered',
  REJECTED: 'cancelled',
  CANCELLED: 'cancelled',
};

const STATUS_LABELS: Record<RefundStatus, string> = {
  REQUESTED: 'Requested',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REFUNDED: 'Refunded',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

const METHOD_LABELS: Record<RefundMethod, string> = {
  ORIGINAL_PAYMENT: 'Original Payment',
  STORE_CREDIT: 'Store Credit',
  BANK_TRANSFER: 'Bank Transfer',
};

function StatusBadge({ status }: { status: RefundStatus }) {
  return (
    <span className="dash-status" data-status={STATUS_DATA_ATTR[status]}>
      <span className="dash-status-dot" />
      {STATUS_LABELS[status]}
    </span>
  );
}

function RowActions({
  row,
  onAction,
}: {
  row: RefundTicketDto;
  onAction: (id: string, action: 'start_review' | 'approve' | 'reject' | 'mark-refunded') => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const act = async (a: Parameters<typeof onAction>[1]) => {
    setBusy(true);
    await onAction(row.id, a);
    setBusy(false);
  };

  if (row.status === 'REQUESTED') {
    return (
      <div className="dash-row-actions">
        <button className="dash-btn-ghost" disabled={busy} onClick={() => act('start_review')}>Review</button>
      </div>
    );
  }
  if (row.status === 'UNDER_REVIEW') {
    return (
      <div className="dash-row-actions">
        <button className="dash-btn-ghost dash-btn-ok" disabled={busy} onClick={() => act('approve')}>Approve</button>
        <button className="dash-btn-ghost" disabled={busy} style={{ color: 'var(--mr-st-danger-fg, #b91c1c)' }} onClick={() => act('reject')}>Reject</button>
      </div>
    );
  }
  if (row.status === 'APPROVED') {
    return (
      <div className="dash-row-actions">
        <button className="dash-btn-ghost dash-btn-ok" disabled={busy} onClick={() => act('mark-refunded')}>Mark Refunded</button>
      </div>
    );
  }
  return <span style={{ color: 'var(--mr-fg-4)', fontSize: 13 }}>—</span>;
}

function SkeletonRows() {
  return (
    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>{['Ticket', 'Order', 'Status', 'Amount', 'Method', 'Reason', 'Date', ''].map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                <td key={j}><span className="dash-skeleton" style={{ display: 'block', width: j < 2 ? 80 : 60, height: 14 }} /></td>
              ))}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function RefundsClient() {
  const [refunds, setRefunds] = useState<RefundTicketDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (status?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiAdminListRefunds({
        status: status ? (status as RefundStatus) : undefined,
        limit: 100,
      });
      // Guarded: a response missing this key set state to undefined and the
      // next .map()/.reduce() blanked the whole tab. Same bug as Settings
      // and Loyalty had.
      setRefunds(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setError((e as ApiError).message ?? 'Failed to load refunds');
    } finally {
      setLoading(false);
    }
  }, []);

  useMountedEffect(() => { load(statusFilter || undefined); }, [load, statusFilter]);

  const handleAction = useCallback(async (
    id: string,
    action: 'start_review' | 'approve' | 'reject' | 'mark-refunded',
  ) => {
    setActionError(null);
    try {
      let updated: RefundTicketDto;
      if (action === 'mark-refunded') {
        updated = await apiAdminMarkRefunded(id, `manual-${Date.now()}`, crypto.randomUUID());
      } else {
        const reviewAction = action as 'start_review' | 'approve' | 'reject';
        const options = action === 'approve'
          ? { approvedAmountCents: refunds.find((r) => r.id === id)?.requestedAmountCents }
          : undefined;
        updated = await apiAdminReviewRefund(id, reviewAction, options);
      }
      setRefunds((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      setActionError((e as ApiError).message ?? 'Action failed');
    }
  }, [refunds]);

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Refunds</h1>
      </div>

      {actionError && <p className="dash-inline-error" style={{ marginBottom: 12 }}>{actionError}</p>}

      <div className="dash-filters">
        <select
          className="dash-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ minWidth: 160 }}
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {loading ? (
        <SkeletonRows />
      ) : error ? (
        <div className="dash-card">
          <p className="dash-inline-error">{error}</p>
          <button className="dash-btn-secondary" style={{ marginTop: 12 }} onClick={() => load(statusFilter || undefined)}>Retry</button>
        </div>
      ) : (
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Requested</th>
                  <th>Method</th>
                  <th>Reason</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {refunds.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="dash-table-empty">
                      {statusFilter ? 'No refunds match the selected status.' : 'No refund requests yet.'}
                    </td>
                  </tr>
                ) : (
                  refunds.map((row) => (
                    <tr key={row.id}>
                      <td><code style={{ fontSize: 12 }}>{row.id.slice(0, 8)}…</code></td>
                      <td>
                        <Link href={`/orders/${row.orderId}`} className="dash-link">
                          {row.orderId.slice(0, 8)}…
                        </Link>
                      </td>
                      <td><StatusBadge status={row.status} /></td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{egp(row.requestedAmountCents)}</td>
                      <td style={{ color: 'var(--mr-fg-3)', fontSize: 13 }}>{METHOD_LABELS[row.method]}</td>
                      <td style={{ color: 'var(--mr-fg-3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{row.reason}</td>
                      <td style={{ color: 'var(--mr-fg-3)' }}>{formatDate(row.createdAt)}</td>
                      <td><RowActions row={row} onAction={handleAction} /></td>
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

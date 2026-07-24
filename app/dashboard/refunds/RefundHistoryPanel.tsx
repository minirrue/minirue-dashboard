'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  apiAdminListRefunds,
  apiAdminReviewRefund,
  apiAdminMarkRefunded,
  apiAdminGetRefundProof,
} from '@/lib/api/refunds';
import type { RefundTicketDto, RefundStatus, RefundMethod } from '@/lib/api/refunds';
import { apiAdminListOrders, type Order } from '@/lib/api/orders';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import { formatOrderRef } from '@/lib/orders/order-format';

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
  INSTAPAY: 'Instapay',
};

function StatusBadge({ status }: { status: RefundStatus }) {
  return (
    <span className="dash-status" data-status={STATUS_DATA_ATTR[status]}>
      <span className="dash-status-dot" />
      {STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Task 8 gap: RefundTicketDto has no orderSeq/orderNumber, only a raw orderId
 * UUID — a human needs `#47`, not a truncated UUID. Resolved client-side
 * (the "acceptable" option from the brief) rather than touching the backend
 * DTO in this task: orders already fetched for the Orders tab are looked up
 * by id, and only tickets for an order outside that fetched page fall back
 * to a truncated UUID.
 */
function OrderRefCell({ ticket, orderById }: { ticket: RefundTicketDto; orderById: Map<string, Order> }) {
  const order = orderById.get(ticket.orderId);
  if (order) {
    return (
      <Link href={`/orders/${order.id}`} className="dash-link">
        {formatOrderRef(order)}
      </Link>
    );
  }
  return (
    <Link href={`/orders/${ticket.orderId}`} className="dash-link" title="Order not in the current page — showing raw id">
      {ticket.orderId.slice(0, 8)}…
    </Link>
  );
}

function ProofLink({ ticketId }: { ticketId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="dash-btn-ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { url } = await apiAdminGetRefundProof(ticketId);
          if (url) window.open(url, '_blank', 'noopener,noreferrer');
        } finally {
          setBusy(false);
        }
      }}
    >
      View proof
    </button>
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
            <tr>{['Ticket', 'Order', 'Status', 'Amount', 'Method', 'Source', 'Proof', 'Reason', 'Date', ''].map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 10 }).map((_, j) => (
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

export default function RefundHistoryPanel({ refreshToken }: { refreshToken: number }) {
  const [refunds, setRefunds] = useState<RefundTicketDto[]>([]);
  const [orderById, setOrderById] = useState<Map<string, Order>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (status?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [refundsRes, ordersRes] = await Promise.all([
        apiAdminListRefunds({
          status: status ? (status as RefundStatus) : undefined,
          limit: 100,
        }),
        apiAdminListOrders({ limit: 100 }),
      ]);
      // Guarded: a response missing this key set state to undefined and the
      // next .map()/.reduce() blanked the whole tab. Same bug as Settings
      // and Loyalty had.
      setRefunds(Array.isArray(refundsRes?.data) ? refundsRes.data : []);
      const orders = Array.isArray(ordersRes?.data) ? ordersRes.data : [];
      setOrderById(new Map(orders.map((o) => [o.id, o])));
    } catch (e) {
      setError((e as ApiError).message ?? 'Failed to load refunds');
    } finally {
      setLoading(false);
    }
  }, []);

  useMountedEffect(() => { load(statusFilter || undefined); }, [load, statusFilter, refreshToken]);

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
      {actionError && <p className="dash-inline-error" style={{ marginBottom: 12 }}>{actionError}</p>}

      <div className="dash-filters">
        <select
          className="dash-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ maxWidth: '100%' }}
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
                  <th>Source</th>
                  <th>Proof</th>
                  <th>Reason</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {refunds.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="dash-table-empty">
                      {statusFilter ? 'No refunds match the selected status.' : 'No refund requests yet.'}
                    </td>
                  </tr>
                ) : (
                  refunds.map((row) => (
                    <tr key={row.id}>
                      <td><code style={{ fontSize: 12 }}>{row.id.slice(0, 8)}…</code></td>
                      <td><OrderRefCell ticket={row} orderById={orderById} /></td>
                      <td><StatusBadge status={row.status} /></td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{egp(row.requestedAmountCents)}</td>
                      <td style={{ color: 'var(--mr-fg-3)', fontSize: 13 }}>{METHOD_LABELS[row.method]}</td>
                      <td style={{ color: 'var(--mr-fg-3)', fontSize: 13 }}>{row.source === 'ADMIN' ? 'Admin' : 'Customer'}</td>
                      <td>{row.hasProof ? <ProofLink ticketId={row.id} /> : <span style={{ color: 'var(--mr-fg-4)' }}>—</span>}</td>
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

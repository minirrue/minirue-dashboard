'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  apiAdminListPayments,
  type AdminPaymentListItem,
  type PaymentAttemptStatus,
} from '@/lib/api/payments';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

const PAGE_SIZE = 25;

function egpFromCents(cents: number): string {
  return `EGP ${(cents / 100).toLocaleString('en-EG', { minimumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Reuses the shared order-status tones rather than inventing payment ones, so a
 * green here means the same thing a green means on the Orders screen.
 */
const STATUS_DATA_ATTR: Record<PaymentAttemptStatus, string> = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCEEDED: 'delivered',
  FAILED: 'cancelled',
  CANCELLED: 'cancelled',
};

const STATUS_LABELS: Record<PaymentAttemptStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

function StatusBadge({ status }: { status: PaymentAttemptStatus }) {
  return (
    <span className="dash-status" data-status={STATUS_DATA_ATTR[status]}>
      <span className="dash-status-dot" />
      {STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Every payment the shop has taken, newest first.
 *
 * `highlightId` is the payment a link arrived pointing at — clicking a row in
 * the Payments card on an order lands here with `?payment=<id>`. The row is
 * marked rather than filtered to: an admin who followed the link still wants
 * the surrounding payments, especially the earlier attempts on the same order,
 * which are usually the reason they clicked.
 */
export default function PaymentsPanel({
  highlightId,
}: {
  highlightId?: string | null;
}) {
  const [rows, setRows] = useState<AdminPaymentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiAdminListPayments({
        page: nextPage,
        limit: PAGE_SIZE,
      });
      setRows(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch (e) {
      setError((e as ApiError).message ?? 'Could not load payments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useMountedEffect(() => {
    void load(1);
  }, [load]);

  if (loading && rows.length === 0) {
    return <span className="dash-skeleton" style={{ width: '100%', height: 160 }} />;
  }
  if (error) return <p className="dash-inline-error">{error}</p>;
  if (rows.length === 0) {
    return <p className="dash-muted">No payments yet.</p>;
  }

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Method</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Instapay ref</th>
              <th>Sender</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                id={`payment-${p.id}`}
                data-highlighted={p.id === highlightId ? 'true' : undefined}
              >
                <td>
                  {/*
                    A payment with no order left is not a link. Rendering one
                    would send the admin to a 404 for a row whose whole point is
                    that the order is gone.
                  */}
                  {p.orderNumber ? (
                    <Link href={`/orders/${p.orderId}`} className="dash-link">
                      {p.orderNumber}
                    </Link>
                  ) : (
                    <span className="dash-muted">Order erased</span>
                  )}
                </td>
                <td>{p.method}</td>
                <td>
                  <StatusBadge status={p.status} />
                </td>
                <td>{egpFromCents(p.amountCents)}</td>
                <td>{formatDate(p.createdAt)}</td>
                <td>{p.instapayReference ?? <span className="dash-muted">—</span>}</td>
                <td>{p.payerName ?? <span className="dash-muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lastPage > 1 && (
        <div className="dash-pagination">
          <button
            type="button"
            className="dash-pagination-btn"
            disabled={page <= 1 || loading}
            onClick={() => void load(page - 1)}
          >
            Previous
          </button>
          <span className="dash-muted">
            Page {page} of {lastPage}
          </span>
          <button
            type="button"
            className="dash-pagination-btn"
            disabled={page >= lastPage || loading}
            onClick={() => void load(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}

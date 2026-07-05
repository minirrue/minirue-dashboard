'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiAdminGetOrder, apiAdminTransitionStatus, apiAdminCancelOrder } from '@/lib/api/orders';
import type { Order, OrderStatus, OrderItem } from '@/lib/api/orders';
import { apiAdminListOrderPayments, apiAdminVerifyInstapay, apiAdminRejectInstapay } from '@/lib/api/payments';
import type { AdminPaymentAttempt } from '@/lib/api/payments';
import type { ApiError } from '@/lib/api/client';

/* ── Helpers ── */
function formatAmount(amount: string, currency: string): string {
  return `${currency} ${parseFloat(amount).toLocaleString('en-EG', { minimumFractionDigits: 2 })}`;
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-EG', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
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

/* ── Action buttons based on current status ── */
function OrderActions({
  status,
  onConfirm,
  onCancel,
  onShip,
  busy,
}: {
  status: OrderStatus;
  onConfirm: () => void;
  onCancel: () => void;
  onShip: () => void;
  busy: boolean;
}) {
  return (
    <div className="dash-row-actions">
      {status === 'PENDING' && (
        <>
          <button className="dash-btn-ok" disabled={busy} onClick={onConfirm}>
            Confirm
          </button>
          <button className="dash-btn-danger" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </>
      )}
      {status === 'CONFIRMED' && (
        <>
          <button className="dash-btn-primary" disabled={busy} onClick={onShip}>
            Start processing
          </button>
          <button className="dash-btn-danger" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </>
      )}
      {status === 'PROCESSING' && (
        <button className="dash-btn-primary" disabled={busy} onClick={onShip}>
          Mark shipped
        </button>
      )}
    </div>
  );
}

/* ── Skeleton ── */
function Skeleton() {
  return (
    <div className="dash-form-card">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className="dash-skeleton" style={{ width: i % 2 === 0 ? '60%' : '40%' }} />
      ))}
    </div>
  );
}

/* ── Component ── */
export default function OrderDetailClient({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payments, setPayments] = useState<AdminPaymentAttempt[]>([]);
  const [paymentBusy, setPaymentBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiAdminGetOrder(id);
      setOrder(data);
      try {
        const pa = await apiAdminListOrderPayments(id);
        setPayments(pa);
      } catch { /* non-critical */ }
    } catch (e) {
      setError((e as ApiError).message ?? 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const runAction = async (fn: () => Promise<Order>) => {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await fn();
      setOrder(updated);
    } catch (e) {
      setActionError((e as ApiError).message ?? 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const runPaymentAction = async (
    attemptId: string,
    action: 'verify' | 'reject',
  ) => {
    setPaymentBusy(attemptId);
    setActionError(null);
    try {
      const updated =
        action === 'verify'
          ? await apiAdminVerifyInstapay(attemptId)
          : await apiAdminRejectInstapay(attemptId, 'Receipt could not be verified');
      setPayments((prev) => prev.map((p) => (p.id === attemptId ? updated : p)));
      if (action === 'verify') await load();
    } catch (e) {
      setActionError((e as ApiError).message ?? 'Payment action failed');
    } finally {
      setPaymentBusy(null);
    }
  };

  if (loading) return <Skeleton />;
  if (error) {
    return (
      <div className="dash-card">
        <p className="dash-inline-error">{error}</p>
        <button className="dash-btn-secondary" style={{ marginTop: 12 }} onClick={load}>Retry</button>
      </div>
    );
  }
  if (!order) return null;

  const items: OrderItem[] = order.items ?? [];
  const itemsTotal = items.reduce((sum, it) => sum + parseFloat(it.lineTotalAmount), 0);

  return (
    <>
      {/* Page header */}
      <div className="dash-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/orders" className="dash-btn-ghost">
            ← Orders
          </Link>
          <h1 className="dash-page-title">{order.orderNumber}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <OrderActions
          status={order.status}
          busy={busy}
          onConfirm={() => runAction(() => apiAdminTransitionStatus(id, 'CONFIRMED'))}
          onCancel={() => runAction(() => apiAdminCancelOrder(id))}
          onShip={() =>
            runAction(() =>
              apiAdminTransitionStatus(
                id,
                order.status === 'CONFIRMED' ? 'PROCESSING' : 'SHIPPED',
              ),
            )
          }
        />
      </div>

      {actionError && (
        <p className="dash-inline-error" style={{ marginBottom: 16 }}>{actionError}</p>
      )}

      {/* Meta */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="dash-form-section" style={{ margin: 0 }}>
          <p className="dash-label" style={{ marginBottom: 6 }}>Order info</p>
          <p style={{ margin: '4px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
            <strong>Date:</strong> {formatDate(order.createdAt)}
          </p>
          <p style={{ margin: '4px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
            <strong>Total:</strong> {formatAmount(order.totalAmount, order.totalCurrency)}
          </p>
        </div>
      </div>

      {/* Items table */}
      <div className="dash-form-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">Items</h2>
        </div>
        {items.length === 0 ? (
          <p style={{ color: 'var(--mr-fg-4)', fontSize: 14 }}>No item details available.</p>
        ) : (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Brand</th>
                  <th>Size</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Unit Price</th>
                  <th style={{ textAlign: 'right' }}>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.productSnapshot.name}</td>
                    <td style={{ color: 'var(--mr-fg-3)' }}>{item.productSnapshot.brand}</td>
                    <td>{item.productSnapshot.sizeMl ? `${item.productSnapshot.sizeMl} ml` : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{item.qty}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.unitPriceAmount, item.unitPriceCurrency)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatAmount(item.lineTotalAmount, item.unitPriceCurrency)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--mr-fg)' }}>
                    Total
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--mr-fg)' }}>
                    {formatAmount(itemsTotal.toFixed(2), order.totalCurrency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment attempts */}
      {payments.length > 0 && (
        <div className="dash-form-section">
          <div className="dash-section-header">
            <h2 className="dash-section-title">Payments</h2>
          </div>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Date</th>
                  <th>Ref</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const receiptUrl =
                    typeof p.gatewayMeta?.receiptDataUrl === 'string'
                      ? p.gatewayMeta.receiptDataUrl
                      : null;
                  const awaiting =
                    p.method === 'INSTAPAY' &&
                    (p.status === 'PROCESSING' || p.status === 'PENDING');
                  return (
                  <tr key={p.id}>
                    <td>{p.method}</td>
                    <td>
                      <span className="dash-status" data-status={p.status.toLowerCase()}>
                        <span className="dash-status-dot" />
                        {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {order.totalCurrency} {(p.amountCents / 100).toLocaleString('en-EG', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ color: 'var(--mr-fg-3)' }}>{formatDate(p.createdAt)}</td>
                    <td style={{ color: 'var(--mr-fg-4)', fontSize: 12 }}>{p.gatewayReference ?? '—'}</td>
                    <td>
                      {receiptUrl && (
                        <a
                          href={receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="dash-btn-ghost"
                          style={{ fontSize: 12, marginRight: 8 }}
                        >
                          View receipt
                        </a>
                      )}
                      {awaiting && (
                        <div className="dash-row-actions">
                          <button
                            type="button"
                            className="dash-btn-ok"
                            disabled={paymentBusy === p.id}
                            onClick={() => void runPaymentAction(p.id, 'verify')}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="dash-btn-danger"
                            disabled={paymentBusy === p.id}
                            onClick={() => void runPaymentAction(p.id, 'reject')}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {p.failureReason && (
                        <span style={{ fontSize: 12, color: 'var(--mr-st-danger-fg)' }}>
                          {p.failureReason}
                        </span>
                      )}
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Status history */}
      {order.statusHistory && order.statusHistory.length > 0 && (
        <div className="dash-form-section">
          <div className="dash-section-header">
            <h2 className="dash-section-title">Status History</h2>
          </div>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {order.statusHistory.map((ev, i) => (
                  <tr key={i}>
                    <td>
                      <span className="dash-status" data-status={STATUS_DATA_ATTR[ev.toStatus as OrderStatus] ?? 'pending'}>
                        <span className="dash-status-dot" />
                        {ev.toStatus.charAt(0) + ev.toStatus.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td style={{ color: 'var(--mr-fg-3)' }}>{formatDate(ev.createdAt)}</td>
                    <td style={{ color: 'var(--mr-fg-3)' }}>{ev.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

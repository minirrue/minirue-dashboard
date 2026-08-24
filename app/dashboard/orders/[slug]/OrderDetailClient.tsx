'use client';

import React, {useState, useCallback } from 'react';
import Link from 'next/link';
import { apiAdminGetOrder, apiAdminTransitionStatus, apiAdminCancelOrder } from '@/lib/api/orders';
import type { Order, OrderStatus, OrderItem } from '@/lib/api/orders';
import {
  apiAdminListOrderPayments,
  apiAdminVerifyInstapay,
  apiAdminRejectInstapay,
  apiAdminUpdatePaymentReference,
} from '@/lib/api/payments';
import EditableCell from '@/components/dashboard/EditableCell';
import type { AdminPaymentAttempt } from '@/lib/api/payments';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import { ImagePreviewModal, EnlargeableImage } from '@/components/dashboard/ImagePreviewModal';
import FulfillmentControl from '@/components/dashboard/FulfillmentControl';
import RefundOrderModal from '@/components/dashboard/RefundOrderModal';
import type { RefundTicketDto } from '@/lib/api/refunds';
import { formatOrderRef } from '@/lib/orders/order-format';
import ReturnToStockModal from '@/components/dashboard/ReturnToStockModal';

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
// Same shape as the Refunds tab (RefundableOrdersPanel) — refundedAmountCents
// is already minor units, unlike totalAmount which is a major-unit string.
function egpFromCents(cents: number): string {
  return `EGP ${(cents / 100).toLocaleString('en-EG', { minimumFractionDigits: 2 })}`;
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
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

/* ── Action buttons based on current status ── */
/**
 * Statuses where goods have physically left, so a return is possible.
 *
 * Anything earlier releases its reservation on cancel and needs no
 * confirmation — the stock never went anywhere.
 */
const SHIPPED_STATUSES: string[] = ['SHIPPED', 'DELIVERED', 'REFUNDED'];

function OrderActions({
  order,
  onConfirm,
  onCancel,
  onShip,
  onDeliver,
  onRefund,
  onReturnToStock,
  busy,
}: {
  order: Order;
  onConfirm: () => void;
  onCancel: () => void;
  onShip: () => void;
  onDeliver: () => void;
  onRefund: () => void;
  onReturnToStock: () => void;
  busy: boolean;
}) {
  const { status } = order;
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
      {/* The step after "Mark shipped", and the last one an order has.
          SHIPPED used to render no action at all, so an order that had gone
          out could only be closed off from the orders LIST — the detail page
          for it was a dead end (owner, 2026-08-23). SHIPPED -> DELIVERED is
          already the only forward transition the API allows from here
          (ORDER_TRANSITIONS), so this exposes an existing rule rather than
          adding one. */}
      {status === 'SHIPPED' && (
        <button
          className="dash-btn-primary"
          disabled={busy}
          onClick={onDeliver}
          data-trace-id="PG-DASHBOARD-FUL-004::EL-BTN-mark-delivered"
        >
          Mark delivered
        </button>
      )}
      {/* Same eligibility as the Refunds tab: not already refunded, and a
          settled payment attempt exists (order.paid), fulfilled or not. */}
      {!order.refundedAt && order.paid && (
        <button className="dash-btn-secondary" disabled={busy} onClick={onRefund}>
          Refund
        </button>
      )}
      {/* Beside the refund, never instead of it. Refunding money and receiving
          a parcel are separate events, often days apart and sometimes only one
          of them happens — so stock moves when the operator says the goods
          arrived, not when the money goes back.

          Shown once an order has shipped, because that is the only case with
          anything to return: cancelling BEFORE shipping releases the
          reservation automatically and the goods are already back on sale. */}
      {SHIPPED_STATUSES.includes(status) && (
        <button
          className="dash-btn-secondary"
          disabled={busy}
          onClick={onReturnToStock}
          data-trace-id="PG-DASHBOARD-FUL-004::EL-BTN-open-return-to-stock"
        >
          Package received back
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
  // A confirmed return changes a number the operator cannot see from here, so
  // it has to say what it did — silence after "add back to stock" reads as
  // nothing having happened.
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payments, setPayments] = useState<AdminPaymentAttempt[]>([]);
  const [paymentBusy, setPaymentBusy] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  // Which order line's image is open full-size. Held by id rather than by URL
  // so two lines sharing one product image cannot both open at once.
  const [itemPreview, setItemPreview] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [returningToStock, setReturningToStock] = useState(false);

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

  useMountedEffect(() => { load(); }, [load]);

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

  // Mirrors RefundableOrdersPanel.handleRefunded — updates the order in
  // place from the ticket rather than refetching, same shape both places.
  const handleRefunded = (ticket: RefundTicketDto) => {
    setOrder((prev) =>
      prev
        ? {
            ...prev,
            refundedAt: new Date().toISOString(),
            refundedAmountCents: ticket.approvedAmountCents ?? ticket.requestedAmountCents,
          }
        : prev,
    );
    setRefunding(false);
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

  /**
   * Save one reference field on one payment.
   *
   * Rethrows on failure so EditableCell can stay open with what the admin
   * typed still in it — swallowing the error would close the input and leave
   * them unsure whether it saved.
   */
  const savePaymentField = async (
    attemptId: string,
    patch: {
      instapayReference?: string | null;
      payerName?: string | null;
      gatewayReference?: string | null;
    },
  ) => {
    setActionError(null);
    try {
      const updated = await apiAdminUpdatePaymentReference(attemptId, patch);
      setPayments((prev) => prev.map((p) => (p.id === attemptId ? updated : p)));
    } catch (e) {
      setActionError((e as ApiError).message ?? 'Could not save the payment reference');
      throw e;
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
          <Link href="/orders" className="dash-btn-ghost">
            ← Orders
          </Link>
          <h1 className="dash-page-title" style={{ overflowWrap: 'anywhere' }}>{formatOrderRef(order)}</h1>
          <span style={{ color: 'var(--mr-fg-4)', fontSize: 13 }}>{order.orderNumber}</span>
          {/* The reverse of the link on the customer page. A guest/manual order has
              no account, so there is nothing to link to. */}
          {order.userId && (
            <Link
              href={`/customers/${order.userId}`}
              className="dash-btn-ghost"
              style={{ fontSize: 13 }}
            >
              View customer →
            </Link>
          )}
          {/* Never disagrees with the Refunds tab: a refund on this order
              overrides whatever `status` still says, even for a row no
              repair migration touched. */}
          <OrderStatusBadge status={order.refundedAt ? 'REFUNDED' : order.status} />
        </div>
        <OrderActions
          order={order}
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
          onDeliver={() => runAction(() => apiAdminTransitionStatus(id, 'DELIVERED'))}
          onRefund={() => setRefunding(true)}
          onReturnToStock={() => setReturningToStock(true)}
        />
      </div>

      {order.refundedAt && (
        <p style={{ margin: '-8px 0 16px', fontSize: 13, color: 'var(--mr-fg-3)' }}>
          {egpFromCents(order.refundedAmountCents)} refunded on {formatDate(order.refundedAt)}
        </p>
      )}

      {actionError && (
        <p className="dash-inline-error" style={{ marginBottom: 16 }}>{actionError}</p>
      )}

      {actionNotice && (
        <p className="dash-help-text" style={{ marginBottom: 16, color: 'var(--mr-st-ok-fg)' }}>
          {actionNotice}
        </p>
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
        <div className="dash-form-section" style={{ margin: 0 }}>
          <p className="dash-label" style={{ marginBottom: 6 }}>Fulfillment</p>
          <FulfillmentControl
            order={order}
            variant="full"
            onUpdated={setOrder}
            onError={setActionError}
          />
        </div>
        <div className="dash-form-section" style={{ margin: 0 }}>
          <p className="dash-label" style={{ marginBottom: 6 }}>Buyer</p>
          <p style={{ margin: '4px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
            <strong>Name:</strong>{' '}
            {order.guestContact?.fullName ?? order.shippingAddressSnapshot?.fullName ?? '—'}
          </p>
          {order.guestContact && (
            <>
              <p style={{ margin: '4px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
                <strong>Phone:</strong> {order.guestContact.phone}
              </p>
              {order.guestContact.email && (
                <p style={{ margin: '4px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
                  <strong>Email:</strong> {order.guestContact.email}
                </p>
              )}
            </>
          )}
          <p style={{ margin: '4px 0', fontSize: 14, color: 'var(--mr-fg-3)' }}>
            {order.channel === 'MANUAL'
              ? 'Registered manually from the dashboard'
              : 'Placed on the storefront'}
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
                  <th style={{ width: 44 }} aria-label="Image" />
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
                    {/* 64px square, and clickable. It was 36x45 — an odd
                        portrait ratio that crop-mangled square product shots,
                        at a size too small to tell two bottles apart — and it
                        was the only image on this page with no preview, while
                        the payment receipt right below it already had one. */}
                    <td>
                      {item.productSnapshot.imageUrl ? (
                        <EnlargeableImage
                          src={item.productSnapshot.imageUrl}
                          alt={item.productSnapshot.name}
                          className="dash-order-item-thumb"
                          previewOpen={itemPreview === item.id}
                          onOpenPreview={() => setItemPreview(item.id)}
                          onClosePreview={() => setItemPreview(null)}
                        />
                      ) : (
                        <div
                          aria-hidden
                          className="dash-order-item-thumb dash-order-item-thumb--empty"
                        />
                      )}
                    </td>
                    <td>{item.productSnapshot.name}</td>
                    <td style={{ color: 'var(--mr-fg-3)' }}>{item.productSnapshot.brand}</td>
                    <td>{item.productSnapshot.sizeMl ? `${item.productSnapshot.sizeMl} ml` : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{item.qty}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.unitPriceAmount, item.unitPriceCurrency)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatAmount(item.lineTotalAmount, item.unitPriceCurrency)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--mr-fg)' }}>
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
      <div className="dash-form-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">Payments</h2>
        </div>
        {payments.length === 0 ? (
          <p style={{ color: 'var(--mr-fg-4)', fontSize: 14 }}>
            No payment recorded against this order.
          </p>
        ) : (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Date</th>
                  <th>Instapay ref</th>
                  <th>Sender</th>
                  <th>Ref</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const receiptUrl = p.receiptUrl ?? null;
                  const awaiting =
                    p.method === 'INSTAPAY' &&
                    (p.status === 'PROCESSING' || p.status === 'PENDING');
                  return (
                  <tr key={p.id}>
                    {/*
                      The METHOD cell is the link, not the row. Three cells on
                      this row are edited in place (Instapay ref, Sender, Ref)
                      and a row-level link would swallow the click that starts
                      an edit. Landing target is the Payments tab on Refunds and
                      payments, with this attempt marked.
                    */}
                    <td>
                      <Link href={`/refunds?payment=${p.id}`} className="dash-link">
                        {p.method}
                      </Link>
                    </td>
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
                    {/* These three are copied by hand off a transfer
                        screenshot, so they arrive late or wrong. They were
                        static text with no endpoint behind them; click to
                        edit, Enter or blur to save, Escape to abandon. */}
                    <td style={{ color: 'var(--mr-fg-3)', fontSize: 12 }}>
                      <EditableCell
                        value={p.instapayReference ?? null}
                        ariaLabel="Instapay reference"
                        maxLength={120}
                        onSave={(next) => savePaymentField(p.id, { instapayReference: next })}
                      />
                    </td>
                    <td style={{ color: 'var(--mr-fg-3)', fontSize: 12 }}>
                      <EditableCell
                        value={p.payerName ?? null}
                        ariaLabel="Sender name"
                        maxLength={160}
                        onSave={(next) => savePaymentField(p.id, { payerName: next })}
                      />
                      {p.transferredAt && (
                        <div style={{ color: 'var(--mr-fg-4)' }}>{formatDate(p.transferredAt)}</div>
                      )}
                    </td>
                    <td style={{ color: 'var(--mr-fg-4)', fontSize: 12 }}>
                      <EditableCell
                        value={p.gatewayReference ?? null}
                        ariaLabel="Payment reference"
                        maxLength={120}
                        onSave={(next) => savePaymentField(p.id, { gatewayReference: next })}
                      />
                    </td>
                    <td>
                      {receiptUrl && (
                        <button
                          type="button"
                          className="dash-btn-ghost"
                          style={{ padding: 0, marginRight: 8 }}
                          onClick={() => setReceiptPreview(receiptUrl)}
                          aria-label="View Instapay receipt"
                        >
                          <img
                            src={receiptUrl}
                            alt="Instapay receipt"
                            style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4, display: 'block' }}
                          />
                        </button>
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
        )}
      </div>

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

      {receiptPreview && (
        <ImagePreviewModal
          src={receiptPreview}
          alt="Instapay receipt"
          onClose={() => setReceiptPreview(null)}
        />
      )}

      {refunding && (
        <RefundOrderModal
          order={order}
          onClose={() => setRefunding(false)}
          onRefunded={handleRefunded}
        />
      )}

      {returningToStock && (
        <ReturnToStockModal
          orderId={order.id}
          orderNumber={order.orderNumber}
          onClose={() => setReturningToStock(false)}
          onDone={(credited) => {
            setReturningToStock(false);
            setActionNotice(
              credited > 0
                ? `${credited} item${credited === 1 ? '' : 's'} added back to stock.`
                : 'Nothing was added back — those items had already been returned.',
            );
          }}
        />
      )}
    </>
  );
}

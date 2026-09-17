'use client';

import React, {useState, useCallback } from 'react';
import Link from 'next/link';
import {
  apiAdminGetOrder,
  apiAdminGetOrderEmails,
  apiAdminTransitionStatus,
  apiAdminCancelOrder,
  apiAdminMarkCashCollected,
} from '@/lib/api/orders';
import type { Order, OrderStatus, OrderItem, OrderEmailLog } from '@/lib/api/orders';
import OrderEmailsSection from './OrderEmailsSection';
import {
  apiAdminListOrderPayments,
  apiAdminVerifyInstapay,
  apiAdminRejectInstapay,
  apiAdminUpdatePaymentReference,
} from '@/lib/api/payments';
import EditableCell from '@/components/dashboard/EditableCell';
import type { AdminPaymentAttempt, InstapayRejectionReason } from '@/lib/api/payments';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import { ImagePreviewModal, EnlargeableImage } from '@/components/dashboard/ImagePreviewModal';
import OrderFulfillmentPipeline from '@/components/dashboard/OrderFulfillmentPipeline';
import SameDayFeeEntry from '@/components/dashboard/SameDayFeeEntry';
import RefundOrderModal from '@/components/dashboard/RefundOrderModal';
import type { RefundTicketDto } from '@/lib/api/refunds';
import { formatOrderRef } from '@/lib/orders/order-format';
import InternalOrderBadge from '@/components/dashboard/InternalOrderBadge';
import ReturnToStockModal from '@/components/dashboard/ReturnToStockModal';
import { formatDeliveryWindow, mapsLinkFor } from '@/lib/orders/delivery-format';

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

const INSTAPAY_REJECTION_OPTIONS: ReadonlyArray<{
  value: InstapayRejectionReason;
  label: string;
}> = [
  { value: 'RECEIPT_UNREADABLE', label: 'Receipt is unreadable' },
  { value: 'AMOUNT_MISMATCH', label: 'Amount does not match' },
  { value: 'REFERENCE_NOT_FOUND', label: 'Reference was not found' },
  { value: 'DUPLICATE_RECEIPT', label: 'Receipt was already used' },
  { value: 'SENDER_NAME_MISMATCH', label: 'Sender name does not match' },
  { value: 'OTHER', label: 'Other reason' },
];

function rejectionLabel(reason: InstapayRejectionReason): string {
  return INSTAPAY_REJECTION_OPTIONS.find((option) => option.value === reason)?.label ?? reason;
}

type ReviewFieldErrors = Partial<
  Record<'instapayReference' | 'payerName' | 'reason' | 'note' | 'form', string>
>;

function reviewErrorsFromApi(error: ApiError): ReviewFieldErrors {
  const fieldErrors: ReviewFieldErrors = {};
  for (const part of (error.message ?? '').split(';')) {
    const match = part.trim().match(/^(instapayReference|payerName|reason|note):\s*(.+)$/);
    if (match) fieldErrors[match[1] as keyof ReviewFieldErrors] = match[2];
  }
  return Object.keys(fieldErrors).length > 0
    ? fieldErrors
    : { form: error.message || 'The payment review could not be saved.' };
}

function InstapayReviewControls({
  payment,
  busy,
  onApprove,
  onReject,
}: {
  payment: AdminPaymentAttempt;
  busy: boolean;
  onApprove: (input: { instapayReference: string; payerName: string }) => Promise<void>;
  onReject: (input: { reason: InstapayRejectionReason; note?: string }) => Promise<void>;
}) {
  const [instapayReference, setInstapayReference] = useState(payment.instapayReference ?? '');
  const [payerName, setPayerName] = useState(payment.payerName ?? '');
  const [reason, setReason] = useState<InstapayRejectionReason>('RECEIPT_UNREADABLE');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<ReviewFieldErrors>({});

  const approve = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: ReviewFieldErrors = {};
    if (!instapayReference.trim()) nextErrors.instapayReference = 'Enter the transfer reference.';
    if (!payerName.trim()) nextErrors.payerName = 'Enter the sender name.';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    try {
      await onApprove({
        instapayReference: instapayReference.trim(),
        payerName: payerName.trim(),
      });
    } catch (error) {
      setErrors(reviewErrorsFromApi(error as ApiError));
    }
  };

  const reject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (reason === 'OTHER' && !note.trim()) {
      setErrors({ note: 'Explain why this receipt cannot be accepted.' });
      return;
    }
    setErrors({});
    try {
      await onReject({ reason, ...(note.trim() ? { note: note.trim() } : {}) });
    } catch (error) {
      setErrors(reviewErrorsFromApi(error as ApiError));
    }
  };

  return (
    <div
      role="group"
      aria-label="Review InstaPay transfer"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
        gap: 20,
        padding: 16,
        background: 'var(--mr-bg-2)',
        borderRadius: 12,
      }}
    >
      <form onSubmit={approve} noValidate>
        <p className="dash-label" style={{ marginBottom: 10 }}>Approve transfer</p>
        <div className="dash-field" style={{ marginBottom: 10 }}>
          <label className="dash-label" htmlFor={`instapay-reference-${payment.id}`}>Transfer reference</label>
          <input
            id={`instapay-reference-${payment.id}`}
            className={`dash-input${errors.instapayReference ? ' dash-input-error' : ''}`}
            value={instapayReference}
            maxLength={120}
            aria-invalid={Boolean(errors.instapayReference)}
            aria-describedby={errors.instapayReference ? `instapay-reference-error-${payment.id}` : undefined}
            onChange={(event) => setInstapayReference(event.target.value)}
          />
          {errors.instapayReference && (
            <p id={`instapay-reference-error-${payment.id}`} className="dash-field-error">{errors.instapayReference}</p>
          )}
        </div>
        <div className="dash-field" style={{ marginBottom: 12 }}>
          <label className="dash-label" htmlFor={`instapay-payer-${payment.id}`}>Sender name</label>
          <input
            id={`instapay-payer-${payment.id}`}
            className={`dash-input${errors.payerName ? ' dash-input-error' : ''}`}
            value={payerName}
            maxLength={160}
            aria-invalid={Boolean(errors.payerName)}
            aria-describedby={errors.payerName ? `instapay-payer-error-${payment.id}` : undefined}
            onChange={(event) => setPayerName(event.target.value)}
          />
          {errors.payerName && (
            <p id={`instapay-payer-error-${payment.id}`} className="dash-field-error">{errors.payerName}</p>
          )}
        </div>
        <button type="submit" className="dash-btn-ok" disabled={busy}>
          {busy ? 'Saving review…' : 'Approve payment'}
        </button>
      </form>

      <form onSubmit={reject} noValidate>
        <p className="dash-label" style={{ marginBottom: 10 }}>Reject transfer</p>
        <div className="dash-field" style={{ marginBottom: 10 }}>
          <label className="dash-label" htmlFor={`instapay-reason-${payment.id}`}>Reason</label>
          <select
            id={`instapay-reason-${payment.id}`}
            className={`dash-select${errors.reason ? ' dash-input-error' : ''}`}
            value={reason}
            aria-invalid={Boolean(errors.reason)}
            onChange={(event) => setReason(event.target.value as InstapayRejectionReason)}
          >
            {INSTAPAY_REJECTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="dash-field" style={{ marginBottom: 12 }}>
          <label className="dash-label" htmlFor={`instapay-note-${payment.id}`}>
            Note {reason === 'OTHER' ? '(required)' : '(optional)'}
          </label>
          <input
            id={`instapay-note-${payment.id}`}
            className={`dash-input${errors.note ? ' dash-input-error' : ''}`}
            value={note}
            maxLength={500}
            aria-invalid={Boolean(errors.note)}
            aria-describedby={errors.note ? `instapay-note-error-${payment.id}` : undefined}
            onChange={(event) => setNote(event.target.value)}
          />
          {errors.note && (
            <p id={`instapay-note-error-${payment.id}`} className="dash-field-error">{errors.note}</p>
          )}
        </div>
        <button type="submit" className="dash-btn-danger" disabled={busy}>
          {busy ? 'Saving review…' : 'Reject payment'}
        </button>
      </form>
      {errors.form && (
        <p className="dash-inline-error" role="alert" style={{ gridColumn: '1 / -1', margin: 0 }}>
          {errors.form}
        </p>
      )}
    </div>
  );
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
  onCancel,
  onRefund,
  onReturnToStock,
  busy,
}: {
  order: Order;
  onCancel: () => void;
  onRefund: () => void;
  onReturnToStock: () => void;
  busy: boolean;
}) {
  const { status } = order;
  return (
    <div className="dash-row-actions">
      {status === 'PENDING' && (
        <button className="dash-btn-danger" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      )}
      {status === 'CONFIRMED' && (
        <button className="dash-btn-danger" disabled={busy} onClick={onCancel}>
          Cancel
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
  const [emailLog, setEmailLog] = useState<OrderEmailLog | null>(null);

  // Its own fetch, re-run after every action: a status change is what sends an
  // email, so the log is only current if it is read again afterwards.
  const loadEmails = useCallback(async () => {
    try {
      setEmailLog((await apiAdminGetOrderEmails(id)) ?? null);
    } catch { /* non-critical — the order itself still renders */ }
  }, [id]);

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
      await loadEmails();
    } catch (e) {
      setError((e as ApiError).message ?? 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [id, loadEmails]);

  useMountedEffect(() => { load(); }, [load]);

  const runAction = async (fn: () => Promise<Order>) => {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await fn();
      setOrder(updated);
      void loadEmails();
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
    input:
      | { instapayReference: string; payerName: string }
      | { reason: InstapayRejectionReason; note?: string },
  ) => {
    setPaymentBusy(attemptId);
    setActionError(null);
    try {
      const updated =
        action === 'verify'
          ? await apiAdminVerifyInstapay(
              attemptId,
              input as { instapayReference: string; payerName: string },
            )
          : await apiAdminRejectInstapay(
              attemptId,
              input as { reason: InstapayRejectionReason; note?: string },
            );
      setPayments((prev) => prev.map((p) => (p.id === attemptId ? updated : p)));
      if (action === 'verify') await load();
    } finally {
      setPaymentBusy(null);
    }
  };

  const markCashCollected = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await apiAdminMarkCashCollected(id);
      setOrder(updated);
      setPayments(await apiAdminListOrderPayments(id));
      void loadEmails();
    } catch (e) {
      setActionError((e as ApiError).message ?? 'Could not record cash collected');
    } finally {
      setBusy(false);
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
          {order.isInternal ? <InternalOrderBadge /> : null}
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
          onCancel={() => runAction(() => apiAdminCancelOrder(id))}
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
      <div className="order-detail-meta">
        <div className="dash-form-section" style={{ margin: 0 }}>
          <p className="dash-label" style={{ marginBottom: 6 }}>Order info</p>
          <p style={{ margin: '4px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
            <strong>Date:</strong> {formatDate(order.createdAt)}
          </p>
          <p style={{ margin: '4px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
            <strong>Total:</strong> {formatAmount(order.totalAmount, order.totalCurrency)}
          </p>
        </div>
        <div className="dash-form-section order-fulfillment-section" style={{ margin: 0 }}>
          <p className="dash-label" style={{ marginBottom: 6 }}>Fulfillment</p>
          <OrderFulfillmentPipeline
            status={order.status}
            busy={busy}
            onAdvance={(target) => runAction(() => apiAdminTransitionStatus(id, target))}
          />
          {order.delivery?.method === 'SAME_DAY' && (
            <div style={{ marginTop: 18 }}>
              <SameDayFeeEntry order={order} onUpdated={setOrder} variant="full" />
            </div>
          )}
        </div>
        {order.delivery && (
          <div className="dash-form-section" style={{ margin: 0 }}>
            <p className="dash-label" style={{ marginBottom: 6 }}>Delivery</p>
            <p style={{ margin: '4px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
              <strong>Method:</strong> {order.delivery.method === 'SAME_DAY' ? 'Same-day' : 'Standard'}
            </p>
            {order.delivery.method === 'SAME_DAY' ? (
              <p style={{ margin: '4px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
                <strong>Window:</strong> {formatDeliveryWindow(order.delivery.window)}
              </p>
            ) : (
              order.delivery.etaLabel && (
                <p style={{ margin: '4px 0', fontSize: 14, color: 'var(--mr-fg-2)' }}>
                  <strong>ETA:</strong> {order.delivery.etaLabel}
                </p>
              )
            )}
            {order.delivery.method === 'SAME_DAY' && (
              <p style={{ margin: '4px 0', fontSize: 14 }}>
                {mapsLinkFor(order.delivery.location) ? (
                  <a
                    href={mapsLinkFor(order.delivery.location) as string}
                    target="_blank"
                    rel="noreferrer"
                    className="dash-link"
                  >
                    Open in Google Maps
                  </a>
                ) : (
                  <span style={{ color: 'var(--mr-fg-4)' }}>No location on file</span>
                )}
              </p>
            )}
          </div>
        )}
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
                          previewSrc={item.productSnapshot.imagePreviewUrl}
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
        {!order.refundedAt && !order.paid && (
          <div
            role="status"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}
          >
            <div>
              <span className="dash-status" data-status="pending">
                <span className="dash-status-dot" />
                Payment pending
              </span>
              <p className="dash-help-text" style={{ marginTop: 8 }}>
                No captured payment exists to refund yet.
                {order.paymentMethod === 'COD' && order.status !== 'DELIVERED'
                  ? ' Cash can be marked collected after delivery.'
                  : ''}
              </p>
            </div>
            {order.paymentMethod === 'COD' && order.status === 'DELIVERED' && (
              <button
                type="button"
                className="dash-btn-primary"
                disabled={busy}
                onClick={() => void markCashCollected()}
              >
                {busy ? 'Recording…' : 'Mark cash collected'}
              </button>
            )}
          </div>
        )}
        {order.paymentMethod === 'COD' && order.paid && (
          <p className="dash-inline-ok" role="status">
            Cash collected. This order can now be refunded.
          </p>
        )}
        {order.paymentRejection && (
          <div className="dash-inline-error" role="status" style={{ marginBottom: 16 }}>
            <strong>Latest InstaPay rejection:</strong>{' '}
            {rejectionLabel(order.paymentRejection.reason)}
            {order.paymentRejection.note ? ` — ${order.paymentRejection.note}` : ''}
          </div>
        )}
        {payments.length === 0 ? (
          order.paid ? (
            <p style={{ color: 'var(--mr-fg-4)', fontSize: 14 }}>
              Payment details are not available for this order.
            </p>
          ) : null
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
                    <td style={{ minWidth: awaiting ? 320 : undefined }}>
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
                        <InstapayReviewControls
                          payment={p}
                          busy={paymentBusy === p.id}
                          onApprove={(input) => runPaymentAction(p.id, 'verify', input)}
                          onReject={(input) => runPaymentAction(p.id, 'reject', input)}
                        />
                      )}
                      {(p.rejectionReason || p.failureReason) && (
                        <div style={{ fontSize: 12, color: 'var(--mr-st-danger-fg)', overflowWrap: 'anywhere' }}>
                          {p.rejectionReason && <strong>{rejectionLabel(p.rejectionReason)}</strong>}
                          {p.rejectionNote && <div>{p.rejectionNote}</div>}
                          {!p.rejectionReason && p.failureReason && <span>{p.failureReason}</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {emailLog && <OrderEmailsSection log={emailLog} orderId={order.id} orderNumber={order.orderNumber} customerName={order.guestContact?.fullName || order.shippingAddressSnapshot.fullName} recipientEmail={emailLog.recipientEmail || order.guestContact?.email} />}

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

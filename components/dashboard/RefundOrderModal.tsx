'use client';

import React, { useCallback, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { apiAdminRefundOrder } from '@/lib/api/refunds';
import type { RefundTicketDto } from '@/lib/api/refunds';
import type { Order } from '@/lib/api/orders';
import type { ApiError } from '@/lib/api/client';
import { formatOrderRef } from '@/lib/orders/order-format';

export interface RefundOrderModalProps {
  order: Order;
  onClose: () => void;
  onRefunded: (ticket: RefundTicketDto) => void;
}

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = new Set(['image/png', 'image/jpeg']);

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that image'));
    reader.readAsDataURL(file);
  });
}

/**
 * There is no payment gateway — Instapay is a bank transfer the admin makes
 * by hand, so "refunding" here is recording money already sent back. The
 * screenshot is optional on purpose: requiring it would block refunds paid
 * in cash or over the counter.
 *
 * Rendered into <body> via createPortal, same pattern as DeleteChoiceDialog
 * and ManualOrderModal — .dash-modal/.dash-modal-backdrop do not exist in
 * dashboard.css, so this reuses .dash-dialog-overlay / .dash-dialog instead
 * of inventing new CSS.
 */
export default function RefundOrderModal({ order, onClose, onRefunded }: RefundOrderModalProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const orderTotal = parseFloat(order.totalAmount);
  const [amount, setAmount] = useState<string>(orderTotal.toFixed(2));
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [proofDataUrl, setProofDataUrl] = useState<string | null>(null);
  const [proofName, setProofName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pickFile = useCallback(async (file: File | undefined) => {
    setError(null);
    if (!file) {
      setProofDataUrl(null);
      setProofName(null);
      return;
    }
    if (!ALLOWED_PROOF_TYPES.has(file.type)) {
      setError('The proof image must be a PNG or JPG.');
      return;
    }
    if (file.size > MAX_PROOF_BYTES) {
      setError('The proof image must be 10 MB or smaller.');
      return;
    }
    try {
      setProofDataUrl(await readAsDataUrl(file));
      setProofName(file.name);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const submit = useCallback(async () => {
    setError(null);

    const parsedAmount = Number(amount);
    if (!reason.trim()) {
      setError('A reason is required.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a refund amount greater than zero.');
      return;
    }
    if (parsedAmount > orderTotal) {
      setError(`The refund cannot be more than the order total (${order.totalCurrency} ${orderTotal.toFixed(2)}).`);
      return;
    }

    setBusy(true);
    try {
      const ticket = await apiAdminRefundOrder(order.id, {
        amountCents: Math.round(parsedAmount * 100),
        reason: reason.trim(),
        ...(note.trim() ? { adminNote: note.trim() } : {}),
        ...(proofDataUrl ? { proofDataUrl } : {}),
      });
      onRefunded(ticket);
    } catch (e) {
      setError((e as ApiError).message ?? 'The refund could not be recorded.');
    } finally {
      setBusy(false);
    }
  }, [amount, reason, note, proofDataUrl, order, orderTotal, onRefunded]);

  if (!mounted) return null;

  return createPortal(
    <div className="dash-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="refund-modal-title">
      <div className="dash-dialog" style={{ maxWidth: 480, width: '90%' }}>
        <h2 id="refund-modal-title" className="dash-section-title" style={{ marginTop: 0 }}>
          Refund order {formatOrderRef(order)}
        </h2>
        <p className="dash-help-text" style={{ marginTop: 0 }}>
          This records an Instapay refund you have already sent. It does not move any money.
        </p>

        {error && <p className="dash-inline-error" style={{ marginBottom: 12 }}>{error}</p>}

        <div className="dash-form-section">
          <label className="dash-field">
            <span className="dash-label" id="refund-amount-label">
              Refund amount ({order.totalCurrency})
            </span>
            <input
              id="refund-amount"
              className="dash-input"
              type="number"
              min="0"
              step="0.01"
              aria-label={`Refund amount (${order.totalCurrency})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="dash-help-text">
              Order total is {order.totalCurrency} {orderTotal.toFixed(2)}.
            </p>
          </label>

          <label className="dash-field">
            <span className="dash-label">Reason</span>
            <input
              id="refund-reason"
              className="dash-input"
              type="text"
              aria-label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this being refunded?"
            />
          </label>

          <label className="dash-field">
            <span className="dash-label">Internal note (optional)</span>
            <input
              id="refund-note"
              className="dash-input"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>

          <label className="dash-field">
            <span className="dash-label">Transfer screenshot (optional)</span>
            <input
              id="refund-proof"
              className="dash-input"
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => void pickFile(e.target.files?.[0])}
            />
            {proofName && (
              <p className="dash-help-text">
                Attached: {proofName}{' '}
                <button
                  type="button"
                  className="dash-btn-ghost"
                  onClick={() => { setProofDataUrl(null); setProofName(null); }}
                >
                  Remove
                </button>
              </p>
            )}
          </label>
        </div>

        <div className="dash-form-actions">
          <button type="button" className="dash-btn-secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="dash-btn-primary" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Recording…' : 'Refund order'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

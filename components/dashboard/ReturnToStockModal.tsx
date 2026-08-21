'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  confirmReturnedToStock,
  getReturnableLines,
  type ReturnableLine,
} from '@/lib/api/fulfillment';
import type { ApiError } from '@/lib/api/client';

const TRACE = 'PG-DASHBOARD-FUL-004';

/**
 * "We have the package back."
 *
 * Deliberately separate from the refund. Refunding money and receiving a parcel
 * are different events — often days apart, and sometimes only one happens at
 * all: a goodwill refund with nothing returned, or a return that arrives
 * damaged and cannot be sold again. Restocking automatically on refund would
 * invent inventory in both cases, so this asks what actually arrived.
 *
 * Per line with an editable quantity, because a partial return is ordinary: a
 * customer sends back one of two bottles. A single whole-order button would
 * force a full restock and then a manual correction, which is how stock drifts.
 *
 * Cancelling BEFORE shipping needs none of this — the reservation is released
 * automatically and the goods are already back on sale.
 */
export default function ReturnToStockModal({
  orderId,
  orderNumber,
  onClose,
  onDone,
}: {
  orderId: string;
  orderNumber?: string;
  onClose: () => void;
  onDone: (credited: number) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [lines, setLines] = useState<ReturnableLine[] | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    getReturnableLines(orderId)
      .then((rows) => {
        if (cancelled) return;
        setLines(rows);
        // Pre-filled with the full returnable quantity: the common case is the
        // whole parcel coming back, so the operator confirms rather than
        // retypes. Anything less is one edit away.
        setQty(Object.fromEntries(rows.map((r) => [r.variantId, r.returnable])));
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError((e as ApiError)?.message ?? 'Could not load this order’s items.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const eligible = (lines ?? []).filter((l) => l.returnable > 0);
  const total = eligible.reduce((sum, l) => sum + (qty[l.variantId] ?? 0), 0);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const results = await confirmReturnedToStock(
        orderId,
        eligible.map((l) => ({ variantId: l.variantId, qty: qty[l.variantId] ?? 0 })),
      );
      onDone(results.reduce((sum, r) => sum + r.returned, 0));
    } catch (e: unknown) {
      setError((e as ApiError)?.message ?? 'Could not record the return.');
      setSaving(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="dash-dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dash-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Confirm returned to stock"
        style={{ maxWidth: 560, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="dash-dialog-title">Package received back</h2>
        <p className="dash-help-text" style={{ marginTop: 0 }}>
          Only what you confirm here goes back on the shelf
          {orderNumber ? ` for order ${orderNumber}` : ''}. Refunding the money
          does not change stock on its own.
        </p>

        {error && <p className="dash-inline-error">{error}</p>}

        {lines === null && !error && (
          <span className="dash-skeleton" style={{ display: 'block', width: '70%', height: 18 }} />
        )}

        {lines !== null && eligible.length === 0 && (
          <p className="dash-help-text">
            Nothing on this order can go back to stock. Either it never shipped —
            in which case cancelling already returned it — or every item has been
            returned already.
          </p>
        )}

        {eligible.map((line) => (
          <div key={line.variantId} className="dash-field">
            <label className="dash-label" htmlFor={`ret-${line.variantId}`}>
              {line.productName || line.sku || 'Item'}
              {line.sku && (
                <span style={{ opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>
                  {' · '}
                  {line.sku}
                </span>
              )}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <input
                id={`ret-${line.variantId}`}
                className="dash-input"
                type="number"
                min={0}
                max={line.returnable}
                value={qty[line.variantId] ?? 0}
                disabled={saving}
                onChange={(e) => {
                  const next = Math.max(
                    0,
                    Math.min(line.returnable, Number(e.target.value) || 0),
                  );
                  setQty((q) => ({ ...q, [line.variantId]: next }));
                }}
                style={{ width: 96 }}
                data-trace-id={`${TRACE}::EL-INPUT-return-qty@${line.variantId}`}
              />
              <span className="dash-help-text" style={{ margin: 0 }}>
                of {line.returnable} returnable
                {line.alreadyReturned > 0 && ` · ${line.alreadyReturned} already back`}
              </span>
            </div>
          </div>
        ))}

        <div className="dash-row-actions" style={{ marginTop: 20 }}>
          <button className="dash-btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="dash-btn-primary"
            onClick={() => void handleSave()}
            // Nothing to record is not an error, but it is not a save either.
            disabled={saving || total <= 0}
            data-trace-id={`${TRACE}::EL-BTN-confirm-returned`}
          >
            {saving
              ? 'Recording…'
              : `Add ${total} item${total === 1 ? '' : 's'} back to stock`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

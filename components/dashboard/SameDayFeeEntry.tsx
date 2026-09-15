'use client';

import React, { useState } from 'react';
import { apiSetSameDayFee } from '@/lib/api/fulfillment';
import type { ApiError } from '@/lib/api/client';
import type { Order } from '@/lib/api/orders';

function egpFromMinor(minor: number): string {
  return `EGP ${(minor / 100).toFixed(2)}`;
}

export interface SameDayFeeEntryProps {
  order: Order;
  onUpdated: (order: Order) => void;
  /** 'compact' fits a queue row; 'full' is the order-detail panel. */
  variant?: 'compact' | 'full';
}

/**
 * The admin's real Uber fee for a same-day order (dashboard#84 /
 * backend#186). Shared by the order-detail page — where it replaces the
 * "Choose method…" fulfilment select for SAME_DAY orders — and the same-day
 * queue's row action.
 *
 * The order must be SAME_DAY and CONFIRMED/PROCESSING (enforced server-side;
 * this component just reflects the outcome). Entered in EGP, sent as
 * `feeMinor = Math.round(egp * 100)`.
 */
export default function SameDayFeeEntry({ order, onUpdated, variant = 'compact' }: SameDayFeeEntryProps) {
  const fee = order.delivery?.sameDayFee ?? null;
  const [value, setValue] = useState(
    fee?.amountMinor != null ? (fee.amountMinor / 100).toFixed(2) : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEnter = order.status === 'CONFIRMED' || order.status === 'PROCESSING';

  const save = async () => {
    setError(null);
    const egp = Number(value);
    if (!Number.isFinite(egp) || egp < 0) {
      setError('Enter a valid EGP amount');
      return;
    }
    const feeMinor = Math.round(egp * 100);
    setBusy(true);
    try {
      const updated = await apiSetSameDayFee(order.id, feeMinor);
      onUpdated(updated);
    } catch (e) {
      setError((e as ApiError).message ?? 'Could not save the fee');
    } finally {
      setBusy(false);
    }
  };

  if (!canEnter && fee?.status !== 'SET') {
    return (
      <span style={{ color: 'var(--mr-fg-4)', fontSize: 12 }}>
        Fee entry opens once the order is confirmed
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {fee?.status === 'SET' && fee.amountMinor != null && (
        <p style={{ margin: 0, fontSize: variant === 'full' ? 14 : 12, color: 'var(--mr-st-ok-fg)' }}>
          Fee set: <strong>{egpFromMinor(fee.amountMinor)}</strong> — total {' '}
          {egpFromMinor(Math.round(Number(order.totalAmount) * 100))}, cash on delivery
        </p>
      )}
      {canEnter && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label className="dash-sr-only" htmlFor={`sdf-${order.id}`}>
            Same-day fee (EGP) for order {order.orderNumber}
          </label>
          <span style={{ fontSize: 12, color: 'var(--mr-fg-3)' }}>EGP</span>
          <input
            id={`sdf-${order.id}`}
            className="dash-input"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            aria-label={`Same-day fee (EGP) for order ${order.orderNumber}`}
            value={value}
            disabled={busy}
            onChange={(e) => setValue(e.target.value)}
            style={{ width: 110, fontSize: 12, padding: '4px 8px' }}
          />
          <button
            type="button"
            className="dash-btn-ok"
            disabled={busy || value.trim() === ''}
            onClick={() => void save()}
            style={variant === 'compact' ? { fontSize: 12, padding: '4px 10px' } : undefined}
          >
            {fee?.status === 'SET' ? 'Update fee' : 'Save fee'}
          </button>
        </div>
      )}
      {error && <p className="dash-inline-error" style={{ margin: 0, fontSize: 12 }}>{error}</p>}
    </div>
  );
}

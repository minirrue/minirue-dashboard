'use client';

import React, { useState, useCallback } from 'react';
import {
  apiAdminSetFulfillmentMethod,
  apiAdminMarkFulfilled,
  type Order,
  type FulfillmentMethod,
} from '@/lib/api/orders';
import type { ApiError } from '@/lib/api/client';
import { FULFILLMENT_LABELS } from '@/lib/orders/order-format';

export interface FulfillmentControlProps {
  order: Order;
  /** 'compact' fits a table cell; 'full' is the order-detail panel. */
  variant?: 'compact' | 'full';
  onUpdated: (order: Order) => void;
  onError: (message: string) => void;
}

function FulfilledBadge({ at }: { at: string | null }) {
  return (
    <span className="dash-status" data-status="delivered">
      <span className="dash-status-dot" />
      Fulfilled
      {at && (
        <span style={{ color: 'var(--mr-fg-4)', fontSize: 11, marginLeft: 6 }}>
          {new Date(at).toLocaleDateString('en-EG', {
            year: 'numeric', month: 'short', day: 'numeric',
          })}
        </span>
      )}
    </span>
  );
}

/**
 * One control, three homes: the Orders table, the order detail page, and a
 * customer's order history. Method first, then the action — an admin cannot
 * fulfil something they have not said how they are sending.
 */
export default function FulfillmentControl({
  order,
  variant = 'compact',
  onUpdated,
  onError,
}: FulfillmentControlProps) {
  const [busy, setBusy] = useState(false);

  const chooseMethod = useCallback(
    async (method: FulfillmentMethod) => {
      setBusy(true);
      try {
        onUpdated(await apiAdminSetFulfillmentMethod(order.id, method));
      } catch (e) {
        onError((e as ApiError).message ?? 'Could not save the fulfillment method');
      } finally {
        setBusy(false);
      }
    },
    [order.id, onUpdated, onError],
  );

  const fulfil = useCallback(async () => {
    setBusy(true);
    try {
      onUpdated(await apiAdminMarkFulfilled(order.id));
    } catch (e) {
      onError((e as ApiError).message ?? 'Could not mark this order fulfilled');
    } finally {
      setBusy(false);
    }
  }, [order.id, onUpdated, onError]);

  if (order.fulfillmentStatus === 'FULFILLED') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <FulfilledBadge at={order.fulfilledAt} />
        {variant === 'full' && order.fulfillmentMethod && (
          <span style={{ color: 'var(--mr-fg-4)', fontSize: 12 }}>
            via {FULFILLMENT_LABELS[order.fulfillmentMethod]}
          </span>
        )}
      </div>
    );
  }

  const cancelled = order.status === 'CANCELLED';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: variant === 'full' ? 'row' : 'column',
        alignItems: variant === 'full' ? 'center' : 'stretch',
        gap: 6,
        minWidth: 150,
      }}
    >
      <label className="dash-sr-only" htmlFor={`ful-${order.id}`}>
        Fulfillment method for order {order.orderNumber}
      </label>
      <select
        id={`ful-${order.id}`}
        className="dash-select"
        aria-label={`Fulfillment method for order ${order.orderNumber}`}
        disabled={busy || cancelled}
        value={order.fulfillmentMethod ?? ''}
        onChange={(e) => {
          const value = e.target.value;
          if (!value) return;
          void chooseMethod(value as FulfillmentMethod);
        }}
        style={{ fontSize: 12, padding: '4px 8px' }}
      >
        <option value="">Choose method…</option>
        <option value="MANUAL">{FULFILLMENT_LABELS.MANUAL}</option>
        <option value="SHIPPING_SERVICE">{FULFILLMENT_LABELS.SHIPPING_SERVICE}</option>
      </select>

      {order.fulfillmentMethod === 'MANUAL' && !cancelled && (
        <button
          type="button"
          className="dash-btn-ok"
          disabled={busy}
          onClick={() => void fulfil()}
          style={variant === 'compact' ? { fontSize: 12, padding: '4px 8px' } : undefined}
        >
          Mark fulfilled
        </button>
      )}

      {order.fulfillmentMethod === 'SHIPPING_SERVICE' && (
        <span style={{ color: 'var(--mr-fg-4)', fontSize: 12 }}>
          Shipping service is not connected yet
        </span>
      )}

      {cancelled && (
        <span style={{ color: 'var(--mr-fg-4)', fontSize: 12 }}>Order cancelled</span>
      )}
    </div>
  );
}

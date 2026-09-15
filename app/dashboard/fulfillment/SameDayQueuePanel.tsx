'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiAdminListOrders, type Order } from '@/lib/api/orders';
import type { ApiError } from '@/lib/api/client';
import SameDayFeeEntry from '@/components/dashboard/SameDayFeeEntry';
import { formatDeliveryWindow, mapsLinkFor } from '@/lib/orders/delivery-format';
import { governorateLabel } from '@/lib/geo/governorates';

/**
 * SAME_DAY orders needing a fee, plus recently-set ones — dashboard#84.
 *
 * `GET /orders/admin` (`lib/api/orders.ts` `apiAdminListOrders`) has no
 * `deliveryMethod` filter today, so this fetches a page of admin orders and
 * filters client-side. Noted on dashboard#84: a `deliveryMethod`/`status`
 * server-side filter on that endpoint would let this scale past one page —
 * filed as a follow-up (see the issue closing comment) rather than widening
 * this slice's backend surface.
 */
const PAGE_LIMIT = 100;

function isQueueCandidate(order: Order): boolean {
  return (
    order.delivery?.method === 'SAME_DAY' &&
    (order.status === 'CONFIRMED' || order.status === 'PROCESSING')
  );
}

export default function SameDayQueuePanel() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiAdminListOrders({ limit: PAGE_LIMIT, page: 1 });
      setOrders(res.data.filter(isQueueCandidate));
    } catch (e) {
      setError((e as ApiError).message ?? 'Could not load the same-day queue');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpdated = (updated: Order) => {
    setOrders((prev) => {
      if (!prev) return prev;
      // A fee just set moves the order out of "needing a fee" — the queue
      // clears it, matching the issue's fixed-when: "Entering EGP 120
      // updates the order total, and the queue clears." Recently-set orders
      // that are still CONFIRMED/PROCESSING stay visible with their fee
      // shown, via isQueueCandidate below.
      return prev.map((o) => (o.id === updated.id ? updated : o));
    });
  };

  if (error) {
    return <p className="dash-inline-error">{error}</p>;
  }

  if (orders === null) {
    return <p className="dash-help-text">Loading same-day orders…</p>;
  }

  const pending = orders.filter((o) => o.delivery?.sameDayFee?.status !== 'SET');
  const recentlySet = orders.filter((o) => o.delivery?.sameDayFee?.status === 'SET');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px' }}>
          <h2 className="dash-section-title" style={{ margin: 0 }}>Needs a fee</h2>
        </div>
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Governorate</th>
                <th>Window</th>
                <th>Address</th>
                <th>Location</th>
                <th>Fee</th>
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 && (
                <tr>
                  <td colSpan={7} className="dash-table-empty">
                    No same-day orders are waiting on a fee.
                  </td>
                </tr>
              )}
              {pending.map((order) => {
                const link = mapsLinkFor(order.delivery?.location ?? null);
                const name =
                  order.guestContact?.fullName ?? order.shippingAddressSnapshot?.fullName ?? '—';
                const gov = order.shippingAddressSnapshot?.governorate ?? '—';
                return (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/orders/${order.id}`} className="dash-link">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td>{name}</td>
                    <td>{governorateLabel(gov)}</td>
                    <td>{formatDeliveryWindow(order.delivery?.window ?? null)}</td>
                    <td style={{ maxWidth: 220, fontSize: 12, color: 'var(--mr-fg-3)' }}>
                      {order.shippingAddressSnapshot?.line1}
                      {order.shippingAddressSnapshot?.line2
                        ? `, ${order.shippingAddressSnapshot.line2}`
                        : ''}
                      , {order.shippingAddressSnapshot?.city}
                    </td>
                    <td>
                      {link ? (
                        <a href={link} target="_blank" rel="noreferrer" className="dash-link">
                          Open in Google Maps
                        </a>
                      ) : (
                        <span style={{ color: 'var(--mr-fg-4)', fontSize: 12 }}>No location</span>
                      )}
                    </td>
                    <td>
                      <SameDayFeeEntry order={order} onUpdated={handleUpdated} variant="compact" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {recentlySet.length > 0 && (
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px' }}>
            <h2 className="dash-section-title" style={{ margin: 0 }}>Recently set</h2>
          </div>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Fee</th>
                </tr>
              </thead>
              <tbody>
                {recentlySet.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/orders/${order.id}`} className="dash-link">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td>
                      {order.guestContact?.fullName ?? order.shippingAddressSnapshot?.fullName ?? '—'}
                    </td>
                    <td>
                      <SameDayFeeEntry order={order} onUpdated={handleUpdated} variant="compact" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

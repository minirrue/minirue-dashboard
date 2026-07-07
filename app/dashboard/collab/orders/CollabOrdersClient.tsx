'use client';



import { useEffect, useState } from 'react';

import {

  CollabEmptyState,

  CollabErrorPanel,

  CollabLoadingBlock,

  CollabPageHeader,

  CollabTableCard,

  formatEgp,

  mapOrderStatus,

} from '@/components/collab/collab-ui';

import { apiCollabOrders } from '@/lib/api/collab-portal';

import type { ApiError } from '@/lib/api/client';



type OrderRow = Record<string, unknown>;



function orderLabel(row: OrderRow): string {

  const id = row.id ?? row.orderId ?? row.order_id;

  if (id) return `#${String(id).slice(0, 8)}`;

  return '—';

}



function orderTotal(row: OrderRow): string | number | null | undefined {

  const v = row.totalAmount ?? row.total_amount;

  if (typeof v === 'string' || typeof v === 'number') return v;

  return null;

}



function orderPlaced(row: OrderRow): string {

  const raw = row.createdAt ?? row.created_at ?? row.date;

  if (!raw) return '—';

  const d = new Date(String(raw));

  return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString('en-GB');

}



export default function CollabOrdersClient() {

  const [items, setItems] = useState<OrderRow[]>([]);

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);



  useEffect(() => {

    apiCollabOrders({ limit: 50 })

      .then((res) => setItems((res.items ?? []) as OrderRow[]))

      .catch((err: ApiError) => setError(err.message || 'Failed to load orders'))

      .finally(() => setLoading(false));

  }, []);



  return (

    <>

      <CollabPageHeader title="Orders" subtitle="Orders attributed to your brand only." />



      {loading ? (

        <CollabLoadingBlock traceId="PG-DASHBOARD-COLLAB-005::EL-REGION-orders-loading" />

      ) : error ? (

        <CollabErrorPanel message={error} traceId="PG-DASHBOARD-COLLAB-005::EL-REGION-orders-error" />

      ) : items.length === 0 ? (

        <CollabEmptyState

          title="No orders yet"

          copy="When customers buy from your brand page, orders appear here."

          traceId="PG-DASHBOARD-COLLAB-005::EL-REGION-orders-empty"

        />

      ) : (

        <CollabTableCard traceId="PG-DASHBOARD-COLLAB-005::EL-TABLE-orders-table">

          <table className="dash-table">

            <thead>

              <tr>

                <th>Order</th>

                <th>Date</th>

                <th>Status</th>

                <th>Total</th>

              </tr>

            </thead>

            <tbody>

              {items.map((row, i) => {

                const rawStatus = String(row.status ?? row.fulfillmentStatus ?? 'pending');

                const { attr, label } = mapOrderStatus(rawStatus);

                const rowKey = String(row.id ?? i);

                return (

                  <tr
                    key={rowKey}
                    data-trace-id={`PG-DASHBOARD-COLLAB-005::EL-ROW-order-row@${rowKey}`}
                  >

                    <td>{orderLabel(row)}</td>

                    <td>{orderPlaced(row)}</td>

                    <td>

                      <span className="dash-status" data-status={attr}>

                        <span className="dash-status-dot" />

                        {label}

                      </span>

                    </td>

                    <td>{formatEgp(orderTotal(row))}</td>

                  </tr>

                );

              })}

            </tbody>

          </table>

        </CollabTableCard>

      )}

    </>

  );

}


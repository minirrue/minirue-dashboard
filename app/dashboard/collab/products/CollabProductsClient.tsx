'use client';



import Link from 'next/link';

import {useState } from 'react';

import {

  CollabEmptyState,

  CollabErrorPanel,

  CollabLoadingBlock,

  CollabPageHeader,

  CollabTableCard,

  formatEgp,

  ProductStatusBadge,

} from '@/components/collab/collab-ui';

import { apiCollabGetBrand, apiCollabProducts } from '@/lib/api/collab-portal';

import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';



type ProductRow = {
  id?: string;
  name?: string;
  published_state?: string;
  publishedState?: string;
  status?: string;
  priceAmount?: string;
  price_amount?: string;
  initialStock?: number;
  stock?: number;
  rejectionReason?: string | null;
  rejection_reason?: string | null;
};



export default function CollabProductsClient() {

  const [items, setItems] = useState<ProductRow[]>([]);

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const [profileComplete, setProfileComplete] = useState(true);



  useMountedEffect(() => {

    let cancelled = false;

    setLoading(true);

    setError(null);

    Promise.all([apiCollabProducts(), apiCollabGetBrand()])

      .then(([products, brand]) => {

        if (cancelled) return;

        setItems((products.items ?? []) as ProductRow[]);

        setProfileComplete(Boolean(brand.displayName?.trim()));

      })

      .catch((err: ApiError) => {

        if (!cancelled) setError(err.message || 'Failed to load products');

      })

      .finally(() => {

        if (!cancelled) setLoading(false);

      });

    return () => {

      cancelled = true;

    };

  }, []);



  return (

    <>

      <CollabPageHeader

        title="Products"

        subtitle="Manage SKUs for your brand storefront."

        action={

          profileComplete ? (

            <Link
              href="/collab/products/new"
              className="dash-btn-primary"
              data-trace-id="PG-DASHBOARD-COLLAB-007::EL-LINK-products-cta"
            >

              Add product

            </Link>

          ) : (

            <Link
              href="/collab/brand"
              className="dash-btn-secondary"
              data-trace-id="PG-DASHBOARD-COLLAB-007::EL-LINK-products-cta"
            >

              Complete brand profile

            </Link>

          )

        }

      />



      {!profileComplete ? (

        <div
          className="dash-role-notice collab-profile-gate"
          data-trace-id="PG-DASHBOARD-COLLAB-007::EL-REGION-products-profile-gate"
        >

          Set your display name on the brand profile before adding products.

        </div>

      ) : null}



      {error ? (

        <CollabErrorPanel message={error} traceId="PG-DASHBOARD-COLLAB-007::EL-REGION-products-error" />

      ) : loading ? (

        <CollabLoadingBlock traceId="PG-DASHBOARD-COLLAB-007::EL-REGION-products-loading" />

      ) : items.length === 0 ? (

        <CollabEmptyState

          title="No products yet"

          copy="Add your first fragrance SKU to start selling on MiniRue."

          traceId="PG-DASHBOARD-COLLAB-007::EL-REGION-products-empty"

          action={

            profileComplete ? (

              <Link href="/collab/products/new" className="dash-btn-primary">

                Add product

              </Link>

            ) : undefined

          }

        />

      ) : (

        <CollabTableCard traceId="PG-DASHBOARD-COLLAB-007::EL-TABLE-products-table">

          <table className="dash-table">

            <thead>

              <tr>

                <th>Name</th>
                <th>Status</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Notes</th>
                <th />

              </tr>

            </thead>

            <tbody>

              {items.map((row, i) => {

                const state =
                  row.published_state ?? row.publishedState ?? row.status ?? 'DRAFT';
                const price = row.priceAmount ?? row.price_amount;
                const stock = row.initialStock ?? row.stock;
                const rejectionReason =
                  row.rejectionReason ?? row.rejection_reason ?? null;
                const showRejection =
                  state === 'REJECTED' && rejectionReason?.trim();
                const rowKey = String(row.id ?? i);

                return (
                  <tr
                    key={rowKey}
                    data-trace-id={`PG-DASHBOARD-COLLAB-007::EL-ROW-product-row@${rowKey}`}
                  >
                    <td>{String(row.name ?? '—')}</td>
                    <td>
                      <ProductStatusBadge state={state} />
                    </td>
                    <td>{formatEgp(price)}</td>
                    <td>{stock != null ? String(stock) : '—'}</td>
                    <td className="collab-rejection-note">
                      {showRejection ? rejectionReason : '—'}
                    </td>
                    <td className="dash-row-actions">

                      {row.id ? (

                        <Link

                          href={`/collab/products/${row.id}/edit`}

                          className="dash-btn-ghost"

                          data-trace-id={`PG-DASHBOARD-COLLAB-007::EL-LINK-product-edit@${row.id}`}

                        >

                          Edit

                        </Link>

                      ) : null}

                    </td>

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


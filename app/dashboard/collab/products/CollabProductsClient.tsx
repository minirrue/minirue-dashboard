'use client';



import Link from 'next/link';

import { useEffect, useState } from 'react';

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



  useEffect(() => {

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

            <Link href="/dashboard/collab/products/new" className="dash-btn-primary">

              Add product

            </Link>

          ) : (

            <Link href="/dashboard/collab/brand" className="dash-btn-secondary">

              Complete brand profile

            </Link>

          )

        }

      />



      {!profileComplete ? (

        <div className="dash-role-notice collab-profile-gate">

          Set your display name on the brand profile before adding products.

        </div>

      ) : null}



      {error ? (

        <CollabErrorPanel message={error} />

      ) : loading ? (

        <CollabLoadingBlock />

      ) : items.length === 0 ? (

        <CollabEmptyState

          title="No products yet"

          copy="Add your first fragrance SKU to start selling on MiniRue."

          action={

            profileComplete ? (

              <Link href="/dashboard/collab/products/new" className="dash-btn-primary">

                Add product

              </Link>

            ) : undefined

          }

        />

      ) : (

        <CollabTableCard>

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

                return (
                  <tr key={String(row.id ?? i)}>
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

                          href={`/dashboard/collab/products/${row.id}/edit`}

                          className="dash-btn-ghost"

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


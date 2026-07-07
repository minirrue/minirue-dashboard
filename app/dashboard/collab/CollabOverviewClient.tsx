'use client';



import Link from 'next/link';

import { useEffect, useState } from 'react';

import {

  CollabEmptyState,

  CollabErrorPanel,

  CollabLoadingBlock,

  CollabPageHeader,

  formatModuleList,

} from '@/components/collab/collab-ui';

import { apiCollabOverview, type CollabOverview } from '@/lib/api/collab-portal';

import type { ApiError } from '@/lib/api/client';



export default function CollabOverviewClient() {

  const [overview, setOverview] = useState<CollabOverview | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);



  useEffect(() => {

    apiCollabOverview()

      .then(setOverview)

      .catch((err: ApiError) => setError(err.message || 'Failed to load overview'))

      .finally(() => setLoading(false));

  }, []);



  if (loading)
    return <CollabLoadingBlock traceId="PG-DASHBOARD-COLLAB-006::EL-REGION-overview-loading" />;



  if (error) {

    return (

      <CollabErrorPanel

        message={error}

        traceId="PG-DASHBOARD-COLLAB-006::EL-REGION-overview-error"

        action={

          <button
            type="button"
            className="dash-btn-secondary"
            onClick={() => window.location.reload()}
            data-trace-id="PG-DASHBOARD-COLLAB-006::EL-BTN-overview-retry"
          >

            Retry

          </button>

        }

      />

    );

  }



  const empty = (overview?.counts.orders ?? 0) === 0 && (overview?.counts.products ?? 0) === 0;

  const title = overview?.displayName || overview?.brandSlug || 'Your brand';

  const moduleSummary = overview?.modules.length ? formatModuleList(overview.modules) : '';



  return (

    <>

      <CollabPageHeader title="Overview" subtitle={`Workspace for ${title}`} />



      <p className="collab-summary-line" data-trace-id="PG-DASHBOARD-COLLAB-006::EL-REGION-overview-summary">

        <span>

          <strong>{overview?.counts.orders ?? 0}</strong> orders

        </span>

        <span className="collab-summary-sep">·</span>

        <span>

          <strong>{overview?.counts.products ?? 0}</strong> products

        </span>

        {moduleSummary ? (

          <>

            <span className="collab-summary-sep">·</span>

            <span>{moduleSummary} enabled</span>

          </>

        ) : null}

      </p>



      {empty ? (

        <CollabEmptyState

          title="Welcome to your brand workspace"

          copy="Complete your brand profile and add your first product to appear on the storefront."

          traceId="PG-DASHBOARD-COLLAB-006::EL-REGION-overview-empty"

          action={

            <div className="collab-action-row collab-action-row--center">

              <Link
                href="/collab/brand"
                className="dash-btn-primary"
                data-trace-id="PG-DASHBOARD-COLLAB-006::EL-LINK-overview-complete-brand-profile"
              >

                Complete brand profile

              </Link>

              {overview?.modules.includes('PRODUCTS') ? (

                <Link
                  href="/collab/products/new"
                  className="dash-btn-secondary"
                  data-trace-id="PG-DASHBOARD-COLLAB-006::EL-LINK-overview-add-first-product"
                >

                  Add first product

                </Link>

              ) : null}

            </div>

          }

        />

      ) : (

        <div
          className="dash-card collab-section-card"
          data-trace-id="PG-DASHBOARD-COLLAB-006::EL-REGION-overview-quicklinks"
        >

          <h2 className="dash-card-title">Quick links</h2>

          <div className="collab-action-row">

            {overview?.modules.includes('PRODUCTS') ? (

              <Link
                href="/collab/products"
                className="dash-btn-secondary"
                data-trace-id="PG-DASHBOARD-COLLAB-006::EL-LINK-overview-manage-products"
              >

                Manage products

              </Link>

            ) : null}

            {overview?.modules.includes('ORDERS') ? (

              <Link
                href="/collab/orders"
                className="dash-btn-secondary"
                data-trace-id="PG-DASHBOARD-COLLAB-006::EL-LINK-overview-view-orders"
              >

                View orders

              </Link>

            ) : null}

            {overview?.modules.includes('ANALYTICS') ? (

              <Link
                href="/collab/analytics"
                className="dash-btn-secondary"
                data-trace-id="PG-DASHBOARD-COLLAB-006::EL-LINK-overview-analytics"
              >

                Analytics

              </Link>

            ) : null}

            <Link
              href="/collab/brand"
              className="dash-btn-ghost"
              data-trace-id="PG-DASHBOARD-COLLAB-006::EL-LINK-overview-brand-profile"
            >

              Brand profile

            </Link>

          </div>

        </div>

      )}

    </>

  );

}


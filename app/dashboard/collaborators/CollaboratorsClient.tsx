'use client';



import React, { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';

import DashboardTable from '@/components/dashboard/DashboardTable';

import type { Column } from '@/components/dashboard/DashboardTable';

import {

  CollaboratorModuleChips,

  CollaboratorStatusBadge,

  CollabEmptyState,

  CollabLoadingBlock,

} from '@/components/collab/collab-ui';

import {

  apiListCollaborators,

  type CollaboratorListItem,

  type CollaboratorStatus,

} from '@/lib/api/collaborators';

import type { ApiError } from '@/lib/api/client';



const COLUMNS: Column<CollaboratorListItem>[] = [

  {

    key: 'brandName',

    label: 'Brand',

    sortable: true,

    render: (row) => (

      <Link
        href={`/collaborators/${row.id}`}
        className="dash-link"
        data-trace-id={`PG-DASHBOARD-COLLAB-011::EL-LINK-collaborator-name@${row.id}`}
      >

        {row.brandName}

      </Link>

    ),

  },

  {

    key: 'email',

    label: 'Email',

    render: (row) => row.email,

  },

  {

    key: 'brandSlug',

    label: 'Slug',

    render: (row) => <code className="collab-slug-code">{row.brandSlug}</code>,

  },

  {

    key: 'status',

    label: 'Status',

    render: (row) => <CollaboratorStatusBadge status={row.status} />,

  },

  {

    key: 'modules',

    label: 'Access',

    render: (row) => <CollaboratorModuleChips modules={row.modules} />,

  },

  {

    key: '_actions',

    label: '',

    align: 'right',

    render: (row) => (

      <Link
        href={`/collaborators/${row.id}`}
        className="dash-btn-ghost"
        data-trace-id={`PG-DASHBOARD-COLLAB-011::EL-LINK-collaborator-manage@${row.id}`}
      >

        Manage

      </Link>

    ),

  },

];



export default function CollaboratorsClient() {

  const [items, setItems] = useState<CollaboratorListItem[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');



  const load = useCallback(async () => {

    setLoading(true);

    setError(null);

    try {

      const res = await apiListCollaborators({

        status: statusFilter ? (statusFilter as CollaboratorStatus) : undefined,

        limit: 50,

      });

      setItems(res.items);

    } catch (e) {

      const err = e as ApiError;

      setError(err.message || 'Failed to load collaborators');

    } finally {

      setLoading(false);

    }

  }, [statusFilter]);



  useEffect(() => {

    void load();

  }, [load]);



  return (

    <>

      <div className="dash-page-header">

        <div>

          <h1 className="dash-page-title">Collaborators</h1>

          <p className="dash-page-subtitle">

            Brand partners with scoped dashboard access and storefront presence.

          </p>

        </div>

        <div className="collab-action-row" style={{ marginTop: 0 }}>

          <Link
            href="/collaborators/review"
            className="dash-btn-secondary"
            data-trace-id="PG-DASHBOARD-COLLAB-011::EL-LINK-list-review-queue"
          >

            Review queue

          </Link>

          <Link
            href="/collaborators/new"
            className="dash-btn-primary"
            data-trace-id="PG-DASHBOARD-COLLAB-011::EL-LINK-list-add-collaborator"
          >

            Add collaborator

          </Link>

        </div>

      </div>



      <div className="dash-toolbar" style={{ marginBottom: 16 }}>

        <select

          className="dash-select"

          value={statusFilter}

          onChange={(e) => setStatusFilter(e.target.value)}

          aria-label="Filter by status"

          data-trace-id="PG-DASHBOARD-COLLAB-011::EL-SELECT-list-status-filter"

        >

          <option value="">All statuses</option>

          <option value="PENDING_ACTIVATION">Pending activation</option>

          <option value="ACTIVE">Active</option>

          <option value="SUSPENDED">Suspended</option>

          <option value="ARCHIVED">Archived</option>

        </select>

      </div>



      {error ? (
        <p
          className="dash-inline-error"
          data-trace-id="PG-DASHBOARD-COLLAB-011::EL-REGION-list-inline-error"
        >
          {error}
        </p>
      ) : null}



      {loading ? (

        <CollabLoadingBlock traceId="PG-DASHBOARD-COLLAB-011::EL-REGION-list-loading" />

      ) : items.length === 0 && !error && !statusFilter ? (

        <CollabEmptyState

          title="No collaborators yet"

          copy="Provision a brand partner to give them a scoped workspace and storefront page."

          traceId="PG-DASHBOARD-COLLAB-011::EL-REGION-list-empty"

          action={

            <Link
              href="/collaborators/new"
              className="dash-btn-primary"
              data-trace-id="PG-DASHBOARD-COLLAB-011::EL-LINK-list-empty-add-collaborator"
            >

              Add collaborator

            </Link>

          }

        />

      ) : (

        <DashboardTable
          columns={COLUMNS}
          data={items}
          emptyMessage="No collaborators match this filter."
          tableTraceId="PG-DASHBOARD-COLLAB-011::EL-TABLE-collaborators-table"
          getRowTraceId={(row) => `PG-DASHBOARD-COLLAB-011::EL-ROW-collaborator-row@${row.id}`}
        />

      )}

    </>

  );

}


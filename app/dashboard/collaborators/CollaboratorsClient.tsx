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

      <Link href={`/dashboard/collaborators/${row.id}`} className="dash-link">

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

    label: 'Modules',

    render: (row) => <CollaboratorModuleChips modules={row.modules} />,

  },

  {

    key: '_actions',

    label: '',

    align: 'right',

    render: (row) => (

      <Link href={`/dashboard/collaborators/${row.id}`} className="dash-btn-ghost">

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

          <Link href="/dashboard/collaborators/review" className="dash-btn-secondary">

            Review queue

          </Link>

          <Link href="/dashboard/collaborators/new" className="dash-btn-primary">

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

        >

          <option value="">All statuses</option>

          <option value="PENDING_ACTIVATION">Pending activation</option>

          <option value="ACTIVE">Active</option>

          <option value="SUSPENDED">Suspended</option>

        </select>

      </div>



      {error ? <p className="dash-inline-error">{error}</p> : null}



      {loading ? (

        <CollabLoadingBlock />

      ) : items.length === 0 && !error && !statusFilter ? (

        <CollabEmptyState

          title="No collaborators yet"

          copy="Provision a brand partner to give them a scoped workspace and storefront page."

          action={

            <Link href="/dashboard/collaborators/new" className="dash-btn-primary">

              Add collaborator

            </Link>

          }

        />

      ) : (

        <DashboardTable columns={COLUMNS} data={items} emptyMessage="No collaborators match this filter." />

      )}

    </>

  );

}


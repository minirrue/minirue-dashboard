'use client';



import React, {useCallback, useState } from 'react';

import Link from 'next/link';
import PartnersOversightClient from '@/app/dashboard/partners/PartnersOversightClient';

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
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import { useClearNavBadge } from '@/lib/hooks/use-clear-nav-badge';
import { HREF_CATEGORIES } from '@/lib/notifications/nav-counts';



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
  // Clears the Collaborators badge the moment this screen is open, instead
  // of leaving it lit until the next 60s poll — this screen previously never
  // called useClearNavBadge at all, so just being on it never cleared it.
  useClearNavBadge(HREF_CATEGORIES['/collaborators']);

  const [items, setItems] = useState<CollaboratorListItem[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  /**
   * Which half of the merged screen is showing.
   *
   * `list` manages collaborators; `oversight` is what the Partners screen was —
   * standing, access and sales per partner, plus the super admin's "open the
   * dashboard as them". Two nav entries for one relationship meant moving
   * between screens for no reason a user could perceive.
   */
  const [view, setView] = useState<'list' | 'oversight'>('list');
  const [statusFilter, setStatusFilter] = useState('');



  const load = useCallback(async () => {

    setLoading(true);

    setError(null);

    try {

      const res = await apiListCollaborators({

        status: statusFilter ? (statusFilter as CollaboratorStatus) : undefined,

        limit: 50,

      });

      // Guarded: a response missing this key set state to undefined and the
      // next .map()/.reduce() blanked the whole tab. Same bug as Settings
      // and Loyalty had.
      setItems(Array.isArray(res?.items) ? res.items : []);

    } catch (e) {

      const err = e as ApiError;

      setError(err.message || 'Failed to load collaborators');

    } finally {

      setLoading(false);

    }

  }, [statusFilter]);



  useMountedEffect(() => {

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

          {/* Partners used to be its own nav entry and its own screen, for what
              is operationally one relationship: you managed a partner here and
              watched them there. It is a view of this screen now, not a
              separate destination — grouped behind a switch rather than stacked
              into one wall of controls, so the merged page stays usable at
              laptop width. */}
          <div
            className="dash-segmented"
            role="tablist"
            aria-label="Collaborators view"
            style={{ display: 'flex', gap: 4, marginRight: 8 }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === 'list'}
              className={view === 'list' ? 'dash-btn-primary' : 'dash-btn-secondary'}
              onClick={() => setView('list')}
              data-trace-id="PG-DASHBOARD-COLLAB-011::EL-TAB-list"
            >
              Collaborators
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'oversight'}
              className={
                view === 'oversight' ? 'dash-btn-primary' : 'dash-btn-secondary'
              }
              onClick={() => setView('oversight')}
              data-trace-id="PG-DASHBOARD-COLLAB-011::EL-TAB-oversight"
            >
              Business &amp; performance
            </button>
          </div>

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



      {view === 'oversight' ? (
        <PartnersOversightClient />
      ) : (
      <>
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
      )}

    </>

  );

}


'use client';

/**
 * Inventory domain — Warehouses management.
 *
 * [TBD] Warehouses are NOT in the MVP spec (01-spec.md: "No multi-warehouse in MVP").
 *       This page is built to spec for the dashboard task but the backend endpoints
 *       GET /v1/inventory/warehouses and POST /v1/inventory/warehouses do not exist yet.
 *       The table will show an empty state until the endpoints are implemented.
 *
 * [TBD] Active toggle (enable/disable warehouse) — no PATCH endpoint defined.
 */

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import DashboardTable from '@/components/dashboard/DashboardTable';
import type { Column } from '@/components/dashboard/DashboardTable';
import { listWarehouses, createWarehouse } from '@/lib/inventory/api';
import type { WarehouseRow } from '@/lib/inventory/api';
import type { ApiError } from '@/lib/api/client';

/* ── Skeleton ── */
function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              {['Name', 'Location Code', 'Active'].map((h) => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: count }).map((_, i) => (
              <tr key={i}>
                {[140, 100, 60].map((w, j) => (
                  <td key={j}>
                    <span className="dash-skeleton" style={{ display: 'block', width: w, height: 14 }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const COLUMNS: Column<WarehouseRow>[] = [
  {
    key: 'name',
    label: 'Name',
    sortable: true,
  },
  {
    key: 'locationCode',
    label: 'Location Code',
    sortable: true,
    render: (row) => <code style={{ fontSize: 12 }}>{row.locationCode}</code>,
  },
  {
    key: 'isActive',
    label: 'Active',
    render: (row) => (
      <span
        className="dash-status"
        data-status={row.isActive ? 'published' : 'archived'}
      >
        <span className="dash-status-dot" />
        {row.isActive ? 'Active' : 'Inactive'}
      </span>
    ),
  },
];

export default function WarehousesClient() {
  const [items, setItems] = useState<WarehouseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Add warehouse inline form */
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formLocationCode, setFormLocationCode] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listWarehouses();
      setItems(res.data);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message ?? 'Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function validateForm(): boolean {
    const errs: Record<string, string> = {};
    if (!formName.trim()) errs.name = 'Name is required';
    if (!formLocationCode.trim()) errs.locationCode = 'Location code is required';
    if (formLocationCode && !/^[A-Z0-9_-]+$/i.test(formLocationCode)) {
      errs.locationCode = 'Location code: alphanumeric, hyphens, underscores only';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleAddWarehouse(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validateForm()) return;

    setFormSubmitting(true);
    try {
      await createWarehouse({
        name: formName.trim(),
        locationCode: formLocationCode.trim().toUpperCase(),
      });
      setFormName('');
      setFormLocationCode('');
      setShowForm(false);
      await load();
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 409) {
        setFormError('A warehouse with that location code already exists.');
      } else {
        setFormError(err.message ?? 'Failed to create warehouse.');
      }
    } finally {
      setFormSubmitting(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Warehouses</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--mr-fg-4)' }}>
            [TBD — multi-warehouse not in MVP spec. Endpoints pending.]
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/inventory" className="dash-btn-secondary">
            Back to Inventory
          </Link>
          {!showForm && (
            <button
              className="dash-btn-primary"
              onClick={() => setShowForm(true)}
            >
              Add Warehouse
            </button>
          )}
        </div>
      </div>

      {/* Inline add form */}
      {showForm && (
        <div className="dash-form-card" style={{ maxWidth: 480, marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>New Warehouse</h2>
          <form onSubmit={handleAddWarehouse} noValidate>
            <div className="dash-inline-form">
              <div className="dash-form-section">
                <label className="dash-label" htmlFor="wh-name">Name</label>
                <input
                  id="wh-name"
                  type="text"
                  className={`dash-input${formErrors.name ? ' dash-input-error' : ''}`}
                  placeholder="e.g. London Warehouse"
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    setFormErrors((p) => ({ ...p, name: '' }));
                  }}
                />
                {formErrors.name && <p className="dash-inline-error">{formErrors.name}</p>}
              </div>

              <div className="dash-form-section">
                <label className="dash-label" htmlFor="wh-code">Location Code</label>
                <input
                  id="wh-code"
                  type="text"
                  className={`dash-input${formErrors.locationCode ? ' dash-input-error' : ''}`}
                  placeholder="e.g. LDN-01"
                  value={formLocationCode}
                  onChange={(e) => {
                    setFormLocationCode(e.target.value);
                    setFormErrors((p) => ({ ...p, locationCode: '' }));
                  }}
                />
                {formErrors.locationCode && (
                  <p className="dash-inline-error">{formErrors.locationCode}</p>
                )}
              </div>

              {formError && <p className="dash-inline-error">{formError}</p>}

              <div className="dash-form-actions">
                <button type="submit" className="dash-btn-primary" disabled={formSubmitting}>
                  {formSubmitting ? 'Creating...' : 'Create Warehouse'}
                </button>
                <button
                  type="button"
                  className="dash-btn-secondary"
                  onClick={() => {
                    setShowForm(false);
                    setFormName('');
                    setFormLocationCode('');
                    setFormErrors({});
                    setFormError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <SkeletonRows />
      ) : error ? (
        <div className="dash-card">
          <p className="dash-inline-error">{error}</p>
          <button className="dash-btn-secondary" style={{ marginTop: 12 }} onClick={load}>
            Retry
          </button>
        </div>
      ) : (
        <DashboardTable<WarehouseRow>
          columns={COLUMNS}
          data={items}
          pageSize={20}
          emptyMessage="No warehouses configured. [TBD — multi-warehouse not in MVP spec.]"
        />
      )}
    </>
  );
}

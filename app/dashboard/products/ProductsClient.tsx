'use client';

import React, { useEffect, useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardTable from '@/components/dashboard/DashboardTable';
import StatusBadge from '@/components/dashboard/StatusBadge';
import type { Column } from '@/components/dashboard/DashboardTable';
import type { StatusKind } from '@/components/dashboard/StatusBadge';
import type { ProductListItem, ProductStatus } from '@/lib/catalog/types';
import { listProducts, publishProduct, archiveProduct } from '@/lib/catalog/api';
import type { ApiError } from '@/lib/api/client';

/* ── Row type for table ── */
interface ProductRow extends ProductListItem {
  _actions?: undefined;
}

/* ── Skeleton ── */
function SkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              {['Product', 'Brand', 'Status', 'Variants', 'Price Range', 'Created', 'Actions'].map(
                (h) => (
                  <th key={h}>{h}</th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: count }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 7 }).map((__, j) => (
                  <td key={j}>
                    <span className="dash-skeleton" style={{ width: j === 6 ? 80 : '80%' }} />
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

/* ── Helpers ── */
function formatPriceRange(item: ProductListItem): string {
  if (item.priceMin == null) return '—';
  const fmt = (n: number) =>
    `${item.currency === 'USD' ? '$' : item.currency}${n.toLocaleString()}`;
  if (item.priceMin === item.priceMax) return fmt(item.priceMin);
  return `${fmt(item.priceMin)} – ${fmt(item.priceMax ?? item.priceMin)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusToKind(s: ProductStatus): StatusKind {
  return s.toLowerCase() as StatusKind;
}

const STATUS_OPTIONS: Array<{ value: '' | ProductStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
];

/* ── Main Component ── */
export default function ProductsClient() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'' | ProductStatus>('');
  const [brandFilter, setBrandFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await listProducts({
        status: statusFilter || undefined,
        brand: brandFilter || undefined,
        search: search || undefined,
        limit: 50,
      });
      setItems(res.items);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message ?? 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, brandFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  /* Search submit on Enter */
  function handleSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') setSearch(searchInput);
  }

  async function handlePublish(id: string) {
    setActionError(null);
    setActionLoadingId(id);
    try {
      await publishProduct(id);
      await load();
    } catch (e) {
      const err = e as ApiError;
      setActionError(err.message ?? 'Publish failed');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleArchive(id: string) {
    setActionError(null);
    setActionLoadingId(id);
    try {
      await archiveProduct(id);
      await load();
    } catch (e) {
      const err = e as ApiError;
      setActionError(err.message ?? 'Archive failed');
    } finally {
      setActionLoadingId(null);
    }
  }

  const columns: Column<ProductRow>[] = [
    {
      key: 'name',
      label: 'Product',
      sortable: true,
      render: (row) => (
        <Link href={`/dashboard/products/${row.id}/edit`} className="dash-link">
          {row.name}
        </Link>
      ),
    },
    { key: 'brand', label: 'Brand', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={statusToKind(row.status)} />,
    },
    { key: 'variantCount', label: 'Variants', align: 'right' as const, sortable: true },
    {
      key: 'priceMin',
      label: 'Price Range',
      align: 'right' as const,
      render: (row) => formatPriceRange(row),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: '_actions',
      label: 'Actions',
      render: (row) => (
        <div className="dash-row-actions">
          <Link href={`/dashboard/products/${row.id}/edit`} className="dash-btn-ghost">
            Edit
          </Link>
          {row.status !== 'PUBLISHED' && (
            <button
              className="dash-btn-ghost dash-btn-ok"
              disabled={actionLoadingId === row.id}
              onClick={() => startTransition(() => { handlePublish(row.id); })}
            >
              Publish
            </button>
          )}
          {row.status !== 'ARCHIVED' && (
            <button
              className="dash-btn-ghost dash-btn-muted"
              disabled={actionLoadingId === row.id}
              onClick={() => startTransition(() => { handleArchive(row.id); })}
            >
              Archive
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Header */}
      <div className="dash-page-header">
        <h1 className="dash-page-title">Products</h1>
        <Link href="/dashboard/products/new" className="dash-btn-primary">
          New Product
        </Link>
      </div>

      {/* Filters */}
      <div className="dash-filters">
        <select
          className="dash-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | ProductStatus)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          className="dash-input"
          placeholder="Brand"
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
        />
        <input
          className="dash-input dash-input-search"
          placeholder="Search products…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={handleSearchKey}
        />
        <button
          className="dash-btn-secondary"
          onClick={() => setSearch(searchInput)}
        >
          Search
        </button>
      </div>

      {/* Errors */}
      {actionError && (
        <p className="dash-inline-error" style={{ marginBottom: 12 }}>
          {actionError}
        </p>
      )}

      {/* Table */}
      {loading || isPending ? (
        <SkeletonRows />
      ) : error ? (
        <div className="dash-card">
          <p className="dash-inline-error">{error}</p>
          <button className="dash-btn-secondary" style={{ marginTop: 12 }} onClick={load}>
            Retry
          </button>
        </div>
      ) : (
        <DashboardTable<ProductRow>
          columns={columns}
          data={items}
          pageSize={20}
          emptyMessage="No products found. Create your first product to get started."
        />
      )}
    </>
  );
}

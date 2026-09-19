'use client';

import React, { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardTable from '@/components/dashboard/DashboardTable';
import RowActionsMenu from '@/components/dashboard/RowActionsMenu';
import StatusBadge from '@/components/dashboard/StatusBadge';
import type { Column } from '@/components/dashboard/DashboardTable';
import type { StatusKind } from '@/components/dashboard/StatusBadge';
import type { Category, ProductListItem, ProductStatus } from '@/lib/catalog/types';
import {
  listProducts,
  publishProduct,
  archiveProduct,
  listManagedBrands,
  softDeleteProduct,
  hardDeleteProduct,
  listCategories,
} from '@/lib/catalog/api';
import type { ManagedBrand } from '@/lib/catalog/api';
import type { ApiError } from '@/lib/api/client';
import DeleteChoiceDialog from '@/components/dashboard/DeleteChoiceDialog';
import CatalogSubnav from '@/components/dashboard/CatalogSubnav';
import UploadPreviewImage from '@/components/dashboard/UploadPreviewImage';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import CopyButton from '@/components/dashboard/CopyButton';
import { apiAccountingOverview, type PricingMode } from '@/lib/api/accounting';

/* ── Row type for table ── */
interface ProductRow extends ProductListItem {
  priceMode: PricingMode | 'MIXED' | null;
  stockAvailable: number;
  _actions?: undefined;
}

/* ── Skeleton ── */
function SkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <div
      className="dash-card"
      style={{ padding: 0, overflow: 'hidden' }}
      data-trace-id="PG-DASHBOARD-CAT-001::EL-REGION-products-table-skeleton"
    >
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              {['Product', 'Brand', 'SKU', 'Price', 'Stock', 'Status', 'Created', 'Actions'].map(
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Total map, not a blind cast: `s.toLowerCase() as StatusKind` compiled fine
// and was silently wrong the moment PENDING_REVIEW/REJECTED joined
// ProductStatus but StatusKind's cases lagged behind. A missing case here is
// now a caught `?? 'draft'` fallback, not an untyped guess.
const STATUS_KIND: Record<ProductStatus, StatusKind> = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
  PENDING_REVIEW: 'pending_review',
  REJECTED: 'rejected',
};
function statusToKind(s: ProductStatus): StatusKind {
  return STATUS_KIND[s] ?? 'draft';
}

type StockFilter = '' | 'IN' | 'LOW' | 'OUT';
type PriceModeFilter = '' | PricingMode | 'MIXED';

function stockState(quantity: number): Exclude<StockFilter, ''> {
  if (quantity <= 0) return 'OUT';
  if (quantity <= 5) return 'LOW';
  return 'IN';
}

function formatPrice(row: ProductRow): string {
  if (row.priceMin == null) return 'No price';
  const money = (value: number) => value.toLocaleString('en-EG', { maximumFractionDigits: 2 });
  return row.priceMax != null && row.priceMax !== row.priceMin
    ? `${row.currency} ${money(row.priceMin)}–${money(row.priceMax)}`
    : `${row.currency} ${money(row.priceMin)}`;
}

function replaceCatalogueQuery(patch: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(patch)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
}

const STATUS_OPTIONS: Array<{ value: '' | ProductStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'PENDING_REVIEW', label: 'Waiting for review' },
  { value: 'REJECTED', label: 'Rejected' },
];


/**
 * The row actions, drawn rather than written.
 *
 * Labels cost three words of width each on a table that now carries a
 * composite SKU as well as two thumbnails (owner, 2026-08-21: "make the 3
 * action buttons icons only for better spacing for sku long one"). One stroke
 * weight across all three so they read as a set.
 *
 * Every one keeps an `aria-label` and a `title` at the call site: an icon-only
 * control is unlabelled to a screen reader and unguessable to anyone who has
 * not used it before, and dropping the visible word does not remove the need
 * for a name.
 */
const ICON = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' } as const;
const STROKE = { stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function EditIcon() {
  return (
    <svg {...ICON} aria-hidden="true">
      <path d="M4 20h4l10-10a2.1 2.1 0 0 0-3-3L5 17v3Z" {...STROKE} />
      <path d="M13.5 6.5 17.5 10.5" {...STROKE} />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg {...ICON} aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="4" rx="1" {...STROKE} />
      <path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5" {...STROKE} />
      <path d="M10 12h4" {...STROKE} />
    </svg>
  );
}

function PublishIcon() {
  return (
    <svg {...ICON} aria-hidden="true">
      <path d="M12 19V5" {...STROKE} />
      <path d="m6 11 6-6 6 6" {...STROKE} />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg {...ICON} aria-hidden="true">
      <path d="M4.5 6.5h15" {...STROKE} />
      <path d="M9.5 6.5V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" {...STROKE} />
      <path d="M6.5 6.5 7.5 19a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1l1-12.5" {...STROKE} />
    </svg>
  );
}

/* ── Main Component ── */
export default function ProductsClient() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'' | ProductStatus>('');
  const [brandFilter, setBrandFilter] = useState('');
  const [brands, setBrands] = useState<ManagedBrand[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [stockFilter, setStockFilter] = useState<StockFilter>('');
  const [priceModeFilter, setPriceModeFilter] = useState<PriceModeFilter>('');
  const [pricingModes, setPricingModes] = useState<Record<string, PricingMode | 'MIXED'>>({});
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearchInput = useDebounce(searchInput, 350);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductListItem | null>(null);

  useEffect(() => {
    // MiniRue's own catalogue only — a partner's makers live under
    // Collaborators, not this screen.
    listManagedBrands({ space: 'house' })
      .then(setBrands)
      .catch(() => setBrands([]));
  }, []);

  useEffect(() => {
    listCategories({ space: 'house' })
      .then((res) => setCategories(Array.isArray(res.items) ? res.items : []))
      .catch(() => setCategories([]));
  }, []);

  // Deep-links here with ?brandId=<id> (e.g. from the Brands tab). Read once
  // on mount rather than through useSearchParams, which would force a
  // Suspense boundary on this page for a one-time seed. A blank or unknown
  // value just leaves the filter on "All brands". Filtering by id rather than
  // name is what makes this unambiguous now that two spaces can each have a
  // brand called the same thing.
  useMountedEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const brandId = params.get('brandId');
    if (brandId) setBrandFilter(brandId);
    const size = Number(params.get('size'));
    if (size === 20 || size === 50 || size === 100) setPageSize(size);
    const requestedPage = Number(params.get('page'));
    if (Number.isInteger(requestedPage) && requestedPage > 0) setPage(requestedPage - 1);
  }, []);

  const load = useCallback(
    async (searchOverride?: string) => {
      setError(null);
      setLoading(true);
      try {
        const query = {
          status: statusFilter || undefined,
          brandId: brandFilter || undefined,
          space: 'house' as const,
          search: (searchOverride ?? debouncedSearchInput) || undefined,
          limit: 100,
        };
        const first = await listProducts({ ...query, page: 1 });
        const all = [...first.items];
        for (let nextPage = 2; all.length < first.total; nextPage += 1) {
          const next = await listProducts({ ...query, page: nextPage });
          if (next.items.length === 0) break;
          all.push(...next.items);
        }
        // Guarded: a response missing this key set state to undefined and the
        // next .map()/.reduce() blanked the whole tab. Same bug as Settings
        // and Loyalty had.
        setItems(Array.isArray(all) ? all : []);
        try {
          const overview = await apiAccountingOverview();
          const grouped = new Map<string, Set<PricingMode>>();
          for (const variant of overview.variants ?? []) {
            const modes = grouped.get(variant.productId) ?? new Set<PricingMode>();
            modes.add(variant.mode);
            grouped.set(variant.productId, modes);
          }
          setPricingModes(Object.fromEntries(
            [...grouped].map(([productId, modes]) => [
              productId,
              modes.size > 1 ? 'MIXED' : ([...modes][0] ?? 'MANUAL'),
            ]),
          ));
        } catch {
          // Catalogue access is wider than Accounting access. Keep products
          // usable for staff even when price-mode metadata is unavailable.
          setPricingModes({});
        }
      } catch (e) {
        const err = e as ApiError;
        setError(err.message ?? 'Failed to load products');
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, brandFilter, debouncedSearchInput],
  );

  useMountedEffect(() => {
    load();
  }, [load]);

  /* Search submit — immediate trigger, bypassing the debounce wait */
  function triggerImmediateSearch() {
    // `load` takes the term directly; there was also a `search` state set here
    // and read nowhere — the query uses `debouncedSearchInput`. All it did was
    // force an extra render on every submit.
    load(searchInput);
  }

  function handleSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') triggerImmediateSearch();
  }

  function resetPage() {
    setPage(0);
    replaceCatalogueQuery({ page: null });
  }

  const rows = useMemo<ProductRow[]>(() => items
    .map((item) => ({
      ...item,
      priceMode: pricingModes[item.id] ?? null,
      stockAvailable: item.stockAvailable ?? 0,
    }))
    .filter((item) => !categoryFilter || item.categoryId === categoryFilter)
    .filter((item) => !stockFilter || stockState(item.stockAvailable) === stockFilter)
    .filter((item) => !priceModeFilter || item.priceMode === priceModeFilter), [
      items,
      pricingModes,
      categoryFilter,
      stockFilter,
      priceModeFilter,
    ]);

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

  async function handleSoftDelete(id: string) {
    await softDeleteProduct(id);
    setDeleteTarget(null);
    await load();
  }

  async function handleHardDelete(id: string) {
    await hardDeleteProduct(id);
    setDeleteTarget(null);
    await load();
  }

  const columns: Column<ProductRow>[] = [
    {
      key: 'name',
      label: 'Product',
      sortable: true,
      // The cover photo beside the name. A catalogue is scanned by picture
      // long before it is read by name (owner, 2026-08-21).
      render: (row) => (
        <Link
          href={`/catalogue/products/${row.id}/edit`}
          className="dash-link"
          data-trace-id={`PG-DASHBOARD-CAT-001::EL-LINK-product-name@${row.id}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}
        >
          {row.coverUrl ? (
            <UploadPreviewImage
              src={row.coverUrl}
              alt=""
              width={36}
              height={44}
              style={{
                width: 36,
                height: 44,
                borderRadius: 4,
                // 'cover' here, unlike a brand logo: a product photo is a
                // photograph, and filling the frame is the right crop for one.
                objectFit: 'cover',
                background: 'var(--mr-dash-sub, #f4f1ec)',
                flexShrink: 0,
              }}
            />
          ) : (
            <span
              aria-hidden="true"
              title="No photo yet"
              style={{
                width: 36,
                height: 44,
                borderRadius: 4,
                flexShrink: 0,
                display: 'inline-block',
                background: 'var(--mr-dash-sub, #f4f1ec)',
                border: '1px solid var(--mr-dash-hair)',
              }}
            />
          )}
          <span style={{ minWidth: 0, overflowWrap: 'break-word' }}>{row.name}</span>
        </Link>
      ),
    },
    {
      key: 'brandName',
      label: 'Brand',
      sortable: true,
      // The logo, then the name. A shop with several perfume houses is far
      // quicker to scan by mark than by reading each name (owner, 2026-08-21).
      render: (row) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {row.brandImageUrl ? (
            <UploadPreviewImage
              src={row.brandImageUrl}
              alt=""
              width={20}
              height={20}
              style={{
                width: 20,
                height: 20,
                borderRadius: 3,
                // 'contain' — a brand image is a wordmark, and the backend now
                // serves it as a fit resize. See resolveGalleryImage.
                objectFit: 'contain',
                background: 'var(--mr-dash-sub, #f4f1ec)',
                flexShrink: 0,
              }}
            />
          ) : null}
          <span style={{ minWidth: 0, overflowWrap: 'break-word' }}>{row.brandName}</span>
        </span>
      ),
    },
    {
      key: 'sku',
      label: 'SKU',
      render: (row) => row.sku ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
          <span style={{ fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{row.sku}</span>
          <CopyButton
            value={row.sku}
            traceId={`PG-DASHBOARD-CAT-001::EL-BTN-copy-sku@${row.id}`}
          />
        </span>
      ) : <span style={{ opacity: 0.45 }}>—</span>,
    },
    {
      key: 'priceMin',
      label: 'Price',
      sortable: true,
      render: (row) => (
        <span className="dash-product-price-cell">
          <strong>{formatPrice(row)}</strong>
          {row.priceMode ? (
            <span className="dash-status" data-status={row.priceMode === 'SYSTEM' ? 'processing' : row.priceMode === 'MIXED' ? 'warn' : 'draft'}>
              {row.priceMode === 'SYSTEM' ? 'System' : row.priceMode === 'MIXED' ? 'Mixed' : 'My price'}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'stockAvailable',
      label: 'Stock available',
      sortable: true,
      // Centered (#99): the pill itself was already centered within its own
      // box (`justify-content: center` on .dash-stock-quantity), but the
      // <td> around it defaults to left, so the pill sat flush against the
      // column's left edge instead of under "Stock available"'s own centre.
      align: 'center',
      render: (row) => (
        <span className="dash-stock-quantity" data-stock={stockState(row.stockAvailable).toLowerCase()}>
          {row.stockAvailable}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span data-trace-id={`PG-DASHBOARD-CAT-001::EL-BADGE-product-status@${row.id}`}>
          <StatusBadge status={statusToKind(row.status)} />
        </span>
      ),
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
      align: 'right',
      // One "..." trigger opening a dropdown (#99), replacing what used to be
      // up to four separate icon buttons crowding the narrowest column on the
      // table's widest row. Each entry keeps the exact handler — and the
      // exact confirm flow for Delete (DeleteChoiceDialog below) — it had as
      // a standalone button; only how it's reached changed.
      render: (row) => (
        <RowActionsMenu
          label={`Actions for ${row.name}`}
          triggerTraceId={`PG-DASHBOARD-CAT-001::EL-BTN-row-actions@${row.id}`}
          items={[
            {
              key: 'edit',
              label: 'Edit',
              icon: <EditIcon />,
              onClick: () => router.push(`/catalogue/products/${row.id}/edit`),
              traceId: `PG-DASHBOARD-CAT-001::EL-LINK-edit-product@${row.id}`,
            },
            ...(row.status !== 'PUBLISHED'
              ? [
                  {
                    key: 'publish',
                    label: 'Publish',
                    icon: <PublishIcon />,
                    tone: 'ok' as const,
                    disabled: actionLoadingId === row.id,
                    onClick: () => startTransition(() => { handlePublish(row.id); }),
                    traceId: `PG-DASHBOARD-CAT-001::EL-BTN-publish-product@${row.id}`,
                  },
                ]
              : []),
            ...(row.status !== 'ARCHIVED'
              ? [
                  {
                    key: 'archive',
                    label: 'Archive',
                    icon: <ArchiveIcon />,
                    disabled: actionLoadingId === row.id,
                    onClick: () => startTransition(() => { handleArchive(row.id); }),
                    traceId: `PG-DASHBOARD-CAT-001::EL-BTN-archive-product@${row.id}`,
                  },
                ]
              : []),
            {
              key: 'delete',
              label: 'Delete',
              icon: <DeleteIcon />,
              tone: 'danger',
              disabled: actionLoadingId === row.id,
              onClick: () => setDeleteTarget(row),
              traceId: `PG-DASHBOARD-CAT-001::EL-BTN-delete-product@${row.id}`,
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      {deleteTarget && (
        <DeleteChoiceDialog
          productName={deleteTarget.name}
          onSoftDelete={() => handleSoftDelete(deleteTarget.id)}
          onHardDelete={() => handleHardDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          traceIdPrefix="PG-DASHBOARD-CAT-001::EL-MODAL-delete-product-confirm"
        />
      )}

      {/* Header — Brands and Global variants used to live here as buttons;
          they are tabs in the hallway now, so only the primary action stays. */}
      <div className="dash-page-header" data-trace-id="PG-DASHBOARD-CAT-001::EL-REGION-products-page-header">
        <h1 className="dash-page-title">Products</h1>
        <Link
          href="/catalogue/products/new"
          className="dash-btn-primary"
          data-trace-id="PG-DASHBOARD-CAT-001::EL-LINK-new-product"
        >
          New Product
        </Link>
      </div>

      <CatalogSubnav />

      {/* Filters */}
      <div className="dash-filters" data-trace-id="PG-DASHBOARD-CAT-001::EL-REGION-filter-bar">
        <select
          className="dash-select"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as '' | ProductStatus); resetPage(); }}
          data-trace-id="PG-DASHBOARD-CAT-001::EL-SELECT-status-filter"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="dash-select"
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); resetPage(); }}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
        <select
          className="dash-select"
          aria-label="Filter by stock"
          value={stockFilter}
          onChange={(e) => { setStockFilter(e.target.value as StockFilter); resetPage(); }}
        >
          <option value="">All stock</option>
          <option value="IN">In stock</option>
          <option value="LOW">Low stock (1–5)</option>
          <option value="OUT">Out of stock</option>
        </select>
        <select
          className="dash-select"
          aria-label="Filter by price mode"
          value={priceModeFilter}
          onChange={(e) => { setPriceModeFilter(e.target.value as PriceModeFilter); resetPage(); }}
        >
          <option value="">All price modes</option>
          <option value="SYSTEM">System price</option>
          <option value="MANUAL">My price</option>
          <option value="MIXED">Mixed</option>
        </select>
        <select
          className="dash-select"
          value={brandFilter}
          onChange={(e) => { setBrandFilter(e.target.value); resetPage(); }}
          data-trace-id="PG-DASHBOARD-CAT-001::EL-SELECT-brand-filter"
        >
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input
          className="dash-input dash-input-search"
          placeholder="Search products…"
          value={searchInput}
          onChange={(e) => { setSearchInput(e.target.value); resetPage(); }}
          onKeyDown={handleSearchKey}
          data-trace-id="PG-DASHBOARD-CAT-001::EL-INPUT-search-products"
        />
        <button
          className="dash-btn-secondary"
          onClick={triggerImmediateSearch}
          data-trace-id="PG-DASHBOARD-CAT-001::EL-BTN-search-products"
        >
          Search
        </button>
        {/* Beside the search input, not below it (#99) — it lives here in the
            filters bar rather than as its own row above the table, and
            `.dash-filters`' own flex-wrap already gives it a sensible spot to
            drop to on narrow screens. */}
        <div className="dash-table-page-size">
          <label htmlFor="products-page-size">Rows per page</label>
          <select
            id="products-page-size"
            className="dash-select"
            value={pageSize}
            onChange={(e) => {
              const size = Number(e.target.value);
              setPageSize(size);
              setPage(0);
              replaceCatalogueQuery({ size: String(size), page: null });
            }}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Errors */}
      {actionError && (
        <p
          className="dash-inline-error"
          style={{ marginBottom: 12 }}
          data-trace-id="PG-DASHBOARD-CAT-001::EL-REGION-action-error"
        >
          {actionError}
        </p>
      )}

      {/* Table */}
      {loading || isPending ? (
        <SkeletonRows />
      ) : error ? (
        <div className="dash-card" data-trace-id="PG-DASHBOARD-CAT-001::EL-REGION-load-error">
          <p className="dash-inline-error">{error}</p>
          <button
            className="dash-btn-secondary"
            style={{ marginTop: 12 }}
            onClick={() => load()}
            data-trace-id="PG-DASHBOARD-CAT-001::EL-BTN-retry-load-products"
          >
            Retry
          </button>
        </div>
      ) : (
        <DashboardTable<ProductRow>
        key={`${pageSize}:${statusFilter}:${brandFilter}:${categoryFilter}:${stockFilter}:${priceModeFilter}:${debouncedSearchInput}`}
        columns={columns}
        data={rows}
        pageSize={pageSize}
        initialPage={page}
        onPageChange={(nextPage) => {
          setPage(nextPage);
          replaceCatalogueQuery({ page: nextPage > 0 ? String(nextPage + 1) : null });
        }}
        emptyMessage="No products found. Create your first product to get started."
        tableTraceId="PG-DASHBOARD-CAT-001::EL-TABLE-products-table"
        getRowTraceId={(row) => `PG-DASHBOARD-CAT-001::EL-ROW-product-row@${row.id}`}
        />
      )}
    </>
  );
}

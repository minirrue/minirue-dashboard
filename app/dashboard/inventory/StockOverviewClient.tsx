'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import UploadPreviewImage from '@/components/dashboard/UploadPreviewImage';
import { ReasonPicker } from '@/components/dashboard/ReasonPicker';
import {
  adjustStock,
  bulkAdjustStock,
  listAllStockAdmin,
  listInventoryCatalog,
  listMovements,
  setVariantStock,
  stockStatus,
} from '@/lib/inventory/api';
import {
  INVENTORY_ADJUSTMENT_REASONS,
  type InventoryAdjustmentReason,
} from '@/lib/reasons/operational';
import type {
  InventoryCatalogProduct,
  MovementRow,
  StockAdminRow,
  StockStatus,
} from '@/lib/inventory/api';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import { useClearNavBadge } from '@/lib/hooks/use-clear-nav-badge';
import { HREF_CATEGORIES } from '@/lib/notifications/nav-counts';

type SortKey = 'available-asc' | 'available-desc' | 'updated-desc' | 'updated-asc';
type BulkMode = 'set' | 'add' | 'remove';

interface InventoryRow extends StockAdminRow {
  key: string;
  productId: string | null;
  productName: string;
  variantName: string;
  sku: string;
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  coverUrl: string | null;
  hasStockItem: boolean;
  _status: StockStatus;
  _updatedAt: string | null;
}

function SkeletonRows() {
  return (
    <div className="dash-card inventory-shell" aria-label="Loading inventory">
      {Array.from({ length: 7 }).map((_, index) => (
        <span className="dash-skeleton inventory-skeleton" key={index} />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: StockStatus }) {
  const details = {
    OK: { label: 'In stock', tone: 'published' },
    LOW: { label: 'Low stock', tone: 'draft' },
    OUT: { label: 'Out of stock', tone: 'archived' },
  }[status];
  return (
    <span className="dash-status" data-status={details.tone}>
      <span className="dash-status-dot" />
      {details.label}
    </span>
  );
}

function formatWhen(value: string | null): string {
  if (!value) return 'No movement yet';
  return new Date(value).toLocaleString('en-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: true,
  });
}

function makeRows(
  stock: StockAdminRow[],
  catalog: InventoryCatalogProduct[],
  movements: MovementRow[],
): InventoryRow[] {
  const byVariant = new Map<string, StockAdminRow[]>();
  stock.forEach((item) => byVariant.set(item.variantId, [...(byVariant.get(item.variantId) ?? []), item]));
  const movementAt = new Map<string, string>();
  movements.forEach((movement) => {
    if (!movementAt.has(movement.stockItemId)) movementAt.set(movement.stockItemId, movement.createdAt);
  });
  const seen = new Set<string>();
  const rows: InventoryRow[] = [];

  catalog.forEach((product) => product.variants.forEach((variant) => {
    const items = byVariant.get(variant.id) ?? [];
    const sources: Array<StockAdminRow | null> = items.length ? items : [null];
    sources.forEach((item) => {
      if (item) seen.add(item.id);
      const base: StockAdminRow = item ?? {
        id: `new:${variant.id}`,
        variantId: variant.id,
        warehouseId: '',
        warehouseName: 'Main warehouse',
        warehouseLocationCode: 'MAIN',
        qtyOnHand: 0,
        qtyReserved: 0,
        qtyAvailable: 0,
        qtyThreshold: 0,
        isBelowThreshold: true,
      };
      rows.push({
        ...base,
        key: base.id,
        productId: product.id,
        productName: product.name,
        variantName: variant.label,
        sku: variant.sku,
        brandId: product.brandId,
        brandName: product.brandName,
        categoryId: product.categoryId,
        categoryName: product.categoryName,
        coverUrl: product.coverUrl,
        hasStockItem: Boolean(item),
        _status: stockStatus(base),
        _updatedAt: item?.updatedAt ?? (item ? movementAt.get(item.id) ?? null : null),
      });
    });
  }));

  stock.filter((item) => !seen.has(item.id)).forEach((item) => rows.push({
    ...item,
    key: item.id,
    productId: null,
    productName: 'Unknown product',
    variantName: item.variantId.slice(0, 8),
    sku: '',
    brandId: '',
    brandName: 'Unknown brand',
    categoryId: '',
    categoryName: 'Uncategorised',
    coverUrl: null,
    hasStockItem: true,
    _status: stockStatus(item),
    _updatedAt: item.updatedAt ?? movementAt.get(item.id) ?? null,
  }));

  return rows;
}

export default function StockOverviewClient({ initialSearch = '' }: { initialSearch?: string }) {
  useClearNavBadge(HREF_CATEGORIES['/inventory']);
  const fileInput = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // A product's "Change in Inventory" link lands here as `?q=<sku>` (#101).
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState<'' | StockStatus>('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<SortKey>('available-asc');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState<BulkMode>('set');
  const [bulkValue, setBulkValue] = useState('');
  const [reason, setReason] = useState<InventoryAdjustmentReason>('STOCK_COUNT');
  const [otherReason, setOtherReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [openHistory, setOpenHistory] = useState<string | null>(null);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const [stock, movementResponse, catalog] = await Promise.all([
        listAllStockAdmin(),
        listMovements({ limit: 100 }),
        listInventoryCatalog().catch(() => []),
      ]);
      const movementRows = Array.isArray(movementResponse.data) ? movementResponse.data : [];
      setMovements(movementRows);
      setRows(makeRows(stock, catalog, movementRows));
      setDrafts({});
    } catch (caught) {
      setError((caught as ApiError).message ?? 'Inventory could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useMountedEffect(() => { void load(); }, [load]);

  const brands = useMemo(() => Array.from(new Map(rows.filter((row) => row.brandId).map((row) => [row.brandId, row.brandName]))), [rows]);
  const categories = useMemo(() => Array.from(new Map(rows.filter((row) => row.categoryId).map((row) => [row.categoryId, row.categoryName]))), [rows]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    const result = rows.filter((row) => {
      if (status && row._status !== status) return false;
      if (brand && row.brandId !== brand) return false;
      if (category && row.categoryId !== category) return false;
      if (needle && !`${row.productName} ${row.variantName} ${row.sku} ${row.warehouseName}`.toLocaleLowerCase().includes(needle)) return false;
      return true;
    });
    return result.sort((a, b) => {
      if (sort === 'available-asc') return a.qtyAvailable - b.qtyAvailable;
      if (sort === 'available-desc') return b.qtyAvailable - a.qtyAvailable;
      const left = a._updatedAt ? Date.parse(a._updatedAt) : 0;
      const right = b._updatedAt ? Date.parse(b._updatedAt) : 0;
      return sort === 'updated-desc' ? right - left : left - right;
    });
  }, [rows, search, status, brand, category, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const visible = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const allVisibleSelected = visible.length > 0 && visible.every((row) => selected.has(row.key));
  const selectedRows = rows.filter((row) => selected.has(row.key));
  const outCount = rows.filter((row) => row._status === 'OUT').length;
  const lowCount = rows.filter((row) => row._status === 'LOW').length;

  async function persist(row: InventoryRow, target: number, why: string): Promise<void> {
    if (!Number.isInteger(target) || target < 0 || target > 1_000_000) throw new Error('Quantity must be a whole number from 0 to 1,000,000.');
    const delta = target - row.qtyAvailable;
    if (delta === 0) return;
    if (row.hasStockItem) {
      await adjustStock({ variantId: row.variantId, warehouseId: row.warehouseId, qty: delta, reason: why });
    } else {
      await setVariantStock(row.variantId, target);
    }
  }

  async function saveInline(row: InventoryRow) {
    const target = Number(drafts[row.key] ?? row.qtyAvailable);
    setNotice(null);
    setSaving((current) => new Set(current).add(row.key));
    try {
      await persist(row, target, 'Stock count');
      await load(false);
      setNotice(`${row.productName} · ${row.variantName} saved.`);
    } catch (caught) {
      setError((caught as Error).message || 'Stock could not be saved.');
    } finally {
      setSaving((current) => { const next = new Set(current); next.delete(row.key); return next; });
    }
  }

  async function applyBulk(mode: BulkMode | 'out' = bulkMode) {
    const amount = Number(bulkValue);
    if (!selectedRows.length) return;
    if (reason === 'OTHER' && !otherReason.trim()) {
      setReasonError('Explain the adjustment when the reason is Other.');
      return;
    }
    if (mode !== 'out' && (!Number.isInteger(amount) || amount < 0)) {
      setError('Enter a whole number of units.');
      return;
    }
    if ((mode === 'add' || mode === 'remove') && amount === 0) {
      setError('Enter at least one unit to add or remove.');
      return;
    }
    setReasonError(undefined);
    setError(null);
    setNotice(null);
    setSaving(new Set(selectedRows.map((row) => row.key)));
    try {
      const operation = mode === 'out' ? 'OUT_OF_STOCK' : mode.toUpperCase() as 'SET' | 'ADD' | 'REMOVE';
      const result = await bulkAdjustStock({
        operation,
        items: selectedRows.map((row) => ({
          variantId: row.variantId,
          ...(row.warehouseId ? { warehouseId: row.warehouseId } : {}),
        })),
        ...(mode === 'out' ? {} : { quantity: amount }),
        reason,
        ...(reason === 'OTHER' ? { reasonNote: otherReason.trim() } : {}),
      });
      await load(false);
      setNotice(`${result.updatedCount} ${result.updatedCount === 1 ? 'variant' : 'variants'} updated.`);
      setSelected(new Set());
      setBulkValue('');
      setReason('STOCK_COUNT');
      setOtherReason('');
    } catch (caught) {
      setError((caught as ApiError).message ?? 'Stock could not be updated.');
    } finally {
      setSaving(new Set());
    }
  }

  function exportCsv() {
    const source = selectedRows.length ? selectedRows : filtered;
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = ['SKU,qty', ...source.map((row) => `${escape(row.sku)},${row.qtyAvailable}`)].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'minirue-inventory.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const wanted = new Map<string, number>();
    text.split(/\r?\n/).slice(1).forEach((line) => {
      const [rawSku, rawQty] = line.split(',');
      const sku = rawSku?.trim().replace(/^"|"$/g, '').replaceAll('""', '"');
      const qty = Number(rawQty?.trim());
      if (sku && Number.isInteger(qty) && qty >= 0) wanted.set(sku, qty);
    });
    const matches = rows.filter((row) => wanted.has(row.sku));
    if (!matches.length) { setError('No CSV rows matched an inventory SKU.'); return; }
    setSaving(new Set(matches.map((row) => row.key)));
    const failures: string[] = [];
    for (const row of matches) {
      try { await persist(row, wanted.get(row.sku)!, 'CSV import'); } catch { failures.push(row.sku); }
    }
    await load(false);
    setSaving(new Set());
    setNotice(`${matches.length - failures.length} CSV ${matches.length === 1 ? 'row' : 'rows'} saved.`);
    if (failures.length) setError(`${failures.length} CSV rows failed: ${failures.join(', ')}`);
  }

  function toggleRow(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function rowHistory(row: InventoryRow) {
    return movements.filter((movement) => movement.stockItemId === row.id).slice(0, 5);
  }

  return (
    <>
      <div className="dash-page-header inventory-header">
        <div>
          <h1 className="dash-page-title">Inventory</h1>
          <p className="inventory-subtitle">Update sellable stock without opening each product.</p>
        </div>
        <div className="inventory-header-actions">
          <button className="dash-btn-secondary" onClick={exportCsv}>Export CSV</button>
          <button className="dash-btn-secondary" onClick={() => fileInput.current?.click()}>Import CSV</button>
          <input ref={fileInput} hidden type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCsv(file); event.target.value = ''; }} />
          <Link href="/inventory/movements" className="dash-btn-secondary">All movements</Link>
          <Link href="/inventory/receive" className="dash-btn-primary">Receive stock</Link>
        </div>
      </div>

      <div className="inventory-summary" aria-label="Inventory summary">
        <button type="button" onClick={() => { setStatus('OUT'); setPage(0); }}><strong>{outCount}</strong><span>Out of stock</span></button>
        <button type="button" onClick={() => { setStatus('LOW'); setPage(0); }}><strong>{lowCount}</strong><span>Low stock</span></button>
        <div><strong>{rows.length}</strong><span>Variants tracked</span></div>
      </div>

      <div className="dash-filters inventory-filters">
        <input aria-label="Search inventory" className="dash-input dash-input-search" placeholder="Search product, variant or SKU…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} />
        <select aria-label="Filter by stock status" className="dash-select" value={status} onChange={(event) => { setStatus(event.target.value as '' | StockStatus); setPage(0); }}>
          <option value="">All stock</option><option value="LOW">Low stock</option><option value="OUT">Out of stock</option><option value="OK">In stock</option>
        </select>
        <select aria-label="Filter by brand" className="dash-select" value={brand} onChange={(event) => { setBrand(event.target.value); setPage(0); }}>
          <option value="">All brands</option>{brands.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select aria-label="Filter by category" className="dash-select" value={category} onChange={(event) => { setCategory(event.target.value); setPage(0); }}>
          <option value="">All categories</option>{categories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select aria-label="Sort inventory" className="dash-select" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
          <option value="available-asc">Available: low first</option><option value="available-desc">Available: high first</option><option value="updated-desc">Recently updated</option><option value="updated-asc">Least recently updated</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="inventory-bulk" role="region" aria-label="Bulk stock actions">
          <strong>{selected.size} selected</strong>
          <select aria-label="Bulk operation" className="dash-select" value={bulkMode} onChange={(event) => setBulkMode(event.target.value as BulkMode)}>
            <option value="set">Set to</option><option value="add">Add</option><option value="remove">Remove</option>
          </select>
          <input aria-label="Bulk quantity" className="dash-input inventory-qty-input" type="number" min="0" step="1" value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} />
          <ReasonPicker
            label="Adjustment reason"
            options={INVENTORY_ADJUSTMENT_REASONS}
            value={reason}
            onChange={(next) => { setReason(next); setReasonError(undefined); }}
            note={otherReason}
            onNoteChange={(next) => { setOtherReason(next); setReasonError(undefined); }}
            otherValue="OTHER"
            noteLabel="Explain the adjustment"
            notePlaceholder="What happened to this stock?"
            error={reasonError}
          />
          <button className="dash-btn-primary" disabled={saving.size > 0} onClick={() => void applyBulk()}>Apply to {selected.size}</button>
          <button className="dash-btn-secondary" disabled={saving.size > 0} onClick={() => void applyBulk('out')}>Mark out of stock</button>
          <button className="dash-btn-ghost" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {notice && <p className="inventory-notice" role="status">{notice}</p>}
      {error && <div className="dash-inline-error inventory-error" role="alert">{error}<button className="dash-btn-ghost" onClick={() => setError(null)}>Dismiss</button></div>}

      {loading ? <SkeletonRows /> : (
        <div className="dash-card inventory-shell">
          <div className="inventory-table-wrap">
            <table className="dash-table inventory-table">
              <thead><tr>
                <th><input aria-label="Select visible inventory" type="checkbox" checked={allVisibleSelected} onChange={() => setSelected((current) => { const next = new Set(current); visible.forEach((row) => allVisibleSelected ? next.delete(row.key) : next.add(row.key)); return next; })} /></th>
                <th>Product</th><th>Variant / SKU</th><th>Warehouse</th><th className="num">On hand</th><th className="num">Reserved</th><th>Available — press Enter to save</th><th>Threshold</th><th>Status</th><th>Updated</th><th><span className="sr-only">History</span></th>
              </tr></thead>
              <tbody>
                {visible.length === 0 ? <tr><td colSpan={11} className="dash-table-empty">No variants match these filters.</td></tr> : visible.map((row) => {
                  const history = rowHistory(row);
                  return (
                    <React.Fragment key={row.key}>
                      <tr data-selected={selected.has(row.key) ? 'true' : undefined}>
                        <td><input aria-label={`Select ${row.productName} ${row.variantName}`} type="checkbox" checked={selected.has(row.key)} onChange={() => toggleRow(row.key)} /></td>
                        <td><div className="inventory-product">{row.coverUrl ? <UploadPreviewImage src={row.coverUrl} alt="" width={38} height={46} /> : <span className="inventory-image-placeholder" aria-hidden="true" />}<span><strong>{row.productName}</strong><small>{row.brandName} · {row.categoryName}</small></span></div></td>
                        <td><strong>{row.variantName}</strong><small className="inventory-sku">{row.sku || 'No SKU'}</small></td>
                        <td>{row.warehouseName}<small>{row.hasStockItem ? row.warehouseLocationCode : 'Created on first save'}</small></td>
                        <td className="num">{row.qtyOnHand}</td><td className="num">{row.qtyReserved}</td>
                        <td><div className="inventory-inline-edit"><input aria-label={`Available stock for ${row.productName} ${row.variantName}`} type="number" min="0" max="1000000" step="1" value={drafts[row.key] ?? row.qtyAvailable} disabled={saving.has(row.key)} onChange={(event) => setDrafts((current) => ({ ...current, [row.key]: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') void saveInline(row); }} /><button aria-label={`Save ${row.productName} ${row.variantName}`} className="dash-btn-ghost" disabled={saving.has(row.key)} onClick={() => void saveInline(row)}>{saving.has(row.key) ? 'Saving…' : 'Save'}</button></div></td>
                        <td>{row.qtyThreshold}</td><td><StatusBadge status={row._status} /></td><td className="inventory-updated">{formatWhen(row._updatedAt)}</td>
                        <td><button className="dash-btn-ghost inventory-history-button" aria-expanded={openHistory === row.key} aria-label={`Show movement history for ${row.productName} ${row.variantName}`} onClick={() => setOpenHistory((current) => current === row.key ? null : row.key)}>History</button></td>
                      </tr>
                      {openHistory === row.key && <tr className="inventory-history-row"><td colSpan={11}><div className="inventory-history"><strong>Recent movement history</strong>{history.length ? <ul>{history.map((movement) => <li key={movement.id}><span>{movement.movementType}</span><b>{movement.qtyDelta > 0 ? '+' : ''}{movement.qtyDelta}</b><span>{movement.referenceId ?? 'Automatic adjustment'}</span><span>{movement.actorUserId ? `Actor ${movement.actorUserId.slice(0, 8)}…` : 'System'}</span><time>{formatWhen(movement.createdAt)}</time></li>)}</ul> : <p>No movement recorded for this stock item.</p>}<Link href="/inventory/movements" className="dash-link">Open full history</Link></div></td></tr>}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="inventory-mobile-list">
            {visible.map((row) => <article className="inventory-mobile-card" key={row.key} data-selected={selected.has(row.key) ? 'true' : undefined}>
              <header><input aria-label={`Select ${row.productName} ${row.variantName}`} type="checkbox" checked={selected.has(row.key)} onChange={() => toggleRow(row.key)} /><div className="inventory-product">{row.coverUrl ? <UploadPreviewImage src={row.coverUrl} alt="" width={38} height={46} /> : <span className="inventory-image-placeholder" aria-hidden="true" />}<span><strong>{row.productName}</strong><small>{row.variantName} · {row.sku || 'No SKU'}</small></span></div><StatusBadge status={row._status} /></header>
              <dl><div><dt>On hand</dt><dd>{row.qtyOnHand}</dd></div><div><dt>Reserved</dt><dd>{row.qtyReserved}</dd></div><div><dt>Threshold</dt><dd>{row.qtyThreshold}</dd></div></dl>
              <label>Available stock<div className="inventory-inline-edit"><input aria-label={`Available stock for ${row.productName} ${row.variantName} on mobile`} type="number" min="0" step="1" value={drafts[row.key] ?? row.qtyAvailable} onChange={(event) => setDrafts((current) => ({ ...current, [row.key]: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') void saveInline(row); }} /><button className="dash-btn-primary" disabled={saving.has(row.key)} onClick={() => void saveInline(row)}>{saving.has(row.key) ? 'Saving…' : 'Save'}</button></div></label>
              <footer><span>{row.warehouseName}</span><button className="dash-btn-ghost" onClick={() => setOpenHistory((current) => current === row.key ? null : row.key)}>History</button></footer>
              {openHistory === row.key && <div className="inventory-mobile-history">{rowHistory(row).length ? rowHistory(row).map((movement) => <p key={movement.id}><b>{movement.movementType} {movement.qtyDelta > 0 ? '+' : ''}{movement.qtyDelta}</b><span>{movement.referenceId ?? 'Automatic'} · {formatWhen(movement.createdAt)}</span></p>) : <p>No movement recorded.</p>}</div>}
            </article>)}
          </div>

          <div className="dash-pagination inventory-pagination">
            <span>{filtered.length ? safePage * pageSize + 1 : 0}–{Math.min((safePage + 1) * pageSize, filtered.length)} of {filtered.length}</span>
            <label>Rows <select className="dash-select" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }}><option>20</option><option>50</option><option>100</option></select></label>
            <div><button className="dash-pagination-btn" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</button><span>Page {safePage + 1} of {pages}</span><button className="dash-pagination-btn" disabled={safePage >= pages - 1} onClick={() => setPage((value) => Math.min(pages - 1, value + 1))}>Next</button></div>
          </div>
        </div>
      )}

      <style jsx>{`
        .inventory-header { align-items: flex-start; }
        .inventory-subtitle { margin: 5px 0 0; color: var(--mr-fg-4); font-size: 13px; }
        .inventory-header-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
        .inventory-summary { display: flex; gap: 1px; margin-bottom: 16px; overflow: hidden; border: 1px solid var(--mr-dash-hair); border-radius: var(--mr-radius-md); background: var(--mr-dash-hair); }
        .inventory-summary > * { flex: 1; min-width: 120px; border: 0; border-radius: 0; padding: 13px 16px; text-align: left; background: var(--mr-dash-surface); color: var(--mr-fg-3); font: inherit; }
        .inventory-summary button { cursor: pointer; }
        .inventory-summary button:hover, .inventory-summary button:focus-visible { background: var(--mr-dash-sub); }
        .inventory-summary strong { display: block; color: var(--mr-fg); font-size: 20px; font-variant-numeric: tabular-nums; }
        .inventory-summary span { display: block; margin-top: 2px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
        .inventory-bulk { position: sticky; top: 8px; z-index: 5; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 0 0 12px; padding: 10px 12px; border-radius: var(--mr-radius-md); background: var(--mr-ink-900); color: var(--mr-cream-100); box-shadow: 0 10px 30px rgba(20, 15, 9, .16); }
        .inventory-bulk strong { margin-right: 4px; }
        .inventory-bulk :global(.dash-select), .inventory-bulk :global(.dash-input) { width: auto; min-width: 112px; }
        .inventory-bulk :global(.reason-picker) { flex: 1 1 100%; padding: 10px; border-radius: var(--mr-radius-sm); background: var(--mr-cream-100); color: var(--mr-fg); }
        .inventory-bulk :global(.reason-picker__choices) { grid-template-columns: repeat(5, minmax(118px, 1fr)); }
        .inventory-qty-input { max-width: 112px; font-variant-numeric: tabular-nums; }
        .inventory-notice { margin: 0 0 12px; padding: 10px 12px; border-radius: var(--mr-radius-sm); background: var(--mr-st-ok-bg); color: var(--mr-st-ok-fg); font-size: 13px; }
        .inventory-error { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
        .inventory-shell { padding: 0; overflow: hidden; }
        .inventory-skeleton { display: block; height: 46px; margin: 12px 14px; }
        .inventory-table-wrap { overflow-x: auto; }
        .inventory-table { min-width: 1180px; }
        .inventory-table th:first-child, .inventory-table td:first-child { width: 38px; padding-right: 2px; }
        .inventory-table tr[data-selected='true'] { background: var(--mr-dash-sub); }
        .inventory-table .num { text-align: right; font-variant-numeric: tabular-nums; }
        .inventory-product { display: flex; align-items: center; gap: 10px; min-width: 190px; }
        .inventory-product :global(img), .inventory-image-placeholder { width: 38px; height: 46px; flex: 0 0 auto; border-radius: 5px; object-fit: cover; background: var(--mr-dash-sub); }
        .inventory-product strong, .inventory-table td > strong { display: block; color: var(--mr-fg); font-size: 13px; font-weight: 600; }
        .inventory-product small, .inventory-table td > small { display: block; margin-top: 3px; color: var(--mr-fg-4); font-size: 11px; }
        .inventory-sku { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-variant-numeric: tabular-nums; }
        .inventory-inline-edit { display: flex; align-items: center; gap: 5px; }
        .inventory-inline-edit input { width: 82px; height: 36px; border: 1px solid var(--mr-dash-hair); border-radius: var(--mr-radius-sm); background: var(--mr-dash-surface); color: var(--mr-fg); padding: 0 9px; font: inherit; font-variant-numeric: tabular-nums; }
        .inventory-inline-edit input:focus-visible { outline: 2px solid var(--mr-gold-500); outline-offset: 1px; border-color: transparent; }
        .inventory-updated { max-width: 130px; color: var(--mr-fg-4) !important; font-size: 11px; }
        .inventory-history-button { white-space: nowrap; }
        .inventory-history-row:hover { background: transparent !important; }
        .inventory-history { padding: 4px 8px 8px 47px; }
        .inventory-history ul { display: grid; gap: 0; margin: 10px 0; padding: 0; list-style: none; border-top: 1px solid var(--mr-dash-hair); }
        .inventory-history li { display: grid; grid-template-columns: 90px 48px minmax(130px, 1fr) minmax(110px, .7fr) 150px; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--mr-dash-hair); color: var(--mr-fg-3); font-size: 12px; }
        .inventory-history li b { color: var(--mr-fg); font-variant-numeric: tabular-nums; }
        .inventory-mobile-list { display: none; }
        .inventory-pagination { gap: 12px; }
        .inventory-pagination label, .inventory-pagination > div { display: flex; align-items: center; gap: 8px; }
        .inventory-pagination :global(.dash-select) { width: auto; min-width: 70px; }
        @media (max-width: 820px) {
          .inventory-header { align-items: stretch; flex-direction: column; }
          .inventory-header-actions { display: grid; grid-template-columns: 1fr 1fr; }
          .inventory-summary { overflow-x: auto; }
          .inventory-filters > :global(*) { width: 100% !important; }
          .inventory-bulk { position: static; align-items: stretch; }
          .inventory-bulk > :global(*) { flex: 1 1 calc(50% - 8px); }
          .inventory-bulk :global(.reason-picker) { flex-basis: 100%; }
          .inventory-bulk :global(.reason-picker__choices) { grid-template-columns: 1fr; }
          .inventory-table-wrap { display: none; }
          .inventory-mobile-list { display: grid; gap: 10px; padding: 10px; }
          .inventory-mobile-card { padding: 14px; border: 1px solid var(--mr-dash-hair); border-radius: var(--mr-radius-md); background: var(--mr-dash-surface); }
          .inventory-mobile-card[data-selected='true'] { background: var(--mr-dash-sub); }
          .inventory-mobile-card header { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 9px; }
          .inventory-mobile-card .inventory-product { min-width: 0; }
          .inventory-mobile-card dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; margin: 14px 0; background: var(--mr-dash-hair); }
          .inventory-mobile-card dl div { padding: 8px; background: var(--mr-dash-sub); }
          .inventory-mobile-card dt { color: var(--mr-fg-4); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
          .inventory-mobile-card dd { margin: 3px 0 0; color: var(--mr-fg); font-variant-numeric: tabular-nums; }
          .inventory-mobile-card > label { display: grid; gap: 6px; color: var(--mr-fg-3); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
          .inventory-mobile-card .inventory-inline-edit input { width: 100%; }
          .inventory-mobile-card footer { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; color: var(--mr-fg-4); font-size: 12px; }
          .inventory-mobile-history { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--mr-dash-hair); }
          .inventory-mobile-history p { display: flex; justify-content: space-between; gap: 8px; margin: 6px 0; font-size: 11px; }
          .inventory-mobile-history span { color: var(--mr-fg-4); text-align: right; }
          .inventory-pagination { flex-wrap: wrap; }
          .inventory-pagination > div { width: 100%; justify-content: space-between; }
        }
      `}</style>
    </>
  );
}

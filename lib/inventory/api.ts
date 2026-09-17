import { apiFetch } from '@/lib/api/client';
import type { InventoryAdjustmentReason } from '@/lib/reasons/operational';

export type StockStatus = 'OK' | 'LOW' | 'OUT';
export type MovementType = 'RECEIVE' | 'RESERVE' | 'RELEASE' | 'ADJUST' | 'SHIP' | 'RETURN';

export interface StockAdminRow {
  id: string;
  variantId: string;
  warehouseId: string;
  warehouseName: string;
  warehouseLocationCode: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  qtyThreshold: number;
  isBelowThreshold: boolean;
  updatedAt?: string;
}

export interface InventoryCatalogVariant {
  id: string;
  sku: string;
  label: string;
}

export interface InventoryCatalogProduct {
  id: string;
  name: string;
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  coverUrl: string | null;
  variants: InventoryCatalogVariant[];
}

export interface MovementRow {
  id: string;
  stockItemId: string;
  movementType: MovementType;
  qtyDelta: number;
  referenceId: string | null;
  referenceType: string | null;
  actorUserId: string | null;
  createdAt: string;
}

export interface WarehouseRow {
  id: string;
  name: string;
  locationCode: string;
  isActive: boolean;
}

export function stockStatus(row: StockAdminRow): StockStatus {
  if (row.qtyAvailable <= 0) return 'OUT';
  if (row.isBelowThreshold) return 'LOW';
  return 'OK';
}

export async function listStockAdmin(params?: {
  page?: number;
  limit?: number;
  warehouseId?: string;
  belowThreshold?: boolean;
}): Promise<{ data: StockAdminRow[]; total: number; page: number; limit: number }> {
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : '';
  return apiFetch(`/inventory/stock${qs}`, { auth: true });
}

export async function receiveStock(data: {
  variantId: string;
  warehouseId: string;
  qty: number;
  referenceId?: string;
}): Promise<StockAdminRow> {
  return apiFetch('/inventory/stock/receive', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(data),
  });
}

export async function adjustStock(data: {
  variantId: string;
  warehouseId: string;
  qty: number;
  reason: string;
}): Promise<StockAdminRow> {
  return apiFetch('/inventory/stock/adjust', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(data),
  });
}

export interface BulkStockResult {
  batchId: string;
  idempotencyKey: string;
  operation: 'SET' | 'ADD' | 'REMOVE' | 'OUT_OF_STOCK';
  quantity: number | null;
  updatedCount: number;
  data: Array<StockAdminRow & { before: number; after: number; changed: boolean }>;
  replayed: boolean;
}

/** One atomic, auditable operator action for the selected inventory rows. */
export async function bulkAdjustStock(data: {
  operation: BulkStockResult['operation'];
  items: Array<{ variantId: string; warehouseId?: string }>;
  quantity?: number;
  reason: InventoryAdjustmentReason;
  reasonNote?: string;
}): Promise<BulkStockResult> {
  return apiFetch('/inventory/stock/bulk', {
    method: 'POST',
    auth: true,
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(data),
  });
}

/**
 * Set the quantity shoppers can buy. The backend translates this absolute
 * value into an ADJUST delta and records the actor in stock_movements; it also
 * creates the default warehouse for variants that have never been stocked.
 */
export async function setVariantStock(
  variantId: string,
  qty: number,
): Promise<{ variantId: string; available: number }> {
  return apiFetch(`/inventory/stock/variant/${variantId}`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify({ qty }),
  });
}

/** Load every stock row instead of silently stopping at the API's 100-row cap. */
export async function listAllStockAdmin(): Promise<StockAdminRow[]> {
  const rows: StockAdminRow[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const response = await listStockAdmin({ page, limit: 100 });
    const batch = Array.isArray(response.data) ? response.data : [];
    rows.push(...batch);
    if (rows.length >= response.total || batch.length < 100) break;
  }
  return rows;
}

interface RawCatalogVariant {
  id: string;
  sku?: string | null;
  isActive?: boolean;
  values?: Array<{ attributeName?: string; optionName?: string }>;
  customValues?: Record<string, string> | null;
}

interface RawCatalogProduct {
  id: string;
  name: string;
  brandId: string;
  brandName?: string | null;
  categoryId: string;
  categoryName?: string | null;
  variants?: RawCatalogVariant[];
  media?: Array<{
    role?: string | null;
    kind?: string | null;
    url?: string | null;
    posterUrl?: string | null;
  }>;
}

function variantLabel(variant: RawCatalogVariant): string {
  const listed = (variant.values ?? [])
    .map((value) => value.optionName)
    .filter((value): value is string => Boolean(value));
  const custom = Object.values(variant.customValues ?? {}).filter(Boolean);
  return [...listed, ...custom].join(' · ') || variant.sku || 'Default variant';
}

/**
 * Inventory needs catalogue identity (photo, product, variant and SKU) while
 * stock remains the sole quantity source. Fetch and map the existing admin
 * catalogue contract without coupling the inventory screen to product forms.
 */
export async function listInventoryCatalog(): Promise<InventoryCatalogProduct[]> {
  const products: RawCatalogProduct[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const response = await apiFetch<{
      data: RawCatalogProduct[];
      meta: { total: number };
    }>(`/catalog/admin/products?page=${page}&limit=100&space=house`, { auth: true });
    const batch = Array.isArray(response.data) ? response.data : [];
    products.push(...batch);
    if (products.length >= response.meta.total || batch.length < 100) break;
  }

  return products.map((product) => {
    const media = product.media ?? [];
    const cover = media.find((item) => item.role === 'COVER') ?? media[0];
    return {
      id: product.id,
      name: product.name,
      brandId: product.brandId,
      brandName: product.brandName ?? 'Unbranded',
      categoryId: product.categoryId,
      categoryName: product.categoryName ?? 'Uncategorised',
      coverUrl: cover?.kind === 'video' ? cover.posterUrl ?? null : cover?.url ?? null,
      variants: (product.variants ?? [])
        .filter((variant) => variant.isActive !== false)
        .map((variant) => ({
          id: variant.id,
          sku: variant.sku ?? '',
          label: variantLabel(variant),
        })),
    };
  });
}

export async function listMovements(params?: {
  page?: number;
  limit?: number;
  movementType?: MovementType;
  from?: string;
  to?: string;
}): Promise<{ data: MovementRow[]; total: number }> {
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : '';
  return apiFetch(`/inventory/movements${qs}`, { auth: true });
}

export async function listWarehouses(): Promise<{ data: WarehouseRow[] }> {
  return apiFetch('/inventory/warehouses', { auth: true });
}

export async function createWarehouse(data: {
  name: string;
  locationCode: string;
  isActive?: boolean;
}): Promise<WarehouseRow> {
  return apiFetch('/inventory/warehouses', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(data),
  });
}

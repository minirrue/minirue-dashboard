import { apiFetch } from '@/lib/api/client';

export type StockStatus = 'OK' | 'LOW' | 'OUT';
export type MovementType = 'RECEIVE' | 'RESERVE' | 'RELEASE' | 'ADJUST';

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

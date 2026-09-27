import { apiFetch } from './client';

export type GroundRule = { type: 'PERCENT' | 'FIXED'; value: number };
export type GroundPriceItem = {
  id: string; kind: 'VARIANT' | 'BUNDLE'; name: string; sku: string;
  onlinePriceMinor: number; groundPriceMinor: number; costMinor: number | null;
  marginBp: number | null; mode: 'SYSTEM' | 'MANUAL'; rule: GroundRule | null;
};
export type GroundPrices = { rule: GroundRule; revision: number; items: GroundPriceItem[] };
export type GroundPricePatch = {
  revision: number; defaultRule?: GroundRule;
  items?: Array<Pick<GroundPriceItem, 'id' | 'kind' | 'mode'> & { rule?: GroundRule; manualPriceMinor?: number }>;
};
const BASE = '/accounting/ground-prices';
export const getGroundPrices = () => apiFetch<GroundPrices>(BASE, { auth: true });
export const previewGroundPrices = (patch: GroundPricePatch) => apiFetch<GroundPrices>(`${BASE}/preview`, { method: 'POST', auth: true, body: JSON.stringify(patch) });
export const saveGroundPrices = (patch: GroundPricePatch) => apiFetch<GroundPrices & { runId: string }>(BASE, { method: 'PATCH', auth: true, body: JSON.stringify(patch) });
export const undoGroundPrices = (runId: string) => apiFetch<GroundPrices>(`${BASE}/undo/${encodeURIComponent(runId)}`, { method: 'POST', auth: true });
export const groundItemKey = (item: Pick<GroundPriceItem, 'kind' | 'id'>) => `${item.kind}:${item.id}`;

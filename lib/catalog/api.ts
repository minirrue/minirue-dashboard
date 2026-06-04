import { apiFetch } from '@/lib/api/client';
import type { ProductListItem, ProductStatus } from './types';

export type { ProductListItem, ProductStatus } from './types';
export type BottleType = 'EDP' | 'EDT' | 'EAU_DE_COLOGNE' | 'PERFUME_OIL' | 'spray' | 'splash' | 'travel' | 'refill';

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  children?: CategoryRow[];
}

export interface VariantRow {
  id: string;
  productId: string;
  sku: string;
  size: number;
  sizeMl: number;
  bottleType: BottleType;
  price: number;
  priceAmount: number;
  currency: string;
  stock: number;
}

interface BackendVariant { priceAmount: string; priceCurrency: string; isActive: boolean; }
interface BackendProduct { id: string; slug: string; name: string; brand: string; publishedState: string; variants: BackendVariant[]; createdAt: string; }

export async function listProducts(params?: { page?: number; limit?: number; status?: ProductStatus; search?: string; brand?: string }): Promise<{ items: ProductListItem[]; total: number }> {
  const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString() : '';
  const res = await apiFetch<{ data: BackendProduct[]; meta: { total: number } }>(`/catalog/products${qs}`, { auth: true });
  const items: ProductListItem[] = res.data.map((p) => {
    const active = p.variants.filter((v) => v.isActive);
    const prices = active.map((v) => parseFloat(v.priceAmount));
    const currency = active[0]?.priceCurrency ?? 'EGP';
    const priceMin = prices.length ? Math.min(...prices) : null;
    const priceMax = prices.length ? Math.max(...prices) : null;
    return {
      id: p.id, slug: p.slug, name: p.name, brand: p.brand,
      status: p.publishedState as ProductStatus,
      variantCount: p.variants.length,
      basePrice: priceMin ?? 0, priceMin, priceMax, currency,
      createdAt: p.createdAt,
    };
  });
  return { items, total: res.meta.total };
}

export async function publishProduct(id: string): Promise<import('./types').Product> {
  return apiFetch(`/catalog/products/${id}/publish`, { method: 'POST', auth: true });
}

export async function archiveProduct(id: string): Promise<import('./types').Product> {
  return apiFetch(`/catalog/products/${id}/archive`, { method: 'POST', auth: true });
}

export async function createProduct(data: { name: string; brand?: string; categoryId?: string; categoryIds?: string[]; basePrice?: number; description?: string; fragranceFamily?: string; gender?: string }, idempotencyKey?: string): Promise<import('./types').Product> {
  return apiFetch('/catalog/products', { method: 'POST', auth: true, body: JSON.stringify({ ...data, idempotencyKey }) });
}

export async function listCategories(): Promise<{ items: CategoryRow[] }> {
  const res = await apiFetch<{ data: CategoryRow[] }>('/catalog/categories', { auth: true });
  return { items: res.data };
}

export async function createCategory(data: { name: string; slug: string; parentId?: string; sortOrder?: number }): Promise<CategoryRow> {
  return apiFetch('/catalog/categories', { method: 'POST', auth: true, body: JSON.stringify(data) });
}

export async function updateCategory(id: string, data: Partial<Pick<CategoryRow, 'name' | 'slug' | 'parentId' | 'sortOrder'>>): Promise<CategoryRow> {
  return apiFetch(`/catalog/categories/${id}`, { method: 'PATCH', auth: true, body: JSON.stringify(data) });
}

export async function createVariant(productId: string, data: { sku: string; sizeMl: number; bottleType: BottleType; priceAmount: number; currency: string; stock?: number }): Promise<VariantRow> {
  return apiFetch(`/catalog/products/${productId}/variants`, { method: 'POST', auth: true, body: JSON.stringify(data) });
}

export async function getProduct(id: string): Promise<import('./types').Product> {
  return apiFetch(`/catalog/products/${id}`, { auth: true });
}

export async function updateProduct(id: string, data: Partial<Pick<ProductListItem, 'name' | 'basePrice' | 'status'> & { description?: string; categoryId?: string; categoryIds?: string[]; brand?: string; fragranceFamily?: string; gender?: string }>): Promise<import('./types').Product> {
  return apiFetch(`/catalog/products/${id}`, { method: 'PATCH', auth: true, body: JSON.stringify(data) });
}

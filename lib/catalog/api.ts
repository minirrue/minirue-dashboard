import { apiFetch } from '@/lib/api/client';
import type {
  Category,
  Gender,
  Product,
  ProductListItem,
  ProductMedia,
  ProductStatus,
  ProductVariant,
} from './types';

export type { ProductListItem, ProductStatus } from './types';
export type BottleType = 'EDP' | 'EDT' | 'Parfum' | 'Hair Mist';

const ADMIN = '/catalog/admin';

interface BackendVariant {
  id: string;
  productId: string;
  sku: string;
  sizeMl: number;
  bottleType: string;
  priceAmount: string;
  priceCurrency: string;
  isActive: boolean;
}

interface BackendMedia {
  id: string;
  productId: string;
  cloudinaryPublicId: string;
  galleryItemId?: string | null;
  // Added for the Gallery module (specs/006-gallery-module, US3): NULL means
  // this row is a general product-level image, not scoped to a variant.
  variantId?: string | null;
  url?: string | null;
  width: number | null;
  height: number | null;
  altText: string | null;
  sortOrder: number;
}

interface BackendProduct {
  id: string;
  slug: string;
  name: string;
  brand: string;
  description?: string | null;
  fragranceFamily?: string | null;
  gender?: Gender;
  publishedState: string;
  variants: BackendVariant[];
  media?: BackendMedia[];
  categories?: Category[];
  createdAt: string;
  updatedAt?: string;
}

function mapListItem(p: BackendProduct): ProductListItem {
  const active = p.variants?.filter((v) => v.isActive) ?? [];
  const prices = active.map((v) => parseFloat(v.priceAmount));
  const currency = active[0]?.priceCurrency ?? 'EGP';
  const priceMin = prices.length ? Math.min(...prices) : null;
  const priceMax = prices.length ? Math.max(...prices) : null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    status: p.publishedState as ProductStatus,
    variantCount: p.variants?.length ?? 0,
    basePrice: priceMin ?? 0,
    priceMin,
    priceMax,
    currency,
    createdAt: p.createdAt,
  };
}

function mapVariant(v: BackendVariant): ProductVariant {
  const price = parseFloat(v.priceAmount);
  return {
    id: v.id,
    productId: v.productId,
    sku: v.sku,
    size: v.sizeMl,
    sizeMl: v.sizeMl,
    bottleType: v.bottleType as ProductVariant['bottleType'],
    price,
    priceAmount: price,
    currency: v.priceCurrency,
    stock: 0,
  };
}

function mapMedia(m: BackendMedia): ProductMedia {
  return {
    id: m.id,
    cloudinaryPublicId: m.cloudinaryPublicId,
    galleryItemId: m.galleryItemId ?? null,
    variantId: m.variantId ?? null,
    url: m.url ?? null,
    width: m.width,
    height: m.height,
    altText: m.altText,
    sortOrder: m.sortOrder,
  };
}

function mapProduct(p: BackendProduct): Product {
  const list = mapListItem(p);
  return {
    ...list,
    description: p.description ?? '',
    fragranceFamily: p.fragranceFamily ?? null,
    gender: (p.gender ?? 'unisex') as Gender,
    categoryId: p.categories?.[0]?.id ?? null,
    category: p.categories?.[0] ?? null,
    categories: p.categories ?? [],
    variants: (p.variants ?? []).map(mapVariant),
    media: (p.media ?? []).map(mapMedia),
    updatedAt: p.updatedAt ?? p.createdAt,
  };
}

function toCreateProductBody(data: {
  name: string;
  brand?: string;
  categoryIds?: string[];
  description?: string;
  fragranceFamily?: string;
  gender?: string;
}) {
  return {
    name: data.name,
    brand: data.brand,
    description: data.description ?? null,
    fragrance_family: data.fragranceFamily ?? null,
    gender: data.gender || 'unisex',
    category_ids: data.categoryIds,
  };
}

function toUpdateProductBody(
  data: Partial<{
    name: string;
    brand: string;
    description?: string;
    fragranceFamily?: string;
    gender?: string;
    categoryIds?: string[];
  }>,
) {
  const body: Record<string, unknown> = {};
  if (data.name !== undefined) body.name = data.name;
  if (data.brand !== undefined) body.brand = data.brand;
  if (data.description !== undefined) body.description = data.description ?? null;
  if (data.fragranceFamily !== undefined) body.fragrance_family = data.fragranceFamily ?? null;
  if (data.gender !== undefined) body.gender = data.gender;
  if (data.categoryIds !== undefined) body.category_ids = data.categoryIds;
  return body;
}

const BOTTLE_TYPE_MAP: Record<string, BottleType> = {
  spray: 'EDP',
  splash: 'EDT',
  travel: 'Parfum',
  refill: 'Hair Mist',
  EDP: 'EDP',
  EDT: 'EDT',
  Parfum: 'Parfum',
  'Hair Mist': 'Hair Mist',
};

export async function listProducts(params?: {
  page?: number;
  limit?: number;
  status?: ProductStatus;
  search?: string;
  brand?: string;
}): Promise<{ items: ProductListItem[]; total: number }> {
  const qs = params
    ? '?' +
      new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : '';
  const res = await apiFetch<{ data: BackendProduct[]; meta: { total: number } }>(
    `${ADMIN}/products${qs}`,
    { auth: true },
  );
  return {
    items: res.data.map(mapListItem),
    total: res.meta.total,
  };
}

export async function publishProduct(id: string): Promise<Product> {
  await apiFetch(`${ADMIN}/products/${id}/publish`, { method: 'POST', auth: true });
  return getProduct(id);
}

export async function archiveProduct(id: string): Promise<Product> {
  await apiFetch(`${ADMIN}/products/${id}/archive`, { method: 'POST', auth: true });
  return getProduct(id);
}

export async function softDeleteProduct(id: string): Promise<void> {
  await apiFetch(`${ADMIN}/products/${id}/delete-soft`, { method: 'POST', auth: true });
}

export async function hardDeleteProduct(id: string): Promise<void> {
  await apiFetch(`${ADMIN}/products/${id}`, { method: 'DELETE', auth: true });
}

export async function softDeleteVariant(productId: string, variantId: string): Promise<void> {
  await apiFetch(`${ADMIN}/products/${productId}/variants/${variantId}/delete-soft`, {
    method: 'POST',
    auth: true,
  });
}

export async function hardDeleteVariant(productId: string, variantId: string): Promise<void> {
  await apiFetch(`${ADMIN}/products/${productId}/variants/${variantId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function createProduct(
  data: {
    name: string;
    brand?: string;
    categoryIds?: string[];
    description?: string;
    fragranceFamily?: string;
    gender?: string;
  },
  idempotencyKey: string,
): Promise<Product> {
  const created = await apiFetch<{ id: string }>(`${ADMIN}/products`, {
    method: 'POST',
    auth: true,
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(toCreateProductBody(data)),
  });
  return getProduct(created.id);
}

export async function listCategories(): Promise<{ items: Category[] }> {
  const res = await apiFetch<{ data: Category[] }>('/catalog/categories', { auth: true });
  return { items: res.data };
}

export async function listBrands(): Promise<string[]> {
  return apiFetch<string[]>(`${ADMIN}/brands`, { auth: true });
}

export interface ManagedBrand {
  id: string;
  name: string;
  createdAt: string;
}

export async function listManagedBrands(): Promise<ManagedBrand[]> {
  const res = await apiFetch<{ data: ManagedBrand[] }>(`${ADMIN}/brands/managed`, { auth: true });
  return res.data;
}

export async function createBrand(name: string): Promise<ManagedBrand> {
  return apiFetch<ManagedBrand>(`${ADMIN}/brands/managed`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ name }),
  });
}

export async function renameBrand(id: string, name: string): Promise<ManagedBrand> {
  return apiFetch<ManagedBrand>(`${ADMIN}/brands/managed/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ name }),
  });
}

export async function deleteBrand(id: string): Promise<void> {
  await apiFetch<void>(`${ADMIN}/brands/managed/${id}`, { method: 'DELETE', auth: true });
}

export async function createCategory(data: {
  name: string;
  slug: string;
  parentId?: string;
  sortOrder?: number;
}): Promise<Category> {
  return apiFetch(`${ADMIN}/categories`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({
      name: data.name,
      slug: data.slug,
      parent_id: data.parentId ?? null,
      sort_order: data.sortOrder ?? 0,
    }),
  });
}

export async function updateCategory(
  id: string,
  data: Partial<Pick<Category, 'name' | 'slug' | 'parentId' | 'sortOrder'>>,
): Promise<Category> {
  return apiFetch(`${ADMIN}/categories/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.parentId !== undefined ? { parent_id: data.parentId } : {}),
      ...(data.sortOrder !== undefined ? { sort_order: data.sortOrder } : {}),
    }),
  });
}

export async function deleteCategory(id: string): Promise<void> {
  await apiFetch<void>(`${ADMIN}/categories/${id}`, { method: 'DELETE', auth: true });
}

export async function createVariant(
  productId: string,
  data: {
    sku: string;
    sizeMl: number;
    bottleType: string;
    priceAmount: number;
    currency: string;
  },
): Promise<ProductVariant> {
  const bottle = BOTTLE_TYPE_MAP[data.bottleType] ?? 'EDP';
  const raw = await apiFetch<BackendVariant>(`${ADMIN}/products/${productId}/variants`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({
      sku: data.sku,
      size_ml: data.sizeMl,
      bottle_type: bottle,
      price_amount: data.priceAmount.toFixed(4),
      price_currency: data.currency || 'EGP',
    }),
  });
  return mapVariant(raw);
}

export async function updateVariant(
  productId: string,
  variantId: string,
  data: {
    sizeMl?: number;
    bottleType?: string;
    priceAmount?: number;
    currency?: string;
  },
): Promise<ProductVariant> {
  const body: Record<string, unknown> = {};
  if (data.sizeMl !== undefined) body.size_ml = data.sizeMl;
  if (data.bottleType !== undefined) {
    body.bottle_type = BOTTLE_TYPE_MAP[data.bottleType] ?? 'EDP';
  }
  if (data.priceAmount !== undefined) body.price_amount = data.priceAmount.toFixed(4);
  if (data.currency !== undefined) body.price_currency = data.currency;
  const raw = await apiFetch<BackendVariant>(
    `${ADMIN}/products/${productId}/variants/${variantId}`,
    { method: 'PATCH', auth: true, body: JSON.stringify(body) },
  );
  return mapVariant(raw);
}

export async function getProduct(id: string): Promise<Product> {
  const raw = await apiFetch<BackendProduct>(`${ADMIN}/products/${id}`, { auth: true });
  return mapProduct(raw);
}

export async function updateProduct(
  id: string,
  data: Partial<{
    name: string;
    brand: string;
    description?: string;
    fragranceFamily?: string;
    gender?: string;
    categoryIds?: string[];
  }>,
): Promise<Product> {
  await apiFetch(`${ADMIN}/products/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(toUpdateProductBody(data)),
  });
  return getProduct(id);
}

const CLOUDINARY_CLOUD =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? 'minirue';

export function cloudinaryPreviewUrl(publicId: string, w = 200, h = 250): string {
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/w_${w},h_${h},c_fill,q_auto,f_auto/${publicId}`;
}

export async function createProductMedia(
  productId: string,
  data: {
    cloudinaryPublicId?: string;
    galleryItemId?: string;
    // Added for the Gallery module (specs/006-gallery-module, US3): when
    // set, scopes this media row to a single product variant rather than
    // the whole product.
    variantId?: string;
    altText?: string;
    sortOrder?: number;
  },
): Promise<ProductMedia> {
  // Mutually exclusive per contracts/gallery-routes.md — pass exactly one.
  const body: Record<string, unknown> = {
    alt_text: data.altText?.trim() || undefined,
    sort_order: data.sortOrder ?? 0,
  };
  if (data.galleryItemId) {
    body.gallery_item_id = data.galleryItemId;
  } else {
    body.cloudinary_public_id = data.cloudinaryPublicId?.trim();
  }
  if (data.variantId) {
    body.variant_id = data.variantId;
  }
  const raw = await apiFetch<BackendMedia>(`${ADMIN}/products/${productId}/media`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(body),
  });
  return mapMedia(raw);
}

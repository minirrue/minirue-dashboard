import { apiFetch } from '@/lib/api/client';
import type {
  Category,
  Product,
  ProductListItem,
  ProductMedia,
  ProductStatus,
  ProductVariant,
} from './types';

export type { ProductListItem, ProductStatus } from './types';

/** A row of the admin-managed variant-type vocabulary ("Global variants"). */
export type { AttributeRecord, AttributeOptionRecord, VariantValue } from './types';

import type {
  AttributeRecord as AttributeRecordDto,
  AttributeOptionRecord as AttributeOptionRecordDto,
  VariantValue as VariantValueDto,
} from './types';

/**
 * Every space-scoped admin list takes this. Absent means the caller's own
 * house catalogue — `space.ts` on the backend defaults the same way, so a
 * screen that forgets to pass it still gets MiniRue's own data, never
 * everything at once.
 */
export type SpaceParam = 'house' | (string & {});

const ADMIN = '/catalog/admin';

interface BackendVariant {
  id: string;
  productId: string;
  sku: string;
  sizeMl: number | null;
  values?: VariantValueDto[];
  customValues?: Record<string, string> | null;
  priceAmount: string;
  priceCurrency: string;
  isActive: boolean;
  /** Available stock, added to every product read so the form can show it. */
  availableQuantity?: number;
  inStock?: boolean;
}

interface BackendMedia {
  id: string;
  productId: string;
  cloudinaryPublicId: string;
  galleryItemId?: string | null;
  // Added for the Gallery module (specs/006-gallery-module, US3): NULL means
  // this row is a general product-level image, not scoped to a variant.
  variantId?: string | null;
  /** 'COVER' | 'CAROUSEL' — absent on responses from an older API build. */
  role?: string | null;
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
  brandId: string;
  brandName: string | null;
  categoryId: string;
  categoryName: string | null;
  description?: string | null;
  publishedState: string;
  variants: BackendVariant[];
  media?: BackendMedia[];
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
    brandId: p.brandId,
    brandName: p.brandName ?? '',
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
    values: v.values ?? [],
    customValues: v.customValues ?? {},
    price,
    priceAmount: price,
    currency: v.priceCurrency,
    // Was hardcoded to 0, so the dashboard could never show or edit stock. The
    // read now carries it (backend 0.34.0).
    stock: v.availableQuantity ?? 0,
  };
}

function mapMedia(m: BackendMedia): ProductMedia {
  return {
    id: m.id,
    cloudinaryPublicId: m.cloudinaryPublicId,
    galleryItemId: m.galleryItemId ?? null,
    variantId: m.variantId ?? null,
    role: m.role === 'COVER' ? 'COVER' : 'CAROUSEL',
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
    categoryId: p.categoryId,
    categoryName: p.categoryName ?? '',
    variants: (p.variants ?? []).map(mapVariant),
    media: (p.media ?? []).map(mapMedia),
    updatedAt: p.updatedAt ?? p.createdAt,
  };
}

/**
 * specs/2026-07-22-product-tree: brand and category are FKs, gender and
 * fragrance family are option-list picks inside `attributes`.
 *
 * `brandId`/`categoryId` are optional (owner decision 2): a product saved with
 * neither resolves to that space's own Generic brand/category on the server.
 * "Generic" is an internal bucket name only — never send it as a chosen
 * brand/category id, just omit the field.
 */
export interface ProductWriteInput {
  name: string;
  brandId?: string;
  categoryId?: string;
  description?: string;
  /** attribute id -> chosen option id */
  attributes?: Record<string, string>;
}

function toCreateProductBody(data: ProductWriteInput) {
  const body: Record<string, unknown> = {
    name: data.name,
    description: data.description ?? null,
    attributes: data.attributes ?? {},
  };
  // Omitted (not sent as '') so the server's Generic-resolution applies —
  // an empty string would be a brand/category id that doesn't exist.
  if (data.brandId) body.brand_id = data.brandId;
  if (data.categoryId) body.category_id = data.categoryId;
  return body;
}

function toUpdateProductBody(data: Partial<ProductWriteInput>) {
  const body: Record<string, unknown> = {};
  if (data.name !== undefined) body.name = data.name;
  if (data.brandId !== undefined) body.brand_id = data.brandId || null;
  if (data.categoryId !== undefined) body.category_id = data.categoryId || null;
  if (data.description !== undefined)
    body.description = data.description ?? null;
  if (data.attributes !== undefined) body.attributes = data.attributes;
  return body;
}

export async function listProducts(params?: {
  page?: number;
  limit?: number;
  status?: ProductStatus;
  search?: string;
  /** Filter by an exact brand id — a deep link from Brands used to filter by
   *  name, which is ambiguous once two spaces can each have a brand called
   *  the same thing. */
  brandId?: string;
  /** 'house' = MiniRue's own catalogue (the default the server applies when
   *  this is omitted), a collaborator id for their space, or 'all'. */
  space?: SpaceParam;
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
  data: ProductWriteInput,
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

/**
 * The admin-scoped read — replaces the public `/catalog/categories`, which
 * returned every space at once and let a partner's category read as though
 * it were filed inside one of MiniRue's own. `space` omitted = MiniRue's own
 * (matches the server default in `space.ts`).
 */
export async function listCategories(opts: { space?: SpaceParam } = {}): Promise<{ items: Category[] }> {
  const qs = opts.space ? `?space=${encodeURIComponent(opts.space)}` : '';
  const res = await apiFetch<{ data: Category[] }>(`${ADMIN}/categories${qs}`, { auth: true });
  return { items: res.data };
}

export interface ManagedBrand {
  id: string;
  name: string;
  createdAt: string;
  /** True for the one auto-created "Generic" brand every space gets. Never
   *  offered as a pick in the brand dropdown — the blank option already means
   *  Generic — and protected from rename/delete like a default category. */
  isGeneric: boolean;
}

// ---------------------------------------------------------------------------
// Option lists and brand global variants (specs 2026-07-22-product-tree)
//
// Delete always takes an explicit mode; the caller must choose, exactly as
// the product delete dialog already makes you.
//
// `GET /catalog/admin/tree` and its client `loadTree` are gone — the
// Catalogue Overview screen was its only caller and is gone too (Task 5a).
// ---------------------------------------------------------------------------

export type DeleteMode = 'soft' | 'hard';

/** Active lists only — what the product form offers. */
export async function listAttributes(
  categoryId?: string,
): Promise<AttributeRecordDto[]> {
  const params = new URLSearchParams();
  if (categoryId) params.set('categoryId', categoryId);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch<{ data: AttributeRecordDto[] }>(
    `/catalog/attributes${qs}`,
  );
  return res.data;
}

/** Includes deleted rows, active first — the management screen. */
export async function listAdminAttributes(
  categoryId?: string,
): Promise<AttributeRecordDto[]> {
  const params = new URLSearchParams();
  if (categoryId) params.set('categoryId', categoryId);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch<{ data: AttributeRecordDto[] }>(
    `${ADMIN}/attributes${qs}`,
    { auth: true },
  );
  return res.data;
}

export async function createAttribute(data: {
  name: string;
  /** Categories it applies to. Empty = every category. */
  categoryIds?: string[];
  sortOrder?: number;
}): Promise<AttributeRecordDto> {
  return apiFetch<AttributeRecordDto>(`${ADMIN}/attributes`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(data),
  });
}

export async function updateAttribute(
  id: string,
  patch: {
    name?: string;
    categoryIds?: string[];
    sortOrder?: number;
    isActive?: boolean;
  },
): Promise<AttributeRecordDto> {
  return apiFetch<AttributeRecordDto>(`${ADMIN}/attributes/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(patch),
  });
}

export async function deleteAttribute(
  id: string,
  mode: DeleteMode,
): Promise<void> {
  await apiFetch<void>(`${ADMIN}/attributes/${id}?mode=${mode}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function listAttributeOptions(
  attributeId: string,
): Promise<AttributeOptionRecordDto[]> {
  const res = await apiFetch<{ data: AttributeOptionRecordDto[] }>(
    `${ADMIN}/attributes/${attributeId}/options`,
    { auth: true },
  );
  return res.data;
}

export async function createAttributeOption(
  attributeId: string,
  data: { name: string; sortOrder?: number },
): Promise<AttributeOptionRecordDto> {
  return apiFetch<AttributeOptionRecordDto>(
    `${ADMIN}/attributes/${attributeId}/options`,
    { method: 'POST', auth: true, body: JSON.stringify(data) },
  );
}

export async function updateAttributeOption(
  optionId: string,
  patch: { name?: string; sortOrder?: number; isActive?: boolean },
): Promise<AttributeOptionRecordDto> {
  return apiFetch<AttributeOptionRecordDto>(
    `${ADMIN}/attribute-options/${optionId}`,
    { method: 'PATCH', auth: true, body: JSON.stringify(patch) },
  );
}

export async function deleteAttributeOption(
  optionId: string,
  mode: DeleteMode,
): Promise<void> {
  await apiFetch<void>(`${ADMIN}/attribute-options/${optionId}?mode=${mode}`, {
    method: 'DELETE',
    auth: true,
  });
}

// --- categories -----------------------------------------------------------

export async function createCategory(data: {
  name: string;
  slug: string;
  parentId?: string;
  sortOrder?: number;
  /** Required in practice (Task 18) — a category with no picture is a
   *  prohibited state — but left optional here so the type itself doesn't
   *  duplicate the form's own validation message. */
  imageMediaId?: string;
  space?: SpaceParam;
}): Promise<Category> {
  const qs = data.space ? `?space=${encodeURIComponent(data.space)}` : '';
  return apiFetch(`${ADMIN}/categories${qs}`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({
      name: data.name,
      slug: data.slug,
      parent_id: data.parentId ?? null,
      sort_order: data.sortOrder ?? 0,
      image_media_id: data.imageMediaId ?? null,
    }),
  });
}

export async function updateCategory(
  id: string,
  data: Partial<Pick<Category, 'name' | 'slug' | 'parentId' | 'sortOrder'>> & {
    imageMediaId?: string | null;
  },
  space?: SpaceParam,
): Promise<Category> {
  const qs = space ? `?space=${encodeURIComponent(space)}` : '';
  return apiFetch(`${ADMIN}/categories/${id}${qs}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.parentId !== undefined ? { parent_id: data.parentId } : {}),
      ...(data.sortOrder !== undefined ? { sort_order: data.sortOrder } : {}),
      ...(data.imageMediaId !== undefined ? { image_media_id: data.imageMediaId } : {}),
    }),
  });
}

export async function deleteCategory(id: string, space?: SpaceParam): Promise<void> {
  const qs = space ? `?space=${encodeURIComponent(space)}` : '';
  await apiFetch<void>(`${ADMIN}/categories/${id}${qs}`, { method: 'DELETE', auth: true });
}

export async function createVariant(
  productId: string,
  data: {
    priceAmount: number;
    currency: string;
    /** global variant id -> free-typed value */
    values?: Record<string, string>;
    /** custom field name -> free-typed value (product-specific) */
    customValues?: Record<string, string>;
  },
): Promise<ProductVariant> {
  // No `sku` in the body: the API derives it from the product's category,
  // brand, name and this variant's values, and refuses to let it change.
  const raw = await apiFetch<BackendVariant>(`${ADMIN}/products/${productId}/variants`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({
      values: data.values ?? {},
      custom_values: data.customValues ?? {},
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
    priceAmount?: number;
    currency?: string;
    /** global variant id -> free-typed value. */
    values?: Record<string, string>;
    /** custom field name -> free-typed value (product-specific). */
    customValues?: Record<string, string>;
  },
): Promise<ProductVariant> {
  const body: Record<string, unknown> = {};
  if (data.priceAmount !== undefined) body.price_amount = data.priceAmount.toFixed(4);
  if (data.currency !== undefined) body.price_currency = data.currency;
  if (data.values !== undefined) body.values = data.values;
  if (data.customValues !== undefined) body.custom_values = data.customValues;
  const raw = await apiFetch<BackendVariant>(
    `${ADMIN}/products/${productId}/variants/${variantId}`,
    { method: 'PATCH', auth: true, body: JSON.stringify(body) },
  );
  return mapVariant(raw);
}

// --- brands ---------------------------------------------------------------

/**
 * `space` scopes to one seller's own makers — 'house' for MiniRue's, a
 * collaborator id for theirs. `GET /catalog/admin/brands` (unscoped, every
 * space at once) is gone; every caller now says whose brands it wants.
 * `includeGeneric` opts into getting that space's Generic row back too — the
 * product form's brand picker filters it out itself either way, so most
 * callers can leave this off.
 */
export async function listManagedBrands(
  opts: { space?: SpaceParam; includeGeneric?: boolean } = {},
): Promise<ManagedBrand[]> {
  const params = new URLSearchParams();
  if (opts.space) params.set('space', opts.space);
  if (opts.includeGeneric) params.set('includeGeneric', 'true');
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch<{ data: ManagedBrand[] }>(
    `${ADMIN}/brands/managed${qs}`,
    { auth: true },
  );
  return res.data;
}
export async function createBrand(
  name: string,
  opts: { space?: SpaceParam; imageMediaId?: string } = {},
): Promise<ManagedBrand> {
  const qs = opts.space ? `?space=${encodeURIComponent(opts.space)}` : '';
  return apiFetch<ManagedBrand>(`${ADMIN}/brands/managed${qs}`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({
      name,
      ...(opts.imageMediaId ? { image_media_id: opts.imageMediaId } : {}),
    }),
  });
}
export async function renameBrand(id: string, name: string): Promise<ManagedBrand> {
  return apiFetch<ManagedBrand>(`${ADMIN}/brands/managed/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ name }),
  });
}

/**
 * Picture and blurb — a brand MAY have one (owner's distinction from a
 * category, which MUST). Works for a partner's own brand too; `id` is enough,
 * no `space` needed on this one endpoint.
 */
export async function updateBrandPresentation(
  id: string,
  data: { description?: string | null; imageMediaId?: string | null },
): Promise<{ id: string; name: string; slug: string }> {
  return apiFetch(`${ADMIN}/brands/${id}/presentation`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.imageMediaId !== undefined ? { image_media_id: data.imageMediaId } : {}),
    }),
  });
}
export async function deleteBrandGlobalVariant(
  id: string,
  mode: DeleteMode,
): Promise<void> {
  await apiFetch<void>(`${ADMIN}/global-variants/${id}?mode=${mode}`, {
    method: 'DELETE',
    auth: true,
  });
}
export async function deleteBrand(id: string): Promise<void> {
  await apiFetch<void>(`${ADMIN}/brands/managed/${id}`, { method: 'DELETE', auth: true });
}

export async function getProduct(id: string): Promise<Product> {
  const raw = await apiFetch<BackendProduct>(`${ADMIN}/products/${id}`, { auth: true });
  return mapProduct(raw);
}

export async function updateProduct(
  id: string,
  data: Partial<ProductWriteInput>,
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

/** Makes one image the product's cover thumbnail. The previous cover drops back
 * into the carousel — there is always exactly one cover. */
export async function setProductMediaCover(
  productId: string,
  mediaId: string,
): Promise<ProductMedia> {
  const raw = await apiFetch<BackendMedia>(
    `${ADMIN}/products/${productId}/media/${mediaId}/cover`,
    { method: 'PATCH', auth: true },
  );
  return mapMedia(raw);
}

/** Makes one image the photograph that ends the product page. The previous
 * closing image drops back into the carousel — at most one per product. The
 * cover cannot be chosen; the backend refuses it, because a product only has
 * one role per image and it would lose its thumbnail everywhere else. */
export async function setProductMediaClosing(
  productId: string,
  mediaId: string,
): Promise<ProductMedia> {
  const raw = await apiFetch<BackendMedia>(
    `${ADMIN}/products/${productId}/media/${mediaId}/closing`,
    { method: 'PATCH', auth: true },
  );
  return mapMedia(raw);
}

/**
 * Sets the available quantity for one variant. The warehouse module is out of
 * service, so this is how stock gets recorded — an absolute quantity, not a
 * delta, matching what someone typing into the product form means.
 */
export async function apiSetVariantStock(
  variantId: string,
  qty: number,
): Promise<{ variantId: string; available: number }> {
  return apiFetch<{ variantId: string; available: number }>(
    `/inventory/stock/variant/${variantId}`,
    { method: 'PUT', auth: true, body: JSON.stringify({ qty }) },
  );
}

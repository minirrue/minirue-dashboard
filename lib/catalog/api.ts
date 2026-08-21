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
  /** Per-image soft delete (task 39) — present only when a SUPERADMIN read
   * the product; absent/undefined for everyone else, since the server never
   * includes a deleted row for anyone but SUPERADMIN. */
  deletedAt?: string | null;
}

interface BackendProduct {
  id: string;
  slug: string;
  name: string;
  brandId: string;
  brandName: string | null;
  categoryId: string;
  categoryName: string | null;
  /** Resolved by CatalogService.withBrandImages on the admin list only. */
  brandImageUrl?: string | null;
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
    brandImageUrl: p.brandImageUrl ?? null,
    // COVER is the photo shoppers see in listings; falling back to the first
    // image means a product uploaded before roles existed still shows
    // something rather than an empty frame. `url` is already resolved by the
    // admin list's own hydrateMediaUrls, so there is nothing to sign here.
    coverUrl:
      (p.media ?? []).find((m) => m.role === 'COVER')?.url ??
      (p.media ?? [])[0]?.url ??
      null,
    status: p.publishedState as ProductStatus,
    // The first variant's SKU. Sorted so the number shown is stable across
    // reloads rather than whatever order the variants query happened to
    // return — a SKU that moves between renders is worse than none.
    sku: [...(p.variants ?? [])].map((v) => v.sku).sort()[0] ?? '',
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
    // Dropped here until 2026-08-21, which is why a soft-deleted variant came
    // back looking untouched after a refresh.
    isActive: v.isActive !== false,
  };
}

function mapMedia(m: BackendMedia): ProductMedia {
  return {
    id: m.id,
    cloudinaryPublicId: m.cloudinaryPublicId,
    galleryItemId: m.galleryItemId ?? null,
    variantId: m.variantId ?? null,
    // Bug fix: this used to collapse anything that wasn't COVER to CAROUSEL,
    // so a CLOSING row lost its "closes the page" role the moment the page
    // reloaded through getProduct — only the in-memory optimistic update
    // after clicking "Set as closing" ever showed it correctly. Reordering
    // (task 38) needs role to survive a reload just as much as cover/closing
    // do, so this had to be right for all three, not just two of them.
    role: m.role === 'COVER' ? 'COVER' : m.role === 'CLOSING' ? 'CLOSING' : 'CAROUSEL',
    url: m.url ?? null,
    width: m.width,
    height: m.height,
    altText: m.altText,
    sortOrder: m.sortOrder,
    deletedAt: m.deletedAt ?? null,
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
 * `brandId` is optional (owner decision 2): a product saved with none
 * resolves to that space's own Generic brand on the server. "Generic" is an
 * internal bucket name only — never send it as a chosen brand id, just omit
 * the field.
 *
 * `categoryId` is REQUIRED (owner decision, 2026-07-31 — reverses the
 * category half of decision 2): there is no fallback category any more, in
 * any space. The form validates this before submit; the type keeps it
 * optional only so `Partial<ProductWriteInput>` can express "leave the
 * existing category unchanged" on update.
 */
export interface ProductWriteInput {
  name: string;
  brandId?: string;
  categoryId: string;
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
  // brandId omitted (not sent as '') so the server's Generic-resolution
  // applies — an empty string would be a brand id that doesn't exist.
  // categoryId is always required and sent as-is; the form never lets this
  // call happen without one.
  if (data.brandId) body.brand_id = data.brandId;
  body.category_id = data.categoryId;
  return body;
}

function toUpdateProductBody(data: Partial<ProductWriteInput>) {
  const body: Record<string, unknown> = {};
  if (data.name !== undefined) body.name = data.name;
  if (data.brandId !== undefined) body.brand_id = data.brandId || null;
  // Never null — a category can be swapped for another real one, never
  // cleared. undefined (field omitted) means "leave unchanged".
  if (data.categoryId !== undefined) body.category_id = data.categoryId;
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

/** Undoes softDeleteVariant. Backend 0.86.0. */
export async function restoreVariant(productId: string, variantId: string): Promise<void> {
  await apiFetch(`${ADMIN}/products/${productId}/variants/${variantId}/restore`, {
    method: 'POST',
    auth: true,
  });
}

/**
 * `force` deletes even when past orders reference the variant.
 *
 * Safe for the ORDERS, which is the part that matters: order_items has no
 * foreign key to the variant and each line carries a frozen product_snapshot,
 * so every receipt still renders exactly as it did. What is lost is the
 * ability to return those orders' stock to the shelf, since returns resolve
 * by variant id. The dialog says so before offering the option.
 */
export async function hardDeleteVariant(
  productId: string,
  variantId: string,
  force = false,
): Promise<void> {
  await apiFetch(
    `${ADMIN}/products/${productId}/variants/${variantId}${force ? '?force=true' : ''}`,
    { method: 'DELETE', auth: true },
  );
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
  slug: string;
  description: string | null;
  imageMediaId: string | null;
  imageUrl: string | null;
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
/**
 * The Brands edit modal's one save call — name, slug, description and image
 * together, whichever of them actually changed. Replaces the old
 * `renameBrand`, which only ever touched `name`; the edit screen now covers
 * the whole managed-brand row in a single PATCH rather than one call per
 * field.
 */
export async function updateBrand(
  id: string,
  data: {
    name?: string;
    slug?: string;
    description?: string | null;
    imageMediaId?: string | null;
  },
): Promise<ManagedBrand> {
  return apiFetch<ManagedBrand>(`${ADMIN}/brands/managed/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.imageMediaId !== undefined ? { image_media_id: data.imageMediaId } : {}),
    }),
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

/**
 * `basePath` defaults to the admin catalogue but accepts `/collab` too — a
 * collaborator's own product read is the same shape, scoped server-side to
 * products they own (CollabProductsService.getProductDetail), so the same
 * mapping is reused rather than forked for the collab edit screen.
 */
export async function getProduct(id: string, basePath: string = ADMIN): Promise<Product> {
  const raw = await apiFetch<BackendProduct>(`${basePath}/products/${id}`, { auth: true });
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

/**
 * Every function below takes an optional `basePath`, defaulting to the admin
 * catalogue (`/catalog/admin`) — passing `/collab` instead hits this
 * collaborator's own scoped media routes (CollabPortalController), which
 * enforce the same product-ownership boundary server-side. Reused rather
 * than forked so MediaSection.tsx (the ONE component both the admin and
 * collab product forms render) never has to know which caller it is.
 */
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
  basePath: string = ADMIN,
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
  const raw = await apiFetch<BackendMedia>(`${basePath}/products/${productId}/media`, {
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
  basePath: string = ADMIN,
): Promise<ProductMedia> {
  const raw = await apiFetch<BackendMedia>(
    `${basePath}/products/${productId}/media/${mediaId}/cover`,
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
  basePath: string = ADMIN,
): Promise<ProductMedia> {
  const raw = await apiFetch<BackendMedia>(
    `${basePath}/products/${productId}/media/${mediaId}/closing`,
    { method: 'PATCH', auth: true },
  );
  return mapMedia(raw);
}

/**
 * Swaps one carousel image with its neighbour ('up' = earlier, 'down' =
 * later). Owner ask, 2026-07-31: the cover and closing photo were already
 * explicit, changeable roles — the images between them had no visible order
 * and no way to change it. Cover, closing and variant-scoped images are
 * outside this ordering; the backend 422s an attempt on one of those.
 */
export async function reorderProductMedia(
  productId: string,
  mediaId: string,
  direction: 'up' | 'down',
  basePath: string = ADMIN,
): Promise<void> {
  await apiFetch<{ ok: boolean }>(
    `${basePath}/products/${productId}/media/${mediaId}/reorder`,
    { method: 'PATCH', auth: true, body: JSON.stringify({ direction }) },
  );
}

/**
 * Soft-deletes one image (task 39, owner ask: "add a global delete per
 * image ... inside collab and admin"). The storage object is never touched;
 * the image simply disappears from every read except a SUPERADMIN's, marked
 * with `deletedAt` (see `ProductMedia.deletedAt`). Same `basePath` pattern as
 * every other media call here — `/collab` hits the collaborator's own
 * ownership-scoped route.
 */
export async function deleteProductMedia(
  productId: string,
  mediaId: string,
  basePath: string = ADMIN,
): Promise<{ promotedCoverId: string | null }> {
  const res = await apiFetch<{ ok: boolean; promotedCoverId?: string | null }>(
    `${basePath}/products/${productId}/media/${mediaId}/delete-soft`,
    { method: 'POST', auth: true },
  );
  return { promotedCoverId: res.promotedCoverId ?? null };
}

/**
 * Reverses a soft delete. SUPERADMIN only — the server 403s anyone else
 * (CatalogService.restoreMedia). Admin-only route; there is no collab
 * equivalent, since only SUPERADMIN can ever see a deleted image to restore
 * it in the first place.
 */
export async function restoreProductMedia(
  productId: string,
  mediaId: string,
): Promise<void> {
  await apiFetch<{ ok: boolean }>(
    `${ADMIN}/products/${productId}/media/${mediaId}/restore`,
    { method: 'POST', auth: true },
  );
}

/**
 * Every soft-deleted image, across every product/space — the SUPERADMIN-
 * only "Deleted" view in the Gallery section (task 39: "make superadmin see
 * soft deleted images in gallery section for super admin only"). The
 * server 403s anyone but SUPERADMIN.
 */
export interface DeletedMediaItem extends ProductMedia {
  productId: string;
  productName: string;
  productSlug: string;
}

export async function listDeletedMedia(): Promise<DeletedMediaItem[]> {
  const res = await apiFetch<{ data: DeletedMediaItem[] }>(
    `${ADMIN}/media/deleted`,
    { auth: true },
  );
  return res.data ?? [];
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

import { apiFetch } from './client';

export type CollabModule = 'ORDERS' | 'PRODUCTS' | 'ANALYTICS' | 'SUPPORT';

export interface UpdateWorkspaceProfile {
  brandSlug: string;
  contactEmail: string;
  storefrontVisible?: boolean;
}

export interface CollabOverview {
  brandSlug: string;
  displayName: string;
  modules: CollabModule[];
  autoPublishProducts?: boolean;
  contactEmail: string;
  storefrontVisible: boolean;
  counts: { orders: number; products: number };
}

export interface CollabBrand {
  displayName: string;
  description: string | null;
  logoUrl: string | null;
  brandSlug: string;
  /**
   * Covers for this space's two shortcut tiles — "All Products" and "Bundles".
   * Ids are what you SEND; the `*Url` pair is server-resolved for display only.
   *
   * Optional so an older API build simply has no covers and the tiles keep their
   * glyph. Set only here, in the partner's own dashboard (owner, 2026-08-03).
   */
  allProductsImageMediaId?: string | null;
  bundlesImageMediaId?: string | null;
  allProductsImageUrl?: string | null;
  bundlesImageUrl?: string | null;
}

export async function apiCollabOverview(): Promise<CollabOverview> {
  return apiFetch<CollabOverview>('/collab/overview', { auth: true });
}

export async function apiCollabOrders(params?: {
  cursor?: string;
  limit?: number;
}): Promise<{ items: unknown[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`/collab/orders${query}`, { auth: true });
}

export async function apiCollabProducts(): Promise<{ items: unknown[] }> {
  return apiFetch('/collab/products', { auth: true });
}

export async function apiCollabCreateProduct(data: {
  name: string;
  description?: string;
  priceAmount: string;
  priceCurrency?: string;
  initialStock?: number;
  /**
   * Product-specific variant fields, e.g. { Size: '50 ml' }. Also feed the SKU,
   * which is generated the same way as on the admin side (backend 0.41.0).
   */
  customValues?: Record<string, string>;
  /**
   * One of this partner's OWN categories (apiCollabCategories) — required.
   * Owner decision, 2026-07-31: there is no default/"Uncategorised" category
   * any more, in any space. A partner must create a category of their own
   * before their first product.
   */
  categoryId: string;
}): Promise<{ id: string }> {
  return apiFetch('/collab/products', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(data),
  });
}

export async function apiCollabGetBrand(): Promise<CollabBrand> {
  return apiFetch<CollabBrand>('/collab/brand', { auth: true });
}

export async function apiCollabUpdateBrand(data: {
  displayName?: string;
  description?: string | null;
  /** Omit to leave a cover alone; `null` clears it. */
  allProductsImageMediaId?: string | null;
  bundlesImageMediaId?: string | null;
}): Promise<CollabBrand> {
  return apiFetch<CollabBrand>('/collab/brand', {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(data),
  });
}

export async function apiCollabUploadLogo(mimeType: string, dataBase64: string): Promise<CollabBrand> {
  return apiFetch<CollabBrand>('/collab/brand/logo', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ mimeType, dataBase64 }),
  });
}

export async function apiActivateCollaborator(token: string, password: string): Promise<void> {
  await apiFetch('/collaborators/activate', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

export async function apiCollabUpdateProduct(
  id: string,
  data: {
    name?: string;
    description?: string;
    priceAmount?: string;
    initialStock?: number;
    unpublish?: boolean;
    /** Swap for another of this partner's own categories. Omit to leave
     *  unchanged — never send an empty value, there is nothing to clear to. */
    categoryId?: string;
    /**
     * Product-specific variant fields, e.g. { Size: '50 ml' } — the collab
     * equivalent of the admin form's Variants section. The Add-product form
     * has offered these since backend 0.41.0; the edit form could not change
     * them because this client never sent the field and the API dropped it
     * (2026-07-31). `{}` clears every field; omit to leave them alone.
     */
    customValues?: Record<string, string>;
  },
): Promise<unknown> {
  return apiFetch(`/collab/products/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(data),
  });
}

export async function apiCollabAnalytics(period: '7d' | '30d' | '90d' = '30d'): Promise<{
  kpis: {
    ordersCount: number;
    revenueCents: number;
    productsActive: number;
    /**
     * MiniRue's cut of this partner's paid revenue, and what the partner keeps.
     * `commissionRate` is null when no agreement is recorded, which reads as zero
     * commission — never as everything (backend 0.42.0).
     */
    commissionRate?: number | null;
    commissionCents?: number;
    partnerNetCents?: number;
  };
  daily: Array<{
    date: string;
    orders: number;
    revenueCents: number;
    commissionCents?: number;
  }>;
}> {
  return apiFetch(`/collab/analytics?period=${period}`, { auth: true });
}

export async function apiUpdateWorkspaceProfile(data: UpdateWorkspaceProfile): Promise<{message: string}> {
  return apiFetch<{message: string}>('/collab/workspace/profile', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(data),
  });
}

/* ── A partner's own categories ──
   Each space keeps its own list and manages it itself (owner decision,
   2026-07-29). The backend takes the space from the authenticated caller and
   never from the body, so there is no space id to send from here — a partner
   can only ever reach their own. */

export interface CollabCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  /** Already a servable URL at tile size — the client never sees a media id. */
  imageUrl?: string | null;
  imageMediaId?: string | null;
  children?: CollabCategory[];
}

export async function apiCollabCategories(): Promise<{ data: CollabCategory[] }> {
  return apiFetch('/collab/categories', { auth: true });
}

export async function apiCollabCreateCategory(data: {
  name: string;
  parent_id?: string;
}): Promise<CollabCategory> {
  return apiFetch('/collab/categories', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(data),
  });
}

export async function apiCollabUpdateCategory(
  id: string,
  data: {
    name?: string;
    sort_order?: number;
    /** A Gallery item id for the shop tile; null clears it. */
    image_media_id?: string | null;
  },
): Promise<CollabCategory> {
  return apiFetch(`/collab/categories/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(data),
  });
}

export async function apiCollabDeleteCategory(id: string): Promise<void> {
  await apiFetch<void>(`/collab/categories/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}

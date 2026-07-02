import { apiFetch } from './client';

export type CollabModule = 'ORDERS' | 'PRODUCTS' | 'ANALYTICS';

export interface CollabOverview {
  brandSlug: string;
  displayName: string;
  modules: CollabModule[];
  autoPublishProducts?: boolean;
  counts: { orders: number; products: number };
}

export interface CollabBrand {
  displayName: string;
  description: string | null;
  logoUrl: string | null;
  brandSlug: string;
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
}): Promise<unknown> {
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
  },
): Promise<unknown> {
  return apiFetch(`/collab/products/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(data),
  });
}

export async function apiCollabAnalytics(period: '7d' | '30d' | '90d' = '30d'): Promise<{
  kpis: { ordersCount: number; revenueCents: number; productsActive: number };
  daily: Array<{ date: string; orders: number; revenueCents: number }>;
}> {
  return apiFetch(`/collab/analytics?period=${period}`, { auth: true });
}

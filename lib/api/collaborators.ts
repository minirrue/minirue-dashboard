import { apiFetch } from './client';

/**
 * What a partner can reach in their own dashboard.
 *
 * SUPPORT (backend 0.55.0) also lets them say whether their support desk is
 * open and what reply time it advertises — only meaningful since every space
 * got its own desk, before which that was one switch for the whole shop.
 */
export type CollaboratorModule = 'ORDERS' | 'PRODUCTS' | 'ANALYTICS' | 'SUPPORT';
export type CollaboratorStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export interface CollaboratorListItem {
  id: string;
  email: string;
  brandName: string;
  brandSlug: string;
  status: CollaboratorStatus;
  modules: CollaboratorModule[];
}

export type FulfillmentMode = 'MINIRUE_SHIPS' | 'COLLAB_DROPSHIP';

export interface CollaboratorSettings {
  autoPublishProducts: boolean;
  storefrontHomeFeature: boolean;
  storefrontNavLink: boolean;
  storefrontVisible: boolean;
  commissionRate: string | null;
  fulfillmentMode: FulfillmentMode;
}

export interface CollaboratorDetail extends CollaboratorListItem {
  description: string | null;
  logoUrl: string | null;
  autoPublishProducts?: boolean;
  storefrontHomeFeature?: boolean;
  storefrontNavLink?: boolean;
  storefrontVisible?: boolean;
  commissionRate?: string | null;
  fulfillmentMode?: FulfillmentMode;
}

export interface PendingReviewProduct {
  id: string;
  name: string;
  brandSlug: string;
  brandName: string;
  priceAmount: string;
  submittedAt: string;
}

export interface CollaboratorsListResponse {
  items: CollaboratorListItem[];
  nextCursor: string | null;
}

export async function apiListCollaborators(params?: {
  status?: CollaboratorStatus;
  cursor?: string;
  limit?: number;
}): Promise<CollaboratorsListResponse> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<CollaboratorsListResponse>(`/admin/collaborators${query}`, { auth: true });
}

export async function apiGetCollaborator(id: string): Promise<CollaboratorDetail> {
  return apiFetch<CollaboratorDetail>(`/admin/collaborators/${id}`, { auth: true });
}

export async function apiCreateCollaborator(data: {
  email: string;
  /** Required. Last name is deliberately optional (2026-07-30 owner ask). */
  firstName: string;
  lastName?: string;
  brandName: string;
  brandSlug: string;
  modules: CollaboratorModule[];
  inviteByEmail?: boolean;
  password?: string;
}): Promise<CollaboratorDetail> {
  return apiFetch<CollaboratorDetail>('/admin/collaborators', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(data),
  });
}

export async function apiUpdateCollaborator(
  id: string,
  data: { brandSlug?: string; displayName?: string; modules?: CollaboratorModule[] },
): Promise<CollaboratorDetail> {
  return apiFetch<CollaboratorDetail>(`/admin/collaborators/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(data),
  });
}

export async function apiSuspendCollaborator(id: string): Promise<void> {
  await apiFetch(`/admin/collaborators/${id}/suspend`, { method: 'POST', auth: true });
}

export async function apiReactivateCollaborator(id: string): Promise<void> {
  await apiFetch(`/admin/collaborators/${id}/reactivate`, { method: 'POST', auth: true });
}

export async function apiArchiveCollaborator(id: string): Promise<void> {
  await apiFetch(`/admin/collaborators/${id}/archive`, { method: 'POST', auth: true });
}

export interface CollaboratorDeleteImpact {
  productCount: number;
  mediaCount: number;
  galleryFolderCount: number;
  galleryItemCount: number;
  orderReferenceCount: number;
}

export async function apiGetCollaboratorDeleteImpact(
  id: string,
): Promise<CollaboratorDeleteImpact> {
  return apiFetch<CollaboratorDeleteImpact>(`/admin/collaborators/${id}/delete-impact`, {
    auth: true,
  });
}

export async function apiSoftDeleteCollaborator(id: string): Promise<void> {
  await apiFetch(`/admin/collaborators/${id}/delete-soft`, { method: 'POST', auth: true });
}

export async function apiRestoreCollaborator(id: string): Promise<void> {
  await apiFetch(`/admin/collaborators/${id}/restore`, { method: 'POST', auth: true });
}

export async function apiHardDeleteCollaborator(id: string): Promise<void> {
  await apiFetch(`/admin/collaborators/${id}`, { method: 'DELETE', auth: true });
}

export async function apiUpdateCollaboratorSettings(
  id: string,
  data: Partial<CollaboratorSettings>,
): Promise<CollaboratorDetail> {
  return apiFetch<CollaboratorDetail>(`/admin/collaborators/${id}/settings`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(data),
  });
}

export interface CollaboratorAnalytics {
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
}

/**
 * A partner's own sales figures, read by an admin for the Partners oversight
 * screen. specs/2026-07-23-partner-oversight
 */
export async function apiGetCollaboratorAnalytics(
  id: string,
  period: '7d' | '30d' | '90d' = '30d',
): Promise<CollaboratorAnalytics> {
  return apiFetch<CollaboratorAnalytics>(
    `/admin/collaborators/${id}/analytics?period=${period}`,
    { auth: true },
  );
}

export async function apiListPendingReviewProducts(): Promise<{ items: PendingReviewProduct[] }> {
  return apiFetch('/admin/collaborators/products/pending', { auth: true });
}

export async function apiApproveCollaboratorProduct(productId: string): Promise<void> {
  await apiFetch(`/admin/collaborators/products/${productId}/approve`, {
    method: 'POST',
    auth: true,
  });
}

export async function apiRejectCollaboratorProduct(
  productId: string,
  reason: string,
): Promise<void> {
  await apiFetch(`/admin/collaborators/products/${productId}/reject`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ reason }),
  });
}

export interface CollaboratorScope {
  collaboratorId: string;
  blockKey: string;
  canEdit: boolean;
  requiresApproval: boolean;
}

export interface AssignCollaboratorScope {
  blockKey: string;
  canEdit: boolean;
  requiresApproval?: boolean;
}

export async function apiListCollaboratorScopes(
  id: string,
): Promise<{ items: CollaboratorScope[] }> {
  return apiFetch(`/admin/collaborators/${id}/scopes`, { auth: true });
}

export async function apiAssignCollaboratorScope(
  id: string,
  data: AssignCollaboratorScope,
): Promise<{ message: string }> {
  return apiFetch(`/admin/collaborators/${id}/scopes`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(data),
  });
}

/* ── Partner detail tabs ──
   The chips on the partner page labelled Products / Orders / Analytics are
   PERMISSION toggles for what the partner sees in their own portal — they were
   never tabs, and this page had no tab strip at all. These back the real ones. */

export interface CollaboratorProductItem {
  id: string;
  name: string;
  slug: string;
  publishedState: string;
  rejectionReason?: string | null;
  priceAmount?: string | null;
  priceCurrency?: string | null;
  imageUrl?: string | null;
}

export async function apiGetCollaboratorProducts(
  id: string,
): Promise<{ items: CollaboratorProductItem[] }> {
  return apiFetch(`/admin/collaborators/${id}/products`, { auth: true });
}

export interface CollaboratorActivityItem {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  createdAt: string;
  /** PARTNER = raised in their own feed; STORE = raised about them, store-wide. */
  source: 'PARTNER' | 'STORE';
}

export async function apiGetCollaboratorActivity(
  id: string,
): Promise<{ items: CollaboratorActivityItem[] }> {
  return apiFetch(`/admin/collaborators/${id}/activity`, { auth: true });
}

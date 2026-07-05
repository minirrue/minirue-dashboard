import { apiFetch } from './client';

export type CollaboratorModule = 'ORDERS' | 'PRODUCTS' | 'ANALYTICS';
export type CollaboratorStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED';

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
  commissionRate: string | null;
  fulfillmentMode: FulfillmentMode;
}

export interface CollaboratorDetail extends CollaboratorListItem {
  description: string | null;
  logoUrl: string | null;
  autoPublishProducts?: boolean;
  storefrontHomeFeature?: boolean;
  storefrontNavLink?: boolean;
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
  data: { brandSlug?: string; modules?: CollaboratorModule[] },
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

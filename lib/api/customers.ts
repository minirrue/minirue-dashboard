import { apiFetch } from './client';

export type TierLevel = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface CustomerListItem {
  customerId: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  emailVerified: boolean;
  tier: TierLevel;
  lifetimeSpendAmount: string;
  lifetimeSpendCurrency: string;
  gdprEraseRequestedAt: string | null;
  createdAt: string;
  addressCount: number;
}

export interface CustomerListResponse {
  data: CustomerListItem[];
  total: number;
  page: number;
  limit: number;
}

export async function apiAdminListCustomers(params?: {
  page?: number;
  limit?: number;
  tier?: TierLevel;
}): Promise<CustomerListResponse> {
  const qs = new URLSearchParams();
  if (params?.page != null) qs.set('page', String(params.page));
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.tier) qs.set('tier', params.tier);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<CustomerListResponse>(`/customers${query}`, { auth: true });
}

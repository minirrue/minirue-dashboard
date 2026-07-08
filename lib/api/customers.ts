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

export interface CustomerAddress {
  id: string;
  customerId: string;
  label: 'HOME' | 'WORK' | 'OTHER';
  line1: string;
  line2: string | null;
  city: string;
  governorate: string;
  postalCode: string | null;
  countryCode: string;
  isDefault: boolean;
  createdAt: string;
}

export interface CustomerDetail {
  customerId: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  phone: string | null;
  phoneSearchHash: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  tier: TierLevel;
  lifetimeSpendAmount: string;
  lifetimeSpendCurrency: string;
  gdprEraseRequestedAt: string | null;
  createdAt: string;
  updatedAt: string;
  addresses: CustomerAddress[];
}

export interface AdjustTierInput {
  tier: TierLevel;
  reason?: string;
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

export async function apiAdminGetCustomer(userId: string): Promise<CustomerDetail> {
  return apiFetch<CustomerDetail>(`/customers/${userId}`, { auth: true });
}

export async function apiAdminAdjustTier(
  userId: string,
  input: AdjustTierInput,
): Promise<CustomerDetail> {
  return apiFetch<CustomerDetail>(`/customers/${userId}/adjust-tier`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}

/** GDPR-anonymize + delete this customer's account (admin-triggered). */
export async function apiAdminDeleteCustomer(userId: string): Promise<void> {
  await apiFetch<void>(`/customers/${userId}`, { method: 'DELETE', auth: true });
}

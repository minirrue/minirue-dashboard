import { apiFetch } from './client';
import type { OrdersListResponse } from './orders';

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

export type CustomerUserStatus = 'ACTIVE' | 'SUSPENDED';

export interface CustomerDetail {
  customerId: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  phone: string | null;
  phoneSearchHash: string | null;
  avatarUrl: string | null;
  email: string | null;
  emailVerified: boolean;
  status: CustomerUserStatus;
  name: string;
  tier: TierLevel;
  lifetimeSpendAmount: string;
  lifetimeSpendCurrency: string;
  gdprEraseRequestedAt: string | null;
  createdAt: string;
  updatedAt: string;
  addresses: CustomerAddress[];
}

export interface AdminUpdateCustomerInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  emailVerified?: boolean;
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

/** Suspend a customer's account (reversible). */
export async function apiAdminBlockCustomer(userId: string): Promise<CustomerDetail> {
  return apiFetch<CustomerDetail>(`/customers/${userId}/block`, {
    method: 'POST',
    auth: true,
  });
}

/** Reactivate a previously suspended customer account. */
export async function apiAdminUnblockCustomer(userId: string): Promise<CustomerDetail> {
  return apiFetch<CustomerDetail>(`/customers/${userId}/unblock`, {
    method: 'POST',
    auth: true,
  });
}

/** Admin edit of all customer fields (email, names, phone, avatar, verified). */
export async function apiAdminUpdateCustomer(
  userId: string,
  input: AdminUpdateCustomerInput,
): Promise<CustomerDetail> {
  return apiFetch<CustomerDetail>(`/customers/${userId}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(input),
  });
}

/** Order history for a specific customer (admin view). */
export async function apiAdminGetCustomerOrders(
  userId: string,
  params?: { page?: number; limit?: number },
): Promise<OrdersListResponse> {
  const qs = new URLSearchParams();
  qs.set('userId', userId);
  if (params?.page != null) qs.set('page', String(params.page));
  if (params?.limit != null) qs.set('limit', String(params.limit));
  return apiFetch<OrdersListResponse>(`/orders/admin?${qs.toString()}`, { auth: true });
}

export async function apiAdminCreateAddress(
  userId: string,
  input: CustomerAddressInput,
): Promise<CustomerAddress> {
  return apiFetch<CustomerAddress>(`/customers/${userId}/addresses`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}

export async function apiAdminUpdateAddress(
  userId: string,
  addressId: string,
  input: Partial<CustomerAddressInput>,
): Promise<CustomerAddress> {
  return apiFetch<CustomerAddress>(`/customers/${userId}/addresses/${addressId}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(input),
  });
}

export async function apiAdminDeleteAddress(
  userId: string,
  addressId: string,
): Promise<void> {
  await apiFetch<void>(`/customers/${userId}/addresses/${addressId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function apiAdminSetDefaultAddress(
  userId: string,
  addressId: string,
): Promise<CustomerAddress> {
  return apiFetch<CustomerAddress>(
    `/customers/${userId}/addresses/${addressId}/set-default`,
    { method: 'PATCH', auth: true },
  );
}

export interface CustomerAddressInput {
  label: 'HOME' | 'WORK' | 'OTHER';
  line1: string;
  line2?: string | null;
  city: string;
  governorate: string;
  postalCode?: string | null;
  countryCode?: string;
  isDefault?: boolean;
}

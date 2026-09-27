import { apiFetch } from './client';

export type SalesMode = 'GROUND' | 'ONLINE';
export interface AssistedCustomer { id: string; firstName: string; lastName: string | null; phone: string; email: string | null; registrationStatus: 'NOT_SIGNED_UP' | 'LINKED'; orderCount?: number }
export interface CustomerNeed { id: string; name: string; description: string | null; productIds: string[]; isActive: boolean }
export interface AssistedCatalogItem { id: string; kind: 'VARIANT' | 'BUNDLE'; variantId: string | null; bundleId: string | null; productId: string | null; name: string; sku: string | null; sizeMl: number | null; onlinePriceMinor: number; groundPriceMinor: number | null; availableStock: number; imageUrl: string | null }
export interface AssistedReview {
  id: string; token: string; reviewPath: string; status: 'AWAITING_PAYMENT' | 'COMPLETED' | 'EXPIRED'; salesMode: SalesMode; currency: string;
  customer: AssistedCustomer;
  items: Array<{ id: string; kind: 'VARIANT' | 'BUNDLE'; variantId: string | null; bundleId: string | null; name: string; sku: string | null; sizeMl: number | null; quantity: number; unitPriceMinor: number; lineTotalMinor: number; imageUrl: string | null }>;
  subtotalMinor: number; totalMinor: number; shippingMinor: number; discountMinor?: number;
  loyalty: { expectedPoints: number; egpValueMinor: number | null; pointsPerEgp: number; egpPerPoint: number | null };
  expiresAt: string; completedAt: string | null; orderNumber: string | null; orderId?: string; orderStatus?: string;
  paymentMethod?: 'CASH' | 'INSTAPAY' | 'CARD'; notes?: string | null;
  concern?: {id:string;name:string} | null;
  shippingAddress?: {line1:string;line2?:string;city:string;governorate:string;postalCode?:string} | null;
}
export interface CreateAssistedReview {
  idempotencyKey: string; salesMode: SalesMode;
  concernId?: string;
  customer: { firstName: string; lastName?: string; phone: string; email?: string };
  items: Array<{ variantId: string; qty: number } | { bundleId: string; qty: number }>;
  paymentMethod: 'CASH' | 'INSTAPAY' | 'CARD'; notes?: string;
  shippingAddress?: { line1: string; line2?: string; city: string; governorate: string; postalCode?: string };
}
const base = '/orders/admin/ground';
export const getAssistedCatalog = (params: { q?: string; concernId?: string; page?: number }) => apiFetch<{ data: AssistedCatalogItem[]; page: number; hasMore: boolean }>(`${base}/catalog?${new URLSearchParams(Object.entries(params).filter(([,value])=>value !== undefined && value !== '').map(([key,value])=>[key,String(value)]))}`, { auth: true });
export const getCustomerNeeds = () => apiFetch<{ data: CustomerNeed[] }>(`${base}/concerns`, { auth: true });
export const saveCustomerNeed = (body: { name: string; description?: string; productIds: string[]; isActive?: boolean }, id?: string) => apiFetch<{data:CustomerNeed[]}>(`${base}/concerns${id?`/${id}`:''}`, { auth: true, method: id?'PATCH':'POST', body: JSON.stringify(body) });
export const archiveCustomerNeed = (id: string) => apiFetch<{data:CustomerNeed[]}>(`${base}/concerns/${id}`, { auth: true, method:'DELETE' });
export const getAssistedCustomers = (q='') => apiFetch<{ data: AssistedCustomer[] }>(`${base}/customers?q=${encodeURIComponent(q)}`, { auth:true });
export const createAssistedReview = (body: CreateAssistedReview) => apiFetch<AssistedReview>(`${base}/reviews`, { auth:true, method:'POST', body:JSON.stringify(body) });
export const getAssistedReview = (id: string) => apiFetch<AssistedReview>(`${base}/reviews/${id}`, { auth:true });
export const completeAssistedReview = (id: string, body: { paymentReceived: true; handedOver: boolean; instapayReference?: string; payerName?: string; receiptDataUrl?: string }) => apiFetch<AssistedReview>(`${base}/reviews/${id}/complete`, { auth:true,method:'POST',body:JSON.stringify(body) });
export const cancelAssistedReview = (id: string) => apiFetch<AssistedReview>(`${base}/reviews/${id}/cancel`, { auth:true,method:'POST' });
export const getAssistedCustomer = (id: string) => apiFetch<{ customer: AssistedCustomer; orders: Array<{id:string;orderNumber:string;salesMode:SalesMode;status:string;totalMinor:number;createdAt:string}> }>(`${base}/customers/${id}`, {auth:true});

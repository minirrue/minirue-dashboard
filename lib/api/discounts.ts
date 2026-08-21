import { apiFetch } from './client';

/**
 * Discount codes, the sitewide markdown, the usage ledger and the abuse
 * warnings.
 *
 * Every write here is ADMIN-only on the backend regardless of what the screen
 * offers — STAFF can read the history and issue compensation from a support
 * conversation, and nothing else.
 */

export type DiscountKind = 'GLOBAL' | 'PERSONAL' | 'AUTOMATIC';

export interface Discount {
  id: string;
  /** `MINIRUE-K7P2X4`. Null for the sitewide markdown, which nobody types. */
  code: string | null;
  kind: DiscountKind;
  valueType: 'PERCENT' | 'FIXED';
  /** Whole percent, e.g. 12.5. Null for a fixed amount. */
  percent: number | null;
  /** Piastres. Null for a percentage. */
  amountMinor: number | null;
  productId: string | null;
  ownerCustomerId: string | null;
  /** The owner's name, resolved by the API for the list. Null for a code
   *  anyone can use, or when that account has since been deleted — in which
   *  case the id is still shown rather than a name being invented. */
  ownerCustomerName?: string | null;
  maxRedemptions: number | null;
  maxPerCustomer: number;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  killedAt: string | null;
  killReason: string | null;
  source: 'DASHBOARD' | 'SUPPORT';
  supportConversationId: string | null;
  note: string | null;
  createdAt: string;
}

export interface Redemption {
  id: string;
  createdAt: string;
  customerId: string;
  amountMinor: number;
  currency: string;
  orderId: string;
  orderNumber: string | null;
  discountId: string | null;
  code: string | null;
  kind: string | null;
  source: string | null;
}

/**
 * The four abuse rules, computed fresh on every read rather than stored — a
 * stored flag is a snapshot of a threshold that seemed right once.
 */
export interface Warnings {
  /** Five or more failed code attempts in an hour from one account or device. */
  guessing: Array<{
    subject: string;
    customer_id: string | null;
    failures: number;
    last_seen: string;
  }>;
  /** One customer redeeming four or more different offers in 30 days. */
  serialRedeemer: Array<{
    customer_id: string;
    distinct_offers: number;
    total_minor: number;
    last_seen: string;
  }>;
  /** One offer used by three or more accounts sharing an address. */
  sharedIdentity: Array<{
    discount_id: string;
    address_hash: string;
    accounts: number;
    total_minor: number;
    last_seen: string;
  }>;
  /** A personal code tried by somebody who does not own it — it leaked. */
  leakedPersonal: Array<{
    code_text: string;
    attempts: number;
    last_seen: string;
  }>;
}

export async function listDiscounts(includeKilled = false): Promise<Discount[]> {
  const res = await apiFetch<{ data: Discount[] }>(
    `/admin/discounts?includeKilled=${includeKilled}`,
    { auth: true },
  );
  return res.data;
}

export interface CreateDiscountInput {
  kind: 'GLOBAL' | 'PERSONAL';
  valueType: 'PERCENT' | 'FIXED';
  percent?: number;
  amountMinor?: number;
  productId?: string | null;
  ownerCustomerId?: string | null;
  maxRedemptions?: number | null;
  maxPerCustomer?: number;
  startsAt?: string | null;
  expiresAt?: string | null;
  note?: string | null;
}

/** The code itself is generated server-side and comes back on the response. */
export async function createDiscount(
  input: CreateDiscountInput,
): Promise<Discount> {
  return apiFetch<Discount>('/admin/discounts', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}

/**
 * Stop a code immediately. Never retroactive — orders already placed keep their
 * discount, and the usage history keeps its rows.
 */
export async function killDiscount(
  id: string,
  reason?: string,
): Promise<Discount> {
  return apiFetch<Discount>(`/admin/discounts/${id}/kill`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

/** Start or replace the one sitewide markdown. Starting a new one retires the old. */
export async function setAutomatic(input: {
  percent: number;
  startsAt?: string | null;
  expiresAt?: string | null;
  note?: string | null;
}): Promise<Discount> {
  return apiFetch<Discount>('/admin/discounts/automatic', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}

export async function stopAutomatic(): Promise<{ stopped: number }> {
  return apiFetch<{ stopped: number }>('/admin/discounts/automatic/stop', {
    method: 'POST',
    auth: true,
  });
}

export async function listRedemptions(params?: {
  code?: string;
  customerId?: string;
  discountId?: string;
  limit?: number;
}): Promise<Redemption[]> {
  const qs = new URLSearchParams();
  if (params?.code) qs.set('code', params.code);
  if (params?.customerId) qs.set('customerId', params.customerId);
  if (params?.discountId) qs.set('discountId', params.discountId);
  qs.set('limit', String(params?.limit ?? 100));
  const res = await apiFetch<{ data: Redemption[] }>(
    `/admin/discounts/redemptions?${qs.toString()}`,
    { auth: true },
  );
  return res.data;
}

export async function getWarnings(): Promise<Warnings> {
  return apiFetch<Warnings>('/admin/discounts/warnings', { auth: true });
}

/**
 * Compensation already given to this order's customer, so the Refunds screen
 * can warn before the same complaint is paid twice.
 */
export async function compensationForOrder(
  orderId: string,
): Promise<Discount[]> {
  const res = await apiFetch<{ data: Discount[] }>(
    `/admin/discounts/for-order/${orderId}`,
    { auth: true },
  );
  return res.data;
}

/** Issue compensation into a support conversation. */
export async function issueCompensation(
  conversationId: string,
  input: {
    valueType: 'PERCENT' | 'FIXED';
    percent?: number;
    amountMinor?: number;
    productId?: string | null;
    expiresInDays?: number;
    note?: string | null;
  },
): Promise<Discount> {
  return apiFetch<Discount>(
    `/support/conversations/${conversationId}/compensation`,
    { method: 'POST', auth: true, body: JSON.stringify(input) },
  );
}

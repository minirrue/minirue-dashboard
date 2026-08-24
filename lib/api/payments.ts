import { apiFetch } from './client';

export type PaymentMethod = 'COD' | 'INSTAPAY' | 'GATEWAY' | 'MANUAL';
export type PaymentAttemptStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface PaymentAttempt {
  id: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentAttemptStatus;
  amountCents: number;
  gatewayReference: string | null;
  createdAt: string;
}

export interface AdminPaymentAttempt extends PaymentAttempt {
  gatewayMeta: Record<string, unknown> | null;
  failureReason: string | null;
  receiptUrl: string | null;
  instapayReference: string | null;
  payerName: string | null;
  transferredAt: string | null;
}

/**
 * A payment as it appears in the shop-wide list, which is read across orders —
 * so it carries the order's own reference. Both are nullable: a payment whose
 * order has been erased still lists, rather than vanishing along with the
 * evidence that money was taken.
 */
export interface AdminPaymentListItem extends AdminPaymentAttempt {
  orderNumber: string | null;
  orderSeq: number | null;
}

export interface PaginatedAdminPayments {
  data: AdminPaymentListItem[];
  total: number;
  page: number;
  limit: number;
}

export async function apiAdminListOrderPayments(orderId: string): Promise<AdminPaymentAttempt[]> {
  return apiFetch<AdminPaymentAttempt[]>(`/admin/payments/orders/${orderId}`, { auth: true });
}

/** Every payment in the shop, newest first. Backs the Payments tab. */
export async function apiAdminListPayments(params: {
  page?: number;
  limit?: number;
  status?: PaymentAttemptStatus;
  method?: PaymentMethod;
} = {}): Promise<PaginatedAdminPayments> {
  const query = new URLSearchParams();
  // Only what was actually asked for. Sending `status=undefined` would filter
  // on the literal string and answer an empty list.
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  if (params.method) query.set('method', params.method);
  const qs = query.toString();
  return apiFetch<PaginatedAdminPayments>(
    `/admin/payments${qs ? `?${qs}` : ''}`,
    { auth: true },
  );
}

export async function apiAdminVerifyInstapay(attemptId: string): Promise<AdminPaymentAttempt> {
  return apiFetch<AdminPaymentAttempt>(`/admin/payments/attempts/${attemptId}/verify`, {
    method: 'POST',
    auth: true,
  });
}

export async function apiAdminRejectInstapay(
  attemptId: string,
  reason?: string,
): Promise<AdminPaymentAttempt> {
  return apiFetch<AdminPaymentAttempt>(`/admin/payments/attempts/${attemptId}/reject`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ reason }),
  });
}

/**
 * Correct the reference fields an admin types in by hand.
 *
 * Omit a key to leave it alone; send null to clear it. Status is deliberately
 * not editable — it is derived from verify/reject and from refunds, and typing
 * it would let this card contradict the order's own status.
 */
export async function apiAdminUpdatePaymentReference(
  attemptId: string,
  patch: {
    instapayReference?: string | null;
    payerName?: string | null;
    gatewayReference?: string | null;
  },
): Promise<AdminPaymentAttempt> {
  return apiFetch<AdminPaymentAttempt>(
    `/admin/payments/attempts/${attemptId}/reference`,
    { method: 'PATCH', auth: true, body: JSON.stringify(patch) },
  );
}

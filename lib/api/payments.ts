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

export async function apiAdminListOrderPayments(orderId: string): Promise<AdminPaymentAttempt[]> {
  return apiFetch<AdminPaymentAttempt[]>(`/admin/payments/orders/${orderId}`, { auth: true });
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

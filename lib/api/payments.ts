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

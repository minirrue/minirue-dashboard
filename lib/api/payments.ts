import { apiFetch } from './client';

export type PaymentMethod = 'COD' | 'INSTAPAY' | 'GATEWAY';
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

export async function apiAdminListOrderPayments(orderId: string): Promise<PaymentAttempt[]> {
  return apiFetch<PaymentAttempt[]>(`/admin/payments/orders/${orderId}`, { auth: true });
}

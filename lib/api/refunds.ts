import { apiFetch } from './client';

export type RefundStatus =
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REFUNDED'
  | 'REJECTED'
  | 'CANCELLED';

export type RefundMethod =
  | 'ORIGINAL_PAYMENT'
  | 'STORE_CREDIT'
  | 'BANK_TRANSFER'
  | 'INSTAPAY';

export type RefundSource = 'CUSTOMER' | 'ADMIN';

export interface RefundTicketDto {
  id: string;
  orderId: string;
  customerId: string;
  status: RefundStatus;
  method: RefundMethod;
  source: RefundSource;
  hasProof: boolean;
  requestedAmountCents: number;
  approvedAmountCents: number | null;
  reason: string;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function apiAdminListRefunds(params?: {
  status?: RefundStatus;
  page?: number;
  limit?: number;
}): Promise<{ data: RefundTicketDto[]; total: number }> {
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : '';
  return apiFetch(`/admin/refunds${qs}`, { auth: true });
}

export async function apiAdminGetRefund(id: string): Promise<RefundTicketDto> {
  return apiFetch(`/admin/refunds/${id}`, { auth: true });
}

export async function apiAdminReviewRefund(
  id: string,
  action: 'start_review' | 'approve' | 'reject',
  options?: { adminNote?: string; approvedAmountCents?: number },
): Promise<RefundTicketDto> {
  return apiFetch(`/admin/refunds/${id}/review`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ action, ...options }),
  });
}

export async function apiAdminMarkRefunded(
  id: string,
  reference: string,
  idempotencyKey: string,
): Promise<RefundTicketDto> {
  return apiFetch(`/admin/refunds/${id}/mark-refunded`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ reference, idempotencyKey }),
  });
}

export async function apiAdminCancelRefund(id: string): Promise<RefundTicketDto> {
  return apiFetch(`/admin/refunds/${id}/cancel`, { method: 'PATCH', auth: true });
}

export interface AdminRefundOrderPayload {
  /** Omit to refund the full order total. */
  amountCents?: number;
  reason: string;
  adminNote?: string;
  /** Inline PNG/JPG data URL — genuinely optional. */
  proofDataUrl?: string;
}

/**
 * There is no payment gateway — this records an Instapay transfer the admin
 * already sent. Writes a ticket straight to REFUNDED, source ADMIN. An order
 * can only ever have one refund ticket; a second attempt 400s with
 * "This order already has a refund (STATUS)", surfaced to the caller as-is.
 */
export async function apiAdminRefundOrder(
  orderId: string,
  payload: AdminRefundOrderPayload,
): Promise<RefundTicketDto> {
  return apiFetch(`/admin/refunds/order/${orderId}`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function apiAdminGetRefundProof(
  ticketId: string,
): Promise<{ url: string | null }> {
  return apiFetch(`/admin/refunds/${ticketId}/proof`, { auth: true });
}

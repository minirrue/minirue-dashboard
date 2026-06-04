import { apiFetch } from './client';

export type PointsTxType =
  | 'EARN_ORDER'
  | 'EARN_SIGNUP'
  | 'EARN_EMAIL_VERIFIED'
  | 'REDEEM'
  | 'DEDUCT_REFUND'
  | 'EXPIRE'
  | 'MANUAL_ADJUST';

export interface LoyaltyAccountDto {
  id: string;
  customerId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  email: string | null;
}

export interface PointsTransactionDto {
  id: string;
  type: PointsTxType;
  delta: number;
  balanceAfter: number;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}

export async function apiAdminListLoyaltyAccounts(params?: {
  page?: number;
  limit?: number;
}): Promise<{ data: LoyaltyAccountDto[]; total: number }> {
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : '';
  return apiFetch(`/admin/loyalty/accounts${qs}`, { auth: true });
}

export async function apiAdminManualAdjust(data: {
  customerId: string;
  delta: number;
  note?: string;
}): Promise<LoyaltyAccountDto> {
  return apiFetch('/admin/loyalty/adjust', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(data),
  });
}

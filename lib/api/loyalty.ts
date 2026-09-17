import { apiFetch } from './client';

export type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
export type PointsTxType = 'EARN' | 'REVERSE' | 'ADJUST_COMPENSATION' | 'ADJUST_PENALTY' | 'ADJUST_CORRECTION';
export type LoyaltyAdjustmentReason = 'COMPENSATION_LATE_DELIVERY' | 'COMPENSATION_DAMAGED_ITEM' | 'GOODWILL' | 'PENALTY_ABUSE' | 'CORRECTION' | 'OTHER';

export interface LoyaltyAccountDto {
  id: string;
  customerId: string;
  name: string;
  email: string | null;
  tier: LoyaltyTier;
  avatarUrl: string | null;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  lifetimeReversed: number;
  lifetimeAdjusted: number;
  earnedLast30Days: number;
  adjustedLast30Days: number;
  lastActivity: string | null;
}

export interface PointsTransactionDto {
  id: string;
  type: PointsTxType;
  points: number;
  delta: number;
  balanceAfter: number;
  orderId: string | null;
  actorId: string | null;
  reason: LoyaltyAdjustmentReason | null;
  note: string | null;
  createdAt: string;
}

export interface LoyaltyCustomerDetailDto extends LoyaltyAccountDto {
  history: PointsTransactionDto[];
  total: number;
  page: number;
  limit: number;
}

export interface LoyaltyRulesDto {
  pointsPerEgp: number;
  redemptionEnabled: false;
  milestonesEnabled: false;
  milestones: [];
}

export interface LoyaltyAccountsParams {
  page?: number;
  limit?: 20 | 50 | 100;
  q?: string;
  tier?: LoyaltyTier;
  hasBalance?: boolean;
  recentlyAdjusted?: boolean;
  sort?: 'name' | 'balance' | 'earned30d' | 'adjusted30d' | 'lastActivity';
  direction?: 'asc' | 'desc';
}

function query<T extends object>(params: T) {
  const value = new URLSearchParams(Object.entries(params)
    .filter(([, item]) => item !== undefined && item !== '')
    .map(([key, item]) => [key, String(item)])).toString();
  return value ? `?${value}` : '';
}

export async function apiAdminListLoyaltyAccounts(params: LoyaltyAccountsParams = {}): Promise<{ data: LoyaltyAccountDto[]; total: number; page: number; limit: number }> {
  return apiFetch(`/admin/loyalty/accounts${query(params)}`, { auth: true });
}

export async function apiAdminGetLoyaltyCustomer(customerId: string, params: { page?: number; limit?: number } = {}): Promise<LoyaltyCustomerDetailDto> {
  return apiFetch(`/admin/loyalty/customers/${encodeURIComponent(customerId)}${query(params)}`, { auth: true });
}

export async function apiAdminGetLoyaltyRules(): Promise<LoyaltyRulesDto> {
  return apiFetch('/admin/loyalty/rules', { auth: true });
}

export async function apiAdminManualAdjust(data: { customerId: string; delta: number; reason: LoyaltyAdjustmentReason; note?: string }): Promise<LoyaltyAccountDto> {
  return apiFetch('/admin/loyalty/adjust', { method: 'POST', auth: true, body: JSON.stringify(data) });
}

import { useQuery } from '@tanstack/react-query';
import { apiCheckPricingWarnings, type Warning, type WarningSummary } from '@/lib/api/accounting';
import type { ApiError } from '@/lib/api/client';
import { isAdminRole } from '@/lib/auth/roles';
import { useUser } from '@/lib/hooks/use-auth';

/** Same cadence as the topbar poll; each check also emits new PRICING notifications. */
export const PRICING_WARNINGS_INTERVAL = 60_000;

export const pricingWarningsKey = ['accounting', 'warnings'] as const;

const EMPTY_BY_PRODUCT: Record<string, number> = {};
const EMPTY_ITEMS: Warning[] = [];

export interface PricingWarningsState extends WarningSummary {
  isLoading: boolean;
  isError: boolean;
}

/**
 * The one source for every yellow pricing-warning count: topbar, sidebar,
 * product page and the Warnings tab all read this hook, so they cannot
 * disagree.
 *
 * Only runs for ADMIN/SUPERADMIN (the endpoint is ADMIN-only). While loading,
 * on error, or for any other role it reports zero warnings instead of
 * throwing, because it is mounted in the layout chrome.
 */
export function usePricingWarnings(): PricingWarningsState {
  const { data: user } = useUser();
  const enabled = isAdminRole(user?.role);

  const query = useQuery<WarningSummary, ApiError>({
    queryKey: pricingWarningsKey,
    queryFn: apiCheckPricingWarnings,
    enabled,
    refetchInterval: enabled ? PRICING_WARNINGS_INTERVAL : false,
    staleTime: PRICING_WARNINGS_INTERVAL / 2,
    throwOnError: false,
  });

  const data = enabled && !query.isError ? query.data : undefined;
  return {
    total: data?.total ?? 0,
    byProduct: data?.byProduct ?? EMPTY_BY_PRODUCT,
    items: data?.items ?? EMPTY_ITEMS,
    isLoading: enabled && query.isLoading,
    isError: enabled && query.isError,
  };
}

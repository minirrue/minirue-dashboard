import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { PricingWarning, PricingWarningsResult } from '@/lib/api/accounting';

/**
 * PG-DASHBOARD-ACCTG-003. One hook feeds every yellow warning count (topbar,
 * sidebar, product page, Warnings tab), so it must never throw into the layout
 * and must never call an ADMIN-only endpoint for anyone else.
 */

jest.mock('@/lib/hooks/use-auth', () => ({ useUser: jest.fn() }));
jest.mock('@/lib/api/accounting', () => ({ apiCheckPricingWarnings: jest.fn() }));

import { useUser } from '@/lib/hooks/use-auth';
import { apiCheckPricingWarnings } from '@/lib/api/accounting';
import { usePricingWarnings, PRICING_WARNINGS_INTERVAL } from '@/lib/hooks/use-pricing-warnings';

const mockUseUser = useUser as jest.Mock;
const mockCheck = apiCheckPricingWarnings as jest.Mock;

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('usePricingWarnings', () => {
  it('polls every 60 seconds', () => {
    expect(PRICING_WARNINGS_INTERVAL).toBe(60_000);
  });

  it('returns the check result for an admin, in the backend shape', async () => {
    mockUseUser.mockReturnValue({ data: { userId: 'a', role: 'ADMIN' } });
    // Exactly what backend deriveWarnings returns (src/pricing/pricing-warnings.ts):
    // a per-item warning and a shop-wide one, which has null ids and a count.
    const items: PricingWarning[] = [
      {
        key: 'NO_COST:v1',
        kind: 'NO_COST',
        variantId: 'v1',
        productId: 'p1',
        title: 'Tee (TEE-S) has no cost',
        detail: 'Without a cost there is no floor, so discounts on it are unprotected.',
      },
      {
        key: 'OFFER_BELOW_LAW1:shop',
        kind: 'OFFER_BELOW_LAW1',
        variantId: null,
        productId: null,
        title: 'The running offer puts 1 product below Law 1',
        detail: "Under the offer, this product's profit comes only from the delivery fee.",
        count: 1,
      },
    ];
    const body: PricingWarningsResult = { total: 2, byProduct: { p1: 1 }, items };
    mockCheck.mockResolvedValue(body);

    const { result } = renderHook(() => usePricingWarnings(), { wrapper });

    await waitFor(() => expect(result.current.total).toBe(2));
    expect(result.current.byProduct).toEqual({ p1: 1 });
    expect(result.current.items).toEqual(items);
    expect(mockCheck).toHaveBeenCalledTimes(1);
  });

  it('recheck() runs the check again (after a pricing or offer save)', async () => {
    mockUseUser.mockReturnValue({ data: { userId: 'a', role: 'ADMIN' } });
    mockCheck
      .mockResolvedValueOnce({ total: 0, byProduct: {}, items: [] })
      .mockResolvedValueOnce({
        total: 1,
        byProduct: { p1: 1 },
        items: [{ key: 'LOSES_MONEY:v1', kind: 'LOSES_MONEY', variantId: 'v1', productId: 'p1', title: 't', detail: 'd' }],
      });

    const { result } = renderHook(() => usePricingWarnings(), { wrapper });
    await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));

    await act(() => result.current.recheck());
    await waitFor(() => expect(result.current.total).toBe(1));
    expect(mockCheck).toHaveBeenCalledTimes(2);
  });

  it('returns zeros while loading and on error, without throwing', async () => {
    mockUseUser.mockReturnValue({ data: { userId: 's', role: 'SUPERADMIN' } });
    mockCheck.mockRejectedValue({ status: 500, message: 'boom' });

    const { result } = renderHook(() => usePricingWarnings(), { wrapper });
    expect(result.current).toMatchObject({ total: 0, byProduct: {}, items: [] });

    await waitFor(() => expect(mockCheck).toHaveBeenCalled());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current).toMatchObject({ total: 0, byProduct: {}, items: [] });
  });

  it.each(['STAFF', 'COLLAB', 'CUSTOMER'])('never calls the endpoint for %s', async (role) => {
    mockUseUser.mockReturnValue({ data: { userId: 'x', role } });
    const { result } = renderHook(() => usePricingWarnings(), { wrapper });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockCheck).not.toHaveBeenCalled();
    expect(result.current.total).toBe(0);
  });

  it('waits for the user before calling', async () => {
    mockUseUser.mockReturnValue({ data: undefined });
    renderHook(() => usePricingWarnings(), { wrapper });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockCheck).not.toHaveBeenCalled();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';

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

  it('returns the check result for an admin', async () => {
    mockUseUser.mockReturnValue({ data: { userId: 'a', role: 'ADMIN' } });
    const items = [{ key: 'k1', kind: 'NO_COST', title: 'No cost', detail: '', productId: 'p1', link: '/accounting' }];
    mockCheck.mockResolvedValue({ total: 1, byProduct: { p1: 1 }, items });

    const { result } = renderHook(() => usePricingWarnings(), { wrapper });

    await waitFor(() => expect(result.current.total).toBe(1));
    expect(result.current.byProduct).toEqual({ p1: 1 });
    expect(result.current.items).toEqual(items);
    expect(mockCheck).toHaveBeenCalledTimes(1);
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

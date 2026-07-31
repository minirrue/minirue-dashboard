/**
 * QC pass 3 (2026-07-31): the dashboard half of "still signed in after Sign out".
 *
 * The dashboard's REAL credential is the httpOnly `mr_dash_access` /
 * `mr_dash_refresh` cookie pair. The backend's token extractor reads the
 * cookie FIRST and only falls back to the Authorization header
 * (jwt.strategy.ts:19-22), and POST /auth/logout resolves the refresh token
 * the same way. Only the server can clear an httpOnly cookie or revoke the
 * refresh_tokens row. clearTokens() reaches neither — it only tidies
 * localStorage and the `mr-auth` hint.
 *
 * useLogout()'s mutationFn used to skip the server round-trip entirely unless
 * a refresh token happened to be sitting in localStorage. It is empty in two
 * ordinary situations:
 *
 *   1. While impersonating — beginActingAs() deliberately parks the real pair
 *      and calls setTokens(borrowed, '').
 *   2. After any 401 that already ran clearTokens(), which is the single most
 *      likely moment for someone to press Sign out.
 *
 * In both, the UI went blank-and-signed-out while the cookies, the session row
 * and every access token issued against it stayed alive — and POST
 * /auth/refresh from that same browser would mint a brand-new session straight
 * off the surviving cookie.
 *
 * Second leak, same button: clearTokens() never touched sessionStorage, so
 * signing out while impersonating left `mr-acting-parked` (the super admin's
 * REAL access and refresh tokens) and `mr-acting-as` behind. apiFetch's 401
 * branch calls stopActingAs() whenever isActing() is true — which writes those
 * parked tokens back into localStorage and re-sets `mr-auth=1`, signing the
 * super admin back in moments after they pressed Sign out.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLogout } from '@/lib/hooks/use-auth';
import { setTokens, getAccessToken, getRefreshToken } from '@/lib/auth/tokens';
import { beginActingAs, isActing, stopActingAs } from '@/lib/auth/acting-session';
import { Role } from '@/lib/auth/role';

const originalFetch = global.fetch;

function jsonResponse(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as unknown as Response;
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function logoutCalls(mock: jest.Mock): unknown[][] {
  return mock.mock.calls.filter((c) => String(c[0]).includes('/auth/logout'));
}

describe('dashboard Sign out ends the SERVER session, not just the client one', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = 'mr-auth=; Max-Age=0; path=/';
    fetchMock = jest.fn().mockResolvedValue(jsonResponse(200));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
    sessionStorage.clear();
  });

  it('POSTs /auth/logout even with no refresh token in localStorage', async () => {
    // The httpOnly cookies are alive; localStorage is not where they live.
    expect(getRefreshToken()).toBeNull();

    const { result } = renderHook(() => useLogout(), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(logoutCalls(fetchMock)).toHaveLength(1);
  });

  it('POSTs /auth/logout while impersonating, where the refresh token is deliberately empty', async () => {
    setTokens('super-access', 'super-refresh');
    beginActingAs('borrowed-access', 1800, {
      id: 'cust-1',
      name: 'A Customer',
      email: 'a@b.c',
      role: Role.CUSTOMER,
    });
    expect(getRefreshToken()).toBe('');
    expect(isActing()).toBe(true);

    const { result } = renderHook(() => useLogout(), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(logoutCalls(fetchMock)).toHaveLength(1);
  });

  it('throws the parked super-admin session away, so a later 401 cannot restore it', async () => {
    setTokens('super-access', 'super-refresh');
    beginActingAs('borrowed-access', 1800, {
      id: 'cust-1',
      name: 'A Customer',
      email: 'a@b.c',
      role: Role.CUSTOMER,
    });

    const { result } = renderHook(() => useLogout(), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(isActing()).toBe(false);
    expect(sessionStorage.getItem('mr-acting-parked')).toBeNull();

    // This is what apiFetch's 401 branch does. After a sign-out it must find
    // nothing to put back.
    expect(stopActingAs()).toBe(false);
    expect(getAccessToken()).toBeNull();
    expect(document.cookie).not.toContain('mr-auth=1');
  });

  it('still signs the user out locally when the server call fails', async () => {
    setTokens('access-1', 'refresh-1');
    fetchMock.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useLogout(), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(getAccessToken()).toBeNull();
    expect(document.cookie).not.toContain('mr-auth=1');
  });
});

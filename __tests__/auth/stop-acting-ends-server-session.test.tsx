/**
 * Stopping a "sign in as" has to reach the SERVER.
 *
 * `stopActingAs()` used to be nothing but a swap in the browser: it put the
 * super admin's parked tokens back and forgot the borrowed one. The borrowed
 * token itself stayed valid for the rest of its 30 minutes, and there was no
 * endpoint that could end it — so one that leaked (copied out of devtools, sat
 * in a shared machine's storage, captured from a screen share) could not be
 * stopped at all.
 *
 * The backend now mints it against a revocable session marker and exposes
 * POST /v1/auth/stop-acting-as. These tests assert the dashboard actually
 * calls it — on switching back AND on signing out — and that a failed call
 * still clears the client, because someone who pressed the button must never
 * be left holding a borrowed session because the network was down.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLogout } from '@/lib/hooks/use-auth';
import { setTokens, getAccessToken } from '@/lib/auth/tokens';
import {
  beginActingAs,
  isActing,
  stopActingAs,
  clearActingSession,
} from '@/lib/auth/acting-session';
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

function stopCalls(mock: jest.Mock): unknown[][] {
  return mock.mock.calls.filter((c) => String(c[0]).includes('/auth/stop-acting-as'));
}

/** The fire-and-forget revoke goes through a dynamic import; let it land. */
async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  await Promise.resolve();
}

function actAsSomeone(): void {
  setTokens('super-access', 'super-refresh');
  beginActingAs('borrowed-access', 1800, {
    id: 'cust-1',
    name: 'A Customer',
    email: 'a@b.c',
    role: Role.CUSTOMER,
  });
}

describe('stopping a borrowed session ends it on the server', () => {
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

  it('POSTs /auth/stop-acting-as with the BORROWED token when switching back', async () => {
    actAsSomeone();

    const restored = stopActingAs();
    await flush();

    expect(restored).toBe(true);
    const calls = stopCalls(fetchMock);
    expect(calls).toHaveLength(1);

    const init = calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    // The borrowed token, not the super admin's own — the point is to end the
    // session being given up, not the one being returned to.
    expect(headers.Authorization).toBe('Bearer borrowed-access');
  });

  it("omits credentials, so the cookie cannot end the super admin's session instead", async () => {
    actAsSomeone();

    stopActingAs();
    await flush();

    // While impersonating, the httpOnly cookie pair still holds the SUPER
    // ADMIN's session while the borrowed token sits in localStorage — and the
    // backend's extractor reads the COOKIE FIRST. Sending cookies here would
    // ask the server to end the wrong session entirely.
    const init = stopCalls(fetchMock)[0][1] as RequestInit;
    expect(init.credentials).toBe('omit');
    expect(init.method).toBe('POST');
  });

  it('still hands the super admin their own session back when the call fails', async () => {
    actAsSomeone();
    fetchMock.mockRejectedValue(new Error('network down'));

    const restored = stopActingAs();
    await flush();

    // Best-effort: a dead network must not strand someone inside a borrowed
    // session in their own browser.
    expect(restored).toBe(true);
    expect(isActing()).toBe(false);
    expect(getAccessToken()).toBe('super-access');
  });

  it('does not call it when there is no borrowed session to end', async () => {
    setTokens('super-access', 'super-refresh');

    stopActingAs();
    clearActingSession();
    await flush();

    expect(stopCalls(fetchMock)).toHaveLength(0);
  });

  it('ends the borrowed session when signing out while impersonating', async () => {
    actAsSomeone();

    const { result } = renderHook(() => useLogout(), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    await flush();

    // Signing out clears the super admin's session. The borrowed one is a
    // separate session in separate storage, so without this it stayed live for
    // the rest of its 30 minutes.
    const calls = stopCalls(fetchMock);
    expect(calls).toHaveLength(1);
    expect((calls[0][1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer borrowed-access',
    });
    expect(isActing()).toBe(false);
  });

  it('does not call it on an ordinary sign-out', async () => {
    setTokens('admin-access', 'admin-refresh');

    const { result } = renderHook(() => useLogout(), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    await flush();

    expect(stopCalls(fetchMock)).toHaveLength(0);
  });
});

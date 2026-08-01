/**
 * Stopping a "sign in as" has to reach the SERVER.
 *
 * The behaviour under test is unchanged; the mechanism is completely different,
 * so these were rewritten rather than patched.
 *
 * It used to be that `stopActingAs()` swapped tokens in the browser: it put the
 * super admin's parked tokens back and forgot the borrowed one, which stayed
 * valid for the rest of its 30 minutes. A separate `/auth/stop-acting-as`
 * endpoint was added later so that a leaked token could actually be revoked.
 *
 * Better Auth's admin plugin removes the whole shape of that problem. The
 * borrowed session IS the session cookie, swapped server-side, so there is
 * nothing parked in the browser, nothing to restore by hand, and stopping is a
 * server action by construction. What still has to be true — and is what these
 * assert — is that switching back reaches the server, that a failed call does
 * not leave someone looking at a banner whose button does nothing, and that
 * signing out while impersonating still ends things properly.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLogout } from '@/lib/hooks/use-auth';
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
  return mock.mock.calls.filter((c) =>
    String(c[0]).includes('/auth/admin/stop-impersonating'),
  );
}

function impersonateCalls(mock: jest.Mock): unknown[][] {
  return mock.mock.calls.filter((c) =>
    String(c[0]).includes('/auth/admin/impersonate-user'),
  );
}

async function actAsSomeone(): Promise<void> {
  await beginActingAs('cust-1', {
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

  it('asks the server to swap the session when acting starts', async () => {
    await actAsSomeone();
    expect(impersonateCalls(fetchMock)).toHaveLength(1);
    expect(isActing()).toBe(true);
  });

  it('POSTs stop-impersonating when switching back', async () => {
    await actAsSomeone();
    fetchMock.mockClear();

    const restored = await stopActingAs();

    expect(restored).toBe(true);
    expect(stopCalls(fetchMock)).toHaveLength(1);
    expect(isActing()).toBe(false);
  });

  it('refuses a second hop rather than losing the way back', async () => {
    // Impersonating from inside an impersonated session would make "stop"
    // return to the FIRST target rather than to the super admin — an account
    // nobody asked for, with no obvious way out.
    await actAsSomeone();
    await expect(actAsSomeone()).rejects.toThrow(/switch back first/i);
  });

  it('still clears the client when the call fails, and reports that it did not restore', async () => {
    await actAsSomeone();
    fetchMock.mockRejectedValue(new Error('network down'));

    const restored = await stopActingAs();

    // False, not true: the admin's session is restored by the SERVER, so a
    // failed call leaves the browser holding the borrowed cookie. The caller
    // uses this to send them to sign-in rather than silently continuing as
    // someone else.
    expect(restored).toBe(false);
    // The local note goes either way — a banner offering a "switch back" that
    // cannot work is worse than no banner at all.
    expect(isActing()).toBe(false);
  });

  it('ends the borrowed session when signing out while impersonating', async () => {
    await actAsSomeone();
    fetchMock.mockClear();

    const { result } = renderHook(() => useLogout(), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isPending).toBe(false));

    // Sign-out destroys whichever session the cookie names — and while
    // impersonating that IS the borrowed one, so a separate revoke is neither
    // needed nor correct: restoring the admin's session a moment before
    // signing it out would be a race with no upside.
    const signOut = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/auth/sign-out'),
    );
    expect(signOut).toHaveLength(1);
    expect(isActing()).toBe(false);
  });

  it('clearActingSession forgets the note without calling the server', async () => {
    await actAsSomeone();
    fetchMock.mockClear();

    clearActingSession();

    expect(isActing()).toBe(false);
    expect(stopCalls(fetchMock)).toHaveLength(0);
  });
});

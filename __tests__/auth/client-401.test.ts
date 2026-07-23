/**
 * A 401 means two completely different things depending on the call.
 *
 * On an authenticated call it means "your access token died" — refresh, retry,
 * and if that fails tell the user the session expired. On the login call it
 * means "wrong email or password", and the user must see that instead. The
 * client used to run the refresh path for both, so every mistyped password on
 * the dashboard login screen reported "Session expired".
 */
import { apiFetch } from '@/lib/api/client';
import { setTokens, getAccessToken } from '@/lib/auth/tokens';

const originalFetch = global.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'x',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as unknown as Response;
}

describe('apiFetch 401 handling', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
  });

  it('surfaces the backend message on an unauthenticated 401 (login)', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse(401, { message: 'Invalid credentials', error: 'Unauthorized' }),
    ) as unknown as typeof fetch;

    await expect(
      apiFetch('/auth/login', { method: 'POST', body: '{}' }),
    ).rejects.toMatchObject({ status: 401, message: 'Invalid credentials' });

    // and it never tried to refresh
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
  });

  it('does not wipe an existing session because a login attempt failed', async () => {
    setTokens('access-1', 'refresh-1');
    global.fetch = jest.fn(async () =>
      jsonResponse(401, { message: 'Invalid credentials' }),
    ) as unknown as typeof fetch;

    await expect(
      apiFetch('/auth/login', { method: 'POST', body: '{}' }),
    ).rejects.toMatchObject({ message: 'Invalid credentials' });

    expect(getAccessToken()).toBe('access-1');
  });

  it('still refreshes and retries an authenticated 401', async () => {
    setTokens('stale', 'refresh-1');
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: 'fresh', refreshToken: 'refresh-2' }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiFetch('/orders', { auth: true })).resolves.toEqual({ ok: true });
    expect(getAccessToken()).toBe('fresh');
  });

  it('reports an expired session when the refresh itself is rejected', async () => {
    setTokens('stale', 'refresh-1');
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(401, {}));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiFetch('/orders', { auth: true })).rejects.toMatchObject({
      status: 401,
      message: 'Session expired',
    });
    expect(getAccessToken()).toBeNull();
  });
});

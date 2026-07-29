import { checkServerHealth } from '@/lib/api/health';

/**
 * The whole point of this indicator is that it never lies, so the cases worth
 * pinning are the ones where a naive implementation would show green:
 * a 200 from something that is not the API, and a request that never returns.
 */

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
  jest.useRealTimers();
});

function mockFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  global.fetch = jest.fn(impl) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('checkServerHealth', () => {
  it('is online when the API answers 200 and reports ok', async () => {
    mockFetch(async () => jsonResponse({ status: 'ok', ts: '2026-07-29T00:00:00.000Z' }));
    await expect(checkServerHealth()).resolves.toMatchObject({ status: 'online' });
  });

  it('probes /health at the root, not under /v1', async () => {
    // The health controller is VERSION_NEUTRAL on the backend. Prefixing it
    // with /v1 like every other call would 404 and read as a dead server.
    let seen = '';
    mockFetch(async (input) => {
      seen = String(input);
      return jsonResponse({ status: 'ok' });
    });
    await checkServerHealth();
    expect(seen).toMatch(/\/health$/);
    expect(seen).not.toContain('/v1');
  });

  it('is degraded on 503 — the API answered, it just is not well', async () => {
    mockFetch(async () => jsonResponse({ status: 'error', db: 'unreachable' }, 503));
    await expect(checkServerHealth()).resolves.toMatchObject({ status: 'degraded' });
  });

  it('is degraded when a 200 does not actually say ok', async () => {
    // A proxy or a holding page can return 200 with the app behind it gone.
    // Trusting the status code alone would paint that green.
    mockFetch(async () => jsonResponse({ hello: 'world' }));
    await expect(checkServerHealth()).resolves.toMatchObject({ status: 'degraded' });
  });

  it('is degraded when a 200 body is not JSON at all', async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    } as unknown as Response));
    await expect(checkServerHealth()).resolves.toMatchObject({ status: 'degraded' });
  });

  it('is offline when the request rejects', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(checkServerHealth()).resolves.toMatchObject({ status: 'offline', latencyMs: null });
  });

  it('is offline when the server hangs past the timeout', async () => {
    // A hung server must not leave the dot stuck on grey "checking" forever.
    mockFetch(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    await expect(checkServerHealth(20)).resolves.toMatchObject({ status: 'offline', latencyMs: null });
  });

  it('reports a round-trip time whenever the server answered', async () => {
    mockFetch(async () => jsonResponse({ status: 'ok' }));
    const { latencyMs } = await checkServerHealth();
    expect(typeof latencyMs).toBe('number');
    expect(latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('still times an unhealthy answer — a slow 503 is worth seeing', async () => {
    mockFetch(async () => jsonResponse({ status: 'error' }, 503));
    const { status, latencyMs } = await checkServerHealth();
    expect(status).toBe('degraded');
    expect(typeof latencyMs).toBe('number');
  });

  it('measures the wait, not a constant', async () => {
    // Guards against the timer being read twice at the same instant, which
    // would make every reading 0 and the whole figure meaningless.
    mockFetch(
      async () =>
        new Promise<Response>((resolve) =>
          setTimeout(() => resolve(jsonResponse({ status: 'ok' })), 30),
        ),
    );
    const { latencyMs } = await checkServerHealth();
    expect(latencyMs).toBeGreaterThanOrEqual(20);
  });
});

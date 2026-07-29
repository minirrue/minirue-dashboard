/**
 * Server health probe.
 *
 * Deliberately NOT routed through `apiFetch`: that client attaches credentials,
 * refreshes tokens and redirects on 401. A health probe must be able to run on
 * the login page, before anyone is signed in, and a dead API must read as "the
 * server is down" rather than kicking the user through an auth flow.
 *
 * `/health` is VERSION_NEUTRAL on the backend, so it sits at the root and NOT
 * under /v1 like everything else. It is also @Public() and @SkipThrottle(), so
 * polling it cannot get the dashboard rate-limited.
 */

const HEALTH_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002') + '/health';

export type ServerHealth = 'online' | 'degraded' | 'offline';

export interface HealthProbe {
  status: ServerHealth;
  /**
   * Round-trip time in ms for the probe, or null when there was no round trip
   * to measure (offline/timed out).
   *
   * This is a real request/response over the same transport, host and proxy
   * chain the dashboard uses for its actual work, so it answers "how slow is
   * the thing I am about to click" rather than the latency of some separate
   * channel kept open for measuring. It includes server think-time — the
   * endpoint runs `SELECT 1` — which is the honest number: a healthy network
   * in front of a struggling database is still a slow dashboard.
   */
  latencyMs: number | null;
}

/** Long enough to survive a slow cold start, short enough that a hung server
 *  reads as down rather than leaving the indicator stuck on "checking". */
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Three outcomes, because "cannot reach it" and "reached it and it says it is
 * unwell" are different problems with different fixes:
 *   online   — 200 and the body says ok
 *   degraded — answered, but not healthy (the endpoint returns 503 when it
 *              cannot reach the database)
 *   offline  — no answer at all: down, unreachable, CORS-blocked, or timed out
 */
export async function checkServerHealth(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<HealthProbe> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // performance.now() rather than Date.now(): it is monotonic, so a clock
  // adjustment mid-request cannot produce a negative or wildly wrong latency.
  const startedAt = performance.now();

  try {
    const res = await fetch(HEALTH_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });

    // Measured at first response, before reading the body: the body is a few
    // bytes, and waiting on it would fold JSON parsing into the network figure.
    const latencyMs = Math.round(performance.now() - startedAt);

    if (!res.ok) return { status: 'degraded', latencyMs };

    // A 200 whose body is not `ok` still counts as degraded rather than online
    // — trusting the status code alone would show green for a proxy's own
    // response when the app behind it is gone.
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    return { status: body?.status === 'ok' ? 'online' : 'degraded', latencyMs };
  } catch {
    // No round trip happened, so there is no latency to report. Reporting the
    // time spent waiting for a timeout as "latency" would be a made-up number.
    return { status: 'offline', latencyMs: null };
  } finally {
    clearTimeout(timer);
  }
}

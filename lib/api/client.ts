import { getAccessToken, setTokens, clearTokens } from '@/lib/auth/tokens';

export interface ApiError {
  status: number;
  message: string;
  error?: string;
}

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002') + '/v1';

/** Exported for the one call that has to bypass apiFetch — see apiStopActingAs. */
export const API_BASE = BASE;

/**
 * Tells the API this request belongs to the DASHBOARD, so it reads and writes the
 * dashboard's own session cookies.
 *
 * Both apps used one cookie pair on the apex domain and both call the same API
 * host, so signing into the dashboard overwrote the storefront's session — and the
 * public storefront then carried a SUPERADMIN token. With this header the two
 * sessions coexist and log out independently.
 */
export const CLIENT_HEADER = 'x-mr-client';
export const CLIENT_AUDIENCE = 'dashboard';

/**
 * One shared refresh attempt for the whole app.
 *
 * The dashboard polls several endpoints at once (notifications, the support
 * inbox, orders). When the access token expired, each of those 401s started its
 * own /auth/refresh — and because the backend ROTATES the refresh token, only
 * the first succeeded. The rest presented a token that had just been invalidated,
 * failed, and called clearTokens(), signing the user out mid-session even though
 * their session was perfectly renewable. Every caller now awaits the same
 * promise and shares its outcome.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const { getRefreshToken } = await import('@/lib/auth/tokens');
        const refreshToken = getRefreshToken();
        if (!refreshToken) return false;
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [CLIENT_HEADER]: CLIENT_AUDIENCE,
          },
          credentials: 'include',
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const pair = (await res.json()) as {
          accessToken: string;
          refreshToken: string;
        };
        setTokens(pair.accessToken, pair.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        // Cleared synchronously. Concurrent callers have already joined by
        // awaiting this same promise; anyone arriving AFTER it settles must
        // start a fresh attempt, not inherit a stale verdict from a refresh
        // that has already finished.
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

/**
 * Coerces an API error body's `message` to a string. Validation failures come
 * back as an array of `{ field, issue }` objects, and every screen renders
 * `err.message` straight into JSX — handing React an object there threw
 * "Minified React error #31" and blanked the whole page instead of showing
 * which field was wrong.
 */
export function errorMessageToText(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && raw) return raw;
  if (Array.isArray(raw)) {
    const parts = raw
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object') {
          const { field, issue, message, path } = entry as Record<string, unknown>;
          const where = field ?? path;
          const what = issue ?? message;
          if (where && what) return `${String(where)}: ${String(what)}`;
          if (what) return String(what);
        }
        return '';
      })
      .filter(Boolean);
    if (parts.length) return parts.join('; ');
  }
  if (raw && typeof raw === 'object') {
    const { message, issue } = raw as Record<string, unknown>;
    if (typeof message === 'string' && message) return message;
    if (typeof issue === 'string' && issue) return issue;
  }
  return fallback;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { auth?: boolean; _isRetry?: boolean },
): Promise<T> {
  const { auth = false, _isRetry = false, ...fetchInit } = init ?? {};

  const headers = new Headers(fetchInit.headers);
  headers.set('Content-Type', 'application/json');
  headers.set(CLIENT_HEADER, CLIENT_AUDIENCE);

  if (auth) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${BASE}${path}`, { ...fetchInit, headers, credentials: 'include' });

  // A 401 on an authenticated call means the access token died — refresh and
  // retry. A 401 on an unauthenticated call (login, register, password reset)
  // means the backend rejected what was sent, so its own message has to reach
  // the user. Treating both alike is what made every mistyped password on the
  // login screen read "Session expired".
  if (res.status === 401 && auth && !_isRetry) {
    // A borrowed "sign in as" session is short-lived by design. When it dies,
    // hand the super admin their own session back rather than signing everyone
    // out. The restore is a server call now, so it is awaited — the message
    // below tells the operator which account they are on, and it must be true.
    const { isActing, stopActingAs } = await import('@/lib/auth/acting-session');
    if (isActing()) {
      const restored = await stopActingAs();
      throw {
        status: 401,
        message: restored
          ? 'That borrowed session expired. You are back on your own account.'
          : 'That borrowed session expired. Please sign in again.',
      } as ApiError;
    }

    if (await refreshSession()) {
      return apiFetch<T>(path, { ...init, _isRetry: true });
    }
    clearTokens();
    throw { status: 401, message: 'Session expired' } as ApiError;
  }

  if (!res.ok) {
    let body: Record<string, unknown> = {};
    try { body = (await res.json()) as Record<string, unknown>; } catch { /* ignore */ }
    /**
     * The whole body is spread, not three hand-picked fields.
     *
     * An error body can carry MORE than a sentence — the variant hard-delete
     * 409 sends `referencingCount` and `canForce` so the dialog can say "4
     * orders reference this" and offer an override. Copying only
     * status/message/error silently threw that away, and the screen showed the
     * old flat refusal no matter what the server actually said (2026-08-21).
     *
     * `status` and `message` are assigned AFTER the spread so a body that
     * happens to contain either cannot overwrite the real HTTP status or the
     * normalised text.
     */
    throw {
      ...body,
      status: res.status,
      message: errorMessageToText(body['message'], res.statusText),
      error: body['error'] as string | undefined,
    } as ApiError;
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Multipart upload variant of {@link apiFetch} — deliberately does NOT set a
 * `Content-Type` header (the browser sets `multipart/form-data; boundary=…`
 * itself from the `FormData` body). Always sends the auth token; gallery
 * uploads (and any future file-upload endpoint) require an authenticated
 * caller.
 *
 * `method` defaults to 'POST' (every existing caller before Exchange only
 * ever created something new) — "Exchange" needs the SAME multipart
 * plumbing but against `PATCH /gallery/items/:id/file`, so this takes a
 * method rather than a second near-duplicate uploader function
 * (task-w2.3-brief.md, Part A: `apiUpload` is "hardcoded to POST; teach it
 * to accept a method rather than writing a second uploader").
 */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  method: 'POST' | 'PATCH' = 'POST',
): Promise<T> {
  const headers = new Headers();
  headers.set(CLIENT_HEADER, CLIENT_AUDIENCE);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${BASE}${path}`, {
    method,
    body: formData,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let body: Record<string, unknown> = {};
    try { body = (await res.json()) as Record<string, unknown>; } catch { /* ignore */ }
    /**
     * The whole body is spread, not three hand-picked fields.
     *
     * An error body can carry MORE than a sentence — the variant hard-delete
     * 409 sends `referencingCount` and `canForce` so the dialog can say "4
     * orders reference this" and offer an override. Copying only
     * status/message/error silently threw that away, and the screen showed the
     * old flat refusal no matter what the server actually said (2026-08-21).
     *
     * `status` and `message` are assigned AFTER the spread so a body that
     * happens to contain either cannot overwrite the real HTTP status or the
     * normalised text.
     */
    throw {
      ...body,
      status: res.status,
      message: errorMessageToText(body['message'], res.statusText),
      error: body['error'] as string | undefined,
    } as ApiError;
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T;
  return res.json() as Promise<T>;
}

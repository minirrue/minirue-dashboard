import { getAccessToken, setTokens, clearTokens } from '@/lib/auth/tokens';

export interface ApiError {
  status: number;
  message: string;
  error?: string;
}

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002') + '/v1';

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
    // A borrowed "sign in as" session has no refresh token and cannot be
    // extended. When it dies, hand the super admin their own session back
    // rather than signing everyone out.
    const { isActing, stopActingAs } = await import('@/lib/auth/acting-session');
    if (isActing()) {
      const restored = stopActingAs();
      throw {
        status: 401,
        message: restored
          ? 'That borrowed session expired. You are back on your own account.'
          : 'That borrowed session expired. Please sign in again.',
      } as ApiError;
    }

    const { getRefreshToken } = await import('@/lib/auth/tokens');
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (refreshRes.ok) {
          const pair = (await refreshRes.json()) as { accessToken: string; refreshToken: string };
          setTokens(pair.accessToken, pair.refreshToken);
          return apiFetch<T>(path, { ...init, _isRetry: true });
        }
      } catch {
        // refresh network failure
      }
    }
    clearTokens();
    throw { status: 401, message: 'Session expired' } as ApiError;
  }

  if (!res.ok) {
    let body: Record<string, unknown> = {};
    try { body = (await res.json()) as Record<string, unknown>; } catch { /* ignore */ }
    throw { status: res.status, message: errorMessageToText(body['message'], res.statusText), error: body['error'] as string | undefined } as ApiError;
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
 */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    body: formData,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let body: Record<string, unknown> = {};
    try { body = (await res.json()) as Record<string, unknown>; } catch { /* ignore */ }
    throw { status: res.status, message: errorMessageToText(body['message'], res.statusText), error: body['error'] as string | undefined } as ApiError;
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T;
  return res.json() as Promise<T>;
}

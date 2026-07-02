import { getAccessToken, setTokens, clearTokens } from '@/lib/auth/tokens';

export interface ApiError {
  status: number;
  message: string;
  error?: string;
}

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002') + '/v1';

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

  if (res.status === 401 && !_isRetry) {
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
    throw { status: res.status, message: (body['message'] as string) ?? res.statusText, error: body['error'] as string | undefined } as ApiError;
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T;
  return res.json() as Promise<T>;
}

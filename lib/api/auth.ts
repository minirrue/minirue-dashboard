import { apiFetch, API_BASE, CLIENT_HEADER, CLIENT_AUDIENCE } from './client';
import { setTokens } from '@/lib/auth/tokens';
import { parseAuthUser } from '@/lib/auth/session-role';
import type { AuthSuccessResponse, MeResponse, TokenPair } from '@/lib/auth/types';
import type { ApiError } from './client';

export type { AuthSuccessResponse as AuthResponse, MeResponse } from '@/lib/auth/types';

function createIdempotencyKey(prefix: string): string {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

export async function apiLogin(email: string, password: string): Promise<AuthSuccessResponse> {
  const data = await apiFetch<TokenPair & Partial<Pick<AuthSuccessResponse, 'user'>>>('/auth/login', {
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey('login') },
    body: JSON.stringify({ email, password }),
  });

  setTokens(data.accessToken, data.refreshToken);

  try {
    const user = data.user ? parseAuthUser(data.user) : await apiMe();
    return { ...data, user };
  } catch (e) {
    const err: ApiError = {
      status: 403,
      message:
        e instanceof Error && e.name === 'InsufficientStaffRoleError'
          ? 'This account does not have admin access.'
          : 'Your session role is invalid. Sign in again.',
      error: 'Forbidden',
    };
    throw err;
  }
}

/**
 * `refreshToken` is optional on purpose.
 *
 * The dashboard's REAL credential is the httpOnly `mr_dash_access` /
 * `mr_dash_refresh` cookie pair — the backend's token extractor reads the
 * cookie FIRST and only falls back to the Authorization header
 * (src/auth/strategies/jwt.strategy.ts:19-22), and POST /auth/logout resolves
 * the refresh token the same way (`readRefreshToken(req) ?? dto.refreshToken`).
 * Only the server can clear an httpOnly cookie or revoke the session row, so
 * this call is the ONLY thing that actually ends the session; clearTokens()
 * just tidies up localStorage and the mr-auth hint.
 *
 * It used to be gated on a localStorage refresh token being present, which is
 * exactly backwards — see useLogout().
 */
export async function apiLogout(refreshToken?: string): Promise<void> {
  await apiFetch<void>('/auth/logout', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
  });
}

/**
 * Ends a "sign in as" session ON THE SERVER.
 *
 * Until this existed, stopping was purely a browser gesture — the borrowed
 * token stayed valid for the rest of its 30 minutes, so a leaked one was
 * unstoppable. It now names a revocable session (`sid`) and this revokes it.
 *
 * Two deliberate departures from apiFetch, both load-bearing:
 *
 *  - `credentials: 'omit'`. While impersonating, the httpOnly cookie pair
 *    still holds the SUPER ADMIN's session while the borrowed token sits in
 *    localStorage, and the backend's extractor reads the COOKIE FIRST
 *    (jwt.strategy.ts). Sending cookies would present the super admin's own
 *    token instead of the borrowed one — i.e. ask the server to end the wrong
 *    session. Omitting them forces the Authorization header to be what is
 *    read.
 *  - the token is passed in, not read from storage, so the caller can revoke
 *    the borrowed token it is about to throw away.
 *
 * Best-effort by contract: it resolves on failure. A dead network must never
 * strand someone inside a borrowed session in their own browser.
 */
export async function apiStopActingAs(borrowedAccessToken: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/stop-acting-as`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [CLIENT_HEADER]: CLIENT_AUDIENCE,
        Authorization: `Bearer ${borrowedAccessToken}`,
      },
      credentials: 'omit',
      body: '{}',
    });
  } catch {
    // fall through: the client still clears itself
  }
}

export async function apiMe(): Promise<MeResponse> {
  const me = await apiFetch<MeResponse>('/auth/me', { auth: true });
  return parseAuthUser(me);
}

export async function apiUpdateMyProfile(name: string): Promise<MeResponse> {
  const me = await apiFetch<MeResponse>('/auth/me', {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ name }),
  });
  return parseAuthUser(me);
}

export async function apiUploadMyAvatar(file: File): Promise<MeResponse> {
  const dataBase64 = await fileToBase64(file);
  const me = await apiFetch<MeResponse>('/auth/me/avatar', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ mimeType: file.type, dataBase64 }),
  });
  return parseAuthUser(me);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

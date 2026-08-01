import { apiFetch, API_BASE, CLIENT_HEADER, CLIENT_AUDIENCE } from './client';
import { markAuthenticated } from '@/lib/auth/tokens';
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

/**
 * Signs an operator in through Better Auth.
 *
 * Keeps its name, arguments and return shape — every caller reads `user` and
 * nothing else. What changed is underneath: there are no tokens. Better Auth
 * sets an httpOnly cookie (`mr-dash.session_token`, distinct from the
 * storefront's `mr-shop.`) and that is the entire session.
 *
 * `setTokens` is gone with them. It wrote the access and refresh tokens into
 * localStorage, which is exactly where a session credential should not live —
 * any script on the page could read it. The only part still needed is the
 * non-secret `mr-auth` hint the Edge middleware reads, so that is all
 * `markAuthenticated` writes.
 */
export async function apiLogin(email: string, password: string): Promise<AuthSuccessResponse> {
  const data = await apiFetch<{
    user: { id: string; email: string; name?: string | null; role?: string | null };
  }>('/auth/sign-in/email', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  markAuthenticated();

  try {
    const user = parseAuthUser({
      userId: data.user.id,
      role: data.user.role ?? '',
      email: data.user.email,
      name: data.user.name ?? undefined,
    });
    return { user };
  } catch (e) {
    // Only a genuine role rejection may claim the account lacks access.
    //
    // This used to flatten EVERY failure here into one 403 reading "This
    // account does not have admin access", and the login page then re-labelled
    // every 403 with that same sentence. So a session problem told the operator
    // their account had been demoted. During the 2026-07-31 incident that
    // message cost real time: it was read as "the reset changed my role" when
    // the password had in fact just been accepted and the account was fine.
    //
    // Reaching this catch means sign-in already returned 200, so the
    // credentials were correct and the users row is alive. Anything other than
    // InsufficientStaffRoleError is a SESSION problem, and saying so points at
    // the actual fix.
    if (e instanceof Error && e.name === 'InsufficientStaffRoleError') {
      const err: ApiError = {
        status: 403,
        message: 'This account does not have admin access.',
        error: 'Forbidden',
      };
      throw err;
    }
    const underlying = e as Partial<ApiError> | undefined;
    const err: ApiError = {
      // 401, not 403 — the credentials passed; it is the session that failed.
      status: 401,
      message:
        (typeof underlying?.message === 'string' && underlying.message) ||
        'Signed in, but the session could not be verified. Sign in again.',
      error: 'Unauthorized',
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
export async function apiLogout(_refreshToken?: string): Promise<void> {
  // The argument is kept so call sites do not change; it is ignored. Better
  // Auth ends the session named by the cookie, which is the only session this
  // browser has — there is no token to hand back.
  await apiFetch<void>('/auth/sign-out', {
    method: 'POST',
    auth: true,
    body: '{}',
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

/**
 * Who is signed in.
 *
 * `get-session` answers 200 with a NULL body for a signed-out visitor rather
 * than 401. The old `/auth/me` 401ed, and the client leans on that hard — a
 * settled 401 is what makes the session state fail closed. So an empty session
 * is converted into the 401 the rest of the app already reasons about, rather
 * than teaching every consumer a second way to be signed out.
 */
export async function apiMe(): Promise<MeResponse> {
  const session = await apiFetch<{
    user?: { id: string; email: string; name?: string | null; role?: string | null };
  } | null>('/auth/get-session', { auth: true });

  if (!session?.user) {
    const err: ApiError = {
      status: 401,
      message: 'Session expired',
      error: 'Unauthorized',
    };
    throw err;
  }
  return parseAuthUser({
    userId: session.user.id,
    role: session.user.role ?? '',
    email: session.user.email,
    name: session.user.name ?? undefined,
  });
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

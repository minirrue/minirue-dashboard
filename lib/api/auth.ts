import { apiFetch } from './client';
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

export async function apiLogout(refreshToken: string): Promise<void> {
  await apiFetch<void>('/auth/logout', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ refreshToken }),
  });
}

export async function apiMe(): Promise<MeResponse> {
  const me = await apiFetch<MeResponse>('/auth/me', { auth: true });
  return parseAuthUser(me);
}

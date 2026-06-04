import { apiFetch } from './client';
import { setTokens } from '@/lib/auth/tokens';

interface TokenPairDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface MeResponse {
  userId: string;
  role: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; firstName: string; role: string };
}

async function fetchUserAndAssemble(pair: TokenPairDto, firstName: string): Promise<AuthResponse> {
  setTokens(pair.accessToken, pair.refreshToken);
  const me = await apiFetch<MeResponse>('/auth/me', { auth: true });
  return { accessToken: pair.accessToken, refreshToken: pair.refreshToken, user: { id: me.userId, email: me.email, firstName, role: me.role } };
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  const pair = await apiFetch<TokenPairDto>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  return fetchUserAndAssemble(pair, email.split('@')[0]);
}

export async function apiRegister(firstName: string, email: string, password: string): Promise<AuthResponse> {
  const pair = await apiFetch<TokenPairDto>('/auth/register', { method: 'POST', body: JSON.stringify({ firstName, email, password }) });
  return fetchUserAndAssemble(pair, firstName);
}

export async function apiLogout(refreshToken: string): Promise<void> {
  await apiFetch<void>('/auth/logout', { method: 'POST', auth: true, body: JSON.stringify({ refreshToken }) });
}

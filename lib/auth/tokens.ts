'use client';

const ACCESS_KEY = 'mr-access-token';
const REFRESH_KEY = 'mr-refresh-token';
const COOKIE_NAME = 'mr-auth';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

/**
 * Marks the UI as signed in. NOT a credential.
 *
 * This replaces `setTokens` for ordinary sign-in. Better Auth's session lives
 * in an httpOnly cookie the browser handles on its own, so there is nothing
 * for the client to store — and storing it would be actively worse, because
 * localStorage is readable by any script on the page. The only thing written
 * here is the non-secret `mr-auth` hint the Edge middleware reads to decide
 * whether to render a dashboard route or bounce to /login. Forging it buys a
 * page shell and a row of 401s, nothing more.
 */
export function markAuthenticated(): void {
  if (typeof window === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=1; path=/; SameSite=Lax`;
}

/**
 * Still used by "sign in as", which is the one flow that genuinely holds a
 * token: impersonation mints a short-lived bearer token rather than swapping
 * the cookie, so it has to live somewhere the client can send it from.
 */
export function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  document.cookie = `${COOKIE_NAME}=1; path=/; SameSite=Lax`;
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  document.cookie = `${COOKIE_NAME}=; Max-Age=0; path=/`;
}

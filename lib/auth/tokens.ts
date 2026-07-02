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

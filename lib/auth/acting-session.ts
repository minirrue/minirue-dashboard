'use client';

import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './tokens';
import type { Role } from './role';

/**
 * "Sign in as" — holding a borrowed session without losing your own.
 * specs/2026-07-23-account-administration
 *
 * The super admin's real tokens are parked here while a borrowed token sits in
 * the normal slot, so every existing API call keeps working untouched and
 * switching back is just putting them back.
 *
 * sessionStorage, not localStorage, on purpose: a borrowed session should not
 * outlive the tab it was started in. Close the tab and the parked tokens go
 * with it — the borrowed token expires on its own and nothing is left behind.
 */

const PARKED_KEY = 'mr-acting-parked';
const ACTING_KEY = 'mr-acting-as';

export interface ActingAs {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Epoch ms when the borrowed token stops working. */
  expiresAt: number;
}

interface ParkedSession {
  accessToken: string;
  refreshToken: string;
}

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Who the dashboard is currently acting as, or null when it is just you. */
export function getActingAs(): ActingAs | null {
  return readJson<ActingAs>(ACTING_KEY);
}

export function isActing(): boolean {
  return getActingAs() !== null;
}

/**
 * Parks the caller's own tokens and installs the borrowed one.
 *
 * Refuses to start a second hop. Acting as A and then as B from inside A would
 * overwrite the parked tokens with A's, and switching back would land on an
 * account nobody asked for.
 */
export function beginActingAs(
  accessToken: string,
  expiresInSeconds: number,
  who: Omit<ActingAs, 'expiresAt'>,
): void {
  if (typeof window === 'undefined') return;
  if (isActing()) {
    throw new Error('Already signed in as another account. Switch back first.');
  }

  const own = getAccessToken();
  const ownRefresh = getRefreshToken();
  if (!own || !ownRefresh) {
    throw new Error('Your own session is missing. Sign in again.');
  }

  sessionStorage.setItem(
    PARKED_KEY,
    JSON.stringify({ accessToken: own, refreshToken: ownRefresh } as ParkedSession),
  );
  sessionStorage.setItem(
    ACTING_KEY,
    JSON.stringify({ ...who, expiresAt: Date.now() + expiresInSeconds * 1000 }),
  );

  // The borrowed token has no refresh token. Parking an empty string here
  // instead of the super admin's real one matters: a 401 while acting must not
  // silently refresh back into the super admin's session and carry on.
  setTokens(accessToken, '');
}

/**
 * Puts the caller's own tokens back. Safe to call when not acting.
 * Returns true if a session was actually restored.
 */
export function stopActingAs(): boolean {
  if (typeof window === 'undefined') return false;
  const parked = readJson<ParkedSession>(PARKED_KEY);
  sessionStorage.removeItem(PARKED_KEY);
  sessionStorage.removeItem(ACTING_KEY);

  if (!parked?.accessToken || !parked?.refreshToken) {
    // Nothing to go back to — better to land on the sign-in screen than to
    // leave a dead borrowed token in place looking like a working session.
    clearTokens();
    return false;
  }

  setTokens(parked.accessToken, parked.refreshToken);
  return true;
}

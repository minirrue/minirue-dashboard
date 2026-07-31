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

/**
 * Tells the server to revoke the borrowed session, then forgets about it.
 *
 * Fire-and-forget on purpose, and the reason both callers below can stay
 * synchronous: a failed round-trip must still clear the client. The server
 * side is not merely a nicety — until POST /auth/stop-acting-as existed,
 * "stop acting" was ONLY this file putting the parked tokens back, so the
 * borrowed token itself stayed valid for the rest of its 30 minutes and a
 * leaked one could not be stopped at all.
 *
 * Dynamically imported so this module keeps no static edge to the API client
 * (which already imports back into this one), and read BEFORE the tokens are
 * swapped or cleared — afterwards the borrowed token is gone and there is
 * nothing left to revoke with.
 */
function revokeBorrowedSession(): void {
  if (!isActing()) return;
  const borrowed = getAccessToken();
  if (!borrowed) return;
  void import('@/lib/api/auth')
    .then((m) => m.apiStopActingAs(borrowed))
    .catch(() => undefined);
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
  // First, while the borrowed token is still the installed one. Switching back
  // has to END the borrowed session, not just stop using it.
  revokeBorrowedSession();
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

/**
 * Throws the borrowed session away WITHOUT restoring the parked one.
 *
 * `stopActingAs()` is "switch back to me"; this is "there is no me any more".
 * Sign-out must use it, because clearTokens() only touches localStorage and
 * the mr-auth hint — it never touched sessionStorage, so after signing out
 * while impersonating, `mr-acting-parked` still held the super admin's real
 * access AND refresh tokens and `mr-acting-as` still said we were acting.
 * The very next 401 anywhere in the app runs apiFetch's isActing() branch
 * (lib/api/client.ts:132), which calls stopActingAs(), which writes those
 * parked tokens back into localStorage and re-sets `mr-auth=1` — signing the
 * super admin straight back in moments after they pressed Sign out.
 */
export function clearActingSession(): void {
  if (typeof window === 'undefined') return;
  // Signing out while impersonating has to end the borrowed session too. The
  // super admin's own sign-out revokes their session, not the borrowed one —
  // they are two separate rows — so without this the account they were acting
  // as stayed borrowable for the rest of its 30 minutes. Runs first, because
  // useLogout calls this BEFORE clearTokens() and the borrowed token is still
  // in localStorage at this point.
  //
  // The server closes the same hole from its own side when it can
  // (AuthService.logoutByRefreshToken ends every session the signing-out
  // person borrowed), so a browser that dies mid-sign-out is still covered.
  revokeBorrowedSession();
  sessionStorage.removeItem(PARKED_KEY);
  sessionStorage.removeItem(ACTING_KEY);
}

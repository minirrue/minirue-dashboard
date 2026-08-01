'use client';

import type { Role } from './role';

/**
 * "Sign in as" — holding a borrowed session without losing your own.
 * specs/2026-07-23-account-administration
 *
 * Rewritten onto Better Auth's admin plugin, and the change is a simplification
 * rather than a port. The old design had to park the super admin's access and
 * refresh tokens in sessionStorage and install a borrowed token in their place,
 * because the session WAS the token and the client was the only thing that knew
 * which one to send. Three things followed from that, all of them bad:
 *
 *   - A borrowed bearer token sat in localStorage, readable by any script on
 *     the page.
 *   - Switching back meant putting the parked tokens back by hand. Lose that
 *     sessionStorage entry — a crash, a closed tab, a cleared store — and the
 *     super admin's own session was simply gone.
 *   - Stopping had to separately revoke the borrowed token server-side, which
 *     was added later, because until then "stop acting" was purely a browser
 *     gesture and a leaked token stayed live for its full 30 minutes.
 *
 * Better Auth swaps the SESSION COOKIE on the server. `impersonate-user`
 * replaces this browser's session with one for the target; `stop-impersonating`
 * puts the admin's back. Nothing is parked, nothing is held in JS, and stopping
 * is a server action by construction rather than by remembering to add one.
 * The borrowed session records `impersonatedBy`, so the act is never anonymous
 * in the audit trail.
 *
 * What remains here is only the LOCAL note of who is being acted as, so the
 * banner has something to render without a round trip. It is a display cache,
 * not a credential — losing it costs a banner, not a session.
 */

const ACTING_KEY = 'mr-acting-as';

export interface ActingAs {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Epoch ms when the borrowed session stops working. */
  expiresAt: number;
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
 * Forgets the local note WITHOUT talking to the server.
 *
 * Used by sign-out, where the server is about to destroy the session anyway —
 * including the borrowed one, since that IS the session. Calling
 * `stopActingAs` there would restore the admin's session a moment before
 * signing it out, which is both pointless and a race.
 *
 * sessionStorage survives `clearTokens()`, so without this a sign-out while
 * impersonating left the banner's note behind for the next sign-in to find.
 */
export function clearActingSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ACTING_KEY);
}

/**
 * Borrows the target's session.
 *
 * Refuses to start a second hop. Better Auth would happily impersonate from
 * inside an impersonated session, and stopping would then return to the FIRST
 * target rather than to the super admin — landing on an account nobody asked
 * for, with no obvious way back.
 */
export async function beginActingAs(
  userId: string,
  who: Omit<ActingAs, 'expiresAt'>,
  expiresInSeconds = 3600,
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (isActing()) {
    throw new Error('Already signed in as another account. Switch back first.');
  }

  const { apiImpersonateUser } = await import('@/lib/api/auth');
  await apiImpersonateUser(userId);

  sessionStorage.setItem(
    ACTING_KEY,
    JSON.stringify({ ...who, expiresAt: Date.now() + expiresInSeconds * 1000 }),
  );
}

/**
 * Hands the borrowed session back and returns to your own.
 *
 * The local note is cleared FIRST, and deliberately: if the server call fails,
 * the banner must not keep claiming an impersonation the browser can no longer
 * end. Better to show your own account and be wrong for a moment than to leave
 * someone looking at a banner whose "switch back" button does nothing.
 */
export async function stopActingAs(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const wasActing = isActing();
  sessionStorage.removeItem(ACTING_KEY);
  if (!wasActing) return false;

  try {
    const { apiStopImpersonating } = await import('@/lib/api/auth');
    await apiStopImpersonating();
    return true;
  } catch {
    // The admin's session is restored by the SERVER, so a failed call here
    // leaves the browser holding the borrowed cookie. Returning false tells the
    // caller to send them to sign-in, which is the only honest recovery — it is
    // better than silently continuing as someone else.
    return false;
  }
}

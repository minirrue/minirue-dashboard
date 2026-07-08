/**
 * Tracks which Info/changelog entries a user has already seen, so the
 * sidebar "Info" nav item can show a red dot when there's something new.
 * Persisted in localStorage (per browser) — not yet synced to the backend,
 * so it won't follow a user across devices. Flagged as a known follow-up
 * if cross-device read-state is needed later.
 */

const LAST_SEEN_KEY = 'dash-info-last-seen-id';

export function getLastSeenChangelogId(): number {
  if (typeof window === 'undefined') return 0;
  try {
    return parseInt(localStorage.getItem(LAST_SEEN_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function markChangelogSeen(latestId: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_SEEN_KEY, String(latestId));
  } catch {
    // localStorage can throw in private-mode Safari or when quota is
    // exhausted — read-state is best-effort, not critical.
  }
}

export function hasUnreadChangelog(latestId: number): boolean {
  return getLastSeenChangelogId() < latestId;
}

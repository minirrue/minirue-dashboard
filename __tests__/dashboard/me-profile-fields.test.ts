import { apiMe } from '@/lib/api/auth';
import { apiFetch } from '@/lib/api/client';

/**
 * Owner report, 2026-08-03: "whenever a new update or so the avatar is hidden as
 * if we havent set it up however its working on storefront, also the name we set
 * minirue goes back to mini, and visible to minirue again if we set a new avatar
 * by itself".
 *
 * Both halves were one cause. `GET /auth/me` was deleted at the Better Auth
 * cutover (2026-08-01) on the reasoning that Better Auth served every route it
 * had. True for sign-in/refresh/logout — but `get-session` cannot return
 * `avatarUrl` or `fullName`, because those are our own profile columns, not
 * session data. `apiMe()` was left building the user from the session alone, so:
 *
 * - `avatarUrl` was always undefined on load, hence the generic icon; it came
 *   back only right after an upload, because THAT response was cached in React
 *   Query. A reload or a deploy dropped the cache and the icon returned — which
 *   is exactly why it looked like it broke "whenever a new update".
 * - `fullName` was always undefined, so the Settings name field fell back to the
 *   GREETING form and then SAVED it, truncating "MiniRue" to "MINI" — the very
 *   trap `toMeNameFields` exists to prevent.
 *
 * These tests assert the profile fields survive, and that a failed profile read
 * degrades to a signed-in user rather than looking like a signed-out one.
 */

jest.mock('@/lib/api/client', () => ({
  apiFetch: jest.fn(),
}));

const mockFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

const SESSION = {
  user: {
    id: 'u1',
    email: 'admin@minirue.local',
    name: 'MINI',
    role: 'ADMIN',
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('carries avatarUrl and fullName through from the profile read', async () => {
  mockFetch.mockImplementation(async (path: string) => {
    if (path === '/auth/get-session') return SESSION as never;
    if (path === '/auth/me') {
      return {
        userId: 'u1',
        role: 'ADMIN',
        email: 'admin@minirue.local',
        name: 'MINI',
        fullName: 'MiniRue',
        avatarUrl: 'https://img.test/avatar.webp',
      } as never;
    }
    throw new Error(`unexpected ${path}`);
  });

  const me = await apiMe();

  // The two fields the session could never have supplied.
  expect(me.avatarUrl).toBe('https://img.test/avatar.webp');
  // Untruncated, so editing the name in Settings cannot save the greeting form.
  expect(me.fullName).toBe('MiniRue');
});

it('still returns a signed-in user when the profile read fails', async () => {
  mockFetch.mockImplementation(async (path: string) => {
    if (path === '/auth/get-session') return SESSION as never;
    throw Object.assign(new Error('boom'), { status: 500 });
  });

  const me = await apiMe();

  // A hiccup fetching a picture must never read as being signed out.
  expect(me.userId).toBe('u1');
  expect(me.role).toBe('ADMIN');
  expect(me.avatarUrl).toBeUndefined();
});

it('throws when there is genuinely no session', async () => {
  mockFetch.mockImplementation(async (path: string) => {
    if (path === '/auth/get-session') return null as never;
    throw new Error(`unexpected ${path}`);
  });

  await expect(apiMe()).rejects.toMatchObject({ status: 401 });
});

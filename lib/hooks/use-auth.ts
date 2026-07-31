import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientQuery } from '@/lib/hooks/use-client-query';
import { apiLogin, apiLogout, apiMe, type AuthResponse } from '@/lib/api/auth';
import { getRefreshToken, clearTokens } from '@/lib/auth/tokens';
import { clearActingSession } from '@/lib/auth/acting-session';

const AUTH_QUERY_KEY = ['auth'];
const ME_QUERY_KEY = ['auth', 'me'];

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      return apiLogin(email, password);
    },
    onSuccess: (data: AuthResponse) => {
      queryClient.setQueryData(ME_QUERY_KEY, data.user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // UNCONDITIONAL, and best-effort. This used to be gated on a
      // localStorage refresh token being present — but localStorage is not
      // where the dashboard session lives. The session is the httpOnly
      // `mr_dash_access` / `mr_dash_refresh` pair, which only the server can
      // clear, backed by a refresh_tokens row that only the server can revoke.
      //
      // getRefreshToken() is empty in two ordinary situations, and in BOTH of
      // them the old gate silently skipped the entire server round-trip:
      //   1. While impersonating — beginActingAs() parks the real pair and
      //      calls setTokens(borrowed, '') on purpose (acting-session.ts:91).
      //   2. After any 401 that already ran clearTokens() (api/client.ts:146),
      //      which is the most likely moment for someone to press Sign out.
      // The UI then looked signed out while the cookies, the session row and
      // every access token issued against it stayed alive — and POST
      // /auth/refresh from that same browser would mint a brand-new session
      // straight off the surviving cookie.
      //
      // Caught, not propagated: the person clicked Sign out. A 5xx must not
      // stop onSettled from clearing the client, and must not put a "Sign out
      // failed" banner in front of someone who is, as far as they are
      // concerned, gone. Mirrors the storefront's useLogout.
      await apiLogout(getRefreshToken() ?? undefined).catch(() => undefined);
    },
    onSettled: () => {
      // Before clearTokens(): sessionStorage survives it, so a sign-out while
      // impersonating left the super admin's parked real tokens behind for
      // apiFetch's isActing() branch to restore on the next 401.
      clearActingSession();
      // §25 Rule 4 + US-ADMIN-IAM-007 / US-COLLABORATOR-IAM-009: clearTokens() removes the
      // `mr-access-token` / `mr-refresh-token` localStorage entries AND the `mr-auth` cookie
      // (the one the Edge proxy at `apps/minirue-dashboard/proxy.ts` reads on every navigation
      // to gate every non-`/login` route). Before this fix, the cookie survived sign-out and
      // the proxy let the user back into the dashboard — the 2026-07-07 v5 falsification root
      // cause.
      //
      // onSettled (not onSuccess) — the user clicked "Sign out"; the spec is about
      // the user-perceived post-state, not whether the server round-trip succeeded.
      // A 5xx or network error from POST /v1/auth/logout must NOT leave the user
      // signed in. Order: clearTokens BEFORE removeQueries so a re-render from a
      // still-cached query cannot re-hydrate from stale tokens.
      clearTokens();
      queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY });
      queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
    },
  });
}

export function useUser() {
  return useClientQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: apiMe,
    staleTime: 1000 * 60 * 15,
    retry: false,
  });
}

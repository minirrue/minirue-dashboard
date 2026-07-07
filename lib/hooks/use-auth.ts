import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientQuery } from '@/lib/hooks/use-client-query';
import { apiLogin, apiLogout, apiMe, type AuthResponse } from '@/lib/api/auth';
import { getRefreshToken, clearTokens } from '@/lib/auth/tokens';

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
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await apiLogout(refreshToken);
      }
    },
    onSettled: () => {
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

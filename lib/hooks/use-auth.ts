import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientQuery } from '@/lib/hooks/use-client-query';
import { apiLogin, apiLogout, apiMe, type AuthResponse } from '@/lib/api/auth';
import { getRefreshToken } from '@/lib/auth/tokens';

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
    onSuccess: () => {
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

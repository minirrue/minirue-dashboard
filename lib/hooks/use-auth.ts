import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  apiLogin,
  apiRegister,
  apiLogout,
  AuthResponse,
  MeResponse,
} from '@/lib/api/auth';
import { apiFetch } from '@/lib/api/client';
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
      queryClient.setQueryData(ME_QUERY_KEY, {
        userId: data.user.id,
        email: data.user.email,
        role: data.user.role,
      });
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      firstName,
      email,
      password,
    }: {
      firstName: string;
      email: string;
      password: string;
    }) => {
      return apiRegister(firstName, email, password);
    },
    onSuccess: (data: AuthResponse) => {
      queryClient.setQueryData(ME_QUERY_KEY, {
        userId: data.user.id,
        email: data.user.email,
        role: data.user.role,
      });
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
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      return apiFetch<MeResponse>('/auth/me', { auth: true });
    },
    enabled: typeof window !== 'undefined', // Only run in browser
    staleTime: 1000 * 60 * 15, // 15m
  });
}

import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5m
        gcTime: 1000 * 60 * 10, // 10m (formerly cacheTime)
        retry: 1,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      mutations: {
        retry: 1,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
    },
  });
}

let clientSingleton: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') {
    return createQueryClient();
  }
  if (!clientSingleton) {
    clientSingleton = createQueryClient();
  }
  return clientSingleton;
}

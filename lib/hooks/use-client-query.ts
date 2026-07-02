'use client';

import {
  useQuery,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';

/**
 * Browser-only queries with isLoading true on SSR so skeleton UIs match hydration.
 */
export function useClientQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): UseQueryResult<TData, TError> {
  const isClient = typeof window !== 'undefined';
  const enabled = isClient && (options.enabled ?? true);
  const result = useQuery({ ...options, enabled });

  const awaitingClient = !isClient || result.isLoading;

  return {
    ...result,
    isLoading: awaitingClient,
  } as UseQueryResult<TData, TError>;
}

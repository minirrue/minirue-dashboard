import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShellContext, type ShellApi } from '@/app/dashboard/analytics/_ui/context';
import { buildModel } from '@/lib/analytics/model';
import { emptyFilters } from '@/lib/analytics/visitors';
import { DEFAULT_VIEW } from '@/lib/analytics/view-state';
import type { PersonRow } from '@/lib/api/story';

/** Renders Analytics pieces inside a real shell context and a fresh query client. */
export function shellApi(people: PersonRow[], o: Partial<ShellApi> = {}): ShellApi {
  const range = { from: '2026-08-23', to: '2026-09-21', compare: false, traffic: 'real' as const };
  return {
    model: buildModel({ range, filters: emptyFilters(), people }),
    range,
    routes: null,
    summary: null,
    recon: null,
    view: DEFAULT_VIEW,
    setView: jest.fn(),
    journeyId: null,
    setJourneyId: jest.fn(),
    go: jest.fn(),
    openVisitor: jest.fn(),
    openPath: jest.fn(),
    openWhoCounts: jest.fn(),
    toast: jest.fn(),
    loading: false,
    ...o,
  };
}

export function Harness({ api, children }: { api: ShellApi; children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return (
    <QueryClientProvider client={client}>
      <ShellContext.Provider value={api}>{children}</ShellContext.Provider>
    </QueryClientProvider>
  );
}

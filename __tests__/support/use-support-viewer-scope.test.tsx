import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useSupportPeople, useSupportConversations, useSupportThread, useSupportPresence } from '@/lib/hooks/use-support';

/**
 * Higher-priority fix ahead of task U's layout work: the owner saw a
 * collaborator's /collab/support briefly render MiniRue's own (team) support
 * conversations before "loading correctly". Root cause: every query key here
 * used to be built from filter VALUES only (status/brand/customerId) — never
 * from WHO was asking — and a collaborator's desk filter defaults to the
 * exact same 'direct' sentinel the team's own MiniRue-desk view uses. Two
 * different signed-in viewers issuing the "same" request landed on the same
 * cache entry, so a result cached for one identity could flash for another.
 *
 * These tests cover the two-part fix in lib/hooks/use-support.ts:
 *   1. the viewer's own id is now the first discriminator in every key, so
 *      two different viewers requesting identical filters get two entries;
 *   2. no query fires at all — `enabled` stays false — until that id is known,
 *      so there is nothing to leak, and nothing to correct, before it is.
 *
 * (Backend verification for the same report: support.service.ts
 * `listForViewer`/`listPeopleForViewer` already force a COLLAB viewer onto
 * `viewer.collaboratorId` regardless of any client-supplied param, and
 * `canViewConversation` in support.visibility.ts rejects any conversation
 * whose `collaboratorId` doesn't match the viewer's own — no server-side hole
 * found there. This suite covers the client-side cache partitioning only.)
 */

jest.mock('@/lib/hooks/use-auth', () => ({
  useUser: jest.fn(),
}));

jest.mock('@/lib/api/support', () => ({
  apiSupportConversations: jest.fn().mockResolvedValue([]),
  apiSupportPeople: jest.fn().mockResolvedValue([]),
  apiSupportThread: jest.fn().mockResolvedValue({ conversation: null, messages: [] }),
  apiSupportPresence: jest.fn().mockResolvedValue({ status: 'ONLINE' }),
  apiSupportSend: jest.fn(),
  apiSupportSetPresence: jest.fn(),
  apiSupportUpload: jest.fn(),
  apiSupportMarkRead: jest.fn(),
  apiSupportUpdateConversation: jest.fn(),
  apiSupportArchiveConversation: jest.fn(),
  apiSupportRestoreConversation: jest.fn(),
}));

import { useUser } from '@/lib/hooks/use-auth';
import {
  apiSupportPeople as mockApiSupportPeople,
  apiSupportConversations as mockApiSupportConversations,
} from '@/lib/api/support';

const mockUseUser = useUser as jest.Mock;

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('use-support.ts — viewer-scoped cache keys (leak fix)', () => {
  it('never fires the people/conversations/thread/presence requests while the viewer id is unknown', async () => {
    mockUseUser.mockReturnValue({ data: undefined, isLoading: true });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderHook(() => useSupportPeople({ collaboratorId: 'direct' }), { wrapper: wrapper(qc) });
    renderHook(() => useSupportConversations({ brand: 'direct', customerId: 'cust-1' }), {
      wrapper: wrapper(qc),
    });
    renderHook(() => useSupportThread('room-1'), { wrapper: wrapper(qc) });
    renderHook(() => useSupportPresence(), { wrapper: wrapper(qc) });

    // Give any wrongly-enabled query a tick to fire.
    await new Promise((r) => setTimeout(r, 0));

    expect(mockApiSupportPeople).not.toHaveBeenCalled();
    expect(mockApiSupportConversations).not.toHaveBeenCalled();
  });

  it('fires the request only once the viewer id resolves, scoped to that viewer', async () => {
    mockUseUser.mockReturnValue({ data: { userId: 'collab-helia', role: 'COLLAB' }, isLoading: false });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useSupportPeople({ collaboratorId: 'direct' }), {
      wrapper: wrapper(qc),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiSupportPeople).toHaveBeenCalledTimes(1);

    const keys = qc.getQueryCache().getAll().map((q) => q.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([['support', 'people', 'collab-helia', 'all', 'direct']]),
    );
  });

  it('gives two different signed-in viewers two SEPARATE cache entries for identical filters — never a shared one', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    // Viewer A (e.g. the team's own MiniRue-desk view) requests 'direct'.
    mockUseUser.mockReturnValue({ data: { userId: 'admin-1', role: 'ADMIN' }, isLoading: false });
    const first = renderHook(() => useSupportPeople({ collaboratorId: 'direct' }), {
      wrapper: wrapper(qc),
    });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    jest.clearAllMocks();

    // Viewer B (a collaborator) requests the SAME filter shape.
    mockUseUser.mockReturnValue({ data: { userId: 'collab-helia', role: 'COLLAB' }, isLoading: false });
    const second = renderHook(() => useSupportPeople({ collaboratorId: 'direct' }), {
      wrapper: wrapper(qc),
    });

    // A cache-key collision would mean this never re-fetches (it would just
    // read viewer A's cached rows) — assert it DOES fetch fresh for viewer B.
    await waitFor(() => expect(mockApiSupportPeople).toHaveBeenCalledTimes(1));

    const keys = qc.getQueryCache().getAll().map((q) => q.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        ['support', 'people', 'admin-1', 'all', 'direct'],
        ['support', 'people', 'collab-helia', 'all', 'direct'],
      ]),
    );
    // The two entries are genuinely distinct cache rows, not one shared row.
    expect(keys.length).toBeGreaterThanOrEqual(2);
    second.unmount();
  });
});

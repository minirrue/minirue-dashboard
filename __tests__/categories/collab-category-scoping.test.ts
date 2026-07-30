/**
 * Task 20 — a collaborator must never be able to name a space other than
 * their own, even by editing the request.
 *
 * The collab-portal category functions (`apiCollabCategories` and friends)
 * take no `space`/`collaboratorId` argument at all — the backend derives it
 * solely from the signed-in session (`collab-portal.controller.ts`). These
 * tests pin the client-side half of that: no normal, typed call site in this
 * codebase can express a space, and none of these functions' URLs or bodies
 * carry one on an ordinary call.
 *
 * That is NOT the same claim as "the backend can't be sent one" — these
 * functions serialize whatever object they're given, so an untyped/`any`
 * caller could still smuggle an extra field onto the wire; rejecting THAT is
 * the backend schema's job (stripping unknown keys), not this client's. This
 * file only pins what the dashboard itself guarantees.
 *
 * The companion admin-side functions (`updateCategory`/`deleteCategory` in
 * lib/catalog/api.ts) DO take an explicit `space`, because an admin legitimately
 * audits more than one space — those are pinned separately below to confirm
 * the space actually reaches the request.
 */
import {
  apiCollabCategories,
  apiCollabCreateCategory,
  apiCollabUpdateCategory,
  apiCollabDeleteCategory,
} from '@/lib/api/collab-portal';
import { updateCategory, deleteCategory, createCategory } from '@/lib/catalog/api';

const originalFetch = global.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'x',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as unknown as Response;
}

describe('collab-portal categories carry no space parameter', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('apiCollabCategories requests a space-less URL', async () => {
    const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(200, { data: [] }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    await apiCollabCategories();
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).not.toMatch(/space=/);
    expect(url).toMatch(/\/collab\/categories$/);
  });

  it('apiCollabCreateCategory sends no space/collaboratorId field for a normal, typed call', async () => {
    const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(201, { id: 'cat_1' }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    // No caller in this codebase can express a space/collaboratorId here —
    // TS rejects it (uncomment to see: `space: 'x'` is not assignable to the
    // parameter type). The one path that matters, this normal typed call,
    // sends none.
    await apiCollabCreateCategory({ name: 'Jewellery' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.space).toBeUndefined();
    expect(body.collaboratorId).toBeUndefined();
  });

  it('apiCollabUpdateCategory and apiCollabDeleteCategory URLs carry no space', async () => {
    const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(200, {}),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    await apiCollabUpdateCategory('cat_1', { name: 'Renamed' });
    await apiCollabDeleteCategory('cat_1');
    for (const call of fetchMock.mock.calls) {
      const [url] = call as [string];
      expect(url).not.toMatch(/space=/);
    }
  });
});

describe('admin catalog category functions DO carry the given space', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('createCategory / updateCategory / deleteCategory each put the space on the request', async () => {
    const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(200, { id: 'cat_1' }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await createCategory({
      name: 'Perfumes',
      slug: 'perfumes',
      imageMediaId: 'gal_1',
      space: 'collab_123',
    });
    await updateCategory('cat_1', { name: 'Perfumes' }, 'collab_123');
    await deleteCategory('cat_1', 'collab_123');

    for (const call of fetchMock.mock.calls) {
      const [url] = call as [string];
      expect(url).toMatch(/space=collab_123/);
    }
  });
});

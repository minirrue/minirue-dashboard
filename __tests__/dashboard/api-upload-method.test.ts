/**
 * `apiUpload` was hardcoded to `method: 'POST'` (task-w2.3-brief.md, Part A)
 * — "Exchange" needs the SAME multipart plumbing but against
 * `PATCH /gallery/items/:id/file`, so it now takes a method rather than a
 * second near-duplicate uploader. Default stays 'POST' so every existing
 * caller (gallery item creation, brand logo, avatar) needs no change.
 */
import { apiUpload } from '@/lib/api/client';

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

describe('apiUpload method parameter', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('defaults to POST when no method is given', async () => {
    const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(201, { id: 'item-1' }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await apiUpload('/gallery/items', new FormData());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
  });

  it('sends PATCH when asked — the method Exchange needs', async () => {
    const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(200, { id: 'item-1' }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await apiUpload('/gallery/items/item-1/file', new FormData(), 'PATCH');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('PATCH');
  });

  it('never sets a Content-Type header — the browser must set the multipart boundary', async () => {
    const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(200, { id: 'item-1' }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await apiUpload('/gallery/items/item-1/file', new FormData(), 'PATCH');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.has('Content-Type')).toBe(false);
  });
});

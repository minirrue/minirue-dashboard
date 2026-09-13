import { act, renderHook } from '@testing-library/react';
import type { GalleryItem } from '@/lib/gallery/types';

/**
 * dashboard#45 (backend#89 slice 1): a video in a format browsers cannot play
 * comes back from the upload as `status: 'processing'` and is converted in the
 * background. The dashboard asks again until it is not processing any more —
 * backing off, and asking nothing at all once no item is processing.
 */

jest.mock('@/lib/gallery/api', () => ({ getItem: jest.fn() }));

import { getItem } from '@/lib/gallery/api';
import {
  POLL_INITIAL_MS,
  POLL_MAX_MS,
  useProcessingItemsPoll,
} from '@/lib/gallery/use-processing-poll';

const mockGetItem = getItem as jest.MockedFunction<typeof getItem>;

const video = (id: string, over: Partial<GalleryItem> = {}): GalleryItem => ({
  id,
  folderId: 'f',
  kind: 'video',
  url: `https://s3.test/${id}.avi`,
  posterUrl: null,
  mimeType: 'video/x-msvideo',
  width: null,
  height: null,
  durationSeconds: null,
  altText: null,
  createdAt: '2026-09-13T00:00:00.000Z',
  status: 'processing',
  processingError: null,
  ...over,
});

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    // let the getItem promises settle
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('useProcessingItemsPoll', () => {
  it('asks nothing when no item is processing', async () => {
    const onUpdate = jest.fn();
    renderHook(() =>
      useProcessingItemsPoll(
        [video('a', { status: 'ready' }), video('b', { status: 'failed' })],
        onUpdate,
      ),
    );
    await advance(POLL_MAX_MS * 5);
    expect(mockGetItem).not.toHaveBeenCalled();
  });

  it('treats an item with no status (an older API) as ready', async () => {
    const legacy = video('a');
    delete legacy.status;
    renderHook(() => useProcessingItemsPoll([legacy], jest.fn()));
    await advance(POLL_MAX_MS * 5);
    expect(mockGetItem).not.toHaveBeenCalled();
  });

  it('refetches a processing item, hands back the result, and stops once it is ready', async () => {
    mockGetItem.mockImplementation(async (id: string) =>
      video(id, { status: 'ready', url: `https://s3.test/${id}.mp4` }),
    );
    let items = [video('a'), video('b', { status: 'ready' })];
    const onUpdate = jest.fn((updated: GalleryItem[]) => {
      items = items.map((it) => updated.find((u) => u.id === it.id) ?? it);
    });
    const { rerender } = renderHook(() => useProcessingItemsPoll(items, onUpdate));

    await advance(POLL_INITIAL_MS - 1);
    expect(mockGetItem).not.toHaveBeenCalled();
    await advance(1);
    // Only the processing item is asked about, never the ready one.
    expect(mockGetItem).toHaveBeenCalledTimes(1);
    expect(mockGetItem).toHaveBeenCalledWith('a');
    expect(onUpdate).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'a', status: 'ready', url: 'https://s3.test/a.mp4' }),
    ]);

    rerender();
    await advance(POLL_MAX_MS * 5);
    expect(mockGetItem).toHaveBeenCalledTimes(1);
  });

  it('backs off between attempts while the item is still processing, capped', async () => {
    mockGetItem.mockImplementation(async (id: string) => video(id));
    const items = [video('a')];
    renderHook(() => useProcessingItemsPoll(items, jest.fn()));

    const callTimes: number[] = [];
    let elapsed = 0;
    for (let i = 0; i < 400; i++) {
      await advance(250);
      elapsed += 250;
      while (callTimes.length < mockGetItem.mock.calls.length) callTimes.push(elapsed);
    }
    const gaps = callTimes.map((t, i) => t - (i === 0 ? 0 : callTimes[i - 1]));
    expect(gaps[0]).toBe(POLL_INITIAL_MS);
    // Each wait is at least as long as the one before, and grows at first...
    expect(gaps[1]).toBeGreaterThan(gaps[0]);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThanOrEqual(gaps[i - 1]);
    // ...but never past the cap.
    expect(Math.max(...gaps)).toBeLessThanOrEqual(POLL_MAX_MS);
    expect(gaps[gaps.length - 1]).toBe(POLL_MAX_MS);
  });

  it('keeps polling after a failed request instead of giving up', async () => {
    mockGetItem.mockRejectedValueOnce(new Error('network')).mockImplementation(async (id: string) => video(id));
    renderHook(() => useProcessingItemsPoll([video('a')], jest.fn()));
    await advance(POLL_INITIAL_MS);
    expect(mockGetItem).toHaveBeenCalledTimes(1);
    await advance(POLL_MAX_MS);
    expect(mockGetItem.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('stops polling on unmount', async () => {
    mockGetItem.mockImplementation(async (id: string) => video(id));
    const { unmount } = renderHook(() => useProcessingItemsPoll([video('a')], jest.fn()));
    unmount();
    await advance(POLL_MAX_MS * 5);
    expect(mockGetItem).not.toHaveBeenCalled();
  });
});

'use client';

import { useEffect, useRef } from 'react';
import { getItem } from './api';
import { galleryItemStatus } from './status';
import type { GalleryItem } from './types';

/**
 * How often to ask about a video still converting (dashboard#45).
 *
 * A 120 s 1080p clip takes about 75 s on the server (backend#123), and most
 * clips are shorter, so the first look comes quickly and the gap then widens:
 * 4 s, 6 s, 9 s, 13.5 s, then every 20 s. That spots a typical conversion
 * within a poll or two of it finishing without hammering the API for a slow one.
 */
export const POLL_INITIAL_MS = 4_000;
export const POLL_BACKOFF = 1.5;
export const POLL_MAX_MS = 20_000;

/**
 * While any of `items` is `processing`, re-reads just those items
 * (`GET /gallery/items/:id`) on a backing-off timer and hands the fresh rows to
 * `onUpdate`, so the caller can swap them in place. Asks nothing when none is
 * processing — `ready` and `failed` are both final.
 *
 * Per item rather than refetching the whole folder: it leaves everything else
 * on screen alone (an alt text being typed, a just-uploaded local preview) and
 * cannot race a folder switch into painting the wrong folder's items.
 *
 * The timer restarts from `POLL_INITIAL_MS` whenever the SET of processing ids
 * changes — a new upload deserves a quick first look even if an older clip has
 * been converting for a while.
 */
export function useProcessingItemsPoll(
  items: ReadonlyArray<Pick<GalleryItem, 'id' | 'status'>>,
  onUpdate: (fresh: GalleryItem[]) => void,
): void {
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

  const key = Array.from(
    new Set(items.filter((i) => galleryItemStatus(i) === 'processing').map((i) => i.id)),
  )
    .sort()
    .join('|');

  useEffect(() => {
    if (!key) return;
    const ids = key.split('|');
    let delay = POLL_INITIAL_MS;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      // A failed read (a blip, an item deleted elsewhere) is not an answer —
      // skip it and ask again next time.
      const results = await Promise.all(ids.map((id) => getItem(id).catch(() => null)));
      if (cancelled) return;
      const fresh = results.filter((r): r is GalleryItem => r != null);
      if (fresh.length > 0) onUpdateRef.current(fresh);
      delay = Math.min(delay * POLL_BACKOFF, POLL_MAX_MS);
      timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key]);
}

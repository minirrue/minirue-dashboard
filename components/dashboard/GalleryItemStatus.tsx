'use client';

import React from 'react';
import RetryingImage from './RetryingImage';
import { FAILED_FALLBACK_MESSAGE, galleryItemStatus } from '@/lib/gallery/status';
import type { GalleryItem } from '@/lib/gallery/types';

/**
 * dashboard#45 — how a gallery video that is not `ready` looks, wherever one is
 * drawn: the Gallery tab, the shared picker, the hero and journal editors.
 *
 * One component so the label reads the same everywhere, and so no surface
 * forgets the rule that matters: until the item is `ready`, `url` is the
 * original upload (ProRes, AVI, MKV…), which a browser may not decode. A
 * `<video src={url}>` would be a black box that reads as a broken upload —
 * the exact thing #89 exists to stop. The poster is always safe.
 */

type StatusItem = Pick<GalleryItem, 'status'>;

/** "Converting…" / "Failed" pill. Renders nothing for a ready item. The
 *  parent must be `position: relative` — the pill sits over the top-left
 *  corner of the thumbnail. */
export function GalleryItemStatusBadge({
  item,
  inline = false,
}: {
  item: StatusItem;
  /** In the text flow rather than over a thumbnail. */
  inline?: boolean;
}) {
  const status = galleryItemStatus(item);
  if (status === 'ready') return null;
  return (
    <span
      className="dash-gallery-status"
      data-status={status}
      data-inline={inline ? 'true' : undefined}
    >
      {status === 'processing' ? 'Converting…' : 'Failed'}
    </span>
  );
}

/** The failure reason, or a generic line when the server gave none. */
export function galleryItemFailureMessage(item: Pick<GalleryItem, 'processingError'>): string {
  return item.processingError?.trim() || FAILED_FALLBACK_MESSAGE;
}

/**
 * A still for a video that is converting or failed: its poster when it has
 * one, otherwise a quiet placeholder. Never the original file.
 */
export function NotReadyVideoStill({
  item,
  className,
  style,
}: {
  item: Pick<GalleryItem, 'posterUrl' | 'status'>;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (item.posterUrl) {
    return <RetryingImage src={item.posterUrl} alt="" className={className} style={style} />;
  }
  return (
    <span
      className={['dash-gallery-still-placeholder', className].filter(Boolean).join(' ')}
      // Callers pass the sizing they give an image, often with
      // `display: block` — the placeholder keeps its own centring regardless.
      style={{ ...style, display: 'flex', textAlign: 'center' }}
    >
      {galleryItemStatus(item) === 'processing' ? 'Preview soon' : 'No preview'}
    </span>
  );
}

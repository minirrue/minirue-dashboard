'use client';

import React from 'react';
import RetryingImage from './RetryingImage';
import UploadPreviewImage from './UploadPreviewImage';
import { GalleryItemStatusBadge, NotReadyVideoStill } from './GalleryItemStatus';
import { galleryItemStatus } from '@/lib/gallery/status';
import type { GalleryItemKind, GalleryItemStatus } from '@/lib/gallery/types';

/**
 * A thumbnail for something that may be a photo OR a video (dashboard#51).
 *
 * Built on the #45 pieces (`NotReadyVideoStill`, `GalleryItemStatusBadge`) so
 * a video reads the same here as in the Gallery tab and the picker:
 *
 * - image → the image, exactly as `UploadPreviewImage` always drew it;
 * - video → its poster with a play glyph, plus the Converting/Failed pill
 *   when it is not ready. With no poster, a ready video paints its first
 *   frame through a muted `<video>`; a non-ready one shows a placeholder.
 *
 * `url` is never put in an `<img>` for a video: for a ready one it is a movie,
 * and while one converts the server may hand out the poster there instead —
 * `posterUrl` is the only field that is always a still.
 */
export interface MediaThumbSource {
  /** Absent (an older API, a legacy row) reads as an image. */
  kind?: GalleryItemKind;
  url: string;
  posterUrl?: string | null;
  status?: GalleryItemStatus;
}

export default function MediaThumb({
  media,
  alt,
  style,
  localFile,
  traceId,
}: {
  media: MediaThumbSource;
  alt: string;
  /** Sizing for the picture — width, aspect ratio, object-fit, border. */
  style?: React.CSSProperties;
  /** Just-uploaded bytes for an IMAGE (see UploadPreviewImage). Ignored for a
   *  video: the browser cannot paint a movie file into an image. */
  localFile?: File | Blob | null;
  traceId?: string;
}) {
  if (media.kind !== 'video') {
    return (
      <UploadPreviewImage
        src={media.url}
        localFile={localFile ?? null}
        alt={alt}
        data-trace-id={traceId}
        style={style}
      />
    );
  }

  const status = galleryItemStatus(media);
  const still: React.CSSProperties = { ...style, display: 'block' };
  // With nothing to paint, the placeholder's own text ("Preview soon") sits
  // where the glyph would; the status pill already says what is going on.
  const placeholder = !media.posterUrl && (status !== 'ready' || !media.url);
  return (
    <span className="dash-media-thumb" data-media-kind="video" data-trace-id={traceId}>
      {status !== 'ready' ? (
        <NotReadyVideoStill item={{ posterUrl: media.posterUrl ?? null, status }} style={still} />
      ) : media.posterUrl ? (
        <RetryingImage src={media.posterUrl} alt={alt} style={still} />
      ) : media.url ? (
        <video src={media.url} muted playsInline preload="metadata" style={still} />
      ) : (
        <NotReadyVideoStill item={{ posterUrl: null, status }} style={still} />
      )}
      {!placeholder && (
        <span className="dash-media-thumb-play" data-media-play aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" focusable="false">
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
        </span>
      )}
      <span className="dash-sr-only">Video</span>
      <GalleryItemStatusBadge item={{ status }} />
    </span>
  );
}

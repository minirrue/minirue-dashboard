'use client';

import { useEffect } from 'react';

/**
 * Full-size tap-to-enlarge preview — same overlay/frame the Gallery module
 * uses for its thumbnails, extracted here so any image anywhere in the
 * dashboard (brand logos, product photos, ...) can open the same modal
 * instead of only ever showing a small fixed thumbnail.
 */
export function ImagePreviewModal({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="dash-gallery-preview-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <button
        type="button"
        className="dash-gallery-preview-close"
        onClick={onClose}
        aria-label="Close preview"
      >
        ✕
      </button>
      <div className="dash-gallery-preview-frame" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="dash-gallery-preview-media" />
      </div>
    </div>
  );
}

/** Wraps any thumbnail image in a clickable button that opens it enlarged. */
export function EnlargeableImage({
  src,
  alt,
  className,
  previewOpen,
  onOpenPreview,
  onClosePreview,
  traceId,
}: {
  src: string;
  alt: string;
  className?: string;
  previewOpen: boolean;
  onOpenPreview: () => void;
  onClosePreview: () => void;
  traceId?: string;
}) {
  return (
    <>
      <button
        type="button"
        className="dash-enlargeable-image-btn"
        onClick={onOpenPreview}
        aria-label="View full size"
        data-trace-id={traceId}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={className} />
      </button>
      {previewOpen && <ImagePreviewModal src={src} alt={alt} onClose={onClosePreview} />}
    </>
  );
}

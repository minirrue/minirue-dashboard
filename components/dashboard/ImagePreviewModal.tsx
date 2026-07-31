'use client';

import { useEffect } from 'react';
import UploadPreviewImage from './UploadPreviewImage';

/**
 * Full-size tap-to-enlarge preview — same overlay/frame the Gallery module
 * uses for its thumbnails, extracted here so any image anywhere in the
 * dashboard (brand logos, product photos, ...) can open the same modal
 * instead of only ever showing a small fixed thumbnail.
 */
export function ImagePreviewModal({
  src,
  alt,
  localFile,
  onClose,
}: {
  src: string;
  alt: string;
  /**
   * Bytes already in the browser for THIS image — the File/Blob just picked,
   * cropped or exchanged. Enlarging a photo seconds after replacing it is the
   * single most likely moment for a cold miss, and this used to be a bare
   * `<img>`: one failed load and the enlarged view stayed broken until the
   * modal was closed and reopened — it now goes through UploadPreviewImage
   * like every other picture in the dashboard. Omit for an image that was not
   * uploaded in this session; the retry behaviour still applies.
   */
  localFile?: File | Blob | null;
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
        <UploadPreviewImage
          src={src}
          localFile={localFile}
          alt={alt}
          className="dash-gallery-preview-media"
        />
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
  localFile,
}: {
  src: string;
  alt: string;
  className?: string;
  previewOpen: boolean;
  onOpenPreview: () => void;
  onClosePreview: () => void;
  traceId?: string;
  /**
   * Task FF (2026-07-30): bytes already in the browser for THIS image — the
   * File/Blob just picked or cropped, whose upload `src` is the eventual
   * result of. Passing this shows the local picture immediately instead of a
   * guaranteed-cold-miss remote fetch. Omit for an image being displayed on
   * first paint (no local bytes exist), which keeps the previous plain
   * retry-only behaviour unchanged.
   */
  localFile?: File | Blob | null;
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
        <UploadPreviewImage src={src} localFile={localFile} alt={alt} className={className} />
      </button>
      {previewOpen && <ImagePreviewModal src={src} alt={alt} onClose={onClosePreview} />}
    </>
  );
}

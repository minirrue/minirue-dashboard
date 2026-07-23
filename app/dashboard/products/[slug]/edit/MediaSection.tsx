'use client';

import React, { useRef, useState } from 'react';
import {
  cloudinaryPreviewUrl,
  createProductMedia,
} from '@/lib/catalog/api';
import type { ProductMedia } from '@/lib/catalog/types';
import type { ApiError } from '@/lib/api/client';
import GalleryPickerModal, {
  uploadDeviceFileToGallery,
} from '@/components/dashboard/GalleryPickerModal';
import type { GalleryItem } from '@/lib/gallery/types';
import { ImagePreviewModal } from '@/components/dashboard/ImagePreviewModal';

interface Props {
  productId: string;
  productName: string;
  media: ProductMedia[];
  onMediaChange: (media: ProductMedia[]) => void;
}

/** Resolves the best available preview URL for a media row — the freshly
 * resolved Gallery URL if present, else the legacy Cloudinary derivation. */
function previewUrl(m: ProductMedia): string {
  if (m.url) return m.url;
  return cloudinaryPreviewUrl(m.cloudinaryPublicId);
}

export default function MediaSection({ productId, productName, media, onMediaChange }: Props) {
  const [mode, setMode] = useState<'device' | 'gallery'>('device');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<ProductMedia | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleDeviceUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      // Device uploads still land in the user's own gallery — not
      // gallery-invisible — per spec Story 2, Acceptance Scenario 3.
      // Folder is named exactly after this product, not a shared bucket.
      const item: GalleryItem = await uploadDeviceFileToGallery(file, productName);
      const asset = await createProductMedia(productId, {
        galleryItemId: item.id,
        sortOrder: media.length,
      });
      onMediaChange([...media, asset]);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  }

  async function handleGallerySelect(item: GalleryItem) {
    setPickerOpen(false);
    setError(null);
    try {
      const asset = await createProductMedia(productId, {
        galleryItemId: item.id,
        sortOrder: media.length,
      });
      onMediaChange([...media, asset]);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || 'Failed to link gallery photo.');
    }
  }

  return (
    <section
      className="dash-form-card"
      style={{ marginTop: 24 }}
      data-trace-id="PG-DASHBOARD-CAT-003::EL-REGION-product-images"
    >
      <h2 className="dash-card-title" style={{ marginTop: 0 }}>
        Product images
      </h2>

      {pickerOpen && (
        <GalleryPickerModal
          onSelect={handleGallerySelect}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {media.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          {media.map((m) => (
            <figure key={m.id} style={{ margin: 0 }}>
              <button
                type="button"
                onClick={() => setPreviewMedia(m)}
                aria-label="View full size"
                data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-enlarge-product-image@${m.id}`}
                style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
              >
                <img
                  src={previewUrl(m)}
                  alt={m.altText ?? ''}
                  data-trace-id={`PG-DASHBOARD-CAT-003::EL-IMG-product-image@${m.id}`}
                  style={{
                    width: '100%',
                    aspectRatio: '4/5',
                    objectFit: 'cover',
                    borderRadius: 'var(--mr-radius-sm)',
                    border: '1px solid var(--mr-dash-hair)',
                  }}
                />
              </button>
              <figcaption
                className="dash-help-text"
                style={{ marginTop: 6, fontSize: 11, wordBreak: 'break-all' }}
              >
                {m.galleryItemId ? 'From Gallery' : m.cloudinaryPublicId}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <div
        className="dash-toggle-group"
        role="tablist"
        style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}
        data-trace-id="PG-DASHBOARD-CAT-003::EL-REGION-media-source-toggle"
      >
        <button
          type="button"
          className={mode === 'device' ? 'dash-btn-primary' : 'dash-btn-ghost'}
          onClick={() => setMode('device')}
          data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-media-mode-device"
        >
          Upload from this device
        </button>
        <button
          type="button"
          className={mode === 'gallery' ? 'dash-btn-primary' : 'dash-btn-ghost'}
          onClick={() => setMode('gallery')}
          data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-media-mode-gallery"
        >
          Choose from Gallery
        </button>
      </div>

      {mode === 'device' ? (
        <div data-trace-id="PG-DASHBOARD-CAT-003::EL-REGION-media-device-upload">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif,image/webp,video/mp4,video/quicktime"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleDeviceUpload(file);
              e.target.value = '';
            }}
            data-trace-id="PG-DASHBOARD-CAT-003::EL-INPUT-media-device-file"
          />
          <button
            type="button"
            className="dash-btn-secondary"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-media-device-browse"
          >
            {uploading ? 'Uploading…' : 'Choose file to upload'}
          </button>
          <p className="dash-help-text" style={{ marginTop: 8 }}>
            Uploaded photos are also saved to your Gallery.
          </p>
        </div>
      ) : (
        <div data-trace-id="PG-DASHBOARD-CAT-003::EL-REGION-media-gallery-pick">
          <button
            type="button"
            className="dash-btn-secondary"
            onClick={() => setPickerOpen(true)}
            data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-media-open-gallery-picker"
          >
            Browse Gallery
          </button>
        </div>
      )}

      {error && <p className="dash-inline-error">{error}</p>}

      {previewMedia && (
        <ImagePreviewModal
          src={previewUrl(previewMedia)}
          alt={previewMedia.altText ?? ''}
          onClose={() => setPreviewMedia(null)}
        />
      )}
    </section>
  );
}

'use client';

import React, { useState } from 'react';
import {
  cloudinaryPreviewUrl,
  createProductMedia,
} from '@/lib/catalog/api';
import type { ProductMedia } from '@/lib/catalog/types';
import type { ApiError } from '@/lib/api/client';

interface Props {
  productId: string;
  media: ProductMedia[];
  onMediaChange: (media: ProductMedia[]) => void;
}

export default function MediaSection({ productId, media, onMediaChange }: Props) {
  const [publicId, setPublicId] = useState('');
  const [altText, setAltText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!publicId.trim()) {
      setError('Cloudinary public ID is required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const asset = await createProductMedia(productId, {
        cloudinaryPublicId: publicId.trim(),
        altText: altText.trim() || undefined,
        sortOrder: media.length,
      });
      onMediaChange([...media, asset]);
      setPublicId('');
      setAltText('');
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || 'Failed to add image.');
    } finally {
      setSubmitting(false);
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
      <p className="dash-help-text" style={{ marginBottom: 20 }}>
        Images are served via Cloudinary. Paste the public ID from your media library
        (e.g. <code>products/rose-noir-01</code>).
      </p>

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
              <img
                src={cloudinaryPreviewUrl(m.cloudinaryPublicId)}
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
              <figcaption
                className="dash-help-text"
                style={{ marginTop: 6, fontSize: 11, wordBreak: 'break-all' }}
              >
                {m.cloudinaryPublicId}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} noValidate>
        <div className="dash-field-row">
          <div className="dash-field">
            <label className="dash-label" htmlFor="media-public-id">
              Cloudinary public ID
            </label>
            <input
              id="media-public-id"
              className="dash-input"
              value={publicId}
              onChange={(e) => setPublicId(e.target.value)}
              placeholder="folder/image-name"
              disabled={submitting}
              data-trace-id="PG-DASHBOARD-CAT-003::EL-INPUT-media-public-id"
            />
          </div>
          <div className="dash-field">
            <label className="dash-label" htmlFor="media-alt">
              Alt text
            </label>
            <input
              id="media-alt"
              className="dash-input"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              disabled={submitting}
              data-trace-id="PG-DASHBOARD-CAT-003::EL-INPUT-media-alt-text"
            />
          </div>
        </div>
        {error && <p className="dash-inline-error">{error}</p>}
        <div className="dash-form-actions">
          <button
            type="submit"
            className="dash-btn-primary"
            disabled={submitting}
            data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-add-image"
          >
            {submitting ? 'Adding…' : 'Add image'}
          </button>
        </div>
      </form>
    </section>
  );
}

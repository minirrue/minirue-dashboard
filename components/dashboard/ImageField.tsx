'use client';

import React, { useState } from 'react';
import GalleryPickerModal from './GalleryPickerModal';
import type { GalleryItem } from '@/lib/gallery/types';

/**
 * A square picture on a thing that has one — a brand, a category.
 *
 * The owner's requirement (2026-07-29) is that customers browse brands and
 * categories by picture rather than by text, so the storefront renders both as
 * image tiles. The schema has held the image since migration 0036; this is the
 * only way to put one there.
 *
 * Reuses GalleryPickerModal rather than adding a second upload path, so an
 * image used on a category is the same asset, in the same folders, as one used
 * on a product.
 */
export default function ImageField({
  imageUrl,
  onChange,
  label = 'Image',
  helpText,
  disabled,
}: {
  /** Current image, or null. */
  imageUrl: string | null;
  /** Called with the chosen gallery item id, or null to clear it. */
  onChange: (mediaId: string | null, item: GalleryItem | null) => void;
  label?: string;
  helpText?: string;
  disabled?: boolean;
}) {
  const [picking, setPicking] = useState(false);

  return (
    <div className="dash-field">
      <span className="dash-label">{label}</span>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 6,
            border: '1px solid var(--mr-dash-border, #e5e0d8)',
            background: 'var(--mr-dash-sub, #f4f1ec)',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="dash-btn-secondary"
            onClick={() => setPicking(true)}
            disabled={disabled}
          >
            {imageUrl ? 'Change' : 'Choose image'}
          </button>
          {imageUrl && (
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={() => onChange(null, null)}
              disabled={disabled}
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {helpText && <p className="dash-help-text">{helpText}</p>}

      {picking && (
        <GalleryPickerModal
          onSelect={(item) => {
            onChange(item.id, item);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

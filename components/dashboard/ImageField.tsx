'use client';

import React, { useRef, useState } from 'react';
import GalleryPickerModal from './GalleryPickerModal';
import { exchangeItem } from '@/lib/gallery/api';
import type { ApiError } from '@/lib/api/client';
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
  mediaId,
  onChange,
  label = 'Image',
  helpText,
  disabled,
}: {
  /** Current image, or null. */
  imageUrl: string | null;
  /**
   * The gallery item id `imageUrl` currently resolves to, if known. Required
   * for "Exchange" (task-w2.3-brief.md, Part A) — without it there is no
   * item to call `PATCH /gallery/items/:id/file` on, so the Exchange button
   * is only offered when a caller passes this. "Change" (pick a different
   * existing gallery item) works either way.
   */
  mediaId?: string | null;
  /** Called with the chosen gallery item id, or null to clear it. */
  onChange: (mediaId: string | null, item: GalleryItem | null) => void;
  label?: string;
  helpText?: string;
  disabled?: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const exchangeInputRef = useRef<HTMLInputElement>(null);

  /**
   * Replaces the CURRENT gallery item's bytes in place — `mediaId` never
   * changes, so whatever this image is attached to (a category's or brand's
   * `imageMediaId`) keeps pointing at the same row with no re-linking.
   * Distinct from "Change", which re-links to a DIFFERENT existing item.
   */
  async function handleExchange(file: File) {
    if (!mediaId) return;
    setExchangeError(null);
    setExchanging(true);
    try {
      const updated = await exchangeItem(mediaId, file);
      onChange(mediaId, updated);
    } catch (e) {
      const err = e as ApiError;
      setExchangeError(err.message || 'Failed to exchange image.');
    } finally {
      setExchanging(false);
    }
  }

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
          {imageUrl && mediaId && (
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={() => exchangeInputRef.current?.click()}
              disabled={disabled || exchanging}
              title="Replace this photo — everywhere it's used updates automatically"
            >
              {exchanging ? 'Exchanging…' : 'Exchange'}
            </button>
          )}
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
      {exchangeError && <p className="dash-inline-error">{exchangeError}</p>}

      <input
        ref={exchangeInputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleExchange(file);
          e.target.value = '';
        }}
      />

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

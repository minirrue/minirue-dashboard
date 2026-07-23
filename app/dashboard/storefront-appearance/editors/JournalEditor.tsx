'use client';

import React, { useRef, useState } from 'react';
import type { JournalSection } from '@/lib/api/storefront';
import type { ApiError } from '@/lib/api/client';
import type { GalleryItem } from '@/lib/gallery/types';
import EntityPicker from '../pickers/EntityPicker';
import GalleryPickerModal, { uploadDeviceFileToGallery } from '@/components/dashboard/GalleryPickerModal';

/** True when the admin has typed editorial copy or attached an image that
 * would be silently thrown away by switching into product mode (product
 * mode ignores title/body/image entirely, taking them from the product). */
function hasEditorialContent(section: JournalSection): boolean {
  return Boolean(section.title.trim() || section.body.trim() || section.imageGalleryItemId);
}

export default function JournalEditor({
  section,
  onChange,
}: {
  section: JournalSection;
  onChange: (next: JournalSection) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleModeChange(mode: JournalSection['mode']) {
    if (mode === 'product' && section.mode === 'editorial' && hasEditorialContent(section)) {
      const ok = window.confirm(
        'Switching to product mode hides your typed title, words and image — the block will ' +
          'instead show whatever is on the chosen product. Your typed copy is kept in the saved ' +
          'document (nothing is deleted) but will not be used while product mode is on. Continue?',
      );
      if (!ok) return;
    }
    onChange({ ...section, mode });
  }

  async function handleDeviceUpload(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const item: GalleryItem = await uploadDeviceFileToGallery(file, section.title || undefined);
      onChange({ ...section, imageGalleryItemId: item.id });
    } catch (e) {
      const err = e as ApiError;
      setUploadError(err.message || 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="dash-form-section">
      <div className="dash-form-grid">
        <label className="dash-field">
          <span className="dash-label">What this block is</span>
          <select
            className="dash-input"
            value={section.mode}
            onChange={(e) => handleModeChange(e.target.value as JournalSection['mode'])}
          >
            <option value="editorial">My own image and words</option>
            <option value="product">A product — its photo and description</option>
          </select>
        </label>
        <label className="dash-field">
          <span className="dash-label">Eyebrow</span>
          <input className="dash-input" value={section.eyebrow}
            onChange={(e) => onChange({ ...section, eyebrow: e.target.value })} />
        </label>
        <label className="dash-field">
          <span className="dash-label">Image side</span>
          <select
            className="dash-input"
            value={section.imageSide}
            onChange={(e) => onChange({ ...section, imageSide: e.target.value as 'left' | 'right' })}
          >
            <option value="left">Image left, words right</option>
            <option value="right">Words left, image right</option>
          </select>
        </label>
        <label className="dash-field">
          <span className="dash-label">Badge on the image (blank to hide it)</span>
          <input className="dash-input" value={section.badge ?? ''} placeholder="Editorial · N°4"
            onChange={(e) => onChange({ ...section, badge: e.target.value.trim() || null })} />
        </label>
      </div>

      {section.mode === 'product' ? (
        <>
          <EntityPicker
            kind="product"
            label="Product"
            value={section.productId}
            onChange={(id) => onChange({ ...section, productId: id })}
          />
          <p style={{ fontSize: 13, color: 'var(--mr-fg-4)' }}>
            The title, words and photo come from the product itself, so editing the product
            updates this block automatically. The title, words and image fields below are hidden
            here because typing into them would have no effect. Only the button label is yours.
          </p>
          <label className="dash-field">
            <span className="dash-label">Button label</span>
            <input className="dash-input" value={section.ctaLabel ?? ''} placeholder="Discover"
              onChange={(e) => onChange({ ...section, ctaLabel: e.target.value || null })} />
          </label>
          {!section.productId && (
            <p className="dash-inline-error">
              No product chosen yet, so this block will show up empty on the live storefront.
            </p>
          )}
        </>
      ) : (
        <>
          <label className="dash-field">
            <span className="dash-label">Title</span>
            <input className="dash-input" value={section.title}
              onChange={(e) => onChange({ ...section, title: e.target.value })} />
          </label>
          <label className="dash-field">
            <span className="dash-label">Words</span>
            <textarea className="dash-input" rows={5} value={section.body}
              onChange={(e) => onChange({ ...section, body: e.target.value })} />
          </label>
          <div className="dash-field">
            <span className="dash-label">Image</span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="dash-btn-secondary" onClick={() => setPicking(true)}>
                {section.imageGalleryItemId ? 'Change image (from gallery)' : 'Choose from gallery'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleDeviceUpload(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                className="dash-btn-secondary"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? 'Uploading…' : 'Upload from this device'}
              </button>
              {section.imageGalleryItemId && (
                <button type="button" className="dash-btn-ghost"
                  onClick={() => onChange({ ...section, imageGalleryItemId: null })}>
                  Clear
                </button>
              )}
            </div>
            {uploadError && <p className="dash-inline-error">{uploadError}</p>}
            {!section.imageGalleryItemId && (
              <p className="dash-help-text" style={{ marginTop: 6 }}>
                No image chosen yet — this block will render without a photo on the live
                storefront until one is picked or uploaded.
              </p>
            )}
          </div>
          <div className="dash-form-grid">
            <label className="dash-field">
              <span className="dash-label">Button label (blank to hide it)</span>
              <input className="dash-input" value={section.ctaLabel ?? ''}
                onChange={(e) => onChange({ ...section, ctaLabel: e.target.value || null })} />
            </label>
            <label className="dash-field">
              <span className="dash-label">Button link</span>
              <input className="dash-input" value={section.ctaHref ?? ''} placeholder="/journal"
                onChange={(e) => onChange({ ...section, ctaHref: e.target.value.trim() || null })} />
            </label>
          </div>
        </>
      )}

      {picking && (
        <GalleryPickerModal
          onClose={() => setPicking(false)}
          onSelect={(item) => {
            onChange({ ...section, imageGalleryItemId: item.id });
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

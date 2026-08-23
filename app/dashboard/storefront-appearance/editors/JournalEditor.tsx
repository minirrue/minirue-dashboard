'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { JournalSection } from '@/lib/api/storefront';
import type { ApiError } from '@/lib/api/client';
import type { GalleryItem } from '@/lib/gallery/types';
import EntityPicker from '../pickers/EntityPicker';
import GalleryPickerModal, { uploadDeviceFileToGallery } from '@/components/dashboard/GalleryPickerModal';
import { useImageCrop } from '@/components/dashboard/ImageCropProvider';
import UploadPreviewImage from '@/components/dashboard/UploadPreviewImage';
import { getItem } from '@/lib/gallery/api';

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
  const cropImage = useImageCrop();

  /**
   * The chosen image, so the admin can SEE what this block will render.
   *
   * The editor only ever stored `imageGalleryItemId`, so after picking or
   * uploading, the entire feedback the admin got was the button relabelling
   * itself to "Change image (from gallery)" — no thumbnail, no way to tell a
   * right photo from a wrong one, and no way to tell an upload that worked
   * from one that silently attached the previous file (reported 2026-08-23).
   *
   * `previewFile` holds the cropped bytes of an upload that just happened, so
   * the tile paints instantly from memory instead of waiting on a guaranteed
   * cache miss through imgproxy — the same trick ImageField uses.
   */
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const previewForId = useRef<string | null>(null);

  const imageId = section.imageGalleryItemId ?? null;
  useEffect(() => {
    if (!imageId) {
      setPreviewUrl(null);
      setPreviewFile(null);
      previewForId.current = null;
      return;
    }
    // Already resolved by the pick/upload that set it — no second fetch.
    if (previewForId.current === imageId) return;
    let live = true;
    void getItem(imageId)
      .then((item) => {
        if (!live) return;
        previewForId.current = imageId;
        setPreviewUrl(item.url);
      })
      // A thumbnail is a convenience; a saved section id that no longer
      // resolves must not break the editor around it.
      .catch(() => {
        if (live) setPreviewUrl(null);
      });
    return () => {
      live = false;
    };
  }, [imageId]);

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
      const cropped = await cropImage(file, { title: `Crop ${file.name}` });
      if (!cropped) return;
      const item: GalleryItem = await uploadDeviceFileToGallery(cropped, section.title || undefined);
      previewForId.current = item.id;
      setPreviewUrl(item.url);
      // Local bytes only when the browser can actually paint them. A HEIC
      // passes through the cropper untouched (see ImageCropProvider) and no
      // browser decodes it, so showing the local file would be a broken frame
      // where the remote WebP the server just wrote renders fine.
      setPreviewFile(cropped.type.startsWith('image/') ? cropped : null);
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
              {imageId && (
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 6,
                    border: '1px solid var(--mr-dash-border, #e5e0d8)',
                    background: 'var(--mr-dash-sub, #f4f1ec)',
                    overflow: 'hidden',
                    flexShrink: 0,
                    padding: 4,
                  }}
                >
                  {previewUrl || previewFile ? (
                    <UploadPreviewImage
                      src={previewUrl ?? ''}
                      localFile={previewFile}
                      alt=""
                      // 'contain' — this answers "what did I just attach", so
                      // it must show the whole frame, not a centre crop that
                      // hides which photo it actually is.
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                  ) : null}
                </div>
              )}
              <button type="button" className="dash-btn-secondary" onClick={() => setPicking(true)}>
                {section.imageGalleryItemId ? 'Change image (from gallery)' : 'Choose from gallery'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif,.hif"
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
                  onClick={() => {
                    setPreviewFile(null);
                    onChange({ ...section, imageGalleryItemId: null });
                  }}>
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
            // A different EXISTING item — drop any local bytes from a previous
            // device upload so the tile cannot keep showing the old photo.
            previewForId.current = item.id;
            setPreviewFile(null);
            setPreviewUrl(item.url);
            onChange({ ...section, imageGalleryItemId: item.id });
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

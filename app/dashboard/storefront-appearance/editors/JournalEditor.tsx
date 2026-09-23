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
import { galleryItemStatus } from '@/lib/gallery/status';
import { useProcessingItemsPoll } from '@/lib/gallery/use-processing-poll';
import {
  GalleryItemStatusBadge,
  galleryItemFailureMessage,
} from '@/components/dashboard/GalleryItemStatus';
import DashboardVideoViewer from '@/components/dashboard/DashboardVideoViewer';

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
  /**
   * What the chosen gallery item is (backend#89). The picker has always
   * offered videos, and the tile below painted every pick as a photo — a
   * video's URL in an image tag is a broken frame that looks like a failed
   * upload.
   */
  const [previewKind, setPreviewKind] = useState<GalleryItem['kind']>('image');
  const [previewPoster, setPreviewPoster] = useState<string | null>(null);
  /** Where a chosen video is in its conversion to MP4 (dashboard#45). */
  const [previewStatus, setPreviewStatus] = useState<
    Pick<GalleryItem, 'status' | 'processingError'>
  >({ status: 'ready', processingError: null });
  const previewForId = useRef<string | null>(null);

  /** Everything the tile needs from a gallery item, in one place. */
  function showItem(item: GalleryItem) {
    previewForId.current = item.id;
    setPreviewUrl(item.url);
    setPreviewKind(item.kind);
    setPreviewPoster(item.posterUrl);
    setPreviewStatus({ status: item.status, processingError: item.processingError ?? null });
  }

  const imageId = section.imageGalleryItemId ?? null;
  const notReadyVideo = previewKind === 'video' && galleryItemStatus(previewStatus) !== 'ready';

  // The tile turns into the playing clip once the server has converted it.
  useProcessingItemsPoll(
    imageId && notReadyVideo ? [{ id: imageId, status: previewStatus.status }] : [],
    (fresh) => {
      const item = fresh.find((f) => f.id === imageId);
      if (item) showItem(item);
    },
  );

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
        setPreviewKind(item.kind);
        setPreviewPoster(item.posterUrl);
        setPreviewStatus({ status: item.status, processingError: item.processingError ?? null });
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

  // Asked in the page, not with window.confirm (which some embedded browsers suppress).
  const [confirmProductMode, setConfirmProductMode] = useState(false);

  function handleModeChange(mode: JournalSection['mode']) {
    if (mode === 'product' && section.mode === 'editorial' && hasEditorialContent(section)) {
      setConfirmProductMode(true);
      return;
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
      // This button takes photos only, so the item is an image whatever the
      // response says about itself.
      showItem({ ...item, kind: 'image', posterUrl: null, status: 'ready', processingError: null });
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
      {confirmProductMode && (
        <div className="sfe-confirm" role="alert">
          <p>
            <b>Switch to showing a product?</b> Your typed title, words and image are hidden and the block shows the
            chosen product instead. Nothing is deleted: your copy stays saved and comes back if you switch again.
          </p>
          <div className="sfe-row-inline">
            <button type="button" className="sfe-btn" onClick={() => setConfirmProductMode(false)}>
              Keep my own words
            </button>
            <button
              type="button"
              className="sfe-btn sfe-btn-primary"
              onClick={() => {
                setConfirmProductMode(false);
                onChange({ ...section, mode: 'product' });
              }}
            >
              Show a product
            </button>
          </div>
        </div>
      )}
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
          {/* Trimmed on BLUR, not on change. `.trim()` inside onChange deletes
              the space the instant it is typed, so a value with a space in it
              cannot be entered at all — the field silently refuses the key.
              Trimming when the field is left keeps the stored value clean
              without fighting the keyboard. */}
          <input className="dash-input" value={section.badge ?? ''} placeholder="Editorial · N°4"
            onChange={(e) => onChange({ ...section, badge: e.target.value || null })}
            onBlur={(e) => onChange({ ...section, badge: e.target.value.trim() || null })} />
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
            <span className="dash-label">Photo or video</span>
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
                  {previewUrl && previewKind === 'video' && !previewFile ? (
                    <DashboardVideoViewer
                      media={{ url: previewUrl, posterUrl: previewPoster, status: previewStatus.status }}
                      variant="thumbnail"
                      showStatusBadge={false}
                      label="Chosen video"
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : previewUrl || previewFile ? (
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
                {section.imageGalleryItemId ? 'Change (from gallery)' : 'Choose from gallery'}
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
            {imageId && previewUrl && notReadyVideo && !previewFile && (
              <p
                className={previewStatus.status === 'failed' ? 'dash-inline-error' : 'dash-help-text'}
                style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', marginTop: 6 }}
              >
                <GalleryItemStatusBadge item={previewStatus} inline />
                {previewStatus.status === 'failed'
                  ? `${galleryItemFailureMessage(previewStatus)} The storefront will only show its still — exchange it in the Gallery or pick another.`
                  : 'The storefront shows its still until the video has been converted.'}
              </p>
            )}
            {!section.imageGalleryItemId && (
              <p className="dash-help-text" style={{ marginTop: 6 }}>
                No photo or video chosen yet — this block will render without one on the live
                storefront until one is picked. Videos are added from the Gallery; <strong>Upload
                from this device</strong> takes photos.
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
                onChange={(e) => onChange({ ...section, ctaHref: e.target.value || null })}
                onBlur={(e) => onChange({ ...section, ctaHref: e.target.value.trim() || null })} />
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
            setPreviewFile(null);
            showItem(item);
            onChange({ ...section, imageGalleryItemId: item.id });
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

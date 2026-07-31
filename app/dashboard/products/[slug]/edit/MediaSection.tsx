'use client';

import React, { useRef, useState } from 'react';
import {
  cloudinaryPreviewUrl,
  createProductMedia,
  setProductMediaCover,
  setProductMediaClosing,
  reorderProductMedia,
  deleteProductMedia,
  restoreProductMedia,
} from '@/lib/catalog/api';
import { exchangeItem } from '@/lib/gallery/api';
import type { ProductMedia } from '@/lib/catalog/types';
import type { ApiError } from '@/lib/api/client';
import GalleryPickerModal, {
  uploadDeviceFileToGallery,
} from '@/components/dashboard/GalleryPickerModal';
import type { GalleryItem } from '@/lib/gallery/types';
import { ImagePreviewModal } from '@/components/dashboard/ImagePreviewModal';
import UploadPreviewImage from '@/components/dashboard/UploadPreviewImage';
import { useImageCrop } from '@/components/dashboard/ImageCropProvider';

interface Props {
  productId: string;
  productName: string;
  media: ProductMedia[];
  onMediaChange: (media: ProductMedia[]) => void;
  /**
   * '/catalog/admin' (default) or '/collab' — this is the ONE media form
   * both the admin and collab product screens render (owner ask, 2026-07-31:
   * the collab form must have "the same mechanism we add a product
   * including the images"). Every request this component makes is prefixed
   * with this, so the collab screen reaches its own scoped routes
   * (CollabPortalController) instead of the admin-only ones.
   */
  mediaBasePath?: string;
}

/** Resolves the best available preview URL for a media row — the freshly
 * resolved Gallery URL if present, else the legacy Cloudinary derivation. */
function previewUrl(m: ProductMedia): string {
  if (m.url) return m.url;
  return cloudinaryPreviewUrl(m.cloudinaryPublicId);
}

export default function MediaSection({
  productId,
  productName,
  media,
  onMediaChange,
  mediaBasePath = '/catalog/admin',
}: Props) {
  const [mode, setMode] = useState<'device' | 'gallery'>('device');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<ProductMedia | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [coverSaving, setCoverSaving] = useState<string | null>(null);
  const [closingSaving, setClosingSaving] = useState<string | null>(null);
  const [reordering, setReordering] = useState<string | null>(null);
  // Per-image soft delete (task 39). A row only ever arrives with
  // `deletedAt` set when the signed-in viewer is SUPERADMIN — the server
  // never includes a deleted row for anyone else — so no extra role check
  // is needed here to decide whether to draw it as deleted.
  const [deleting, setDeleting] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const cropImage = useImageCrop();

  // The visible, changeable order the owner asked for (2026-07-31): every
  // general (non-variant) CAROUSEL image's position among its own siblings
  // — cover and closing sit outside this, their position IS their role.
  const carouselIds = media
    .filter((m) => m.role === 'CAROUSEL' && !m.variantId)
    .map((m) => m.id);

  // "Exchange" (task-w2.3-brief.md, Part A) — replaces a media row's picture
  // in place via PATCH /gallery/items/:id/file, so the ProductMedia row's own
  // id, role and sort order never change, only the bytes behind it. One
  // shared hidden input, retargeted per row via `exchangeTargetId` rather
  // than one input per card.
  const exchangeInputRef = useRef<HTMLInputElement>(null);
  const [exchangeTargetId, setExchangeTargetId] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState<string | null>(null);

  // Task FF (2026-07-30): the cropped bytes for a media row that was JUST
  // uploaded or exchanged in this session, keyed by media id — so its
  // thumbnail can render from local bytes instead of a guaranteed-cold-miss
  // remote URL. Rows never touched this session (the product's existing
  // media on first paint) have no entry here and fall back to plain retry.
  const [pendingLocalFiles, setPendingLocalFiles] = useState<Record<string, File>>({});

  /** Promote one image to the cover thumbnail; the old cover joins the carousel. */
  async function handleSetCover(m: ProductMedia) {
    if (m.role === 'COVER' || m.variantId) return;
    setError(null);
    setCoverSaving(m.id);
    try {
      await setProductMediaCover(productId, m.id, mediaBasePath);
      onMediaChange(
        media.map((x) => ({
          ...x,
          role: x.id === m.id ? 'COVER' : x.variantId ? x.role : 'CAROUSEL',
        })),
      );
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || 'Failed to set the cover image.');
    } finally {
      setCoverSaving(null);
    }
  }

  /**
   * Mark the photograph that ends the product page. The previous one drops back
   * into the carousel — at most one per product, same as the cover.
   *
   * The cover is excluded because an image holds one role: promoting it here
   * would strip the product's thumbnail from the shop grid, the bag and link
   * previews without saying so. The backend refuses it too; this just means the
   * button is never offered in the first place.
   */
  async function handleSetClosing(m: ProductMedia) {
    if (m.role === 'CLOSING' || m.role === 'COVER' || m.variantId) return;
    setError(null);
    setClosingSaving(m.id);
    try {
      await setProductMediaClosing(productId, m.id, mediaBasePath);
      onMediaChange(
        media.map((x) => ({
          ...x,
          role:
            x.id === m.id
              ? 'CLOSING'
              : x.variantId || x.role === 'COVER'
                ? x.role
                : x.role === 'CLOSING'
                  ? 'CAROUSEL'
                  : x.role,
        })),
      );
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || 'Failed to set the closing image.');
    } finally {
      setClosingSaving(null);
    }
  }

  /**
   * Swaps this carousel image with its neighbour (owner ask, 2026-07-31:
   * cover and closing already had a visible, changeable role — the rest of
   * the images had no visible order and no way to change it). Only offered
   * for a general CAROUSEL image with a neighbour on that side; the button
   * is simply absent past either end, so this never has to reject a no-op.
   */
  async function handleReorder(m: ProductMedia, direction: 'up' | 'down') {
    const pos = carouselIds.indexOf(m.id);
    if (pos === -1) return;
    const neighborPos = direction === 'up' ? pos - 1 : pos + 1;
    if (neighborPos < 0 || neighborPos >= carouselIds.length) return;
    const neighborId = carouselIds[neighborPos];

    setError(null);
    setReordering(m.id);
    try {
      await reorderProductMedia(productId, m.id, direction, mediaBasePath);
      // Swap BOTH the array position (what the grid below actually renders
      // in order) and the sortOrder value (what a fresh getProduct() would
      // return) — updating only one would look reordered here and then jump
      // back on the next reload, or vice versa.
      const aIdx = media.findIndex((x) => x.id === m.id);
      const bIdx = media.findIndex((x) => x.id === neighborId);
      if (aIdx === -1 || bIdx === -1) return;
      const next = [...media];
      const aSortOrder = next[aIdx].sortOrder;
      const bSortOrder = next[bIdx].sortOrder;
      next[aIdx] = { ...next[aIdx], sortOrder: bSortOrder };
      next[bIdx] = { ...next[bIdx], sortOrder: aSortOrder };
      [next[aIdx], next[bIdx]] = [next[bIdx], next[aIdx]];
      onMediaChange(next);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || 'Failed to reorder image.');
    } finally {
      setReordering(null);
    }
  }

  /**
   * Per-image soft delete (task 39, owner ask: "add a global delete per
   * image ... soft delete collab and soft delete for admin"). Never a
   * confirm-less click — this hides the photo from the storefront and every
   * other viewer immediately, so a mis-click needs a chance to be caught.
   * The row itself is dropped from the local list on success rather than
   * marked deleted in place: an ordinary ADMIN/STAFF/COLLAB viewer's product
   * read will never see it again on the next reload either (the server
   * excludes it), so there is nothing useful left to show here for them.
   */
  async function handleDelete(m: ProductMedia) {
    if (!window.confirm('Delete this image? It will be hidden everywhere, but can still be restored by a super admin.')) {
      return;
    }
    setError(null);
    setDeleting(m.id);
    try {
      await deleteProductMedia(productId, m.id, mediaBasePath);
      onMediaChange(media.filter((x) => x.id !== m.id));
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || 'Failed to delete image.');
    } finally {
      setDeleting(null);
    }
  }

  /**
   * Reverses a soft delete. Only ever offered on a row that already carries
   * `deletedAt` — which, per the comment on the `deleting`/`restoring` state
   * above, only a SUPERADMIN viewer's read ever includes. The server itself
   * also refuses this for anyone else (CatalogService.restoreMedia), so this
   * is a UI convenience, not the actual boundary.
   */
  async function handleRestore(m: ProductMedia) {
    setError(null);
    setRestoring(m.id);
    try {
      await restoreProductMedia(productId, m.id);
      onMediaChange(media.map((x) => (x.id === m.id ? { ...x, deletedAt: null } : x)));
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || 'Failed to restore image.');
    } finally {
      setRestoring(null);
    }
  }

  async function handleDeviceUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      // Device uploads still land in the user's own gallery — not
      // gallery-invisible — per spec Story 2, Acceptance Scenario 3.
      // Auto-organised into category → brand → product (task-w2.3-brief.md,
      // Part B) via the productId passed here — see
      // uploadDeviceFileToGallery's own doc comment for the fallback when
      // there's no product context.
      // Crop before upload — product photos share the app-wide crop step so a
      // cover and its carousel siblings can be framed consistently.
      const cropped = await cropImage(file, { title: `Crop ${file.name}` });
      if (!cropped) return;
      const item: GalleryItem = await uploadDeviceFileToGallery(
        cropped,
        productName,
        productId,
        mediaBasePath,
      );
      const asset = await createProductMedia(
        productId,
        { galleryItemId: item.id, sortOrder: media.length },
        mediaBasePath,
      );
      onMediaChange([...media, asset]);
      setPendingLocalFiles((prev) => ({ ...prev, [asset.id]: cropped }));
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  }

  /**
   * "Exchange" — swaps this row's picture for a different file without
   * touching its id, role, sort order or cover/closing status
   * (task-w2.3-brief.md, Part A). Only offered when the row is gallery-backed
   * (`galleryItemId` set); a handful of legacy rows still carry only a
   * `cloudinaryPublicId` from before the Gallery module existed and have no
   * gallery item to exchange.
   */
  async function handleExchange(mediaId: string, file: File) {
    const target = media.find((x) => x.id === mediaId);
    if (!target?.galleryItemId) return;
    setError(null);
    setExchanging(mediaId);
    try {
      const cropped = await cropImage(file, { title: `Crop replacement for ${file.name}` });
      if (!cropped) return;
      const updated = await exchangeItem(target.galleryItemId, cropped);
      onMediaChange(
        media.map((x) => (x.id === mediaId ? { ...x, url: updated.url } : x)),
      );
      setPendingLocalFiles((prev) => ({ ...prev, [mediaId]: cropped }));
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || 'Failed to exchange image.');
    } finally {
      setExchanging(null);
    }
  }

  async function handleGallerySelect(item: GalleryItem) {
    setPickerOpen(false);
    setError(null);
    try {
      const asset = await createProductMedia(
        productId,
        { galleryItemId: item.id, sortOrder: media.length },
        mediaBasePath,
      );
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
      <p className="dash-help-text" style={{ marginTop: 0 }}>
        The cover thumbnail is the one photo shoppers see in listings, the cart
        and shared links. Every other photo shows inside the product carousel.
      </p>

      {pickerOpen && (
        <GalleryPickerModal
          onSelect={handleGallerySelect}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <input
        ref={exchangeInputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,image/webp,video/mp4,video/quicktime"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && exchangeTargetId) handleExchange(exchangeTargetId, file);
          e.target.value = '';
        }}
        data-trace-id="PG-DASHBOARD-CAT-003::EL-INPUT-media-exchange-file"
      />

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
            <figure key={m.id} style={{ margin: 0, opacity: m.deletedAt ? 0.5 : 1 }}>
              <button
                type="button"
                onClick={() => setPreviewMedia(m)}
                aria-label="View full size"
                data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-enlarge-product-image@${m.id}`}
                style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
              >
                <UploadPreviewImage
                  src={previewUrl(m)}
                  localFile={pendingLocalFiles[m.id] ?? null}
                  alt={m.altText ?? ''}
                  data-trace-id={`PG-DASHBOARD-CAT-003::EL-IMG-product-image@${m.id}`}
                  style={{
                    width: '100%',
                    aspectRatio: '4/5',
                    objectFit: 'cover',
                    borderRadius: 'var(--mr-radius-sm)',
                    border: m.deletedAt
                      ? '1px dashed var(--mr-dash-danger, #b3261e)'
                      : '1px solid var(--mr-dash-hair)',
                  }}
                />
              </button>
              <figcaption
                className="dash-help-text"
                style={{ marginTop: 6, fontSize: 11, wordBreak: 'break-all' }}
              >
                {m.deletedAt ? (
                  // Task 39: only a SUPERADMIN's read ever includes a row
                  // with `deletedAt` set — everyone else's product read never
                  // sees this row at all. No cover/closing/reorder/exchange
                  // controls make sense on something already deleted; the
                  // only action offered is putting it back.
                  <>
                    <strong
                      style={{ display: 'block', color: 'var(--mr-dash-danger, #b3261e)' }}
                      data-trace-id={`PG-DASHBOARD-CAT-003::EL-LABEL-deleted-image@${m.id}`}
                    >
                      Deleted
                    </strong>
                    <button
                      type="button"
                      className="dash-btn-ghost"
                      style={{ display: 'block', padding: '2px 0', fontSize: 11 }}
                      disabled={restoring !== null}
                      onClick={() => handleRestore(m)}
                      data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-restore-product-image@${m.id}`}
                    >
                      {restoring === m.id ? 'Restoring…' : 'Restore image'}
                    </button>
                  </>
                ) : (
                  <>
                {m.role === 'COVER' ? (
                  <strong style={{ display: 'block', color: 'var(--mr-dash-accent, #8a6d3b)' }}>
                    Cover thumbnail
                  </strong>
                ) : m.role === 'CLOSING' ? (
                  <strong style={{ display: 'block', color: 'var(--mr-dash-accent, #8a6d3b)' }}>
                    Closes the page
                  </strong>
                ) : m.variantId ? (
                  <span style={{ display: 'block' }}>Variant image</span>
                ) : (
                  <>
                    {/* Owner ask, 2026-07-31: cover and closing already read
                        as explicit roles — the images between them need the
                        same clarity: which position they hold, and a way to
                        move them. */}
                    <span style={{ display: 'block', fontWeight: 600 }}>
                      Image {carouselIds.indexOf(m.id) + 1} of {carouselIds.length}
                    </span>
                    <span style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                      <button
                        type="button"
                        className="dash-btn-ghost"
                        style={{ padding: '2px 6px', fontSize: 11 }}
                        disabled={reordering !== null || carouselIds.indexOf(m.id) === 0}
                        onClick={() => handleReorder(m, 'up')}
                        title="Move earlier"
                        data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-move-image-up@${m.id}`}
                      >
                        {reordering === m.id ? '…' : '↑ Earlier'}
                      </button>
                      <button
                        type="button"
                        className="dash-btn-ghost"
                        style={{ padding: '2px 6px', fontSize: 11 }}
                        disabled={
                          reordering !== null ||
                          carouselIds.indexOf(m.id) === carouselIds.length - 1
                        }
                        onClick={() => handleReorder(m, 'down')}
                        title="Move later"
                        data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-move-image-down@${m.id}`}
                      >
                        {reordering === m.id ? '…' : '↓ Later'}
                      </button>
                    </span>
                    <button
                      type="button"
                      className="dash-btn-ghost"
                      style={{ display: 'block', padding: '2px 0', fontSize: 11 }}
                      disabled={coverSaving !== null}
                      onClick={() => handleSetCover(m)}
                      data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-set-cover-image@${m.id}`}
                    >
                      {coverSaving === m.id ? 'Setting…' : 'Set as cover'}
                    </button>
                    <button
                      type="button"
                      className="dash-btn-ghost"
                      style={{ display: 'block', padding: '2px 0', fontSize: 11 }}
                      disabled={closingSaving !== null}
                      onClick={() => handleSetClosing(m)}
                      title="The photograph the product page ends on"
                      data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-set-closing-image@${m.id}`}
                    >
                      {closingSaving === m.id ? 'Setting…' : 'Set as closing'}
                    </button>
                  </>
                )}
                {m.galleryItemId && (
                  <button
                    type="button"
                    className="dash-btn-ghost"
                    style={{ display: 'block', padding: '2px 0', fontSize: 11 }}
                    disabled={exchanging !== null}
                    onClick={() => {
                      setExchangeTargetId(m.id);
                      exchangeInputRef.current?.click();
                    }}
                    title="Replace this photo — everywhere it's used updates automatically"
                    data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-exchange-product-image@${m.id}`}
                  >
                    {exchanging === m.id ? 'Exchanging…' : 'Exchange'}
                  </button>
                )}
                <button
                  type="button"
                  className="dash-btn-ghost"
                  style={{
                    display: 'block',
                    padding: '2px 0',
                    fontSize: 11,
                    color: 'var(--mr-dash-danger, #b3261e)',
                  }}
                  disabled={deleting !== null}
                  onClick={() => handleDelete(m)}
                  title="Delete this image — hidden everywhere, restorable only by a super admin"
                  data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-delete-product-image@${m.id}`}
                >
                  {deleting === m.id ? 'Deleting…' : 'Delete image'}
                </button>
                  </>
                )}
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

'use client';

import React, { useRef, useState, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  listManagedBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  type ManagedBrand,
} from '@/lib/catalog/api';
import type { ApiError } from '@/lib/api/client';
import CatalogSubnav from '@/components/dashboard/CatalogSubnav';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import ImageField from '@/components/dashboard/ImageField';
import UploadPreviewImage from '@/components/dashboard/UploadPreviewImage';
import { uploadDeviceFileToGallery } from '@/components/dashboard/GalleryPickerModal';
import { useImageCrop } from '@/components/dashboard/ImageCropProvider';
import type { GalleryItem } from '@/lib/gallery/types';

const TRACE = 'PG-DASHBOARD-CAT-005';

interface BrandEditValues {
  name: string;
  slug: string;
  description: string;
}

interface BrandEditErrors {
  name?: string;
  slug?: string;
}

function validateBrandEdit(v: BrandEditValues): BrandEditErrors {
  const errors: BrandEditErrors = {};
  if (!v.name.trim()) errors.name = 'Name is required.';
  if (!v.slug.trim()) errors.slug = 'Slug is required.';
  return errors;
}

/**
 * The Brands row's edit view — image, name, slug, description, one Save.
 * Rendered into <body> via createPortal, same pattern as RefundOrderModal /
 * ManualOrderModal: .dash-dialog-overlay / .dash-dialog already exist, no
 * new modal CSS to invent.
 */
function BrandEditModal({
  brand,
  onClose,
  onSaved,
}: {
  brand: ManagedBrand;
  onClose: () => void;
  onSaved: (updated: ManagedBrand, localImageFile: File | null) => void;
}) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const [values, setValues] = useState<BrandEditValues>({
    name: brand.name,
    slug: brand.slug,
    description: brand.description ?? '',
  });
  const [errors, setErrors] = useState<BrandEditErrors>({});
  const [imageMediaId, setImageMediaId] = useState<string | null>(brand.imageMediaId);
  const [imageUrl, setImageUrl] = useState<string | null>(brand.imageUrl);
  // Bytes an in-modal Exchange just uploaded — shown in the ImageField's own
  // preview only; the row thumbnail gets its own copy via `onSaved` once this
  // is actually persisted, same reasoning as CategoryTree's `localImage`.
  const [localImageFile, setLocalImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function setField<K extends keyof BrandEditValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof BrandEditErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  // Dirtied, not just present — the warning is about CHANGING the slug, so a
  // field that still reads the brand's original slug has nothing to warn about.
  const slugDirty = values.slug.trim() !== brand.slug;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateBrandEdit(values);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    // One PATCH, only the fields that actually changed — not a blanket
    // resend of everything the modal happens to hold.
    const patch: Parameters<typeof updateBrand>[1] = {};
    if (values.name.trim() !== brand.name) patch.name = values.name.trim();
    if (values.slug.trim() !== brand.slug) patch.slug = values.slug.trim();
    const trimmedDescription = values.description.trim();
    if (trimmedDescription !== (brand.description ?? '')) {
      patch.description = trimmedDescription || null;
    }
    if (imageMediaId !== brand.imageMediaId) patch.imageMediaId = imageMediaId;

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    setSaveError(null);
    setSaving(true);
    try {
      const updated = await updateBrand(brand.id, patch);
      onSaved(updated, patch.imageMediaId !== undefined ? localImageFile : null);
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 409) {
        // A slug collision belongs on the Slug field, not as a generic toast
        // — it's the one field the error is actually about.
        setErrors((prev) => ({ ...prev, slug: err.message ?? 'That slug is already in use.' }));
      } else {
        setSaveError(err.message ?? 'Save failed.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="dash-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="brand-edit-title">
      <div className="dash-dialog" style={{ maxWidth: 520, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 id="brand-edit-title" className="dash-section-title" style={{ marginTop: 0 }}>
          Edit brand
        </h2>

        <form
          onSubmit={handleSave}
          noValidate
          data-trace-id={`${TRACE}::EL-FORM-edit-brand@${brand.id}`}
        >
          <ImageField
            label="Brand image"
            imageUrl={imageUrl}
            mediaId={imageMediaId}
            disabled={saving}
            onChange={(mediaId, item, localFile) => {
              setImageMediaId(mediaId);
              setImageUrl(item?.url ?? null);
              setLocalImageFile(localFile ?? null);
            }}
          />

          <div className="dash-field">
            <label className="dash-label" htmlFor={`brand-edit-name-${brand.id}`}>
              Name <span className="dash-required">*</span>
            </label>
            <input
              id={`brand-edit-name-${brand.id}`}
              className={`dash-input${errors.name ? ' dash-input-error' : ''}`}
              value={values.name}
              onChange={(e) => setField('name', e.target.value)}
              disabled={saving}
              autoFocus
              data-trace-id={`${TRACE}::EL-INPUT-edit-brand-name@${brand.id}`}
            />
            {errors.name && <p className="dash-field-error">{errors.name}</p>}
          </div>

          <div className="dash-field">
            <label className="dash-label" htmlFor={`brand-edit-slug-${brand.id}`}>
              Slug <span className="dash-required">*</span>
            </label>
            <input
              id={`brand-edit-slug-${brand.id}`}
              className={`dash-input${errors.slug ? ' dash-input-error' : ''}`}
              value={values.slug}
              onChange={(e) => setField('slug', e.target.value)}
              disabled={saving}
              data-trace-id={`${TRACE}::EL-INPUT-edit-brand-slug@${brand.id}`}
            />
            {errors.slug && <p className="dash-field-error">{errors.slug}</p>}
            {slugDirty && !errors.slug && (
              <p className="dash-help-text" style={{ color: 'var(--mr-st-warn-fg)' }}>
                Changing the slug breaks any existing links to this brand&apos;s page.
              </p>
            )}
          </div>

          <div className="dash-field">
            <label className="dash-label" htmlFor={`brand-edit-desc-${brand.id}`}>
              Description
            </label>
            <textarea
              id={`brand-edit-desc-${brand.id}`}
              className="dash-textarea"
              rows={4}
              value={values.description}
              onChange={(e) => setField('description', e.target.value)}
              disabled={saving}
              data-trace-id={`${TRACE}::EL-INPUT-edit-brand-description@${brand.id}`}
            />
          </div>

          {saveError && <p className="dash-inline-error">{saveError}</p>}
          <div className="dash-form-actions">
            <button
              type="button"
              className="dash-btn-secondary"
              onClick={onClose}
              disabled={saving}
              data-trace-id={`${TRACE}::EL-BTN-cancel-brand-edit@${brand.id}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="dash-btn-primary"
              disabled={saving}
              data-trace-id={`${TRACE}::EL-BTN-save-brand-edit@${brand.id}`}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function BrandRow({
  brand,
  onUpdated,
  onDeleted,
}: {
  brand: ManagedBrand;
  onUpdated: (updated: ManagedBrand) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Same cold-miss fix as CategoryTree's row thumbnail (2026-07-31): bytes for
  // a picture THIS row's brand was just given, tagged by media id so it drops
  // the instant the row points at a DIFFERENT image.
  const [localImage, setLocalImage] = useState<{ mediaId: string; file: File } | null>(null);
  const localImageFile =
    localImage && localImage.mediaId === brand.imageMediaId ? localImage.file : null;

  function handleSaved(updated: ManagedBrand, localImageFile: File | null) {
    setLocalImage(
      localImageFile && updated.imageMediaId
        ? { mediaId: updated.imageMediaId, file: localImageFile }
        : null,
    );
    onUpdated(updated);
    setEditing(false);
  }

  async function handleDelete() {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteBrand(brand.id);
      onDeleted();
    } catch (e) {
      const err = e as ApiError;
      setDeleteError(
        err.status === 409
          ? err.message ?? 'This brand is used by existing products — reassign them first.'
          : err.message ?? 'Delete failed.',
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <tr data-trace-id={`${TRACE}::EL-ROW-brand@${brand.id}`}>
        <td style={{ minWidth: 0 }}>
          {/* A real <button>, not a div with onClick — Enter/Space and a
              focus ring come for free, and it's the whole image+name cell so
              clicking the row (not a buried "Edit" link) opens the edit view. */}
          <button
            type="button"
            className="dash-row-activate"
            onClick={() => setEditing(true)}
            data-trace-id={`${TRACE}::EL-BTN-edit-brand@${brand.id}`}
          >
            {brand.imageUrl ? (
              <UploadPreviewImage
                src={brand.imageUrl}
                localFile={localImageFile}
                alt=""
                width={32}
                height={32}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 4,
                  // A brand image is a wordmark. 'cover' cropped wide logos to
                  // their middle, so the Brands list showed "BURB" next to the
                  // name "BURBERRY" (reported 2026-08-21). The backend now
                  // serves these as a fit resize rather than a square crop, and
                  // this places the whole thing inside its box.
                  objectFit: 'contain',
                  background: 'var(--mr-dash-sub, #f4f1ec)',
                  padding: 2,
                  flexShrink: 0,
                }}
              />
            ) : (
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 4,
                  flexShrink: 0,
                  display: 'inline-block',
                  background: 'var(--mr-dash-sub, #f4f1ec)',
                  border: '1px solid var(--mr-dash-hair)',
                }}
                title="No image yet"
              />
            )}
            <span style={{ minWidth: 0, overflowWrap: 'break-word' }}>{brand.name}</span>
          </button>
        </td>
        <td>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="dash-btn-ghost dash-btn-danger"
              onClick={handleDelete}
              disabled={deleting}
              data-trace-id={`${TRACE}::EL-BTN-delete-brand@${brand.id}`}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
          {deleteError && <p className="dash-field-error">{deleteError}</p>}
        </td>
      </tr>

      {editing && (
        <BrandEditModal brand={brand} onClose={() => setEditing(false)} onSaved={handleSaved} />
      )}
    </>
  );
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<ManagedBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Optional — the owner's distinction from a category, which MUST have one.
  // A brand with no image falls back to whatever the storefront already does
  // today for an imageless brand; nothing here invents a placeholder.
  const [newImageMediaId, setNewImageMediaId] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const deviceInputRef = useRef<HTMLInputElement>(null);
  const cropImage = useImageCrop();

  async function handleDeviceImage(file: File) {
    setImageError(null);
    setUploadingImage(true);
    try {
      const cropped = await cropImage(file, {
        initialAspect: 1,
        title: 'Crop brand image',
      });
      if (!cropped) return;
      const item: GalleryItem = await uploadDeviceFileToGallery(
        cropped,
        newName.trim() || 'Brand Photos',
      );
      setNewImageMediaId(item.id);
      setNewImageUrl(item.url);
    } catch (e) {
      const err = e as ApiError;
      setImageError(err.message ?? 'Failed to upload image.');
    } finally {
      setUploadingImage(false);
    }
  }

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      // Own makers only — a partner's brand row is created automatically when
      // the collaborator is onboarded and is managed under Collaborators, so
      // listing it here mixed two different things into one undivided list.
      const res = await listManagedBrands({ space: 'house' });
      setBrands(res.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      const err = e as ApiError;
      setLoadError(err.message ?? 'Failed to load brands.');
    } finally {
      setLoading(false);
    }
  }, []);

  useMountedEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      setAddError('Name is required.');
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      await createBrand(newName.trim(), {
        space: 'house',
        imageMediaId: newImageMediaId ?? undefined,
      });
      setNewName('');
      setNewImageMediaId(null);
      setNewImageUrl(null);
      setShowAddForm(false);
      await load();
    } catch (e) {
      const err = e as ApiError;
      setAddError(err.message ?? 'Failed to create brand.');
    } finally {
      setAdding(false);
    }
  }

  function handleUpdated(updated: ManagedBrand) {
    setBrands((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b)).sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  return (
    <>
      <div className="dash-page-header" data-trace-id={`${TRACE}::EL-REGION-brands-page-header`}>
        <div>
          <h1 className="dash-page-title">Brands</h1>
          <p className="dash-help-text" style={{ marginTop: 4 }}>
            Your own makers — Creed, Dior. Partner brands live under
            Collaborators. Not your shop&apos;s
            name.
          </p>
        </div>
        {!showAddForm && (
          <button
            type="button"
            className="dash-btn-primary"
            onClick={() => setShowAddForm(true)}
            data-trace-id={`${TRACE}::EL-BTN-show-add-brand-form`}
          >
            New Brand
          </button>
        )}
      </div>

      <CatalogSubnav />

      {showAddForm && (
        <form
          className="dash-form-card"
          onSubmit={handleCreate}
          noValidate
          data-trace-id={`${TRACE}::EL-FORM-add-brand`}
        >
          <div className="dash-field-row">
            <div className="dash-field">
              <label className="dash-label" htmlFor="brand-name">
                Brand name <span className="dash-required">*</span>
              </label>
              <input
                id="brand-name"
                className="dash-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Creed"
                disabled={adding}
                autoFocus
                data-trace-id={`${TRACE}::EL-INPUT-add-brand-name`}
              />
            </div>
          </div>

          <ImageField
            label="Brand image (optional)"
            imageUrl={newImageUrl}
            mediaId={newImageMediaId}
            disabled={adding || uploadingImage}
            onChange={(mediaId, item) => {
              setNewImageMediaId(mediaId);
              setNewImageUrl(item?.url ?? null);
            }}
          />
          <input
            ref={deviceInputRef}
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleDeviceImage(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="dash-btn-ghost"
            style={{ marginTop: -8, marginBottom: 16 }}
            disabled={adding || uploadingImage}
            onClick={() => deviceInputRef.current?.click()}
            data-trace-id={`${TRACE}::EL-BTN-upload-brand-image`}
          >
            {uploadingImage ? 'Uploading…' : 'Upload from this device'}
          </button>
          {imageError && <p className="dash-inline-error">{imageError}</p>}

          {addError && <p className="dash-inline-error">{addError}</p>}
          <div className="dash-form-actions">
            <button type="submit" className="dash-btn-primary" disabled={adding}>
              {adding ? 'Creating…' : 'Create Brand'}
            </button>
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={() => {
                setShowAddForm(false);
                setNewName('');
                setNewImageMediaId(null);
                setNewImageUrl(null);
                setImageError(null);
                setAddError(null);
              }}
              disabled={adding}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="dash-card" data-trace-id={`${TRACE}::EL-REGION-brands-loading`}>
          <span className="dash-skeleton" style={{ display: 'block', width: '40%', height: 18 }} />
        </div>
      ) : loadError ? (
        <div className="dash-card" data-trace-id={`${TRACE}::EL-REGION-brands-load-error`}>
          <p className="dash-inline-error">{loadError}</p>
          <button className="dash-btn-secondary" style={{ marginTop: 12 }} onClick={load}>
            Retry
          </button>
        </div>
      ) : brands.length === 0 ? (
        <p className="dash-help-text">No brands yet. Add your first brand above.</p>
      ) : (
        <div
          className="dash-card"
          style={{ padding: 0, overflow: 'hidden' }}
          data-trace-id={`${TRACE}::EL-TABLE-brands`}
        >
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <BrandRow key={b.id} brand={b} onUpdated={handleUpdated} onDeleted={load} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import React, { useRef, useState, useCallback } from 'react';
import {
  listManagedBrands,
  createBrand,
  renameBrand,
  deleteBrand,
  type ManagedBrand,
} from '@/lib/catalog/api';
import type { ApiError } from '@/lib/api/client';
import CatalogSubnav from '@/components/dashboard/CatalogSubnav';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import ImageField from '@/components/dashboard/ImageField';
import { uploadDeviceFileToGallery } from '@/components/dashboard/GalleryPickerModal';
import { useImageCrop } from '@/components/dashboard/ImageCropProvider';
import type { GalleryItem } from '@/lib/gallery/types';

const TRACE = 'PG-DASHBOARD-CAT-005';

function BrandRow({
  brand,
  onRenamed,
  onDeleted,
}: {
  brand: ManagedBrand;
  onRenamed: (updated: ManagedBrand) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(brand.name);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await renameBrand(brand.id, name.trim());
      onRenamed(updated);
      setEditing(false);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message ?? 'Rename failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      await deleteBrand(brand.id);
      onDeleted();
    } catch (e) {
      const err = e as ApiError;
      setError(
        err.status === 409
          ? err.message ?? 'This brand is used by existing products — reassign them first.'
          : err.message ?? 'Delete failed.',
      );
    } finally {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <tr data-trace-id={`${TRACE}::EL-ROW-brand-editing@${brand.id}`}>
        <td colSpan={2}>
          <form
            className="dash-inline-form"
            onSubmit={handleRename}
            data-trace-id={`${TRACE}::EL-FORM-rename-brand@${brand.id}`}
          >
            <input
              className="dash-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              autoFocus
              data-trace-id={`${TRACE}::EL-INPUT-rename-brand-name@${brand.id}`}
            />
            <button type="submit" className="dash-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={() => {
                setEditing(false);
                setName(brand.name);
                setError(null);
              }}
              disabled={saving}
            >
              Cancel
            </button>
            {error && <p className="dash-field-error">{error}</p>}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr data-trace-id={`${TRACE}::EL-ROW-brand@${brand.id}`}>
      <td>{brand.name}</td>
      <td>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="dash-btn-ghost"
            onClick={() => setEditing(true)}
            data-trace-id={`${TRACE}::EL-BTN-rename-brand@${brand.id}`}
          >
            Rename
          </button>
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
        {error && <p className="dash-field-error">{error}</p>}
      </td>
    </tr>
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

  function handleRenamed(updated: ManagedBrand) {
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
                  <BrandRow key={b.id} brand={b} onRenamed={handleRenamed} onDeleted={load} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

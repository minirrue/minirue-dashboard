'use client';

import React, { useRef, useState } from 'react';
import ImageField from '@/components/dashboard/ImageField';
import { uploadDeviceFileToGallery } from '@/components/dashboard/GalleryPickerModal';
import { useImageCrop } from '@/components/dashboard/ImageCropProvider';
import type { GalleryItem } from '@/lib/gallery/types';
import type { ApiError } from '@/lib/api/client';

/**
 * A category node this tree can render. MiniRue's own `Category` (lib/catalog/types)
 * and a collaborator's `CollabCategory` (lib/api/collab-portal) both already
 * shape-match this — same nesting, same image fields — which is what makes one
 * tree component usable for both without a second implementation to drift.
 */
export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  children?: CategoryTreeNode[];
  imageUrl?: string | null;
  imageMediaId?: string | null;
}

/**
 * Space-agnostic on purpose (Task 20): the tree itself never imports an API
 * client. Each hosting screen (MiniRue's own Categories tab, a partner's own
 * Categories screen, or an admin auditing one partner's space) passes the
 * functions that already know which space and which backend they talk to.
 */
export interface CategoryTreeApi<T extends CategoryTreeNode = CategoryTreeNode> {
  update(
    id: string,
    data: { name?: string; slug?: string; sortOrder?: number; imageMediaId?: string },
  ): Promise<T>;
  remove(id: string): Promise<void>;
}

interface CategoryRowProps<T extends CategoryTreeNode> {
  category: T;
  depth: number;
  api: CategoryTreeApi<T>;
  showSlugField: boolean;
  onUpdated: (updated: T) => void;
  onDeleted: () => void;
}

interface EditValues {
  name: string;
  slug: string;
  sortOrder: string;
}

interface EditErrors {
  name?: string;
  slug?: string;
}

function validateEdit(v: EditValues, showSlugField: boolean): EditErrors {
  const errors: EditErrors = {};
  if (!v.name.trim()) errors.name = 'Name is required.';
  if (showSlugField && !v.slug.trim()) errors.slug = 'Slug is required.';
  return errors;
}

function CategoryRow<T extends CategoryTreeNode>({
  category,
  depth,
  api,
  showSlugField,
  onUpdated,
  onDeleted,
}: CategoryRowProps<T>) {
  const [expanded, setExpanded] = useState(depth === 0);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<EditValues>({
    name: category.name,
    slug: category.slug,
    sortOrder: String(category.sortOrder),
  });
  const [errors, setErrors] = useState<EditErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const deviceInputRef = useRef<HTMLInputElement>(null);
  const cropImage = useImageCrop();

  const hasChildren = (category.children ?? []).length > 0;
  const childCount = category.children?.length ?? 0;

  function setField<K extends keyof EditValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof EditErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateEdit(values, showSlugField);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await api.update(category.id, {
        name: values.name.trim(),
        ...(showSlugField ? { slug: values.slug.trim() } : {}),
        sortOrder: Number(values.sortOrder) || 0,
      });
      onUpdated(updated);
      setEditing(false);
    } catch (e) {
      const err = e as ApiError;
      setSaveError(err.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  /** The shop shows categories as picture tiles — a category without one
   *  renders as an empty square, which is the whole reason it is required. */
  async function handleDeviceImage(file: File) {
    setImageError(null);
    setUploadingImage(true);
    try {
      const cropped = await cropImage(file, {
        initialAspect: 1,
        title: 'Crop category image',
      });
      if (!cropped) return;
      const item: GalleryItem = await uploadDeviceFileToGallery(cropped, category.name);
      const updated = await api.update(category.id, { imageMediaId: item.id });
      onUpdated(updated);
    } catch (e) {
      const err = e as ApiError;
      setImageError(err.message ?? 'Failed to upload image.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleGalleryPick(mediaId: string | null) {
    // A category can never end up imageless — refuse the "Remove" affordance
    // ImageField would otherwise offer, same rule as at create time.
    if (!mediaId) {
      setImageError('A category must always have a picture — choose a different one instead of removing it.');
      return;
    }
    setImageError(null);
    setUploadingImage(true);
    try {
      const updated = await api.update(category.id, { imageMediaId: mediaId });
      onUpdated(updated);
    } catch (e) {
      const err = e as ApiError;
      setImageError(err.message ?? 'Failed to save that image.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleDelete() {
    setDeleteError(null);
    setDeleting(true);
    try {
      await api.remove(category.id);
      onDeleted();
    } catch (e) {
      const err = e as ApiError;
      setDeleteError(
        err.status === 409
          ? err.message ?? 'This category has subcategories or products assigned — remove them first.'
          : err.message ?? 'Delete failed.',
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <tr className="dash-cat-row" data-trace-id={`PG-DASHBOARD-CAT-004::EL-ROW-category-row@${category.id}`}>
        {/* Indent is capped with a viewport-scaled step (min(20px, 4vw)) so a
            deeply nested row still leaves room for its own name on a 320px
            screen instead of marching the text off the right edge. */}
        <td style={{ paddingLeft: `calc(14px + ${depth} * min(20px, 4vw))`, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
            {hasChildren ? (
              <button
                type="button"
                className="dash-tree-toggle"
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? 'Collapse' : 'Expand'}
                data-trace-id={`PG-DASHBOARD-CAT-004::EL-BTN-toggle-category-expand@${category.id}`}
              >
                {expanded ? '▾' : '▸'}
              </button>
            ) : (
              <span style={{ display: 'inline-block', width: 18, flexShrink: 0 }} />
            )}
            {category.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={category.imageUrl}
                alt=""
                width={28}
                height={28}
                style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  flexShrink: 0,
                  display: 'inline-block',
                  background: 'var(--mr-dash-sub, #f4f1ec)',
                  border: '1px solid var(--mr-dash-hair)',
                }}
                title="No image yet"
              />
            )}
            <span style={{ minWidth: 0, overflowWrap: 'break-word' }}>{category.name}</span>
          </div>
        </td>
        <td>
          <code className="dash-slug">{category.slug}</code>
        </td>
        <td style={{ textAlign: 'right' }}>
          {childCount > 0 ? childCount : <span style={{ color: 'var(--mr-fg-4)' }}>—</span>}
        </td>
        <td>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={() => deviceInputRef.current?.click()}
              disabled={uploadingImage}
              data-trace-id={`PG-DASHBOARD-CAT-004::EL-BTN-change-category-image@${category.id}`}
            >
              {uploadingImage ? 'Uploading…' : 'Change image'}
            </button>
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
              onClick={() => {
                setEditing((v) => !v);
                setSaveError(null);
              }}
              data-trace-id={`PG-DASHBOARD-CAT-004::EL-BTN-edit-category@${category.id}`}
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
            <button
              type="button"
              className="dash-btn-ghost dash-btn-danger"
              onClick={handleDelete}
              disabled={deleting}
              data-trace-id={`PG-DASHBOARD-CAT-004::EL-BTN-delete-category@${category.id}`}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
          {deleteError && <p className="dash-field-error">{deleteError}</p>}
          {imageError && <p className="dash-field-error">{imageError}</p>}
        </td>
      </tr>

      {editing && (
        <tr>
          <td colSpan={4} style={{ background: 'var(--mr-dash-sub)', padding: '12px 14px' }}>
            <form
              className="dash-inline-form"
              onSubmit={handleSave}
              noValidate
              data-trace-id={`PG-DASHBOARD-CAT-004::EL-FORM-edit-category-form@${category.id}`}
            >
              <div className="dash-field-row">
                <div className="dash-field">
                  <label className="dash-label" htmlFor={`cat-name-${category.id}`}>
                    Name <span className="dash-required">*</span>
                  </label>
                  <input
                    id={`cat-name-${category.id}`}
                    className={`dash-input${errors.name ? ' dash-input-error' : ''}`}
                    value={values.name}
                    onChange={(e) => setField('name', e.target.value)}
                    disabled={saving}
                    data-trace-id={`PG-DASHBOARD-CAT-004::EL-INPUT-edit-category-name@${category.id}`}
                  />
                  {errors.name && <p className="dash-field-error">{errors.name}</p>}
                </div>
                {showSlugField && (
                  <div className="dash-field">
                    <label className="dash-label" htmlFor={`cat-slug-${category.id}`}>
                      Slug <span className="dash-required">*</span>
                    </label>
                    <input
                      id={`cat-slug-${category.id}`}
                      className={`dash-input${errors.slug ? ' dash-input-error' : ''}`}
                      value={values.slug}
                      onChange={(e) => setField('slug', e.target.value)}
                      disabled={saving}
                      data-trace-id={`PG-DASHBOARD-CAT-004::EL-INPUT-edit-category-slug@${category.id}`}
                    />
                    {errors.slug && <p className="dash-field-error">{errors.slug}</p>}
                  </div>
                )}
                <div className="dash-field">
                  <label className="dash-label" htmlFor={`cat-sort-${category.id}`}>
                    Sort Order
                  </label>
                  <input
                    id={`cat-sort-${category.id}`}
                    type="number"
                    className="dash-input"
                    value={values.sortOrder}
                    onChange={(e) => setField('sortOrder', e.target.value)}
                    disabled={saving}
                    data-trace-id={`PG-DASHBOARD-CAT-004::EL-INPUT-edit-category-sort-order@${category.id}`}
                  />
                </div>
              </div>

              <ImageField
                label="Image"
                imageUrl={category.imageUrl ?? null}
                mediaId={category.imageMediaId ?? null}
                disabled={saving || uploadingImage}
                onChange={(mediaId) => void handleGalleryPick(mediaId)}
              />

              {saveError && <p className="dash-inline-error">{saveError}</p>}
              <div className="dash-form-actions">
                <button
                  type="submit"
                  className="dash-btn-primary"
                  disabled={saving}
                  data-trace-id={`PG-DASHBOARD-CAT-004::EL-BTN-save-category-edit@${category.id}`}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="dash-btn-ghost"
                  onClick={() => { setEditing(false); setSaveError(null); }}
                  disabled={saving}
                  data-trace-id={`PG-DASHBOARD-CAT-004::EL-BTN-cancel-category-edit@${category.id}`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </td>
        </tr>
      )}

      {expanded &&
        hasChildren &&
        (category.children ?? []).map((child) => (
          <CategoryRow
            key={child.id}
            category={child as T}
            depth={depth + 1}
            api={api}
            showSlugField={showSlugField}
            onUpdated={onUpdated}
            onDeleted={onDeleted}
          />
        ))}
    </>
  );
}

interface Props<T extends CategoryTreeNode = CategoryTreeNode> {
  categories: T[];
  api: CategoryTreeApi<T>;
  /** Off for a backend whose categories have no separate slug to edit
   *  in-place (the collab portal). */
  showSlugField?: boolean;
  onCategoryUpdated: (updated: T) => void;
  onCategoryDeleted: () => void;
}

export default function CategoryTree<T extends CategoryTreeNode = CategoryTreeNode>({
  categories,
  api,
  showSlugField = true,
  onCategoryUpdated,
  onCategoryDeleted,
}: Props<T>) {
  if (categories.length === 0) {
    return (
      <p className="dash-help-text" style={{ padding: '20px 0' }}>
        No categories yet. Add your first category above.
      </p>
    );
  }

  return (
    <div
      className="dash-card"
      style={{ padding: 0, overflow: 'hidden' }}
      data-trace-id="PG-DASHBOARD-CAT-004::EL-TABLE-categories-tree"
    >
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th style={{ textAlign: 'right' }}>Children</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <CategoryRow
                key={cat.id}
                category={cat}
                depth={0}
                api={api}
                showSlugField={showSlugField}
                onUpdated={onCategoryUpdated}
                onDeleted={onCategoryDeleted}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

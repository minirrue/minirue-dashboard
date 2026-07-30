'use client';

import React, { useRef, useState } from 'react';
import ImageField from '@/components/dashboard/ImageField';
import { uploadDeviceFileToGallery } from '@/components/dashboard/GalleryPickerModal';
import { useImageCrop } from '@/components/dashboard/ImageCropProvider';
import type { GalleryItem } from '@/lib/gallery/types';
import type { ApiError } from '@/lib/api/client';

/**
 * The owner's words: a category with no image is a prohibited business rule.
 * This form is the one place a category gets created, in any space, so this
 * is the one place that rule has to be enforced — Create stays disabled until
 * a picture is attached, with no way around it.
 *
 * Reused as-is by the collaborator's own Categories screen (Task 20) with
 * `showSlugField`/`showSortOrderField` off, since that backend derives the
 * slug and doesn't take an explicit sort order on create.
 */

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export interface NewCategoryInput {
  name: string;
  slug?: string;
  parentId?: string;
  sortOrder?: number;
  /** Never optional in practice — Create is disabled until this is set — but
   *  typed as required so a caller can't accidentally omit it either. */
  imageMediaId: string;
}

export interface ParentOption {
  id: string;
  name: string;
  depth: number;
}

interface Props {
  parentOptions: ParentOption[];
  /** Off for a backend that derives the slug itself (the collab portal). */
  showSlugField?: boolean;
  /** Off for a backend that doesn't take an explicit sort order on create. */
  showSortOrderField?: boolean;
  onCreate: (input: NewCategoryInput) => Promise<unknown>;
  /** Called after a successful create so the caller can reload its list. */
  onCreated: () => void;
  traceId: string;
}

export default function NewCategoryForm({
  parentOptions,
  showSlugField = true,
  showSortOrderField = true,
  onCreate,
  onCreated,
  traceId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [imageMediaId, setImageMediaId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; slug?: string; image?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const deviceInputRef = useRef<HTMLInputElement>(null);
  const cropImage = useImageCrop();

  function reset() {
    setName('');
    setSlug('');
    setParentId('');
    setSortOrder('0');
    setImageMediaId(null);
    setImageUrl(null);
    setErrors({});
    setSubmitError(null);
    setImageError(null);
  }

  function setNameField(value: string) {
    setName(value);
    if (showSlugField) setSlug(slugify(value));
    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
  }

  async function handleDeviceImage(file: File) {
    setImageError(null);
    setUploadingImage(true);
    try {
      // Category tiles render 480×480 — locked to a 1:1 crop so nothing the
      // owner frames square gets squashed into a rectangle by the tile later.
      const cropped = await cropImage(file, {
        initialAspect: 1,
        title: 'Crop category image',
      });
      if (!cropped) return;
      const item: GalleryItem = await uploadDeviceFileToGallery(
        cropped,
        name.trim() || 'Category Photos',
      );
      setImageMediaId(item.id);
      setImageUrl(item.url);
      setErrors((prev) => ({ ...prev, image: undefined }));
    } catch (e) {
      setImageError((e as ApiError).message ?? 'Failed to upload image.');
    } finally {
      setUploadingImage(false);
    }
  }

  const canSubmit = name.trim().length > 0 && !!imageMediaId && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Name is required.';
    if (showSlugField && !slug.trim()) errs.slug = 'Slug is required.';
    if (!imageMediaId) errs.image = 'A category needs a picture before it can be created.';
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        slug: showSlugField ? slug.trim() : undefined,
        parentId: parentId || undefined,
        sortOrder: showSortOrderField ? Number(sortOrder) || 0 : undefined,
        imageMediaId: imageMediaId!,
      });
      reset();
      setOpen(false);
      onCreated();
    } catch (e) {
      setSubmitError((e as ApiError).message ?? 'Failed to create category.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="dash-page-header" data-trace-id={`${traceId}::EL-REGION-add-category-toggle`}>
        <button
          className="dash-btn-primary"
          onClick={() => setOpen(true)}
          data-trace-id={`${traceId}::EL-BTN-show-add-category-form`}
        >
          Add Category
        </button>
      </div>
    );
  }

  return (
    <form
      className="dash-form-card"
      onSubmit={handleSubmit}
      noValidate
      data-trace-id={`${traceId}::EL-FORM-add-category-form`}
    >
      <h2 className="dash-section-title" style={{ marginBottom: 16 }}>
        New Category
      </h2>
      <div className="dash-field-row">
        <div className="dash-field">
          <label className="dash-label" htmlFor="cat-name">
            Name <span className="dash-required">*</span>
          </label>
          <input
            id="cat-name"
            className={`dash-input${errors.name ? ' dash-input-error' : ''}`}
            value={name}
            onChange={(e) => setNameField(e.target.value)}
            placeholder="e.g. Woody"
            disabled={submitting}
            autoFocus
            data-trace-id={`${traceId}::EL-INPUT-add-category-name`}
          />
          {errors.name && <p className="dash-field-error">{errors.name}</p>}
        </div>
        {showSlugField && (
          <div className="dash-field">
            <label className="dash-label" htmlFor="cat-slug">
              Slug <span className="dash-required">*</span>
            </label>
            <input
              id="cat-slug"
              className={`dash-input${errors.slug ? ' dash-input-error' : ''}`}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="woody"
              disabled={submitting}
              data-trace-id={`${traceId}::EL-INPUT-add-category-slug`}
            />
            {errors.slug && <p className="dash-field-error">{errors.slug}</p>}
          </div>
        )}
      </div>
      <div className="dash-field-row">
        <div className="dash-field">
          <label className="dash-label" htmlFor="cat-parent">
            Parent Category
          </label>
          <select
            id="cat-parent"
            className="dash-select"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            disabled={submitting}
            data-trace-id={`${traceId}::EL-SELECT-add-category-parent`}
          >
            <option value="">None (top-level)</option>
            {parentOptions.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {'  '.repeat(cat.depth)}
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        {showSortOrderField && (
          <div className="dash-field">
            <label className="dash-label" htmlFor="cat-sort">
              Sort Order
            </label>
            <input
              id="cat-sort"
              type="number"
              className="dash-input"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              disabled={submitting}
              data-trace-id={`${traceId}::EL-INPUT-add-category-sort-order`}
            />
          </div>
        )}
      </div>

      <ImageField
        label="Image *"
        helpText="Required — shown as this category's 480×480 tile on the shop."
        imageUrl={imageUrl}
        mediaId={imageMediaId}
        disabled={submitting || uploadingImage}
        onChange={(mediaId, item) => {
          // A category can never end up imageless — ImageField's own "Remove"
          // affordance is refused here rather than reused unguarded.
          if (!mediaId) {
            setImageError('A category must always have a picture — choose a different one instead of removing it.');
            return;
          }
          setImageMediaId(mediaId);
          setImageUrl(item?.url ?? null);
          setErrors((prev) => ({ ...prev, image: undefined }));
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
        disabled={submitting || uploadingImage}
        onClick={() => deviceInputRef.current?.click()}
        data-trace-id={`${traceId}::EL-BTN-upload-category-image`}
      >
        {uploadingImage ? 'Uploading…' : 'Upload from this device'}
      </button>
      {errors.image && <p className="dash-field-error">{errors.image}</p>}
      {imageError && <p className="dash-inline-error">{imageError}</p>}

      {submitError && <p className="dash-inline-error">{submitError}</p>}

      <div className="dash-form-actions">
        <button
          type="submit"
          className="dash-btn-primary"
          disabled={!canSubmit}
          data-trace-id={`${traceId}::EL-BTN-create-category`}
        >
          {submitting ? 'Creating…' : 'Create Category'}
        </button>
        <button
          type="button"
          className="dash-btn-ghost"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          disabled={submitting}
          data-trace-id={`${traceId}::EL-BTN-cancel-add-category`}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

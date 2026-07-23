'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getProduct,
  updateProduct,
  publishProduct,
  archiveProduct,
  listCategories,
  listManagedBrands,
  softDeleteProduct,
  hardDeleteProduct,
  cloudinaryPreviewUrl,
} from '@/lib/catalog/api';
import type { Product, ProductVariant, ProductMedia } from '@/lib/catalog/types';
import ProductClassification, {
  type ClassificationValue,
} from '@/components/dashboard/ProductClassification';
import type { ApiError } from '@/lib/api/client';
import StatusBadge from '@/components/dashboard/StatusBadge';
import type { StatusKind } from '@/components/dashboard/StatusBadge';
import DeleteChoiceDialog from '@/components/dashboard/DeleteChoiceDialog';
import VariantsSection from './VariantsSection';
import MediaSection from './MediaSection';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

/* ── Types ── */
interface FormValues {
  name: string;
  description: string;
  /** Where the item sits in the tree, plus its option-list picks. */
  classification: ClassificationValue;
}

interface FormErrors {
  name?: string;
  categoryId?: string;
  brandId?: string;
}

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.name.trim()) errors.name = 'Product name is required.';
  if (!values.classification.categoryId)
    errors.categoryId = 'Category is required.';
  if (!values.classification.brandId) errors.brandId = 'Brand is required.';
  return errors;
}

/** Resolves the best available preview URL for a media row — the freshly
 * resolved Gallery URL if present, else the legacy Cloudinary derivation
 * (mirrors MediaSection.tsx's previewUrl helper). */
function mediaPreviewUrl(m: ProductMedia): string {
  if (m.url) return m.url;
  return cloudinaryPreviewUrl(m.cloudinaryPublicId);
}

/* ── Skeleton loader ── */
function EditSkeleton() {
  return (
    <div className="dash-form-card" data-trace-id="PG-DASHBOARD-CAT-003::EL-REGION-edit-product-skeleton">
      {[200, 140, 300, 160].map((w, i) => (
        <div key={i} className="dash-field">
          <span className="dash-skeleton" style={{ width: 80, marginBottom: 6, display: 'block' }} />
          <span className="dash-skeleton" style={{ width: w, height: 36, display: 'block' }} />
        </div>
      ))}
    </div>
  );
}

/* ── Confirm dialog ── */
interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="dash-dialog-overlay">
      <div className="dash-dialog" data-trace-id="PG-DASHBOARD-CAT-003::EL-MODAL-archive-confirm">
        <p className="dash-dialog-message">{message}</p>
        <div className="dash-form-actions">
          <button
            className="dash-btn-danger"
            onClick={onConfirm}
            data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-archive-confirm-yes"
          >
            Confirm
          </button>
          <button
            className="dash-btn-ghost"
            onClick={onCancel}
            data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-archive-confirm-cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ── */
export default function EditProductPage() {
  const params = useParams();
  const id = (params.slug ?? params.id) as string;
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [values, setValues] = useState<FormValues>({
    name: '',
    description: '',
    classification: { categoryId: '', brandId: '' },
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [media, setMedia] = useState<ProductMedia[]>([]);
  // Added for the Gallery module (specs/006-gallery-module, US3): which
  // variant's photos are currently being viewed. null = no variant selected,
  // show general (non-variant-specific) images only.
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  // Pure client-side filter of the already-fetched `media` array — no new
  // network request on variant switch (spec SC-003: under 1 second, no
  // full-page reload). Falls back to general (variantId === null) images
  // when the selected variant has none of its own (Acceptance Scenario 3).
  const displayedMedia = useMemo(() => {
    if (!selectedVariantId) {
      return media.filter((m) => m.variantId === null);
    }
    const variantMedia = media.filter((m) => m.variantId === selectedVariantId);
    return variantMedia.length > 0
      ? variantMedia
      : media.filter((m) => m.variantId === null);
  }, [media, selectedVariantId]);

  /* Load product */
  useMountedEffect(() => {
    setLoading(true);
    setLoadError(null);
    getProduct(id)
      .then((p) => {
        setProduct(p);
        setValues({
          name: p.name,
          description: p.description ?? '',
          classification: {
            categoryId: p.categoryId,
            brandId: p.brandId,
          },
        });
        setVariants(p.variants);
        setMedia(p.media ?? []);
      })
      .catch((e: ApiError) => setLoadError(e.message ?? 'Failed to load product.'))
      .finally(() => setLoading(false));
  }, [id]);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(values);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await updateProduct(id, {
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        brandId: values.classification.brandId,
        categoryId: values.classification.categoryId,
      });
      setProduct(updated);
      setSavedAt(new Date());
    } catch (e) {
      const err = e as ApiError;
      setSaveError(err.message ?? 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishError(null);
    setPublishing(true);
    try {
      const updated = await publishProduct(id);
      setProduct(updated);
    } catch (e) {
      const err = e as ApiError;
      setPublishError(err.message ?? 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  }

  async function handleArchive() {
    setShowArchiveConfirm(false);
    setArchiving(true);
    try {
      await archiveProduct(id);
      router.push('/products');
    } catch (e) {
      const err = e as ApiError;
      setPublishError(err.message ?? 'Archive failed.');
      setArchiving(false);
    }
  }

  async function handleSoftDelete() {
    await softDeleteProduct(id);
    setShowDeleteDialog(false);
    router.push('/products');
  }

  async function handleHardDelete() {
    await hardDeleteProduct(id);
    setShowDeleteDialog(false);
    router.push('/products');
  }

  if (loading) {
    return (
      <>
        <div className="dash-page-header">
          <h1 className="dash-page-title">Edit Product</h1>
          <Link href="/products" className="dash-btn-ghost">Back to Products</Link>
        </div>
        <EditSkeleton />
      </>
    );
  }

  if (loadError || !product) {
    return (
      <>
        <div className="dash-page-header">
          <h1 className="dash-page-title">Edit Product</h1>
        </div>
        <div className="dash-card">
          <p className="dash-inline-error">{loadError ?? 'Product not found.'}</p>
          <Link href="/products" className="dash-btn-ghost" style={{ marginTop: 12, display: 'inline-block' }}>
            Back to Products
          </Link>
        </div>
      </>
    );
  }

  const statusKind = product.status.toLowerCase() as StatusKind;

  return (
    <>
      {showArchiveConfirm && (
        <ConfirmDialog
          message={`Archive "${product.name}"? It will no longer be visible on the storefront.`}
          onConfirm={handleArchive}
          onCancel={() => setShowArchiveConfirm(false)}
        />
      )}

      {showDeleteDialog && (
        <DeleteChoiceDialog
          productName={product.name}
          onSoftDelete={handleSoftDelete}
          onHardDelete={handleHardDelete}
          onCancel={() => setShowDeleteDialog(false)}
          traceIdPrefix="PG-DASHBOARD-CAT-003::EL-MODAL-delete-product-confirm"
        />
      )}

      <div className="dash-page-header" data-trace-id="PG-DASHBOARD-CAT-003::EL-REGION-edit-product-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 className="dash-page-title">{product.name}</h1>
          <span data-trace-id="PG-DASHBOARD-CAT-003::EL-BADGE-product-status-edit">
            <StatusBadge status={statusKind} />
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {product.status !== 'PUBLISHED' && (
            <button
              className="dash-btn-ok"
              disabled={publishing || archiving}
              onClick={handlePublish}
              data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-publish-product-edit"
            >
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          )}
          {product.status !== 'ARCHIVED' && (
            <button
              className="dash-btn-ghost dash-btn-muted"
              disabled={publishing || archiving}
              onClick={() => setShowArchiveConfirm(true)}
              data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-archive-product-edit"
            >
              Archive
            </button>
          )}
          <button
            className="dash-btn-ghost dash-btn-danger"
            disabled={publishing || archiving}
            onClick={() => setShowDeleteDialog(true)}
            data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-delete-product-edit"
          >
            Delete
          </button>
          <Link
            href="/products"
            className="dash-btn-ghost"
            data-trace-id="PG-DASHBOARD-CAT-003::EL-LINK-back-to-products"
          >
            Back
          </Link>
        </div>
      </div>

      {publishError && (
        <p
          className="dash-inline-error"
          style={{ marginBottom: 16 }}
          data-trace-id="PG-DASHBOARD-CAT-003::EL-REGION-publish-error"
        >
          {publishError}
        </p>
      )}

      <form
        className="dash-form-card"
        onSubmit={handleSave}
        noValidate
        data-trace-id="PG-DASHBOARD-CAT-003::EL-FORM-edit-product-form"
      >
        {/* Name */}
        <div className="dash-field">
          <label className="dash-label" htmlFor="name">
            Name <span className="dash-required">*</span>
          </label>
          <input
            id="name"
            className={`dash-input${errors.name ? ' dash-input-error' : ''}`}
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
            disabled={saving}
            data-trace-id="PG-DASHBOARD-CAT-003::EL-INPUT-edit-product-name"
          />
          {errors.name && <p className="dash-field-error">{errors.name}</p>}
        </div>

        {/* Description */}
        <div className="dash-field">
          <label className="dash-label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            className="dash-textarea"
            rows={4}
            value={values.description}
            onChange={(e) => setField('description', e.target.value)}
            disabled={saving}
            data-trace-id="PG-DASHBOARD-CAT-003::EL-FIELD-edit-product-description"
          />
        </div>

        {/* Category -> Brand, then whatever option lists that category uses.
            Replaces the old free-text brand select, the hardcoded gender list
            and the multi-select category checkboxes — an item sits in exactly
            one category now (specs 2026-07-22-product-tree). */}
        <ProductClassification
          value={values.classification}
          onChange={(next) => {
            setValues((prev) => ({ ...prev, classification: next }));
            setErrors((prev) => ({
              ...prev,
              categoryId: undefined,
              brandId: undefined,
            }));
          }}
          disabled={saving}
          errors={{ categoryId: errors.categoryId, brandId: errors.brandId }}
          tracePrefix="PG-DASHBOARD-CAT-003"
        />

        {saveError && <p className="dash-inline-error">{saveError}</p>}

        <div className="dash-form-actions">
          <button
            type="submit"
            className="dash-btn-primary"
            disabled={saving}
            data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-save-product-changes"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {savedAt && (
            <span className="dash-help-text">
              Saved at {savedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
      </form>

      <MediaSection productId={id} productName={values.name} media={media} onMediaChange={setMedia} />

      <VariantsSection
        productId={id}
        categoryId={values.classification.categoryId}
        variants={variants}
        onVariantsChange={setVariants}
        media={media}
        onMediaChange={setMedia}
        selectedVariantId={selectedVariantId}
        onSelectVariant={setSelectedVariantId}
      />

      {/* Variant-filtered photo display (specs/006-gallery-module, US3, T031) —
          pure client-side filter of `media`, already loaded above; switching
          variants never triggers a new fetch. Only rendered when a variant is
          selected — with no variant selected this would show the exact same
          image set as "Product images" above, a pure duplicate. */}
      {selectedVariantId && (
        <section
          className="dash-form-section"
          style={{ marginTop: 24 }}
          data-trace-id="PG-DASHBOARD-CAT-003::EL-REGION-variant-photos"
        >
          <h2 className="dash-section-title">
            {`Photos for ${variants.find((v) => v.id === selectedVariantId)?.sku ?? 'selected variant'}`}
          </h2>
          {displayedMedia.length === 0 ? (
            <p className="dash-help-text">No photos to show for this selection.</p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: 16,
              }}
              data-trace-id="PG-DASHBOARD-CAT-003::EL-GRID-variant-photos"
            >
              {displayedMedia.map((m) => (
                <figure key={m.id} style={{ margin: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaPreviewUrl(m)}
                    alt={m.altText ?? ''}
                    data-trace-id={`PG-DASHBOARD-CAT-003::EL-IMG-variant-photo@${m.id}`}
                    style={{
                      width: '100%',
                      aspectRatio: '4/5',
                      objectFit: 'cover',
                      borderRadius: 'var(--mr-radius-sm)',
                      border: '1px solid var(--mr-dash-hair)',
                    }}
                  />
                </figure>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}

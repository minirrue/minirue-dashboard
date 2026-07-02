'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getProduct,
  updateProduct,
  publishProduct,
  archiveProduct,
  listCategories,
} from '@/lib/catalog/api';
import type { Product, Category, Gender, ProductVariant, ProductMedia } from '@/lib/catalog/types';
import type { ApiError } from '@/lib/api/client';
import StatusBadge from '@/components/dashboard/StatusBadge';
import type { StatusKind } from '@/components/dashboard/StatusBadge';
import VariantsSection from './VariantsSection';
import MediaSection from './MediaSection';

/* ── Types ── */
interface FormValues {
  name: string;
  brand: string;
  description: string;
  fragranceFamily: string;
  gender: Gender | '';
  categoryIds: string[];
}

interface FormErrors {
  name?: string;
  brand?: string;
}

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.name.trim()) errors.name = 'Product name is required.';
  if (!values.brand.trim()) errors.brand = 'Brand is required.';
  return errors;
}

function flattenCategories(categories: Category[], depth = 0): Array<Category & { depth: number }> {
  return categories.flatMap((cat) => [
    { ...cat, depth },
    ...flattenCategories(cat.children ?? [], depth + 1),
  ]);
}

const GENDER_OPTIONS: Array<{ value: Gender | ''; label: string }> = [
  { value: '', label: 'Select gender…' },
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
  { value: 'unisex', label: 'Unisex' },
];

/* ── Skeleton loader ── */
function EditSkeleton() {
  return (
    <div className="dash-form-card">
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
      <div className="dash-dialog">
        <p className="dash-dialog-message">{message}</p>
        <div className="dash-form-actions">
          <button className="dash-btn-danger" onClick={onConfirm}>
            Confirm
          </button>
          <button className="dash-btn-ghost" onClick={onCancel}>
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

  const [categories, setCategories] = useState<Array<Category & { depth: number }>>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [values, setValues] = useState<FormValues>({
    name: '',
    brand: '',
    description: '',
    fragranceFamily: '',
    gender: '',
    categoryIds: [],
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [media, setMedia] = useState<ProductMedia[]>([]);

  /* Load product */
  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    getProduct(id)
      .then((p) => {
        setProduct(p);
        setValues({
          name: p.name,
          brand: p.brand,
          description: p.description ?? '',
          fragranceFamily: p.fragranceFamily ?? '',
          gender: p.gender ?? '',
          categoryIds: p.categories.map((c) => c.id),
        });
        setVariants(p.variants);
        setMedia(p.media ?? []);
      })
      .catch((e: ApiError) => setLoadError(e.message ?? 'Failed to load product.'))
      .finally(() => setLoading(false));
  }, [id]);

  /* Load categories */
  useEffect(() => {
    listCategories()
      .then((res) => setCategories(flattenCategories(res.items)))
      .catch(() => setCategories([]))
      .finally(() => setCategoriesLoading(false));
  }, []);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function toggleCategory(catId: string) {
    setValues((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(catId)
        ? prev.categoryIds.filter((c) => c !== catId)
        : [...prev.categoryIds, catId],
    }));
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
        brand: values.brand.trim(),
        description: values.description.trim() || undefined,
        fragranceFamily: values.fragranceFamily.trim() || undefined,
        gender: values.gender || undefined,
        categoryIds: values.categoryIds,
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
      router.push('/dashboard/products');
    } catch (e) {
      const err = e as ApiError;
      setPublishError(err.message ?? 'Archive failed.');
      setArchiving(false);
    }
  }

  if (loading) {
    return (
      <>
        <div className="dash-page-header">
          <h1 className="dash-page-title">Edit Product</h1>
          <Link href="/dashboard/products" className="dash-btn-ghost">Back to Products</Link>
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
          <Link href="/dashboard/products" className="dash-btn-ghost" style={{ marginTop: 12, display: 'inline-block' }}>
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

      <div className="dash-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 className="dash-page-title">{product.name}</h1>
          <StatusBadge status={statusKind} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {product.status !== 'PUBLISHED' && (
            <button
              className="dash-btn-ok"
              disabled={publishing || archiving}
              onClick={handlePublish}
            >
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          )}
          {product.status !== 'ARCHIVED' && (
            <button
              className="dash-btn-ghost dash-btn-muted"
              disabled={publishing || archiving}
              onClick={() => setShowArchiveConfirm(true)}
            >
              Archive
            </button>
          )}
          <Link href="/dashboard/products" className="dash-btn-ghost">
            Back
          </Link>
        </div>
      </div>

      {publishError && (
        <p className="dash-inline-error" style={{ marginBottom: 16 }}>
          {publishError}
        </p>
      )}

      <form className="dash-form-card" onSubmit={handleSave} noValidate>
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
          />
          {errors.name && <p className="dash-field-error">{errors.name}</p>}
        </div>

        {/* Brand */}
        <div className="dash-field">
          <label className="dash-label" htmlFor="brand">
            Brand <span className="dash-required">*</span>
          </label>
          <input
            id="brand"
            className={`dash-input${errors.brand ? ' dash-input-error' : ''}`}
            value={values.brand}
            onChange={(e) => setField('brand', e.target.value)}
            disabled={saving}
          />
          {errors.brand && <p className="dash-field-error">{errors.brand}</p>}
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
          />
        </div>

        {/* Fragrance Family + Gender */}
        <div className="dash-field-row">
          <div className="dash-field">
            <label className="dash-label" htmlFor="fragranceFamily">
              Fragrance Family
            </label>
            <input
              id="fragranceFamily"
              className="dash-input"
              value={values.fragranceFamily}
              onChange={(e) => setField('fragranceFamily', e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="dash-field">
            <label className="dash-label" htmlFor="gender">
              Gender
            </label>
            <select
              id="gender"
              className="dash-select"
              value={values.gender}
              onChange={(e) => setField('gender', e.target.value as Gender | '')}
              disabled={saving}
            >
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Categories */}
        <div className="dash-field">
          <p className="dash-label">Categories</p>
          {categoriesLoading ? (
            <span className="dash-skeleton" style={{ width: 160, display: 'inline-block' }} />
          ) : categories.length === 0 ? (
            <p className="dash-help-text">No categories available.</p>
          ) : (
            <div className="dash-checkbox-grid">
              {categories.map((cat) => (
                <label
                  key={cat.id}
                  className="dash-checkbox-label"
                  style={{ paddingLeft: cat.depth * 16 }}
                >
                  <input
                    type="checkbox"
                    className="dash-checkbox"
                    checked={values.categoryIds.includes(cat.id)}
                    onChange={() => toggleCategory(cat.id)}
                    disabled={saving}
                  />
                  {cat.name}
                </label>
              ))}
            </div>
          )}
        </div>

        {saveError && <p className="dash-inline-error">{saveError}</p>}

        <div className="dash-form-actions">
          <button type="submit" className="dash-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {savedAt && (
            <span className="dash-help-text">
              Saved at {savedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
      </form>

      <MediaSection productId={id} media={media} onMediaChange={setMedia} />

      <VariantsSection
        productId={id}
        variants={variants}
        onVariantsChange={setVariants}
      />
    </>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createProduct, listCategories, listManagedBrands } from '@/lib/catalog/api';
import type { Category, Gender, ProductMedia } from '@/lib/catalog/types';
import type { ApiError } from '@/lib/api/client';
import MediaSection from '../[slug]/edit/MediaSection';

/* ── Validation ── */
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

/* ── UUID helper (client-side) ── */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const GENDER_OPTIONS: Array<{ value: Gender | ''; label: string }> = [
  { value: '', label: 'Select gender…' },
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
  { value: 'unisex', label: 'Unisex' },
];

/* ── Category tree flattened for checkboxes ── */
function flattenCategories(categories: Category[], depth = 0): Array<Category & { depth: number }> {
  return categories.flatMap((cat) => [
    { ...cat, depth },
    ...flattenCategories(cat.children ?? [], depth + 1),
  ]);
}

/* ── Page ── */
export default function NewProductPage() {
  const router = useRouter();

  const [values, setValues] = useState<FormValues>({
    name: '',
    brand: '',
    description: '',
    fragranceFamily: '',
    gender: '',
    categoryIds: [],
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [categories, setCategories] = useState<Array<Category & { depth: number }>>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [brands, setBrands] = useState<string[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);

  // Once the product is created, images can be attached before moving on to
  // the full edit screen (spec Story 2 — device uploads via this form still
  // create a real gallery item, never gallery-invisible).
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [media, setMedia] = useState<ProductMedia[]>([]);

  useEffect(() => {
    listCategories()
      .then((res) => setCategories(flattenCategories(res.items)))
      .catch(() => setCategories([]))
      .finally(() => setCategoriesLoading(false));
    listManagedBrands()
      .then((res) => setBrands(res.map((b) => b.name)))
      .catch(() => setBrands([]))
      .finally(() => setBrandsLoading(false));
  }, []);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function toggleCategory(id: string) {
    setValues((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id)
        ? prev.categoryIds.filter((c) => c !== id)
        : [...prev.categoryIds, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(values);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    const idempotencyKey = generateUUID();
    try {
      const product = await createProduct(
        {
          name: values.name.trim(),
          brand: values.brand.trim(),
          description: values.description.trim() || undefined,
          fragranceFamily: values.fragranceFamily.trim() || undefined,
          gender: values.gender || undefined,
          categoryIds: values.categoryIds.length > 0 ? values.categoryIds : undefined,
        },
        idempotencyKey,
      );
      setCreatedProductId(product.id);
      setSubmitting(false);
    } catch (e) {
      const err = e as ApiError;
      setSubmitError(err.message ?? 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  if (createdProductId) {
    return (
      <>
        <div
          className="dash-page-header"
          data-trace-id="PG-DASHBOARD-CAT-002::EL-REGION-new-product-images-header"
        >
          <h1 className="dash-page-title">Add images</h1>
          <button
            type="button"
            className="dash-btn-primary"
            onClick={() => router.push(`/products/${createdProductId}/edit`)}
            data-trace-id="PG-DASHBOARD-CAT-002::EL-BTN-continue-to-edit"
          >
            Continue
          </button>
        </div>
        <p className="dash-help-text" style={{ marginBottom: 16 }}>
          Product created. Add photos now, or continue and add them later from the edit screen.
        </p>
        <MediaSection productId={createdProductId} media={media} onMediaChange={setMedia} />
      </>
    );
  }

  return (
    <>
      <div className="dash-page-header" data-trace-id="PG-DASHBOARD-CAT-002::EL-REGION-new-product-page-header">
        <h1 className="dash-page-title">New Product</h1>
        <Link
          href="/products"
          className="dash-btn-ghost"
          data-trace-id="PG-DASHBOARD-CAT-002::EL-LINK-cancel-new-product"
        >
          Cancel
        </Link>
      </div>

      <form
        className="dash-form-card"
        onSubmit={handleSubmit}
        noValidate
        data-trace-id="PG-DASHBOARD-CAT-002::EL-FORM-new-product-form"
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
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Noir Absolu"
            disabled={submitting}
            data-trace-id="PG-DASHBOARD-CAT-002::EL-INPUT-product-name"
          />
          {errors.name && <p className="dash-field-error">{errors.name}</p>}
        </div>

        {/* Brand */}
        <div className="dash-field">
          <label className="dash-label" htmlFor="brand">
            Brand <span className="dash-required">*</span>
          </label>
          <select
            id="brand"
            className={`dash-select${errors.brand ? ' dash-input-error' : ''}`}
            value={values.brand}
            onChange={(e) => set('brand', e.target.value)}
            disabled={submitting || brandsLoading}
            data-trace-id="PG-DASHBOARD-CAT-002::EL-SELECT-product-brand"
          >
            <option value="" disabled>
              {brandsLoading ? 'Loading brands…' : 'Select brand…'}
            </option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
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
            onChange={(e) => set('description', e.target.value)}
            placeholder="Product description…"
            disabled={submitting}
            data-trace-id="PG-DASHBOARD-CAT-002::EL-FIELD-product-description"
          />
        </div>

        {/* Fragrance Family + Gender row */}
        <div className="dash-field-row">
          <div className="dash-field">
            <label className="dash-label" htmlFor="fragranceFamily">
              Fragrance Family
            </label>
            <input
              id="fragranceFamily"
              className="dash-input"
              value={values.fragranceFamily}
              onChange={(e) => set('fragranceFamily', e.target.value)}
              placeholder="e.g. Oriental, Floral"
              disabled={submitting}
              data-trace-id="PG-DASHBOARD-CAT-002::EL-INPUT-fragrance-family"
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
              onChange={(e) => set('gender', e.target.value as Gender | '')}
              disabled={submitting}
              data-trace-id="PG-DASHBOARD-CAT-002::EL-SELECT-product-gender"
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
            <div
              className="dash-checkbox-grid"
              data-trace-id="PG-DASHBOARD-CAT-002::EL-REGION-category-checklist"
            >
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
                    disabled={submitting}
                    data-trace-id={`PG-DASHBOARD-CAT-002::EL-CHECK-category-option@${cat.id}`}
                  />
                  {cat.name}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Submit error */}
        {submitError && <p className="dash-inline-error">{submitError}</p>}

        {/* Actions */}
        <div className="dash-form-actions">
          <button
            type="submit"
            className="dash-btn-primary"
            disabled={submitting}
            data-trace-id="PG-DASHBOARD-CAT-002::EL-BTN-create-product"
          >
            {submitting ? 'Creating…' : 'Create Product'}
          </button>
          <Link
            href="/products"
            className="dash-btn-ghost"
            data-trace-id="PG-DASHBOARD-CAT-002::EL-LINK-cancel-new-product"
          >
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}

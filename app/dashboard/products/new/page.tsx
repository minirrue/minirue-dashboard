'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createProduct, listCategories } from '@/lib/catalog/api';
import type { Category, Gender } from '@/lib/catalog/types';
import type { ApiError } from '@/lib/api/client';

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

  useEffect(() => {
    listCategories()
      .then((res) => setCategories(flattenCategories(res.items)))
      .catch(() => setCategories([]))
      .finally(() => setCategoriesLoading(false));
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
      router.push(`/products/${product.id}/edit`);
    } catch (e) {
      const err = e as ApiError;
      setSubmitError(err.message ?? 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">New Product</h1>
        <Link href="/products" className="dash-btn-ghost">
          Cancel
        </Link>
      </div>

      <form className="dash-form-card" onSubmit={handleSubmit} noValidate>
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
            onChange={(e) => set('brand', e.target.value)}
            placeholder="e.g. MiniRue"
            disabled={submitting}
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
            onChange={(e) => set('description', e.target.value)}
            placeholder="Product description…"
            disabled={submitting}
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
                    disabled={submitting}
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
          <button type="submit" className="dash-btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Product'}
          </button>
          <Link href="/products" className="dash-btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createProduct } from '@/lib/catalog/api';
import type { ProductMedia } from '@/lib/catalog/types';
import ProductClassification, {
  type ClassificationValue,
} from '@/components/dashboard/ProductClassification';
import type { ApiError } from '@/lib/api/client';
import MediaSection from '../[slug]/edit/MediaSection';

/* ── Validation ── */
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

/* ── Page ── */
export default function NewProductPage() {
  const router = useRouter();

  const [values, setValues] = useState<FormValues>({
    name: '',
    description: '',
    classification: { categoryId: '', brandId: '' },
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Once the product is created, images can be attached before moving on to
  // the full edit screen (spec Story 2 — device uploads via this form still
  // create a real gallery item, never gallery-invisible).
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [media, setMedia] = useState<ProductMedia[]>([]);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
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
          description: values.description.trim() || undefined,
          brandId: values.classification.brandId,
          categoryId: values.classification.categoryId,
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
        <MediaSection productId={createdProductId} productName={values.name} media={media} onMediaChange={setMedia} />
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

        {/* Category -> Brand, then whatever option lists that category uses.
            Replaces the free-text brand select, the hardcoded gender list and
            the category checkboxes (specs 2026-07-22-product-tree). */}
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
          disabled={submitting}
          errors={{ categoryId: errors.categoryId, brandId: errors.brandId }}
          tracePrefix="PG-DASHBOARD-CAT-002"
        />

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
            disabled={submitting}
            data-trace-id="PG-DASHBOARD-CAT-002::EL-FIELD-product-description"
          />
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

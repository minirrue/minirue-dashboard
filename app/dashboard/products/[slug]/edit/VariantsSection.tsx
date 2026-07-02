'use client';

import React, { useState } from 'react';
import { createVariant } from '@/lib/catalog/api';
import type { ProductVariant, BottleType } from '@/lib/catalog/types';
import type { ApiError } from '@/lib/api/client';

interface VariantFormValues {
  sku: string;
  sizeMl: string;
  bottleType: BottleType | '';
  priceAmount: string;
  currency: string;
}

interface VariantFormErrors {
  sku?: string;
  sizeMl?: string;
  bottleType?: string;
  priceAmount?: string;
}

function validateVariant(v: VariantFormValues): VariantFormErrors {
  const errors: VariantFormErrors = {};
  if (!v.sku.trim()) errors.sku = 'SKU is required.';
  const size = Number(v.sizeMl);
  if (!v.sizeMl || isNaN(size) || size <= 0) errors.sizeMl = 'Valid size is required.';
  if (!v.bottleType) errors.bottleType = 'Bottle type is required.';
  const price = Number(v.priceAmount);
  if (!v.priceAmount || isNaN(price) || price < 0) errors.priceAmount = 'Valid price is required.';
  return errors;
}

const BOTTLE_OPTIONS: Array<{ value: BottleType | ''; label: string }> = [
  { value: '', label: 'Select type…' },
  { value: 'EDP', label: 'EDP' },
  { value: 'EDT', label: 'EDT' },
  { value: 'Parfum', label: 'Parfum' },
  { value: 'Hair Mist', label: 'Hair Mist' },
];

const EMPTY_FORM: VariantFormValues = {
  sku: '',
  sizeMl: '',
  bottleType: '',
  priceAmount: '',
  currency: 'EGP',
};

interface Props {
  productId: string;
  variants: ProductVariant[];
  onVariantsChange: (variants: ProductVariant[]) => void;
}

export default function VariantsSection({ productId, variants, onVariantsChange }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState<VariantFormValues>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<VariantFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof VariantFormValues>(key: K, value: VariantFormValues[K]) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    if (formErrors[key as keyof VariantFormErrors]) {
      setFormErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  async function handleAddVariant(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateVariant(formValues);
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const variant = await createVariant(productId, {
        sku: formValues.sku.trim(),
        sizeMl: Number(formValues.sizeMl),
        bottleType: formValues.bottleType as BottleType,
        priceAmount: Number(formValues.priceAmount),
        currency: formValues.currency.trim() || 'USD',
      });
      onVariantsChange([...variants, variant]);
      setFormValues(EMPTY_FORM);
      setShowForm(false);
    } catch (e) {
      const err = e as ApiError;
      setSubmitError(err.message ?? 'Failed to add variant.');
    } finally {
      setSubmitting(false);
    }
  }

  function formatPrice(amount: number, currency: string) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  }

  return (
    <section className="dash-form-section">
      <div className="dash-section-header">
        <h2 className="dash-section-title">Variants</h2>
        {!showForm && (
          <button
            type="button"
            className="dash-btn-secondary"
            onClick={() => setShowForm(true)}
          >
            + Add Variant
          </button>
        )}
      </div>

      {/* Existing variants */}
      {variants.length === 0 && !showForm ? (
        <p className="dash-help-text">No variants yet. Add a variant to set pricing and sizing.</p>
      ) : (
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <table className="dash-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Size (ml)</th>
                <th>Bottle</th>
                <th style={{ textAlign: 'right' }}>Price</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id}>
                  <td>{v.sku}</td>
                  <td>{v.sizeMl}</td>
                  <td style={{ textTransform: 'capitalize' }}>{v.bottleType}</td>
                  <td style={{ textAlign: 'right' }}>{formatPrice(v.priceAmount, v.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add variant form */}
      {showForm && (
        <form className="dash-inline-form" onSubmit={handleAddVariant} noValidate>
          <div className="dash-field-row">
            <div className="dash-field">
              <label className="dash-label" htmlFor="var-sku">
                SKU <span className="dash-required">*</span>
              </label>
              <input
                id="var-sku"
                className={`dash-input${formErrors.sku ? ' dash-input-error' : ''}`}
                value={formValues.sku}
                onChange={(e) => setField('sku', e.target.value)}
                placeholder="MR-001-50ML"
                disabled={submitting}
              />
              {formErrors.sku && <p className="dash-field-error">{formErrors.sku}</p>}
            </div>
            <div className="dash-field">
              <label className="dash-label" htmlFor="var-size">
                Size (ml) <span className="dash-required">*</span>
              </label>
              <input
                id="var-size"
                type="number"
                min={1}
                className={`dash-input${formErrors.sizeMl ? ' dash-input-error' : ''}`}
                value={formValues.sizeMl}
                onChange={(e) => setField('sizeMl', e.target.value)}
                placeholder="50"
                disabled={submitting}
              />
              {formErrors.sizeMl && <p className="dash-field-error">{formErrors.sizeMl}</p>}
            </div>
            <div className="dash-field">
              <label className="dash-label" htmlFor="var-bottle">
                Bottle Type <span className="dash-required">*</span>
              </label>
              <select
                id="var-bottle"
                className={`dash-select${formErrors.bottleType ? ' dash-input-error' : ''}`}
                value={formValues.bottleType}
                onChange={(e) => setField('bottleType', e.target.value as BottleType | '')}
                disabled={submitting}
              >
                {BOTTLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {formErrors.bottleType && <p className="dash-field-error">{formErrors.bottleType}</p>}
            </div>
          </div>
          <div className="dash-field-row">
            <div className="dash-field">
              <label className="dash-label" htmlFor="var-price">
                Price <span className="dash-required">*</span>
              </label>
              <input
                id="var-price"
                type="number"
                min={0}
                step={0.01}
                className={`dash-input${formErrors.priceAmount ? ' dash-input-error' : ''}`}
                value={formValues.priceAmount}
                onChange={(e) => setField('priceAmount', e.target.value)}
                placeholder="185.00"
                disabled={submitting}
              />
              {formErrors.priceAmount && (
                <p className="dash-field-error">{formErrors.priceAmount}</p>
              )}
            </div>
            <div className="dash-field">
              <label className="dash-label" htmlFor="var-currency">
                Currency
              </label>
              <input
                id="var-currency"
                className="dash-input"
                value={formValues.currency}
                onChange={(e) => setField('currency', e.target.value.toUpperCase())}
                placeholder="USD"
                maxLength={3}
                disabled={submitting}
              />
            </div>
          </div>

          {submitError && <p className="dash-inline-error">{submitError}</p>}

          <div className="dash-form-actions">
            <button type="submit" className="dash-btn-primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add Variant'}
            </button>
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={() => {
                setShowForm(false);
                setFormValues(EMPTY_FORM);
                setFormErrors({});
                setSubmitError(null);
              }}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

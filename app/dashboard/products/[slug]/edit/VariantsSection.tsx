'use client';

import React, { useState } from 'react';
import { createVariant, updateVariant, softDeleteVariant, hardDeleteVariant } from '@/lib/catalog/api';
import type { ProductVariant, BottleType } from '@/lib/catalog/types';
import type { ApiError } from '@/lib/api/client';
import DeleteChoiceDialog from '@/components/dashboard/DeleteChoiceDialog';

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<VariantFormValues>(EMPTY_FORM);
  const [editErrors, setEditErrors] = useState<VariantFormErrors>({});
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductVariant | null>(null);

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

  function editSetField<K extends keyof VariantFormValues>(key: K, value: VariantFormValues[K]) {
    setEditValues((prev) => ({ ...prev, [key]: value }));
    if (editErrors[key as keyof VariantFormErrors]) {
      setEditErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function handleStartEdit(v: ProductVariant) {
    setEditingId(v.id);
    setEditValues({
      sku: v.sku,
      sizeMl: String(v.sizeMl),
      bottleType: v.bottleType as BottleType,
      priceAmount: String(v.priceAmount),
      currency: v.currency,
    });
    setEditErrors({});
    setEditSubmitError(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditValues(EMPTY_FORM);
    setEditErrors({});
    setEditSubmitError(null);
  }

  async function handleEditSave(e: React.FormEvent, v: ProductVariant) {
    e.preventDefault();
    const errs = validateVariant(editValues);
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }
    setEditSubmitError(null);
    setEditSubmitting(true);
    try {
      const updated = await updateVariant(productId, v.id, {
        sizeMl: Number(editValues.sizeMl),
        bottleType: editValues.bottleType as BottleType,
        priceAmount: Number(editValues.priceAmount),
        currency: editValues.currency.trim() || 'USD',
      });
      onVariantsChange(
        variants.map((x) => (x.id === v.id ? updated : x)),
      );
      setEditingId(null);
      setEditValues(EMPTY_FORM);
    } catch (e) {
      const err = e as ApiError;
      setEditSubmitError(err.message ?? 'Failed to update variant.');
    } finally {
      setEditSubmitting(false);
    }
  }

  function formatPrice(amount: number, currency: string) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  }

  async function handleSoftDeleteVariant(v: ProductVariant) {
    await softDeleteVariant(productId, v.id);
    onVariantsChange(variants.filter((x) => x.id !== v.id));
    setDeleteTarget(null);
  }

  async function handleHardDeleteVariant(v: ProductVariant) {
    await hardDeleteVariant(productId, v.id);
    onVariantsChange(variants.filter((x) => x.id !== v.id));
    setDeleteTarget(null);
  }

  return (
    <section className="dash-form-section" data-trace-id="PG-DASHBOARD-CAT-003::EL-REGION-variants-section">
      {deleteTarget && (
        <DeleteChoiceDialog
          productName={deleteTarget.sku}
          onSoftDelete={() => handleSoftDeleteVariant(deleteTarget)}
          onHardDelete={() => handleHardDeleteVariant(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
          traceIdPrefix={`PG-DASHBOARD-CAT-003::EL-MODAL-delete-variant-confirm@${deleteTarget.id}`}
        />
      )}
      <div className="dash-section-header">
        <h2 className="dash-section-title">Variants</h2>
        {!showForm && (
          <button
            type="button"
            className="dash-btn-secondary"
            onClick={() => setShowForm(true)}
            data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-add-variant-toggle"
          >
            + Add Variant
          </button>
        )}
      </div>

      {/* Existing variants */}
      {variants.length === 0 && !showForm ? (
        <p className="dash-help-text">No variants yet. Add a variant to set pricing and sizing.</p>
      ) : (
        <div
          className="dash-card"
          style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}
          data-trace-id="PG-DASHBOARD-CAT-003::EL-TABLE-variants-table"
        >
          <table className="dash-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Size (ml)</th>
                <th>Bottle</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <React.Fragment key={v.id}>
                  <tr data-trace-id={`PG-DASHBOARD-CAT-003::EL-ROW-variant-row@${v.id}`}>
                    <td>{v.sku}</td>
                    <td>{v.sizeMl}</td>
                    <td style={{ textTransform: 'capitalize' }}>{v.bottleType}</td>
                    <td style={{ textAlign: 'right' }}>{formatPrice(v.priceAmount, v.currency)}</td>
                    <td>
                      <button
                        type="button"
                        className="dash-btn-ghost"
                        onClick={() => handleStartEdit(v)}
                        data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-edit-variant@${v.id}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="dash-btn-ghost dash-btn-danger"
                        onClick={() => setDeleteTarget(v)}
                        data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-delete-variant@${v.id}`}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  {editingId === v.id && (
                    <tr>
                      <td colSpan={5} style={{ background: 'var(--mr-dash-sub)', padding: '12px 14px' }}>
                        <form
                          className="dash-inline-form"
                          onSubmit={(e) => handleEditSave(e, v)}
                          noValidate
                          data-trace-id={`PG-DASHBOARD-CAT-003::EL-FORM-edit-variant-form@${v.id}`}
                        >
                          <div className="dash-field-row">
                            <div className="dash-field">
                              <label className="dash-label" htmlFor={`edit-sku-${v.id}`}>
                                SKU
                              </label>
                              <input
                                id={`edit-sku-${v.id}`}
                                className="dash-input"
                                value={editValues.sku}
                                disabled
                              />
                            </div>
                            <div className="dash-field">
                              <label className="dash-label" htmlFor={`edit-size-${v.id}`}>
                                Size (ml) <span className="dash-required">*</span>
                              </label>
                              <input
                                id={`edit-size-${v.id}`}
                                type="number"
                                min={1}
                                className={`dash-input${editErrors.sizeMl ? ' dash-input-error' : ''}`}
                                value={editValues.sizeMl}
                                onChange={(e) => editSetField('sizeMl', e.target.value)}
                                disabled={editSubmitting}
                                data-trace-id={`PG-DASHBOARD-CAT-003::EL-INPUT-edit-variant-size@${v.id}`}
                              />
                              {editErrors.sizeMl && <p className="dash-field-error">{editErrors.sizeMl}</p>}
                            </div>
                            <div className="dash-field">
                              <label className="dash-label" htmlFor={`edit-bottle-${v.id}`}>
                                Bottle Type <span className="dash-required">*</span>
                              </label>
                              <select
                                id={`edit-bottle-${v.id}`}
                                className={`dash-select${editErrors.bottleType ? ' dash-input-error' : ''}`}
                                value={editValues.bottleType}
                                onChange={(e) => editSetField('bottleType', e.target.value as BottleType | '')}
                                disabled={editSubmitting}
                                data-trace-id={`PG-DASHBOARD-CAT-003::EL-SELECT-edit-variant-bottle-type@${v.id}`}
                              >
                                {BOTTLE_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                              {editErrors.bottleType && <p className="dash-field-error">{editErrors.bottleType}</p>}
                            </div>
                          </div>
                          <div className="dash-field-row">
                            <div className="dash-field">
                              <label className="dash-label" htmlFor={`edit-price-${v.id}`}>
                                Price <span className="dash-required">*</span>
                              </label>
                              <input
                                id={`edit-price-${v.id}`}
                                type="number"
                                min={0}
                                step={0.01}
                                className={`dash-input${editErrors.priceAmount ? ' dash-input-error' : ''}`}
                                value={editValues.priceAmount}
                                onChange={(e) => editSetField('priceAmount', e.target.value)}
                                placeholder="185.00"
                                disabled={editSubmitting}
                                data-trace-id={`PG-DASHBOARD-CAT-003::EL-INPUT-edit-variant-price@${v.id}`}
                              />
                              {editErrors.priceAmount && (
                                <p className="dash-field-error">{editErrors.priceAmount}</p>
                              )}
                            </div>
                            <div className="dash-field">
                              <label className="dash-label" htmlFor={`edit-currency-${v.id}`}>
                                Currency
                              </label>
                              <input
                                id={`edit-currency-${v.id}`}
                                className="dash-input"
                                value={editValues.currency}
                                onChange={(e) => editSetField('currency', e.target.value.toUpperCase())}
                                placeholder="USD"
                                maxLength={3}
                                disabled={editSubmitting}
                                data-trace-id={`PG-DASHBOARD-CAT-003::EL-INPUT-edit-variant-currency@${v.id}`}
                              />
                            </div>
                          </div>
                          {editSubmitError && <p className="dash-inline-error">{editSubmitError}</p>}
                          <div className="dash-form-actions">
                            <button
                              type="submit"
                              className="dash-btn-primary"
                              disabled={editSubmitting}
                              data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-save-variant-edit@${v.id}`}
                            >
                              {editSubmitting ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="dash-btn-ghost"
                              onClick={handleCancelEdit}
                              disabled={editSubmitting}
                              data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-cancel-variant-edit@${v.id}`}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add variant form */}
      {showForm && (
        <form
          className="dash-inline-form"
          onSubmit={handleAddVariant}
          noValidate
          data-trace-id="PG-DASHBOARD-CAT-003::EL-FORM-add-variant-form"
        >
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
                data-trace-id="PG-DASHBOARD-CAT-003::EL-INPUT-add-variant-sku"
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
                data-trace-id="PG-DASHBOARD-CAT-003::EL-INPUT-add-variant-size"
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
                data-trace-id="PG-DASHBOARD-CAT-003::EL-SELECT-add-variant-bottle-type"
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
                data-trace-id="PG-DASHBOARD-CAT-003::EL-INPUT-add-variant-price"
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
                data-trace-id="PG-DASHBOARD-CAT-003::EL-INPUT-add-variant-currency"
              />
            </div>
          </div>

          {submitError && <p className="dash-inline-error">{submitError}</p>}

          <div className="dash-form-actions">
            <button
              type="submit"
              className="dash-btn-primary"
              disabled={submitting}
              data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-submit-add-variant"
            >
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
              data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-cancel-add-variant"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

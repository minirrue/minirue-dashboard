'use client';

import React, { useState, useEffect } from 'react';
import {
  createVariant,
  updateVariant,
  softDeleteVariant,
  hardDeleteVariant,
  createProductMedia,
  listBrandGlobalVariants,
  applyGlobalVariant,
  type BrandGlobalVariant,
} from '@/lib/catalog/api';
import type { ProductVariant, ProductMedia } from '@/lib/catalog/types';
import type { ApiError } from '@/lib/api/client';
import DeleteChoiceDialog from '@/components/dashboard/DeleteChoiceDialog';
import GalleryPickerModal from '@/components/dashboard/GalleryPickerModal';
import type { GalleryItem } from '@/lib/gallery/types';

interface VariantFormValues {
  sku: string;
  sizeMl: string;
  priceAmount: string;
  currency: string;
}

interface VariantFormErrors {
  sku?: string;
  sizeMl?: string;
  priceAmount?: string;
}

function validateVariant(v: VariantFormValues): VariantFormErrors {
  const errors: VariantFormErrors = {};
  if (!v.sku.trim()) errors.sku = 'SKU is required.';
  const size = Number(v.sizeMl);
  if (!v.sizeMl || isNaN(size) || size <= 0) errors.sizeMl = 'Valid size is required.';
  const price = Number(v.priceAmount);
  if (!v.priceAmount || isNaN(price) || price < 0) errors.priceAmount = 'Valid price is required.';
  return errors;
}

const EMPTY_FORM: VariantFormValues = {
  sku: '',
  sizeMl: '',
  priceAmount: '',
  currency: 'EGP',
};

interface Props {
  productId: string;
  /** Level 2 of the tree — decides which shared variants are on offer here. */
  brandId: string;
  variants: ProductVariant[];
  onVariantsChange: (variants: ProductVariant[]) => void;
  // Added for the Gallery module (specs/006-gallery-module, US3): lets this
  // section link a gallery photo to a specific variant row, and lets the
  // parent page track which variant is selected for the variant-filtered
  // photo display (T031) — both share the same product-edit page state, no
  // duplicate fetch.
  media: ProductMedia[];
  onMediaChange: (media: ProductMedia[]) => void;
  selectedVariantId: string | null;
  onSelectVariant: (variantId: string | null) => void;
}

export default function VariantsSection({
  productId,
  brandId,
  variants,
  onVariantsChange,
  media,
  onMediaChange,
  selectedVariantId,
  onSelectVariant,
}: Props) {
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
  const [pickerVariantId, setPickerVariantId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // The brand's reusable variants, offered as one-click additions beside the
  // custom ones. Replaces the concentration dropdown that used to sit on each
  // variant row -- concentration describes the ITEM and lives in its option
  // lists now (specs 2026-07-22-product-tree).
  const [globals, setGlobals] = useState<BrandGlobalVariant[]>([]);
  const [globalsError, setGlobalsError] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    listBrandGlobalVariants(brandId)
      .then((rows) => {
        if (!cancelled) setGlobals(rows.filter((g) => g.isActive));
      })
      .catch(() => {
        if (!cancelled)
          setGlobalsError(
            'Could not load this brand\'s shared variants.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [brandId]);

  /**
   * Copies a brand variant onto this item. The SKU is generated from the
   * label because SKUs are unique across every variant in the system and so
   * can never be inherited; the admin can edit it afterwards like any other.
   */
  async function handleApplyGlobal(g: BrandGlobalVariant) {
    setApplying(g.id);
    setGlobalsError(null);
    try {
      const suffix = g.label.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const variant = await applyGlobalVariant(productId, g.id, {
        sku: `${productId.slice(0, 8).toUpperCase()}-${suffix}`,
      });
      onVariantsChange([...variants, variant]);
    } catch (e) {
      const err = e as ApiError;
      setGlobalsError(err.message ?? 'Could not add that variant.');
    } finally {
      setApplying(null);
    }
  }

  async function handleLinkGalleryItem(variantId: string, item: GalleryItem) {
    setPickerVariantId(null);
    setLinkError(null);
    try {
      const asset = await createProductMedia(productId, {
        galleryItemId: item.id,
        variantId,
        sortOrder: media.filter((m) => m.variantId === variantId).length,
      });
      onMediaChange([...media, asset]);
    } catch (e) {
      const err = e as ApiError;
      setLinkError(err.message ?? 'Failed to link gallery photo to variant.');
    }
  }

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
      {pickerVariantId && (
        <GalleryPickerModal
          onSelect={(item) => handleLinkGalleryItem(pickerVariantId, item)}
          onClose={() => setPickerVariantId(null)}
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
                <th>Source</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th>Photos</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => {
                const variantPhotoCount = media.filter((m) => m.variantId === v.id).length;
                const isSelected = selectedVariantId === v.id;
                return (
                <React.Fragment key={v.id}>
                  <tr
                    data-trace-id={`PG-DASHBOARD-CAT-003::EL-ROW-variant-row@${v.id}`}
                    data-active={isSelected ? 'true' : undefined}
                  >
                    <td>{v.sku}</td>
                    <td>{v.sizeMl}</td>
                    <td>{v.sourceGlobalVariantId ? 'Shared' : 'Custom'}</td>
                    <td style={{ textAlign: 'right' }}>{formatPrice(v.priceAmount, v.currency)}</td>
                    <td>
                      <button
                        type="button"
                        className={isSelected ? 'dash-btn-primary' : 'dash-btn-ghost'}
                        onClick={() => onSelectVariant(isSelected ? null : v.id)}
                        data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-view-variant-photos@${v.id}`}
                      >
                        {variantPhotoCount > 0
                          ? `${variantPhotoCount} photo${variantPhotoCount === 1 ? '' : 's'}`
                          : 'No photos'}
                      </button>
                      <button
                        type="button"
                        className="dash-btn-ghost"
                        onClick={() => setPickerVariantId(v.id)}
                        data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-link-variant-photo@${v.id}`}
                      >
                        + Link Photo
                      </button>
                    </td>
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
                      <td colSpan={6} style={{ background: 'var(--mr-dash-sub)', padding: '12px 14px' }}>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {linkError && <p className="dash-inline-error">{linkError}</p>}
      {globalsError && (
        <p className="dash-inline-error" data-trace-id="PG-DASHBOARD-CAT-003::EL-TEXT-global-variants-error">
          {globalsError}
        </p>
      )}

      {/* One-click additions from the brand. Applying copies the definition
          onto this item, so its price and SKU stay its own. */}
      {globals.length > 0 && (
        <div
          className="dash-field"
          data-trace-id="PG-DASHBOARD-CAT-003::EL-REGION-apply-global-variants"
        >
          <p className="dash-label">Add from {'{'}this brand{'}'}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {globals.map((g) => (
              <button
                key={g.id}
                type="button"
                className="dash-btn-secondary"
                onClick={() => handleApplyGlobal(g)}
                disabled={applying !== null}
                data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-apply-global@${g.id}`}
              >
                {applying === g.id ? 'Adding…' : `+ ${g.label}`}
              </button>
            ))}
          </div>
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

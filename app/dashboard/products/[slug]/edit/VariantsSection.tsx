'use client';

import React, { useState, useEffect } from 'react';
import {
  createVariant,
  updateVariant,
  softDeleteVariant,
  hardDeleteVariant,
  createProductMedia,
  listAttributes,
  listAttributeOptions,
} from '@/lib/catalog/api';
import type {
  AttributeRecord,
  AttributeOptionRecord,
} from '@/lib/catalog/types';
import type { ProductVariant, ProductMedia } from '@/lib/catalog/types';
import type { ApiError } from '@/lib/api/client';
import DeleteChoiceDialog from '@/components/dashboard/DeleteChoiceDialog';
import GalleryPickerModal from '@/components/dashboard/GalleryPickerModal';
import type { GalleryItem } from '@/lib/gallery/types';

interface CustomField {
  name: string;
  value: string;
}

interface VariantFormValues {
  sku: string;
  /** global variant id -> typed value */
  values: Record<string, string>;
  /** product-specific custom fields, same methodology as globals: name + value */
  customFields: CustomField[];
  priceAmount: string;
  currency: string;
}

/** Turns the custom-field rows into the { name: value } map the API takes,
 *  dropping any row with a blank name. */
function customFieldsToMap(fields: CustomField[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of fields) {
    const name = f.name.trim();
    if (name) map[name] = f.value.trim();
  }
  return map;
}

interface VariantFormErrors {
  sku?: string;
  priceAmount?: string;
}

/**
 * The product-specific custom fields editor — same methodology as a global
 * variant (a field name plus a typed value), but added here for this one
 * product. Rows of {name, value}; add and remove freely.
 */
function CustomFieldsEditor({
  fields,
  onChange,
  disabled,
  idScope,
}: {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
  disabled?: boolean;
  idScope: string;
}) {
  function update(index: number, patch: Partial<CustomField>) {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }
  function remove(index: number) {
    onChange(fields.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...fields, { name: '', value: '' }]);
  }

  return (
    <div className="dash-field" data-trace-id={`PG-DASHBOARD-CAT-003::EL-REGION-custom-fields-${idScope}`}>
      <label className="dash-label">Custom fields (just this product)</label>
      <p className="dash-help-text" style={{ marginBottom: 8 }}>
        A field only this product has, beyond the ones its category requires.
        Type a name and its value — for example “Bottle shape” → “Round”.
      </p>
      {fields.map((f, i) => (
        <div
          key={i}
          style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <input
            className="dash-input"
            style={{ maxWidth: 200 }}
            placeholder="Field name"
            value={f.name}
            onChange={(e) => update(i, { name: e.target.value })}
            disabled={disabled}
            maxLength={60}
            data-trace-id={`PG-DASHBOARD-CAT-003::EL-INPUT-custom-name-${idScope}@${i}`}
          />
          <input
            className="dash-input"
            style={{ maxWidth: 220 }}
            placeholder="Value"
            value={f.value}
            onChange={(e) => update(i, { value: e.target.value })}
            disabled={disabled}
            maxLength={200}
            data-trace-id={`PG-DASHBOARD-CAT-003::EL-INPUT-custom-value-${idScope}@${i}`}
          />
          <button
            type="button"
            className="dash-btn-ghost dash-btn-danger"
            onClick={() => remove(i)}
            disabled={disabled}
            data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-remove-custom-${idScope}@${i}`}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="dash-btn-secondary"
        onClick={add}
        disabled={disabled}
        data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-add-custom-field-${idScope}`}
      >
        + Add custom field
      </button>
    </div>
  );
}

function validateVariant(v: VariantFormValues): VariantFormErrors {
  const errors: VariantFormErrors = {};
  if (!v.sku.trim()) errors.sku = 'SKU is required.';
  const price = Number(v.priceAmount);
  if (!v.priceAmount || isNaN(price) || price < 0) errors.priceAmount = 'Valid price is required.';
  return errors;
}

const EMPTY_FORM: VariantFormValues = {
  sku: '',
  values: {},
  customFields: [],
  priceAmount: '',
  currency: 'EGP',
};

interface Props {
  productId: string;
  /** Decides which global variants apply to this product's variants. */
  categoryId: string;
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
  categoryId,
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

  /**
   * The global variants that apply to this product's category. These are the
   * fields on every variant here — created and named by the admin under
   * Products → Global variants, never fixed in code.
   */
  const [globals, setGlobals] = useState<AttributeRecord[]>([]);
  const [optionsByGlobal, setOptionsByGlobal] = useState<
    Record<string, AttributeOptionRecord[]>
  >({});
  const [globalsError, setGlobalsError] = useState<string | null>(null);
  const [globalsReloadKey, setGlobalsReloadKey] = useState(0);

  useEffect(() => {
    if (!categoryId) return;
    let cancelled = false;
    setGlobalsError(null);
    listAttributes(categoryId)
      .then(async (rows) => {
        const safe = Array.isArray(rows) ? rows : [];
        if (cancelled) return;
        setGlobals(safe);
        const entries = await Promise.all(
          safe.map(async (a) => {
            const opts = await listAttributeOptions(a.id);
            return [a.id, Array.isArray(opts) ? opts : []] as const;
          }),
        );
        if (!cancelled) setOptionsByGlobal(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled)
          setGlobalsError('Could not load the global variants for this category.');
      });
    return () => {
      cancelled = true;
    };
  }, [categoryId, globalsReloadKey]);

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
        priceAmount: Number(formValues.priceAmount),
        currency: formValues.currency.trim() || 'EGP',
        values: formValues.values,
        customValues: customFieldsToMap(formValues.customFields),
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
      // The field value is the TEXT now, not an option id — seed the input with
      // what was typed so it shows and can be edited free-hand.
      values: Object.fromEntries(v.values.map((x) => [x.attributeId, x.optionName])),
      customFields: Object.entries(v.customValues ?? {}).map(([name, value]) => ({
        name,
        value,
      })),
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
        priceAmount: Number(editValues.priceAmount),
        currency: editValues.currency.trim() || 'EGP',
        values: editValues.values,
        customValues: customFieldsToMap(editValues.customFields),
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
        <div>
          <h2 className="dash-section-title">Custom variants</h2>
          <p className="dash-help-text" style={{ marginTop: 4, maxWidth: 620 }}>
            Each variant is one buyable version of this product with its own
            price. The fields marked <strong>Applied</strong> come from this
            category&apos;s global variants — every variant here must answer
            them, and you type the value ({globals.map((g) => g.name).join(', ') || 'e.g. Size'}).
          </p>
        </div>
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

      {/* Remembered values for each global variant, offered as suggestions.
          Free-typed, so a new value is always allowed. */}
      {globals.map((g) => (
        <datalist key={g.id} id={`gv-suggestions-${g.id}`}>
          {(optionsByGlobal[g.id] ?? []).map((o) => (
            <option key={o.id} value={o.name} />
          ))}
        </datalist>
      ))}

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
                <th>Fields</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => {
                const isSelected = selectedVariantId === v.id;
                return (
                <React.Fragment key={v.id}>
                  <tr
                    data-trace-id={`PG-DASHBOARD-CAT-003::EL-ROW-variant-row@${v.id}`}
                    data-active={isSelected ? 'true' : undefined}
                  >
                    <td>{v.sku}</td>
                    <td>
                      {[
                        ...v.values.map((x) => `${x.attributeName}: ${x.optionName}`),
                        ...Object.entries(v.customValues ?? {}).map(
                          ([n, val]) => `${n}: ${val}`,
                        ),
                      ].join(' · ') || '—'}
                    </td>
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
                      <td colSpan={4} style={{ background: 'var(--mr-dash-sub)', padding: '12px 14px' }}>
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
                              {globals.map((g) => (
                                <div className="dash-field" key={g.id}>
                                  <label className="dash-label">
                                    {g.name}{' '}
                                    <span className="dash-pill-applied">Applied</span>
                                  </label>
                                  <input
                                    className="dash-input"
                                    list={`gv-suggestions-${g.id}`}
                                    value={editValues.values[g.id] ?? ''}
                                    onChange={(e) => editSetField('values', { ...editValues.values, [g.id]: e.target.value })}
                                    placeholder={`Type a value for ${g.name}…`}
                                    disabled={editSubmitting}
                                  />
                                </div>
                              ))}
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
                          <CustomFieldsEditor
                            fields={editValues.customFields}
                            onChange={(cf) => editSetField('customFields', cf)}
                            disabled={editSubmitting}
                            idScope={`edit-${v.id}`}
                          />
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
        <div
          className="dash-inline-error"
          style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
          data-trace-id="PG-DASHBOARD-CAT-003::EL-TEXT-global-variants-error"
        >
          <span>{globalsError} You can still set the price.</span>
          <button
            type="button"
            className="dash-btn-secondary"
            onClick={() => setGlobalsReloadKey((k) => k + 1)}
            data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-retry-global-variants"
          >
            Try again
          </button>
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
              {globals.map((g) => (
                <div className="dash-field" key={g.id}>
                  <label className="dash-label">
                    {g.name}{' '}
                    <span className="dash-pill-applied">Applied</span>
                  </label>
                  <input
                    className="dash-input"
                    list={`gv-suggestions-${g.id}`}
                    value={formValues.values[g.id] ?? ''}
                    onChange={(e) =>
                      setField('values', { ...formValues.values, [g.id]: e.target.value })
                    }
                    placeholder={`Type a value for ${g.name}…`}
                    disabled={submitting}
                    data-trace-id={`PG-DASHBOARD-CAT-003::EL-INPUT-add-variant-global@${g.id}`}
                  />
                </div>
              ))}
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

          <CustomFieldsEditor
            fields={formValues.customFields}
            onChange={(cf) => setField('customFields', cf)}
            disabled={submitting}
            idScope="add"
          />

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

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  createVariant,
  updateVariant,
  softDeleteVariant,
  restoreVariant,
  hardDeleteVariant,
  createProductMedia,
  listAttributes,
  listAttributeOptions,
  toProductVariant,
} from '@/lib/catalog/api';
import {
  apiAccountingOverview,
  apiCreateSystemVariant,
  apiUpdateVariantPricing,
  type AccountingOverview,
  type CostCurrency,
  type PricingMode,
} from '@/lib/api/accounting';
import { parseAmountInput } from '@/lib/accounting/validate';
import { formatEgpMinor } from '@/components/dashboard/charts';
import { whyFromTrace } from '@/app/dashboard/accounting/PricingDrawer';
import './variant-pricing.css';
import type {
  AttributeRecord,
  AttributeOptionRecord,
} from '@/lib/catalog/types';
import type { ProductVariant, ProductMedia } from '@/lib/catalog/types';
import type { ApiError } from '@/lib/api/client';
import { errorMessageToText } from '@/lib/api/client';
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
  // No SKU check — the server generates it (category + brand + product + values).
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

/**
 * Accounting DA-6 (minirue-dashboard#62, epic minirue-backend#155): how a
 * house variant's cost is entered. "EGP that follows the dollar" is an EGP
 * cost the USD rate moves.
 */
type CostKind = 'EGP' | 'USD' | 'EGP_USD';

const COST_KINDS: { value: CostKind; label: string }[] = [
  { value: 'EGP', label: 'EGP' },
  { value: 'USD', label: 'USD' },
  { value: 'EGP_USD', label: 'EGP that follows the dollar' },
];

function costFields(kind: CostKind): { costCurrency: CostCurrency; followsUsd: boolean } {
  return { costCurrency: kind === 'USD' ? 'USD' : 'EGP', followsUsd: kind === 'EGP_USD' };
}

const MODE_LABEL: Record<PricingMode, string> = {
  SYSTEM: 'System price',
  MANUAL: 'My price',
};

/** Opens this variant's pricing drawer in Accounting (`?open=` — #61). */
function accountingHref(variantId: string): string {
  return `/accounting?tab=prices&open=${encodeURIComponent(variantId)}`;
}

/** Inventory, already searched down to this variant's SKU. */
function inventoryHref(sku: string): string {
  return `/inventory?q=${encodeURIComponent(sku)}`;
}

interface HouseDraft {
  systemCost: string;
  systemKind: CostKind;
  myPrice: string;
  myCost: string;
  myKind: CostKind;
}

const EMPTY_HOUSE: HouseDraft = {
  systemCost: '',
  systemKind: 'EGP',
  myPrice: '',
  myCost: '',
  myKind: 'EGP',
};

/** What the last house add produced, shown read-only after the form closes. */
interface AddResult {
  sku: string;
  mode: PricingMode;
  priceMinor: number;
  why: string;
  /** Set when the variant was created but a follow-up write failed. */
  warning?: string;
}

/** This product's variant modes out of the Accounting overview. */
function modesFrom(o: AccountingOverview, productId: string): Record<string, PricingMode> {
  const out: Record<string, PricingMode> = {};
  for (const r of o.variants) if (r.productId === productId) out[r.variantId] = r.mode;
  return out;
}

function errorText(e: unknown, fallback: string): string {
  return errorMessageToText((e as ApiError | undefined)?.message, fallback);
}

interface Props {
  productId: string;
  /** Decides which global variants apply to this product's variants. */
  categoryId: string;
  /**
   * MiniRue's own product. Only these are priced by Accounting, so only these
   * get the System price / My price paths; a partner's product keeps the plain
   * price form.
   */
  isHouse?: boolean;
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
  isHouse = false,
  variants,
  onVariantsChange,
  media,
  onMediaChange,
  selectedVariantId,
  onSelectVariant,
}: Props) {
  // ── Accounting (house products only) ──────────────────────────────────────
  // Each variant's price mode, from the Accounting overview. Null until read.
  // Backend#167 flips a SYSTEM variant to MANUAL on any catalog price write,
  // so the inline price edit is offered only once a row is KNOWN to be My price.
  const [modes, setModes] = useState<Record<string, PricingMode> | null>(null);
  const [modesError, setModesError] = useState(false);
  const [house, setHouse] = useState<HouseDraft>(EMPTY_HOUSE);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [myError, setMyError] = useState<string | null>(null);
  const [addResult, setAddResult] = useState<AddResult | null>(null);

  useEffect(() => {
    if (!isHouse) return;
    let cancelled = false;
    setModesError(false);
    apiAccountingOverview()
      .then((o) => {
        if (!cancelled) setModes(modesFrom(o, productId));
      })
      .catch(() => {
        if (!cancelled) setModesError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isHouse, productId]);

  /** Folds a write's fresh overview in, keeping modes learned locally. */
  function mergeModes(o: AccountingOverview | undefined, extra: Record<string, PricingMode>) {
    setModes((prev) => ({ ...(prev ?? {}), ...(o ? modesFrom(o, productId) : {}), ...extra }));
  }

  function modeOf(v: ProductVariant): PricingMode | null {
    return modes?.[v.id] ?? null;
  }

  /**
   * Partner rows only. A house price — System or My price — is changed in
   * Accounting, never here (owner, 2026-09-19, #101); partner products have
   * no Accounting row, so this is still their only price edit.
   */
  function priceEditable(_v: ProductVariant): boolean {
    return !isHouse;
  }

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
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [pickerVariantId, setPickerVariantId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copiedSku, setCopiedSku] = useState<string | null>(null);

  /** SKUs are read-only but searchable — one click puts one on the clipboard. */
  async function handleCopySku(sku: string) {
    try {
      await navigator.clipboard.writeText(sku);
      setCopiedSku(sku);
      setTimeout(() => setCopiedSku((cur) => (cur === sku ? null : cur)), 1600);
    } catch {
      // Clipboard blocked (insecure context / denied permission) — the SKU is
      // still selectable in the cell, so there is nothing to recover from.
    }
  }

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
    // A house variant is added through one of its two pricing paths.
    if (isHouse) return;
    const errs = validateVariant(formValues);
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const variant = await createVariant(productId, {
        // sku omitted on purpose — the server derives and owns it.
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

  function setHouseField<K extends keyof HouseDraft>(key: K, value: HouseDraft[K]) {
    setHouse((prev) => ({ ...prev, [key]: value }));
    if (key === 'systemCost' || key === 'systemKind') setSystemError(null);
    else setMyError(null);
  }

  function closeAddForm() {
    setShowForm(false);
    setFormValues(EMPTY_FORM);
    setFormErrors({});
    setSubmitError(null);
    setHouse(EMPTY_HOUSE);
    setSystemError(null);
    setMyError(null);
  }

  /** System price: cost in, the engine's price out, in one backend call. */
  async function handleAddSystem() {
    const costMinor = parseAmountInput(house.systemCost);
    if (costMinor === null) {
      setSystemError('Enter what one unit cost you, for example 650 or 12.50.');
      return;
    }
    setSystemError(null);
    setMyError(null);
    setSubmitting(true);
    try {
      const res = await apiCreateSystemVariant(productId, {
        values: formValues.values,
        custom_values: customFieldsToMap(formValues.customFields),
        costAmountMinor: costMinor,
        ...costFields(house.systemKind),
      });
      const id = String(res.variant.id);
      const row = res.overview.variants.find((r) => r.variantId === id);
      const created = toProductVariant(res.variant, row?.currentPriceMinor);
      onVariantsChange([...variants, created]);
      mergeModes(res.overview, { [id]: 'SYSTEM' });
      setAddResult({
        sku: created.sku,
        mode: 'SYSTEM',
        priceMinor: row?.currentPriceMinor ?? Math.round(created.priceAmount * 100),
        why: row ? whyFromTrace(row.system.trace) : '',
      });
      closeAddForm();
    } catch (e) {
      setSystemError(`Could not add it: ${errorText(e, 'the server refused the save.')} Nothing was created.`);
    } finally {
      setSubmitting(false);
    }
  }

  /** My price: the catalog create, then the cost through Accounting when one is given. */
  async function handleAddMine() {
    const priceMinor = parseAmountInput(house.myPrice);
    if (priceMinor === null || priceMinor < 1) {
      setMyError('Enter the price customers pay, for example 950.');
      return;
    }
    const costMinor = house.myCost.trim() === '' ? null : parseAmountInput(house.myCost);
    if (house.myCost.trim() !== '' && costMinor === null) {
      setMyError('Enter the cost as a number, for example 650, or leave it blank.');
      return;
    }
    setSystemError(null);
    setMyError(null);
    setSubmitting(true);
    let created: ProductVariant;
    try {
      created = await createVariant(productId, {
        priceAmount: priceMinor / 100,
        currency: 'EGP',
        values: formValues.values,
        customValues: customFieldsToMap(formValues.customFields),
      });
    } catch (e) {
      setMyError(`Could not add it: ${errorText(e, 'the server refused the save.')} Nothing was created.`);
      setSubmitting(false);
      return;
    }
    onVariantsChange([...variants, created]);
    // No pricing row reads as My price, so the new row is My price either way.
    let warning: string | undefined;
    let fresh: AccountingOverview | undefined;
    if (costMinor !== null) {
      try {
        const res = await apiUpdateVariantPricing(created.id, {
          mode: 'MANUAL',
          manualPriceMinor: priceMinor,
          costAmountMinor: costMinor,
          ...costFields(house.myKind),
        });
        fresh = res.overview;
      } catch (e) {
        warning = `The variant was added, but its cost was not saved: ${errorText(e, 'the server refused it.')} Add the cost in Accounting.`;
      }
    }
    mergeModes(fresh, { [created.id]: 'MANUAL' });
    setAddResult({ sku: created.sku, mode: 'MANUAL', priceMinor, why: '', warning });
    closeAddForm();
    setSubmitting(false);
  }

  /** Enter inside a path's inputs adds on that path. */
  function submitOnEnter(e: React.KeyboardEvent, add: () => void) {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault();
      if (!submitting) add();
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
    // A price the row may not edit is never validated or sent: on a System
    // price variant any catalog price write switches it to My price (#167).
    const withPrice = priceEditable(v);
    const errs = withPrice ? validateVariant(editValues) : {};
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }
    setEditSubmitError(null);
    setEditSubmitting(true);
    try {
      const updated = await updateVariant(productId, v.id, {
        ...(withPrice
          ? {
              priceAmount: Number(editValues.priceAmount),
              currency: editValues.currency.trim() || 'EGP',
            }
          : {}),
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

  /**
   * A soft delete HIDES the variant, it does not remove it — so the row stays,
   * marked, with a way back.
   *
   * This used to drop the row from local state, which read as a permanent
   * delete until the next refresh brought it back looking untouched (owner,
   * 2026-08-21: "when i soft delete it and refresh the page it returns again").
   * The write was always fine; the screen was lying about what it did.
   */
  async function handleSoftDeleteVariant(v: ProductVariant) {
    await softDeleteVariant(productId, v.id);
    onVariantsChange(
      variants.map((x) => (x.id === v.id ? { ...x, isActive: false } : x)),
    );
    setDeleteTarget(null);
  }

  async function handleRestoreVariant(v: ProductVariant) {
    setRestoringId(v.id);
    try {
      await restoreVariant(productId, v.id);
      onVariantsChange(
        variants.map((x) => (x.id === v.id ? { ...x, isActive: true } : x)),
      );
    } finally {
      setRestoringId(null);
    }
  }

  async function handleHardDeleteVariant(v: ProductVariant, force = false) {
    await hardDeleteVariant(productId, v.id, force);
    onVariantsChange(variants.filter((x) => x.id !== v.id));
    // The row is gone, so the photo panel below it cannot keep naming it —
    // it would fall back to the literal words "selected variant".
    if (selectedVariantId === v.id) onSelectVariant(null);
    setDeleteTarget(null);
  }

  return (
    <section className="dash-form-section" data-trace-id="PG-DASHBOARD-CAT-003::EL-REGION-variants-section">
      {deleteTarget && (
        <DeleteChoiceDialog
          productName={deleteTarget.sku}
          onSoftDelete={() => handleSoftDeleteVariant(deleteTarget)}
          onHardDelete={(force) => handleHardDeleteVariant(deleteTarget, force)}
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
            onClick={() => {
              setAddResult(null);
              setShowForm(true);
            }}
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
          <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Fields</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => {
                const isSelected = selectedVariantId === v.id;
                // Absent means active — old fixtures and any read that predates
                // the mapper carrying the flag must not all look deleted.
                const hidden = v.isActive === false;
                return (
                <React.Fragment key={v.id}>
                  <tr
                    data-trace-id={`PG-DASHBOARD-CAT-003::EL-ROW-variant-row@${v.id}`}
                    data-active={isSelected ? 'true' : undefined}
                    data-hidden={hidden ? 'true' : undefined}
                    // Dimmed rather than removed: the operator needs to see
                    // that the delete landed, and needs the row present to
                    // undo it. Contrast stays above the readable floor.
                    style={hidden ? { opacity: 0.55 } : undefined}
                  >
                    <td>
                      <button
                        type="button"
                        className="dash-btn-ghost"
                        style={{
                          fontFamily: 'var(--mr-font-mono, monospace)',
                          padding: '2px 6px',
                          marginLeft: -6,
                        }}
                        title="Copy SKU"
                        onClick={() => handleCopySku(v.sku)}
                        data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-copy-variant-sku@${v.id}`}
                      >
                        {v.sku}
                        <span
                          aria-live="polite"
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            letterSpacing: '0.08em',
                            opacity: copiedSku === v.sku ? 1 : 0.45,
                          }}
                        >
                          {copiedSku === v.sku ? 'COPIED' : 'COPY'}
                        </span>
                      </button>
                      {hidden && (
                        <span
                          style={{
                            display: 'inline-block',
                            marginLeft: 8,
                            padding: '1px 6px',
                            border: '1px solid var(--mr-dash-danger, #c0392b)',
                            color: 'var(--mr-dash-danger, #c0392b)',
                            fontFamily: 'var(--mr-font-label)',
                            fontSize: 10,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Hidden
                        </span>
                      )}
                    </td>
                    <td>
                      {[
                        ...v.values.map((x) => `${x.attributeName}: ${x.optionName}`),
                        ...Object.entries(v.customValues ?? {}).map(
                          ([n, val]) => `${n}: ${val}`,
                        ),
                      ].join(' · ') || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {formatPrice(v.priceAmount, v.currency)}
                      {isHouse && (
                        <span className="vp-mode">
                          <span
                            className="vp-mode-label"
                            data-mode={modeOf(v) ?? 'unknown'}
                            data-trace-id={`PG-DASHBOARD-CAT-003::EL-TEXT-variant-mode@${v.id}`}
                          >
                            {modeOf(v)
                              ? MODE_LABEL[modeOf(v) as PricingMode]
                              : modes === null && !modesError
                                ? 'Reading mode…'
                                : 'Mode unavailable'}
                          </span>
                          <Link
                            href={accountingHref(v.id)}
                            className="vp-mode-link"
                            data-trace-id={`PG-DASHBOARD-CAT-003::EL-LINK-variant-change-in-accounting@${v.id}`}
                          >
                            Change in Accounting
                          </Link>
                        </span>
                      )}
                    </td>
                    {/* Stock is read here, changed in Inventory (owner,
                        2026-09-19, #101): one place writes quantities, so the
                        movement log there stays the whole story. */}
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                        data-trace-id={`PG-DASHBOARD-CAT-003::EL-TEXT-variant-stock@${v.id}`}
                      >
                        {v.stock}
                      </span>
                      <span className="vp-mode">
                        {v.stock === 0 && (
                          <span style={{ color: 'var(--mr-dash-danger, #c0392b)' }}>
                            Out of stock
                          </span>
                        )}
                        <Link
                          href={inventoryHref(v.sku)}
                          className="vp-mode-link"
                          data-trace-id={`PG-DASHBOARD-CAT-003::EL-LINK-variant-change-in-inventory@${v.id}`}
                        >
                          Change in Inventory
                        </Link>
                      </span>
                    </td>
                    <td>
                      {/* The only way to select a variant.

                          `onSelectVariant` was declared, passed down by the
                          page and never called (#15), so the row rendered a
                          selected state nothing could reach — and with it the
                          whole "Photos for <SKU>" section below the table,
                          which the page only renders once a variant is
                          selected (specs/006-gallery-module US3, T031). A
                          feature reachable by no click at all.

                          A toggle rather than a one-way select: clicking the
                          open one closes it, which is the only way back to
                          the unfiltered product photos above. */}
                      <button
                        type="button"
                        className="dash-btn-ghost"
                        aria-pressed={isSelected}
                        onClick={() => onSelectVariant(isSelected ? null : v.id)}
                        style={isSelected ? { fontWeight: 600 } : undefined}
                        data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-select-variant@${v.id}`}
                      >
                        {isSelected ? 'Hide photos' : 'Photos'}
                      </button>
                      <button
                        type="button"
                        className="dash-btn-ghost"
                        onClick={() => handleStartEdit(v)}
                        data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-edit-variant@${v.id}`}
                      >
                        Edit
                      </button>
                      {hidden && (
                        <button
                          type="button"
                          className="dash-btn-ghost"
                          onClick={() => void handleRestoreVariant(v)}
                          disabled={restoringId === v.id}
                          data-trace-id={`PG-DASHBOARD-CAT-003::EL-BTN-restore-variant@${v.id}`}
                        >
                          {restoringId === v.id ? 'Restoring…' : 'Restore'}
                        </button>
                      )}
                      {/* Delete stays available on a HIDDEN row too (owner,
                          2026-08-21: "what if i want to hard delete"). Hiding
                          it there would have left the only route to a
                          permanent delete running through Restore first — put
                          it back on sale, then delete it — which is exactly
                          the wrong order to do those two things in.

                          The dialog is the same one, and its hard-delete path
                          still refuses with a 409 when orders reference the
                          variant, so a sales record cannot be destroyed by
                          reaching this button from either state. */}
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
                          {!priceEditable(v) && (
                            <p className="vp-locked" data-trace-id={`PG-DASHBOARD-CAT-003::EL-TEXT-edit-variant-price-locked@${v.id}`}>
                              {modeOf(v) === 'SYSTEM'
                                ? `${formatPrice(v.priceAmount, v.currency)} is set by the system from this variant's cost, so it is not edited here. `
                                : modeOf(v) === 'MANUAL'
                                  ? `${formatPrice(v.priceAmount, v.currency)} is your price. Prices are changed in Accounting. `
                                  : `The price mode could not be read, so the price is not edited here. `}
                              <Link href={accountingHref(v.id)} className="vp-mode-link">
                                Change in Accounting
                              </Link>
                            </p>
                          )}
                          {priceEditable(v) && (
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
                          )}
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
            {/* SKU is generated by the server from category + brand + product
                name + this variant's values, and can never be edited. Shown
                read-only so nobody types one and expects it to stick. */}
            <div className="dash-field">
              <label className="dash-label" htmlFor="var-sku">
                SKU
              </label>
              <input
                id="var-sku"
                className="dash-input"
                value="Generated automatically on save"
                readOnly
                disabled
                data-trace-id="PG-DASHBOARD-CAT-003::EL-INPUT-add-variant-sku"
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
          {!isHouse && (
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
          )}

          <CustomFieldsEditor
            fields={formValues.customFields}
            onChange={(cf) => setField('customFields', cf)}
            disabled={submitting}
            idScope="add"
          />

          {isHouse && (
            <div className="vp-paths" data-trace-id="PG-DASHBOARD-CAT-003::EL-REGION-add-variant-pricing-paths">
              <section
                className="vp-path"
                aria-labelledby="vp-system-title"
                onKeyDown={(e) => submitOnEnter(e, () => void handleAddSystem())}
                data-trace-id="PG-DASHBOARD-CAT-003::EL-REGION-add-variant-system-price"
              >
                <h3 id="vp-system-title" className="vp-path-title">System price</h3>
                <p className="vp-path-line">Type what one unit cost you; the shop sets and updates the price.</p>
                <div className="vp-path-fields">
                  <div className="dash-field vp-field-amount">
                    <label className="dash-label" htmlFor="vp-system-cost">
                      Cost per unit ({house.systemKind === 'USD' ? 'USD' : 'EGP'})
                    </label>
                    <input
                      id="vp-system-cost"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className={`dash-input mr-num${systemError ? ' dash-input-error' : ''}`}
                      value={house.systemCost}
                      onChange={(e) => setHouseField('systemCost', e.target.value)}
                      placeholder="650"
                      disabled={submitting}
                      aria-invalid={systemError ? true : undefined}
                      aria-describedby={systemError ? 'vp-system-error' : undefined}
                      data-trace-id="PG-DASHBOARD-CAT-003::EL-INPUT-add-variant-system-cost"
                    />
                  </div>
                  <div className="dash-field">
                    <label className="dash-label" htmlFor="vp-system-kind">
                      Currency
                    </label>
                    <select
                      id="vp-system-kind"
                      className="dash-input"
                      value={house.systemKind}
                      onChange={(e) => setHouseField('systemKind', e.target.value as CostKind)}
                      disabled={submitting}
                      data-trace-id="PG-DASHBOARD-CAT-003::EL-SELECT-add-variant-system-currency"
                    >
                      {COST_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {systemError && (
                  <p id="vp-system-error" role="alert" className="dash-field-error">
                    {systemError}
                  </p>
                )}
                <button
                  type="button"
                  className="dash-btn-primary vp-path-add"
                  onClick={() => void handleAddSystem()}
                  disabled={submitting}
                  data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-add-variant-system-price"
                >
                  {submitting ? 'Adding…' : 'Add on System price'}
                </button>
              </section>

              <section
                className="vp-path"
                aria-labelledby="vp-my-title"
                onKeyDown={(e) => submitOnEnter(e, () => void handleAddMine())}
                data-trace-id="PG-DASHBOARD-CAT-003::EL-REGION-add-variant-my-price"
              >
                <h3 id="vp-my-title" className="vp-path-title">My price</h3>
                <p className="vp-path-line">
                  You set it; the slider and USD rate won&apos;t change it. Add the cost to see profit and get floor protection.
                </p>
                <div className="vp-path-fields">
                  <div className="dash-field vp-field-amount">
                    <label className="dash-label" htmlFor="vp-my-price">
                      Price (EGP)
                    </label>
                    <input
                      id="vp-my-price"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className={`dash-input mr-num${myError ? ' dash-input-error' : ''}`}
                      value={house.myPrice}
                      onChange={(e) => setHouseField('myPrice', e.target.value)}
                      placeholder="950"
                      disabled={submitting}
                      aria-invalid={myError ? true : undefined}
                      aria-describedby={myError ? 'vp-my-error' : undefined}
                      data-trace-id="PG-DASHBOARD-CAT-003::EL-INPUT-add-variant-my-price"
                    />
                  </div>
                </div>
                <div className="vp-path-fields">
                  <div className="dash-field vp-field-amount">
                    <label className="dash-label" htmlFor="vp-my-cost">
                      Cost per unit (optional)
                    </label>
                    <input
                      id="vp-my-cost"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="dash-input mr-num"
                      value={house.myCost}
                      onChange={(e) => setHouseField('myCost', e.target.value)}
                      placeholder="650"
                      disabled={submitting}
                      data-trace-id="PG-DASHBOARD-CAT-003::EL-INPUT-add-variant-my-cost"
                    />
                  </div>
                  <div className="dash-field">
                    <label className="dash-label" htmlFor="vp-my-kind">
                      Cost in
                    </label>
                    <select
                      id="vp-my-kind"
                      className="dash-input"
                      value={house.myKind}
                      onChange={(e) => setHouseField('myKind', e.target.value as CostKind)}
                      disabled={submitting}
                      data-trace-id="PG-DASHBOARD-CAT-003::EL-SELECT-add-variant-my-cost-currency"
                    >
                      {COST_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {myError && (
                  <p id="vp-my-error" role="alert" className="dash-field-error">
                    {myError}
                  </p>
                )}
                <button
                  type="button"
                  className="dash-btn-secondary vp-path-add"
                  onClick={() => void handleAddMine()}
                  disabled={submitting}
                  data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-add-variant-my-price"
                >
                  {submitting ? 'Adding…' : 'Add on My price'}
                </button>
              </section>
            </div>
          )}

          {submitError && <p className="dash-inline-error">{submitError}</p>}

          <div className="dash-form-actions">
            {!isHouse && (
              <button
                type="submit"
                className="dash-btn-primary"
                disabled={submitting}
                data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-submit-add-variant"
              >
                {submitting ? 'Adding…' : 'Add Variant'}
              </button>
            )}
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={closeAddForm}
              disabled={submitting}
              data-trace-id="PG-DASHBOARD-CAT-003::EL-BTN-cancel-add-variant"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {addResult && !showForm && (
        <div
          role="status"
          className="vp-result"
          data-mode={addResult.mode}
          data-trace-id="PG-DASHBOARD-CAT-003::EL-TEXT-add-variant-result"
        >
          <p className="vp-result-head">
            Added <span className="vp-result-sku">{addResult.sku}</span> on {MODE_LABEL[addResult.mode]}:{' '}
            <strong className="mr-num">{formatEgpMinor(addResult.priceMinor)}</strong>
          </p>
          {addResult.why && <p className="vp-result-why">{addResult.why}</p>}
          {addResult.warning && <p className="vp-result-warning">{addResult.warning}</p>}
        </div>
      )}
    </section>
  );
}

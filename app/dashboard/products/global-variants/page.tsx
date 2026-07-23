'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  listManagedBrands,
  listBrandGlobalVariants,
  createBrandGlobalVariant,
  updateBrandGlobalVariant,
  deleteBrandGlobalVariant,
  listAttributes,
  listAttributeOptions,
  type ManagedBrand,
} from '@/lib/catalog/api';
import type {
  BrandGlobalVariant,
  AttributeRecord,
  AttributeOptionRecord,
} from '@/lib/catalog/types';
import type { ApiError } from '@/lib/api/client';
import DeleteChoiceDialog from '@/components/dashboard/DeleteChoiceDialog';

const TRACE = 'PG-DASHBOARD-CAT-006';

/**
 * Global variants — the reusable variants a brand offers across its products.
 * specs/2026-07-22-product-tree-design.md
 *
 * Nothing here is fixed in code. A variant has a Label, and everything else
 * describing it comes from VARIANT-scoped option lists the admin creates under
 * Products → Option lists. "Size (ml)" used to be a hardcoded millilitre box,
 * which made the whole screen useless for anything that is not a liquid.
 *
 * There is deliberately no price. The same 50ml costs different amounts on
 * different products, so price is typed on the product itself.
 */
function VariantRow({
  variant,
  variantAttributes,
  optionsByAttribute,
  onUpdated,
  onDeleted,
}: {
  variant: BrandGlobalVariant;
  variantAttributes: AttributeRecord[];
  optionsByAttribute: Record<string, AttributeOptionRecord[]>;
  onUpdated: (v: BrandGlobalVariant) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(variant.label);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      (variant.values ?? []).map((v) => [v.attributeId, v.optionId]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    setError(null);
    try {
      onUpdated(
        await updateBrandGlobalVariant(variant.id, {
          label: label.trim(),
          values,
        }),
      );
      setEditing(false);
    } catch (e) {
      setError((e as ApiError).message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(mode: 'soft' | 'hard') {
    await deleteBrandGlobalVariant(variant.id, mode);
    setConfirmDelete(false);
    if (mode === 'hard') onDeleted(variant.id);
    else onUpdated({ ...variant, isActive: false });
  }

  const summary = (variant.values ?? [])
    .map((v) => `${v.attributeName}: ${v.optionName}`)
    .join(' · ');

  return (
    <>
      <tr
        style={variant.isActive ? undefined : { opacity: 0.55 }}
        data-trace-id={`${TRACE}::EL-ROW-global-variant@${variant.id}`}
      >
        <td>
          {editing ? (
            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  className="dash-input"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Name, e.g. 50ml"
                  disabled={saving}
                  maxLength={60}
                  autoFocus
                  data-trace-id={`${TRACE}::EL-INPUT-edit-label@${variant.id}`}
                />
                {variantAttributes.map((a) => (
                  <select
                    key={a.id}
                    className="dash-select"
                    value={values[a.id] ?? ''}
                    onChange={(e) => {
                      const next = { ...values };
                      if (e.target.value) next[a.id] = e.target.value;
                      else delete next[a.id];
                      setValues(next);
                    }}
                    disabled={saving}
                    style={{ maxWidth: 200 }}
                    data-trace-id={`${TRACE}::EL-SELECT-edit-value@${variant.id}-${a.id}`}
                  >
                    <option value="">{a.name}: not set</option>
                    {(optionsByAttribute[a.id] ?? []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {a.name}: {o.name}
                      </option>
                    ))}
                  </select>
                ))}
                <button className="dash-btn-primary" type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  className="dash-btn-secondary"
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setLabel(variant.label);
                    setError(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <strong>{variant.label}</strong>
              {summary && <span className="dash-muted"> · {summary}</span>}
              {!variant.isActive && <span className="dash-muted"> — deleted</span>}
            </>
          )}
          {error && <p className="dash-field-error">{error}</p>}
        </td>
        <td style={{ textAlign: 'right' }}>
          {!editing && (
            <>
              <button
                className="dash-btn-secondary"
                onClick={() => setEditing(true)}
                data-trace-id={`${TRACE}::EL-BTN-edit@${variant.id}`}
              >
                Edit
              </button>{' '}
              {variant.isActive ? (
                <button
                  className="dash-btn-secondary"
                  onClick={() => setConfirmDelete(true)}
                  data-trace-id={`${TRACE}::EL-BTN-delete@${variant.id}`}
                >
                  Delete
                </button>
              ) : (
                <button
                  className="dash-btn-secondary"
                  onClick={async () =>
                    onUpdated(
                      await updateBrandGlobalVariant(variant.id, {
                        isActive: true,
                      }),
                    )
                  }
                  data-trace-id={`${TRACE}::EL-BTN-restore@${variant.id}`}
                >
                  Restore
                </button>
              )}
            </>
          )}
        </td>
      </tr>
      {confirmDelete && (
        <tr>
          <td colSpan={2}>
            <DeleteChoiceDialog
              productName={variant.label}
              onSoftDelete={() => handleDelete('soft')}
              onHardDelete={() => handleDelete('hard')}
              onCancel={() => setConfirmDelete(false)}
              traceIdPrefix={`${TRACE}::EL-MODAL-delete@${variant.id}`}
              hardDeleteNote="Variants already added to products stay exactly as they are — they simply stop being linked to this shared one."
            />
          </td>
        </tr>
      )}
    </>
  );
}

export default function GlobalVariantsPage() {
  const [brands, setBrands] = useState<ManagedBrand[]>([]);
  const [brandId, setBrandId] = useState('');
  const [variants, setVariants] = useState<BrandGlobalVariant[]>([]);
  const [variantAttributes, setVariantAttributes] = useState<AttributeRecord[]>(
    [],
  );
  const [optionsByAttribute, setOptionsByAttribute] = useState<
    Record<string, AttributeOptionRecord[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState('');
  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listManagedBrands(), listAttributes(undefined, 'VARIANT')])
      .then(async ([brandRows, attrs]) => {
        if (cancelled) return;
        // Guarded: an endpoint that returns nothing set state to undefined and
        // the .length below blanked the page — the same bug Settings, Loyalty
        // and eleven other screens had.
        const safeBrands = Array.isArray(brandRows) ? brandRows : [];
        const safeAttrs = Array.isArray(attrs) ? attrs : [];
        setBrands(safeBrands);
        if (safeBrands.length > 0) setBrandId(safeBrands[0].id);
        setVariantAttributes(safeAttrs);
        const entries = await Promise.all(
          safeAttrs.map(
            async (a) => {
              const opts = await listAttributeOptions(a.id);
              return [a.id, Array.isArray(opts) ? opts : []] as const;
            },
          ),
        );
        if (!cancelled) setOptionsByAttribute(Object.fromEntries(entries));
      })
      .catch((e: ApiError) => {
        if (!cancelled) setLoadError(e.message ?? 'Could not load this page.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    listBrandGlobalVariants(brandId)
      .then((rows) => {
        if (!cancelled) setVariants(Array.isArray(rows) ? rows : []);
      })
      .catch((e: ApiError) => {
        if (!cancelled) setLoadError(e.message ?? 'Could not load this brand.');
      });
    return () => {
      cancelled = true;
    };
  }, [brandId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim() || !brandId) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createBrandGlobalVariant(brandId, {
        label: newLabel.trim(),
        values: newValues,
      });
      setVariants((prev) => [...prev, created]);
      setNewLabel('');
      setNewValues({});
    } catch (e) {
      setCreateError((e as ApiError).message ?? 'Could not add that.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div data-trace-id={`${TRACE}::EL-REGION-global-variants-page`}>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Global variants</h1>
        <Link
          href="/products"
          className="dash-btn-secondary"
          data-trace-id={`${TRACE}::EL-LINK-back-to-products`}
        >
          Back to products
        </Link>
      </div>

      <p className="dash-muted">
        Variants a brand reuses across its products. Give it a name, and
        describe it using your own option lists — nothing here is fixed. Add it
        to a product in one click, then set that product&apos;s price.
      </p>

      {loading && <p>Loading…</p>}
      {loadError && <p className="dash-inline-error">{loadError}</p>}

      {!loading && brands.length === 0 && (
        <p className="dash-muted">
          No brands yet. Add one under Products → Brands first.
        </p>
      )}

      {!loading && variantAttributes.length === 0 && (
        <p className="dash-muted">
          You have no variant option lists yet. Create one under Products →
          Option lists and set it to describe variants — for example a
          &ldquo;Size&rdquo; list with the sizes you sell.
        </p>
      )}

      {brands.length > 0 && (
        <div className="dash-field" style={{ maxWidth: 320 }}>
          <label className="dash-label" htmlFor="gv-brand">
            Brand
          </label>
          <select
            id="gv-brand"
            className="dash-select"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            data-trace-id={`${TRACE}::EL-SELECT-brand`}
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {brandId && (
        <>
          <form
            onSubmit={handleCreate}
            style={{ display: 'flex', gap: 8, margin: '16px 0', flexWrap: 'wrap' }}
          >
            <input
              className="dash-input"
              placeholder="Name, e.g. 50ml"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              disabled={creating}
              maxLength={60}
              data-trace-id={`${TRACE}::EL-INPUT-new-label`}
            />
            {variantAttributes.map((a) => (
              <select
                key={a.id}
                className="dash-select"
                value={newValues[a.id] ?? ''}
                onChange={(e) => {
                  const next = { ...newValues };
                  if (e.target.value) next[a.id] = e.target.value;
                  else delete next[a.id];
                  setNewValues(next);
                }}
                disabled={creating}
                style={{ maxWidth: 200 }}
                data-trace-id={`${TRACE}::EL-SELECT-new-value@${a.id}`}
              >
                <option value="">{a.name}: not set</option>
                {(optionsByAttribute[a.id] ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {a.name}: {o.name}
                  </option>
                ))}
              </select>
            ))}
            <button
              className="dash-btn-primary"
              type="submit"
              disabled={creating || !newLabel.trim()}
              data-trace-id={`${TRACE}::EL-BTN-create`}
            >
              {creating ? 'Adding…' : 'Add'}
            </button>
          </form>
          {createError && <p className="dash-inline-error">{createError}</p>}

          {variants.length === 0 ? (
            <p className="dash-muted">
              This brand has no shared variants yet.
            </p>
          ) : (
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <VariantRow
                    key={v.id}
                    variant={v}
                    variantAttributes={variantAttributes}
                    optionsByAttribute={optionsByAttribute}
                    onUpdated={(updated) =>
                      setVariants((prev) =>
                        prev.map((x) => (x.id === updated.id ? updated : x)),
                      )
                    }
                    onDeleted={(id) =>
                      setVariants((prev) => prev.filter((x) => x.id !== id))
                    }
                  />
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

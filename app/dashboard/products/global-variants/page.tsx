'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  listManagedBrands,
  listBrandGlobalVariants,
  createBrandGlobalVariant,
  updateBrandGlobalVariant,
  deleteBrandGlobalVariant,
  type ManagedBrand,
  type BrandGlobalVariant,
} from '@/lib/catalog/api';
import type { ApiError } from '@/lib/api/client';
import DeleteChoiceDialog from '@/components/dashboard/DeleteChoiceDialog';

const TRACE = 'PG-DASHBOARD-CAT-006';

/**
 * Global variants — the reusable variants a brand offers to all of its items.
 * specs/2026-07-22-product-tree-design.md
 *
 * Rewritten. The previous version listed EDP/EDT/Parfum/Hair Mist here, which
 * was wrong: those describe what a product IS and now live under Option lists.
 * A global variant is something like "50ml" that a brand reuses.
 *
 * Applying one to an item COPIES it, so each item keeps its own price and SKU
 * and nothing a customer already bought can be rewritten from here.
 */
function VariantRow({
  variant,
  onUpdated,
  onDeleted,
}: {
  variant: BrandGlobalVariant;
  onUpdated: (v: BrandGlobalVariant) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(variant.label);
  const [sizeMl, setSizeMl] = useState(
    variant.sizeMl === null ? '' : String(variant.sizeMl),
  );
  const [price, setPrice] = useState(variant.defaultPriceAmount ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const size = sizeMl.trim() ? Number(sizeMl) : null;
      onUpdated(
        await updateBrandGlobalVariant(variant.id, {
          label: label.trim(),
          sizeMl: size,
          defaultPriceAmount: price.trim() || null,
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

  return (
    <>
      <tr
        style={variant.isActive ? undefined : { opacity: 0.55 }}
        data-trace-id={`${TRACE}::EL-ROW-global-variant@${variant.id}`}
      >
        <td>
          {editing ? (
            <form onSubmit={handleSave} style={{ display: 'flex', gap: 8 }}>
              <input
                className="dash-input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label, e.g. 50ml"
                disabled={saving}
                maxLength={60}
                autoFocus
                data-trace-id={`${TRACE}::EL-INPUT-edit-label@${variant.id}`}
              />
              <input
                className="dash-input"
                value={sizeMl}
                onChange={(e) => setSizeMl(e.target.value)}
                placeholder="Size (ml)"
                inputMode="numeric"
                disabled={saving}
                style={{ maxWidth: 110 }}
                data-trace-id={`${TRACE}::EL-INPUT-edit-size@${variant.id}`}
              />
              <input
                className="dash-input"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Default price"
                inputMode="decimal"
                disabled={saving}
                style={{ maxWidth: 140 }}
                data-trace-id={`${TRACE}::EL-INPUT-edit-price@${variant.id}`}
              />
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
            </form>
          ) : (
            <>
              <strong>{variant.label}</strong>
              {variant.sizeMl !== null && (
                <span className="dash-muted"> · {variant.sizeMl} ml</span>
              )}
              {variant.defaultPriceAmount && (
                <span className="dash-muted"> · {variant.defaultPriceAmount}</span>
              )}
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
                  onClick={async () => {
                    onUpdated(
                      await updateBrandGlobalVariant(variant.id, {
                        isActive: true,
                      }),
                    );
                  }}
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState('');
  const [newSize, setNewSize] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listManagedBrands()
      .then((rows) => {
        if (cancelled) return;
        setBrands(rows);
        if (rows.length > 0) setBrandId(rows[0].id);
      })
      .catch((e: ApiError) => {
        if (!cancelled) setLoadError(e.message ?? 'Could not load brands.');
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
        if (!cancelled) setVariants(rows);
      })
      .catch((e: ApiError) => {
        if (!cancelled)
          setLoadError(e.message ?? 'Could not load this brand.');
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
        sizeMl: newSize.trim() ? Number(newSize) : null,
        defaultPriceAmount: newPrice.trim() || null,
      });
      setVariants((prev) => [...prev, created]);
      setNewLabel('');
      setNewSize('');
      setNewPrice('');
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
        Variants a brand reuses across its products — a size, for example. Add
        one here and it becomes a one-click option on every product of that
        brand. Applying it copies it, so each product keeps its own price and
        SKU.
      </p>

      {loading && <p>Loading…</p>}
      {loadError && <p className="dash-inline-error">{loadError}</p>}

      {!loading && brands.length === 0 && (
        <p className="dash-muted">
          No brands yet. Add one under Products → Brands first.
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
              placeholder="Label, e.g. 50ml"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              disabled={creating}
              maxLength={60}
              data-trace-id={`${TRACE}::EL-INPUT-new-label`}
            />
            <input
              className="dash-input"
              placeholder="Size (ml)"
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              disabled={creating}
              inputMode="numeric"
              style={{ maxWidth: 120 }}
              data-trace-id={`${TRACE}::EL-INPUT-new-size`}
            />
            <input
              className="dash-input"
              placeholder="Default price (optional)"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              disabled={creating}
              inputMode="decimal"
              style={{ maxWidth: 180 }}
              data-trace-id={`${TRACE}::EL-INPUT-new-price`}
            />
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

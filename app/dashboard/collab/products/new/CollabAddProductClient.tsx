'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import {
  CollabLoadingBlock,
  CollabPageHeader,
  CollabProfileGate,
  CollabTrustBanner,
} from '@/components/collab/collab-ui';
import {
  apiCollabCategories,
  apiCollabCreateProduct,
  apiCollabGetBrand,
  apiCollabOverview,
  type CollabCategory,
} from '@/lib/api/collab-portal';
import type { ApiError } from '@/lib/api/client';
import type { ProductMedia } from '@/lib/catalog/types';
import MediaSection from '@/app/dashboard/products/[slug]/edit/MediaSection';

export default function CollabAddProductClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trusted, setTrusted] = useState(false);
  const [brandSlug, setBrandSlug] = useState('');
  const [profileComplete, setProfileComplete] = useState(false);
  // No default/"Uncategorised" category exists any more (owner decision,
  // 2026-07-31) — a partner must pick one of their own before a product can
  // be saved at all. An empty list here means they have not created one yet.
  const [categories, setCategories] = useState<CollabCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  // Set once the product is created, so images can be attached before moving
  // on — same two-step flow the admin new-product screen already uses
  // (owner ask, 2026-07-31: the collab form lacked images/cover entirely).
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [media, setMedia] = useState<ProductMedia[]>([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    priceAmount: '',
    initialStock: '',
  });
  /**
   * Product-specific variant fields, e.g. Size / 50 ml.
   *
   * A collaborator product had no way to describe its variant at all — every one
   * was created as a hardcoded 50 ml with a random SKU. These also feed the SKU,
   * which is now generated the same way as on the admin side.
   */
  const [customFields, setCustomFields] = useState<{ name: string; value: string }[]>([
    { name: '', value: '' },
  ]);

  const setField = (index: number, patch: Partial<{ name: string; value: string }>) =>
    setCustomFields((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  useEffect(() => {
    Promise.all([apiCollabOverview(), apiCollabGetBrand(), apiCollabCategories()])
      .then(([overview, brand, cats]) => {
        setBrandSlug(overview.brandSlug);
        setTrusted(Boolean(overview.autoPublishProducts));
        setProfileComplete(Boolean(brand.displayName?.trim()));
        setCategories(cats.data ?? []);
      })
      .catch((err: ApiError) => setError(err.message || 'Failed to load workspace'))
      .finally(() => setLoading(false));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profileComplete) return;
    if (!categoryId) {
      setCategoryError('Category is required.');
      return;
    }
    setCategoryError(null);
    setSaving(true);
    setError(null);
    try {
      const payload: Parameters<typeof apiCollabCreateProduct>[0] = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        priceAmount: form.priceAmount.trim(),
        priceCurrency: 'EGP',
        categoryId,
      };
      const stock = form.initialStock.trim();
      if (stock) payload.initialStock = Number.parseInt(stock, 10);

      // Only rows with BOTH a name and a value: a half-filled row is someone
      // mid-thought, not data, and an empty key would break the SKU.
      const customValues = Object.fromEntries(
        customFields
          .map((row) => [row.name.trim(), row.value.trim()] as const)
          .filter(([name, value]) => name && value),
      );
      if (Object.keys(customValues).length) payload.customValues = customValues;

      const product = await apiCollabCreateProduct(payload);
      setCreatedProductId(product.id);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CollabLoadingBlock />;

  // Same two-step shape the admin new-product screen uses: save the fields
  // first, then attach images — a product must exist before an image can be
  // linked to it. This is the step that was missing entirely before (owner
  // ask, 2026-07-31: "the collab product form needs images/cover").
  if (createdProductId) {
    return (
      <>
        <CollabPageHeader
          title="Add images"
          subtitle="Every product must have a cover image before it can be sold."
          action={
            <Link href="/collab/products" className="dash-btn-primary">
              Done
            </Link>
          }
        />
        <MediaSection
          productId={createdProductId}
          productName={form.name}
          media={media}
          onMediaChange={setMedia}
          mediaBasePath="/collab"
        />
      </>
    );
  }

  return (
    <>
      <CollabPageHeader
        title="Add product"
        subtitle="Create a sellable SKU for your brand page."
        action={
          <Link href="/collab/products" className="dash-btn-ghost">
            Cancel
          </Link>
        }
      />

      {!profileComplete ? <CollabProfileGate brandSlug={brandSlug} /> : null}

      <form className="dash-form-card collab-product-form" onSubmit={onSubmit}>
        <CollabTrustBanner trusted={trusted} />

        <div className="dash-field">
          <label className="dash-label" htmlFor="prod-name">
            Product name
          </label>
          <input
            id="prod-name"
            className="dash-input"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nuit Santal 50ml EDP"
            required
            disabled={!profileComplete || saving}
          />
        </div>

        <div className="dash-field">
          <label className="dash-label" htmlFor="prod-category">
            Category <span className="dash-required">*</span>
          </label>
          {categories.length === 0 ? (
            <p className="dash-inline-error" role="alert">
              You have no categories yet.{' '}
              <Link href="/collab/categories">Create one</Link> before adding a
              product — every product must be categorized.
            </p>
          ) : (
            <>
              <select
                id="prod-category"
                className={`dash-select${categoryError ? ' dash-input-error' : ''}`}
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setCategoryError(null);
                }}
                required
                disabled={!profileComplete || saving}
              >
                <option value="">Select category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {categoryError && <p className="dash-field-error">{categoryError}</p>}
            </>
          )}
        </div>

        <div className="dash-field">
          <label className="dash-label" htmlFor="prod-desc">
            Description
          </label>
          <textarea
            id="prod-desc"
            className="dash-input"
            rows={4}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            disabled={!profileComplete || saving}
          />
        </div>

        <div className="dash-field-row">
          <div className="dash-field">
            <label className="dash-label" htmlFor="prod-price">
              Price (EGP)
            </label>
            <input
              id="prod-price"
              className="dash-input"
              inputMode="decimal"
              value={form.priceAmount}
              onChange={(e) => setForm((f) => ({ ...f, priceAmount: e.target.value }))}
              placeholder="1299.00"
              pattern="^\d+(\.\d{1,4})?$"
              required
              disabled={!profileComplete || saving}
            />
          </div>
          <div className="dash-field">
            <label className="dash-label" htmlFor="prod-stock">
              Initial stock
            </label>
            <input
              id="prod-stock"
              className="dash-input"
              inputMode="numeric"
              value={form.initialStock}
              onChange={(e) => setForm((f) => ({ ...f, initialStock: e.target.value }))}
              placeholder="25"
              min={0}
              disabled={!profileComplete || saving}
            />
          </div>
        </div>

        <div className="dash-field">
          <label className="dash-label">Variant details (optional)</label>
          <p className="dash-help-text" style={{ marginTop: 0, marginBottom: 8 }}>
            What makes this version distinct — e.g. Size / 50 ml, or Shade / Amber.
            These appear on the product and are used to build its SKU.
          </p>
          {customFields.map((row, i) => (
            <div
              key={i}
              style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}
            >
              <input
                className="dash-input"
                style={{ flex: '1 1 140px' }}
                placeholder="Field name"
                aria-label={`Custom field ${i + 1} name`}
                value={row.name}
                onChange={(e) => setField(i, { name: e.target.value })}
                disabled={!profileComplete || saving}
              />
              <input
                className="dash-input"
                style={{ flex: '1 1 140px' }}
                placeholder="Value"
                aria-label={`Custom field ${i + 1} value`}
                value={row.value}
                onChange={(e) => setField(i, { value: e.target.value })}
                disabled={!profileComplete || saving}
              />
              {customFields.length > 1 && (
                <button
                  type="button"
                  className="dash-btn-ghost"
                  onClick={() =>
                    setCustomFields((rows) => rows.filter((_, idx) => idx !== i))
                  }
                  disabled={saving}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {/* Capped at the same 10 the API accepts, so the form cannot offer a row
              that would be rejected on save. */}
          {customFields.length < 10 && (
            <button
              type="button"
              className="dash-btn-secondary"
              onClick={() => setCustomFields((rows) => [...rows, { name: '', value: '' }])}
              disabled={!profileComplete || saving}
            >
              + Add field
            </button>
          )}
        </div>

        {error ? (
          <p className="dash-inline-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="dash-form-actions">
          <button
            type="submit"
            className="dash-btn-primary"
            disabled={!profileComplete || saving || categories.length === 0}
          >
            {saving ? 'Adding…' : 'Add product'}
          </button>
        </div>
      </form>
    </>
  );
}

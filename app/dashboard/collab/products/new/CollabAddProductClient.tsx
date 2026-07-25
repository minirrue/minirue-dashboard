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
  apiCollabCreateProduct,
  apiCollabGetBrand,
  apiCollabOverview,
} from '@/lib/api/collab-portal';
import type { ApiError } from '@/lib/api/client';

export default function CollabAddProductClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trusted, setTrusted] = useState(false);
  const [brandSlug, setBrandSlug] = useState('');
  const [profileComplete, setProfileComplete] = useState(false);
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
    Promise.all([apiCollabOverview(), apiCollabGetBrand()])
      .then(([overview, brand]) => {
        setBrandSlug(overview.brandSlug);
        setTrusted(Boolean(overview.autoPublishProducts));
        setProfileComplete(Boolean(brand.displayName?.trim()));
      })
      .catch((err: ApiError) => setError(err.message || 'Failed to load workspace'))
      .finally(() => setLoading(false));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profileComplete) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Parameters<typeof apiCollabCreateProduct>[0] = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        priceAmount: form.priceAmount.trim(),
        priceCurrency: 'EGP',
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

      await apiCollabCreateProduct(payload);
      router.push('/collab/products');
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CollabLoadingBlock />;

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
            disabled={!profileComplete || saving}
          >
            {saving ? 'Adding…' : 'Add product'}
          </button>
        </div>
      </form>
    </>
  );
}

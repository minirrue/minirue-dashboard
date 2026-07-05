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

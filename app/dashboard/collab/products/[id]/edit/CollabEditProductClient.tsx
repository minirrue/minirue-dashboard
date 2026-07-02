'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import {
  CollabErrorPanel,
  CollabLoadingBlock,
  CollabPageHeader,
  CollabTrustBanner,
  ProductStatusBadge,
} from '@/components/collab/collab-ui';
import {
  apiCollabOverview,
  apiCollabProducts,
  apiCollabUpdateProduct,
} from '@/lib/api/collab-portal';
import type { ApiError } from '@/lib/api/client';

type ProductRow = {
  id?: string;
  name?: string;
  description?: string;
  priceAmount?: string;
  price_amount?: string;
  initialStock?: number;
  stock?: number;
  published_state?: string;
  publishedState?: string;
  status?: string;
  rejectionReason?: string | null;
  rejection_reason?: string | null;
};

export default function CollabEditProductClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trusted, setTrusted] = useState(false);
  const [publishedState, setPublishedState] = useState('DRAFT');
  const [form, setForm] = useState({
    name: '',
    description: '',
    priceAmount: '',
    initialStock: '',
  });

  useEffect(() => {
    if (!id) return;
    Promise.all([apiCollabOverview(), apiCollabProducts()])
      .then(([overview, products]) => {
        setTrusted(Boolean(overview.autoPublishProducts));
        const row = (products.items ?? []).find(
          (item) => String((item as ProductRow).id) === id,
        ) as ProductRow | undefined;
        if (!row) {
          setError('Product not found');
          return;
        }
        setPublishedState(
          row.published_state ?? row.publishedState ?? row.status ?? 'DRAFT',
        );
        setForm({
          name: String(row.name ?? ''),
          description: String(row.description ?? ''),
          priceAmount: String(row.priceAmount ?? row.price_amount ?? ''),
          initialStock:
            row.initialStock != null
              ? String(row.initialStock)
              : row.stock != null
                ? String(row.stock)
                : '',
        });
      })
      .catch((err: ApiError) => setError(err.message || 'Failed to load product'))
      .finally(() => setLoading(false));
  }, [id]);

  const onUnpublish = async () => {
    if (!id || publishedState !== 'PUBLISHED') return;
    if (!window.confirm('Unpublish this product? It will be removed from the storefront.')) {
      return;
    }
    setUnpublishing(true);
    setError(null);
    try {
      await apiCollabUpdateProduct(id, { unpublish: true });
      router.push('/dashboard/collab/products');
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to unpublish product');
    } finally {
      setUnpublishing(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Parameters<typeof apiCollabUpdateProduct>[1] = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        priceAmount: form.priceAmount.trim(),
      };
      const stock = form.initialStock.trim();
      if (stock) payload.initialStock = Number.parseInt(stock, 10);
      await apiCollabUpdateProduct(id, payload);
      router.push('/dashboard/collab/products');
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CollabLoadingBlock />;

  if (error && !form.name) {
    return (
      <CollabErrorPanel
        message={error}
        action={
          <Link href="/dashboard/collab/products" className="dash-btn-secondary">
            Back to products
          </Link>
        }
      />
    );
  }

  return (
    <>
      <CollabPageHeader
        title="Edit product"
        subtitle={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Update SKU details
            <ProductStatusBadge state={publishedState} />
          </span>
        }
        action={
          <Link href="/dashboard/collab/products" className="dash-btn-ghost">
            Cancel
          </Link>
        }
      />

      <form className="dash-form-card collab-product-form" onSubmit={onSubmit}>
        <CollabTrustBanner trusted={trusted} />

        <div className="dash-field">
          <label className="dash-label" htmlFor="edit-name">
            Product name
          </label>
          <input
            id="edit-name"
            className="dash-input"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            disabled={saving}
          />
        </div>

        <div className="dash-field">
          <label className="dash-label" htmlFor="edit-desc">
            Description
          </label>
          <textarea
            id="edit-desc"
            className="dash-input"
            rows={4}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            disabled={saving}
          />
        </div>

        <div className="dash-field-row">
          <div className="dash-field">
            <label className="dash-label" htmlFor="edit-price">
              Price (EGP)
            </label>
            <input
              id="edit-price"
              className="dash-input"
              inputMode="decimal"
              value={form.priceAmount}
              onChange={(e) => setForm((f) => ({ ...f, priceAmount: e.target.value }))}
              pattern="^\d+(\.\d{1,4})?$"
              required
              disabled={saving}
            />
          </div>
          <div className="dash-field">
            <label className="dash-label" htmlFor="edit-stock">
              Stock
            </label>
            <input
              id="edit-stock"
              className="dash-input"
              inputMode="numeric"
              value={form.initialStock}
              onChange={(e) => setForm((f) => ({ ...f, initialStock: e.target.value }))}
              min={0}
              disabled={saving}
            />
          </div>
        </div>

        {error ? <p className="dash-inline-error">{error}</p> : null}

        <div className="dash-form-actions">
          {publishedState === 'PUBLISHED' ? (
            <button
              type="button"
              className="dash-btn-secondary"
              disabled={saving || unpublishing}
              onClick={onUnpublish}
            >
              {unpublishing ? 'Unpublishing…' : 'Unpublish'}
            </button>
          ) : null}
          <button type="submit" className="dash-btn-primary" disabled={saving || unpublishing}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </>
  );
}

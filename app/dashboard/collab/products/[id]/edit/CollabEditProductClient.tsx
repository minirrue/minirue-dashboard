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
  apiCollabCategories,
  apiCollabOverview,
  apiCollabUpdateProduct,
  type CollabCategory,
} from '@/lib/api/collab-portal';
import { getProduct } from '@/lib/catalog/api';
import type { Product, ProductMedia } from '@/lib/catalog/types';
import type { ApiError } from '@/lib/api/client';
import MediaSection from '@/app/dashboard/products/[slug]/edit/MediaSection';

export default function CollabEditProductClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trusted, setTrusted] = useState(false);
  const [publishedState, setPublishedState] = useState('DRAFT');
  const [categories, setCategories] = useState<CollabCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [media, setMedia] = useState<ProductMedia[]>([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    priceAmount: '',
    initialStock: '',
  });

  useEffect(() => {
    if (!id) return;
    // GET /collab/products/:id — same shape (variants + media, resolved to
    // servable URLs) as the admin edit screen's own getProduct(), reused
    // here via CollabProductsService.getProductDetail rather than a second
    // fetch-the-list-and-find-by-id detour that never carried media at all.
    Promise.all([
      apiCollabOverview(),
      getProduct(id, '/collab') as Promise<Product>,
      apiCollabCategories(),
    ])
      .then(([overview, product, cats]) => {
        setTrusted(Boolean(overview.autoPublishProducts));
        setCategories(cats.data ?? []);
        setPublishedState(product.status);
        setCategoryId(product.categoryId);
        setMedia(product.media ?? []);
        const activeVariant = product.variants.find((v) => v.stock !== undefined) ?? product.variants[0];
        setForm({
          name: product.name,
          description: product.description ?? '',
          priceAmount: activeVariant ? String(activeVariant.priceAmount) : '',
          initialStock: activeVariant ? String(activeVariant.stock) : '',
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
      router.push('/collab/products');
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
    if (!categoryId) {
      setCategoryError('Category is required.');
      return;
    }
    setCategoryError(null);
    setSaving(true);
    setError(null);
    try {
      const payload: Parameters<typeof apiCollabUpdateProduct>[1] = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        priceAmount: form.priceAmount.trim(),
        categoryId,
      };
      const stock = form.initialStock.trim();
      if (stock) payload.initialStock = Number.parseInt(stock, 10);
      await apiCollabUpdateProduct(id, payload);
      router.push('/collab/products');
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
          <Link href="/collab/products" className="dash-btn-secondary">
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
          <Link href="/collab/products" className="dash-btn-ghost">
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
          <label className="dash-label" htmlFor="edit-category">
            Category <span className="dash-required">*</span>
          </label>
          <select
            id="edit-category"
            className={`dash-select${categoryError ? ' dash-input-error' : ''}`}
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setCategoryError(null);
            }}
            required
            disabled={saving}
          >
            <option value="">Select category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {categoryError && <p className="dash-field-error">{categoryError}</p>}
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
              type="number"
              inputMode="numeric"
              step={1}
              value={form.initialStock}
              onChange={(e) => setForm((f) => ({ ...f, initialStock: e.target.value }))}
              min={0}
              disabled={saving}
            />
            {/* This field existed but the API ignored it on update, so a stock
                correction silently did nothing. It now sets the sellable quantity
                (backend 0.39.0). */}
            <p className="dash-help-text">
              Units available to sell. 0 shows the product as out of stock.
            </p>
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

      {/* Same images/cover mechanism as the admin product form — owner ask,
          2026-07-31: "the collab product form needs images/cover... whats
          the cover ? whats the last image ? what the images rest of them".
          mediaBasePath scopes every request this renders to this
          collaborator's own product, never the admin-only routes. */}
      {id ? (
        <MediaSection
          productId={id}
          productName={form.name}
          media={media}
          onMediaChange={setMedia}
          mediaBasePath="/collab"
        />
      ) : null}
    </>
  );
}

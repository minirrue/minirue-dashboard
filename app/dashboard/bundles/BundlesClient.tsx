'use client';

import React from 'react';
import CatalogSubnav from '@/components/dashboard/CatalogSubnav';
import ImageField from '@/components/dashboard/ImageField';
import {
  createBundle,
  deleteBundle,
  listBundles,
  slugify,
  updateBundle,
  type Bundle,
  type BundleMemberInput,
} from '@/lib/api/bundles';
import { listProducts } from '@/lib/catalog/api';
import BundleProductPicker from './BundleProductPicker';
import type { ProductListItem } from '@/lib/catalog/types';
import { errorMessageToText } from '@/lib/api/client';

function money(minor: number): string {
  return (minor / 100).toFixed(2);
}

/**
 * Bundles — import existing products, name the set, give it one price.
 *
 * A set can ONLY contain products that already exist in the Products tab. There
 * is no way to invent one here: the picker offers rows from the catalogue and
 * nothing else, the list is fetched with `space: 'house'` so a partner's product
 * is never offered, and the server re-reads every id on save and refuses the
 * request if any belongs to a collaborator. Three layers, because a picker is a
 * convenience and the endpoint takes ids that anything could send.
 */
export default function BundlesClient() {
  const [rows, setRows] = React.useState<Bundle[]>([]);
  const [products, setProducts] = React.useState<ProductListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [name, setName] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [imageUrl, setImageUrl] = React.useState('');
  /** This set's own cover, picked from the gallery (migration 0220). Replaces the
   *  paste-a-URL box: a stored URL drifts out of imgproxy signature validity,
   *  which is the defect already fixed twice for avatars and brand logos. */
  const [imageMediaId, setImageMediaId] = React.useState<string | null>(null);
  const [isActive, setIsActive] = React.useState(false);
  const [members, setMembers] = React.useState<BundleMemberInput[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bundles, prods] = await Promise.all([
        listBundles(),
        // 'house' = MiniRue's own catalogue. A partner's product must never
        // appear in this list.
        listProducts({ limit: 200, space: 'house' }),
      ]);
      setRows(bundles);
      setProducts(prods.items);
    } catch (e) {
      setError(errorMessageToText(e, 'Could not load bundles'));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const priceMinor = Math.round(Number(price || '0') * 100);

  /**
   * What the chosen members cost separately, so the saving is visible while the
   * price is being typed. A set priced ABOVE its parts is not rejected — there
   * are reasons to sell a gift box for more — but it should never happen by
   * accident, and this makes it impossible to miss.
   */
  const listTotalMinor = React.useMemo(
    () =>
      members.reduce((sum, m) => {
        const p = products.find((x) => x.id === m.productId);
        const unit = p ? Math.round((p.basePrice ?? 0) * 100) : 0;
        return sum + unit * m.quantity;
      }, 0),
    [members, products],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (members.length === 0) {
      setError('A set needs at least one product.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createBundle({
        name: name.trim(),
        slug: slugify(name),
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        imageMediaId,
        priceMinor,
        isActive,
        members,
      });
      setName('');
      setPrice('');
      setDescription('');
      setImageUrl('');
      setIsActive(false);
      setMembers([]);
      await load();
    } catch (e) {
      setError(errorMessageToText(e, 'Could not create the set'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleLive(bundle: Bundle) {
    setError(null);
    try {
      await updateBundle(bundle.id, { isActive: !bundle.isActive });
      await load();
    } catch (e) {
      setError(errorMessageToText(e, 'Could not change the set'));
    }
  }

  async function remove(bundle: Bundle) {
    if (!window.confirm(`Delete "${bundle.name}"? Past orders are unaffected.`))
      return;
    setError(null);
    try {
      await deleteBundle(bundle.id);
      await load();
    } catch (e) {
      setError(errorMessageToText(e, 'Could not delete the set'));
    }
  }

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Bundles</h1>
      </div>
      <CatalogSubnav />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {error && <p className="dash-error">{error}</p>}

        <section className="dash-card">
          <h2 className="dash-card-title">New bundle</h2>
          <form onSubmit={submit}>
            <div className="dash-form-grid">
              <div className="dash-field">
                <label className="dash-label" htmlFor="b-name">
                  Name <span className="dash-required">*</span>
                </label>
                <input
                  id="b-name"
                  className="dash-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Evening Set"
                  required
                />
                {name && <p className="dash-help-text">Web address: /bundles/{slugify(name)}</p>}
              </div>

              <div className="dash-field">
                <label className="dash-label" htmlFor="b-price">
                  Price for the whole set (EGP) <span className="dash-required">*</span>
                </label>
                <input
                  id="b-price"
                  className="dash-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>

              <div className="dash-field">
                <ImageField
                  label="Photo"
                  helpText="This set's own picture. Separate from the Bundles tile on the shop page, which is set under Categories."
                  imageUrl={imageUrl || null}
                  mediaId={imageMediaId}
                  onChange={(mediaId, item) => {
                    setImageMediaId(mediaId);
                    // Keep the display URL in step so the tile redraws at once;
                    // the id is what actually gets saved.
                    setImageUrl(item?.url ?? '');
                  }}
                />
              </div>

              <div className="dash-field">
                <label className="dash-label" htmlFor="b-desc">Description</label>
                <input
                  id="b-desc"
                  className="dash-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <BundleProductPicker
              products={products}
              members={members}
              onChange={setMembers}
              loading={loading}
            />

            <div className="dash-form-section">
              {members.length > 0 && (
                <p className="dash-help-text">
                  Bought separately: EGP {money(listTotalMinor)}.{' '}
                  {priceMinor > 0 && priceMinor < listTotalMinor
                    ? `This set saves the shopper EGP ${money(listTotalMinor - priceMinor)}.`
                    : priceMinor > listTotalMinor
                      ? 'This set costs MORE than buying the pieces separately.'
                      : ''}
                </p>
              )}
            </div>

            <div className="dash-field-row">
              <label className="dash-checkbox-label">
                <input
                  type="checkbox"
                  className="dash-checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>Show it in the shop straight away</span>
              </label>
            </div>

            <div className="dash-form-actions">
              <button type="submit" className="dash-btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Create bundle'}
              </button>
            </div>
            <p className="dash-help-text">
              Only MiniRue&rsquo;s own products can go in a set. Discount codes
              never apply to a set, and a set disappears from the shop by itself
              if any piece runs out.
            </p>
          </form>
        </section>

        <section className="dash-card">
          <h2 className="dash-card-title">Bundles</h2>
          {loading ? (
            <p className="dash-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="dash-panel-empty">No bundles yet.</p>
          ) : (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Inside</th>
                    <th>Price</th>
                    <th>Separately</th>
                    <th>In shop</th>
                    <th>Stock</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={b.id}>
                      <td>
                        {b.name}
                        <br />
                        <code className="dash-slug">/bundles/{b.slug}</code>
                      </td>
                      <td>
                        {b.members
                          .map((m) => `${m.quantity > 1 ? `${m.quantity}× ` : ''}${m.productName}`)
                          .join(', ')}
                      </td>
                      <td>
                        {b.currency} {money(b.priceMinor)}
                      </td>
                      <td>
                        {money(b.listTotalMinor)}
                        {b.savingMinor > 0 && ` (saves ${money(b.savingMinor)})`}
                      </td>
                      <td>{b.isActive ? 'Live' : 'Hidden'}</td>
                      <td>
                        {b.inStock ? (
                          'Available'
                        ) : (
                          <span className="dash-muted">A piece is out of stock</span>
                        )}
                      </td>
                      <td className="dash-row-actions">
                        <button
                          type="button"
                          className="dash-btn-secondary"
                          onClick={() => void toggleLive(b)}
                        >
                          {b.isActive ? 'Hide' : 'Show'}
                        </button>
                        <button
                          type="button"
                          className="dash-btn-danger"
                          onClick={() => void remove(b)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

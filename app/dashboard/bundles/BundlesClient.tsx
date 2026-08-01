'use client';

import React from 'react';
import CatalogSubnav from '@/components/dashboard/CatalogSubnav';
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
import type { ProductListItem } from '@/lib/catalog/types';
import { errorMessageToText } from '@/lib/api/client';

const MAX_MEMBERS = 6;

function money(minor: number): string {
  return (minor / 100).toFixed(2);
}

/**
 * Bundles — pick products, name the set, give it one price.
 *
 * The product picker asks the catalogue for MiniRue's own products only
 * (`space: 'house'`). That is a convenience, not the rule: the backend re-checks
 * every member on save, because a set holding a partner's product would be a
 * back door around "a partner's price is never cut".
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

  function addMember() {
    if (members.length >= MAX_MEMBERS) return;
    const first = products.find((p) => !members.some((m) => m.productId === p.id));
    if (!first) return;
    setMembers([...members, { productId: first.id, quantity: 1 }]);
  }

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
                <label className="dash-label" htmlFor="b-image">Photo URL</label>
                <input
                  id="b-image"
                  className="dash-input"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="paste from Gallery"
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

            <div className="dash-form-section">
              <div className="dash-panel-head">
                <h3 className="dash-section-title">
                  What is inside ({members.length}/{MAX_MEMBERS})
                </h3>
                <button
                  type="button"
                  className="dash-btn-secondary"
                  onClick={addMember}
                  disabled={members.length >= MAX_MEMBERS || products.length === 0}
                >
                  Add product
                </button>
              </div>

              {products.length === 0 && !loading && (
                <p className="dash-help-text">
                  There are no MiniRue products yet, so there is nothing to put
                  in a set. Add products under Catalogue first.
                </p>
              )}

              {members.map((m, i) => (
                <div key={i} className="dash-field-row">
                  <div className="dash-field" style={{ flex: 3 }}>
                    <label className="dash-label" htmlFor={`b-m-${i}`}>Product</label>
                    <select
                      id={`b-m-${i}`}
                      className="dash-select"
                      value={m.productId}
                      onChange={(e) => {
                        const next = [...members];
                        next[i] = { ...m, productId: e.target.value };
                        setMembers(next);
                      }}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.brandName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="dash-field" style={{ flex: 1 }}>
                    <label className="dash-label" htmlFor={`b-q-${i}`}>How many</label>
                    <input
                      id={`b-q-${i}`}
                      className="dash-input"
                      type="number"
                      min="1"
                      max="99"
                      value={m.quantity}
                      onChange={(e) => {
                        const next = [...members];
                        next[i] = { ...m, quantity: Number(e.target.value) || 1 };
                        setMembers(next);
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="dash-btn-ghost"
                    onClick={() => setMembers(members.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </div>
              ))}

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

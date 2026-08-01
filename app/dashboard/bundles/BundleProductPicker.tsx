'use client';

import React from 'react';
import Link from 'next/link';
import type { ProductListItem } from '@/lib/catalog/types';
import type { BundleMemberInput } from '@/lib/api/bundles';

const MAX_MEMBERS = 6;

function money(minor: number): string {
  return (minor / 100).toFixed(2);
}

/**
 * Import products into a set.
 *
 * **A bundle can only ever contain products that already exist in the Products
 * tab.** Nothing here creates a product, and there is no free-text field that
 * could — you search what is already in the catalogue and tick it. That rule is
 * enforced three times over, on purpose:
 *
 *   1. Here, structurally: the only way to add a member is to pick a real row
 *      out of the list this component was handed.
 *   2. In the list itself: it is fetched with `space: 'house'`, so a partner's
 *      product is not even offered.
 *   3. On the server, on every save: `assertAllMinirueOwned` re-reads each id
 *      and refuses the whole request if any belongs to a collaborator. A picker
 *      is a convenience, not a guard — this endpoint takes ids, and ids can be
 *      sent by anything.
 *
 * A search box rather than a dropdown: a `<select>` of two hundred perfumes is
 * unusable, and picking the wrong one is silent — it looks like a set you meant
 * to build, priced against products you did not choose.
 */
export default function BundleProductPicker({
  products,
  members,
  onChange,
  loading,
}: {
  products: ProductListItem[];
  members: BundleMemberInput[];
  onChange: (next: BundleMemberInput[]) => void;
  loading: boolean;
}) {
  const [query, setQuery] = React.useState('');

  const byId = React.useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const chosen = new Set(members.map((m) => m.productId));

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => !chosen.has(p.id))
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.brandName.toLowerCase().includes(q),
      )
      .slice(0, 20);
    // `chosen` is derived from members each render; listing it as a dep would
    // be a new Set every time and defeat the memo entirely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, query, members]);

  const full = members.length >= MAX_MEMBERS;

  function add(p: ProductListItem) {
    if (full) return;
    onChange([...members, { productId: p.id, quantity: 1 }]);
    setQuery('');
  }

  return (
    <div className="dash-form-section">
      <div className="dash-panel-head">
        <h3 className="dash-section-title">
          What is inside ({members.length}/{MAX_MEMBERS})
        </h3>
      </div>

      {/* Chosen members first — this is the set being built, and it should not
          be below a list of things that are not in it. */}
      {members.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {members.map((m, i) => {
            const p = byId.get(m.productId);
            return (
              <div
                key={`${m.productId}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  border: '1px solid var(--mr-dash-hair)',
                  borderRadius: 'var(--mr-radius-sm)',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ flex: 1, minWidth: 180 }}>
                  <strong>{p?.name ?? 'Unknown product'}</strong>
                  <span className="dash-muted"> · {p?.brandName ?? '—'}</span>
                  {p && (
                    <span className="dash-muted">
                      {' '}
                      · {p.currency} {p.basePrice.toFixed(2)} each
                    </span>
                  )}
                </span>

                <label
                  className="dash-label"
                  htmlFor={`bm-qty-${i}`}
                  style={{ margin: 0 }}
                >
                  Qty
                </label>
                <input
                  id={`bm-qty-${i}`}
                  className="dash-input"
                  type="number"
                  min="1"
                  max="99"
                  value={m.quantity}
                  onChange={(e) => {
                    const next = [...members];
                    next[i] = {
                      ...m,
                      quantity: Math.max(1, Number(e.target.value) || 1),
                    };
                    onChange(next);
                  }}
                  style={{ width: 80 }}
                />

                <button
                  type="button"
                  className="dash-btn-ghost"
                  onClick={() => onChange(members.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <p className="dash-help-text">Loading your products…</p>
      ) : products.length === 0 ? (
        <p className="dash-help-text">
          Your catalogue has no MiniRue products yet, so there is nothing to put
          in a set. A bundle can only hold products that already exist —{' '}
          <Link className="dash-link" href="/catalogue/products">
            add them under Products
          </Link>{' '}
          first, then come back.
        </p>
      ) : full ? (
        <p className="dash-help-text">
          A set holds at most {MAX_MEMBERS} products. Remove one to add another.
        </p>
      ) : (
        <>
          <div className="dash-field">
            <label className="dash-label" htmlFor="bundle-product-search">
              Add a product from your catalogue
            </label>
            <input
              id="bundle-product-search"
              className="dash-input dash-input-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by product or brand…"
              autoComplete="off"
            />
          </div>

          {matches.length === 0 ? (
            <p className="dash-help-text">
              {query.trim()
                ? `Nothing in your catalogue matches “${query.trim()}”.`
                : 'Every product in your catalogue is already in this set.'}
            </p>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                maxHeight: 260,
                overflowY: 'auto',
                marginTop: 8,
              }}
            >
              {matches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => add(p)}
                  className="dash-btn-ghost"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    textAlign: 'left',
                    width: '100%',
                    padding: '8px 12px',
                  }}
                >
                  <span>
                    {p.name}
                    <span className="dash-muted"> · {p.brandName}</span>
                    {/* A draft is offered, but labelled: a set containing an
                        unpublished product is legitimate while you build it,
                        and a silent one would be a set that never appears. */}
                    {p.status !== 'PUBLISHED' && (
                      <span className="dash-muted"> · {p.status.toLowerCase()}</span>
                    )}
                  </span>
                  <span className="dash-muted">
                    {p.currency} {p.basePrice.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export { MAX_MEMBERS, money };

'use client';

import React from 'react';
import Link from 'next/link';
import RetryingImage from '@/components/dashboard/RetryingImage';
import type { ProductListItem, ProductVariant } from '@/lib/catalog/types';
import {
  MAX_MEMBERS,
  MAX_UNITS_PER_LINE,
  formatMinor,
  moveMember,
  type DraftMember,
} from './bundle-economics';

/** Results shown at once. Past this, typing narrows faster than scrolling. */
const RESULT_LIMIT = 8;

export type VariantState = ProductVariant[] | 'loading' | 'error' | undefined;

/**
 * What goes in the set.
 *
 * Three things were wrong with the list this replaces, and they were the same
 * thing: the screen was organised around the CATALOGUE rather than around the
 * set being built.
 *
 *   1. The catalogue rendered by default. An empty search box sat above twenty
 *      products the admin had not asked for, so the tallest thing on a New
 *      bundle page was a list of everything that was not in the bundle. The
 *      search box already existed — the list is now its result. Nothing shows
 *      until you type, or until you deliberately ask to browse.
 *   2. The cap was a secret. `(0/6)` is the only place the number appeared, and
 *      `/6` next to a count reads as progress, not as a ceiling. It is stated
 *      in words now, before the first line is added.
 *   3. A member was a product, never a variant — and the backend has taken a
 *      `variantId` per member the whole time. Sending none is not "no opinion":
 *      `BundlesService.detail` resolves a variant-less member to the product's
 *      CHEAPEST variant. So a shop selling 100 ML and 50 ML of the same scent
 *      could not express a set of the 100 ML, and silently priced and shipped
 *      the 50 ML. The choice is explicit here, cheapest still available as a
 *      deliberate option because that is a real thing to mean.
 *
 * Variants are fetched per product, on demand, through `onNeedVariants` —
 * `listProducts` carries `variantCount` and a price range but not the variants
 * themselves, and pre-fetching every product's variants to fill a select the
 * admin may never open is a request per catalogue row for nothing.
 */
export default function BundleMembersEditor({
  products,
  members,
  onChange,
  variantsByProduct,
  onNeedVariants,
  unitMinorFor,
  currency,
  loading,
  duplicateIndex,
}: {
  products: ProductListItem[];
  members: DraftMember[];
  onChange: (next: DraftMember[]) => void;
  variantsByProduct: Record<string, VariantState>;
  onNeedVariants: (productId: string) => void;
  /** Minor units for one unit of this line, resolved the way the server does. */
  unitMinorFor: (member: DraftMember) => number;
  currency: string;
  loading: boolean;
  /** Index of the line that repeats an earlier one, or -1. */
  duplicateIndex: number;
}) {
  const [query, setQuery] = React.useState('');
  const [browsing, setBrowsing] = React.useState(false);

  const byId = React.useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const full = members.length >= MAX_MEMBERS;
  const trimmed = query.trim();

  /**
   * A product is offered even when it is already in the set, as long as it has
   * more than one variant — "100 ML and 50 ML of the same scent" is the exact
   * set this picker used to make impossible. A single-variant product already
   * in the set is not offered, because a second line of it would be the same
   * cart row written twice.
   */
  const results = React.useMemo(() => {
    const q = trimmed.toLowerCase();
    const usedSingles = new Set(
      members
        .map((m) => byId.get(m.productId))
        .filter((p): p is ProductListItem => !!p && p.variantCount <= 1)
        .map((p) => p.id),
    );
    return products
      .filter((p) => !usedSingles.has(p.id))
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.brandName.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q),
      );
  }, [products, trimmed, members, byId]);

  /**
   * The running sum, repeated at the foot of this panel.
   *
   * It is already in the "What it costs" column, but that column sits BESIDE
   * this one only on a wide laptop — below 1280px the form is one column and
   * the sum scrolls off while the admin is picking products, which is exactly
   * when it is worth reading. Cheap to repeat, and the same arithmetic.
   */
  const runningTotal = members.reduce(
    (sum, m) => sum + unitMinorFor(m) * m.quantity,
    0,
  );
  const unitCount = members.reduce((sum, m) => sum + m.quantity, 0);

  const shown = results.slice(0, RESULT_LIMIT);
  /** Search-first: the catalogue is never the resting state of this panel. */
  const showResults = !loading && (trimmed.length > 0 || browsing);

  function add(p: ProductListItem) {
    if (full) return;
    onChange([...members, { productId: p.id, variantId: null, quantity: 1 }]);
    if (p.variantCount > 1) onNeedVariants(p.id);
    setQuery('');
    setBrowsing(false);
  }

  function patch(index: number, next: Partial<DraftMember>) {
    onChange(members.map((m, i) => (i === index ? { ...m, ...next } : m)));
  }

  return (
    <section className="dash-card mr-bundle-members">
      <div className="mr-bundle-members-head">
        <div>
          <h2 className="dash-card-title">What is inside</h2>
          <p className="dash-help-text">
            A set holds 1 to {MAX_MEMBERS} lines, each 1 to{' '}
            {MAX_UNITS_PER_LINE} units. Pick the exact variant a shopper
            receives — leave it on cheapest and the shop chooses for you.
          </p>
        </div>
        <span
          className="mr-bundle-count"
          data-full={full ? 'true' : 'false'}
          aria-label={`${members.length} of ${MAX_MEMBERS} lines used`}
        >
          {members.length} / {MAX_MEMBERS}
        </span>
      </div>

      {members.length === 0 ? (
        <p className="mr-bundle-empty">
          Nothing in this set yet. Search your catalogue below — a set can only
          hold products that already exist under Products.
        </p>
      ) : (
        <ol className="mr-bundle-lines">
          {members.map((m, i) => {
            const p = byId.get(m.productId);
            const variants = variantsByProduct[m.productId];
            const unit = unitMinorFor(m);
            return (
              <li
                key={`${m.productId}:${m.variantId ?? '*'}:${i}`}
                className="mr-bundle-line"
                data-duplicate={i === duplicateIndex ? 'true' : 'false'}
              >
                <span className="mr-bundle-line-pos" aria-hidden="true">
                  {i + 1}
                </span>

                <span className="mr-bundle-thumb">
                  {p?.coverUrl ? (
                    <RetryingImage src={p.coverUrl} alt="" />
                  ) : (
                    <span className="mr-bundle-thumb-empty" aria-hidden="true" />
                  )}
                </span>

                <span className="mr-bundle-line-copy">
                  <strong className="mr-bundle-line-name">
                    {p?.name ?? 'Product no longer in your catalogue'}
                  </strong>
                  <span className="dash-muted mr-bundle-line-sub">
                    {p?.brandName || '—'}
                    {p && p.status !== 'PUBLISHED' && (
                      <> · {p.status.toLowerCase().replace(/_/g, ' ')}</>
                    )}
                  </span>
                </span>

                <span className="mr-bundle-line-variant">
                  <label className="dash-label" htmlFor={`bm-var-${i}`}>
                    Variant
                  </label>
                  {p && p.variantCount > 1 ? (
                    <select
                      id={`bm-var-${i}`}
                      className="dash-select"
                      value={m.variantId ?? ''}
                      onFocus={() => onNeedVariants(m.productId)}
                      onChange={(e) =>
                        patch(i, { variantId: e.target.value || null })
                      }
                    >
                      <option value="">Cheapest — shop decides</option>
                      {Array.isArray(variants) &&
                        variants
                          .filter((v) => v.isActive !== false)
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {variantLabel(v)} — {v.currency}{' '}
                              {v.price.toFixed(2)}
                            </option>
                          ))}
                      {variants === 'loading' && (
                        <option value={m.variantId ?? ''} disabled>
                          Loading variants…
                        </option>
                      )}
                    </select>
                  ) : (
                    <span className="mr-bundle-line-onlyvariant dash-muted">
                      {p ? 'Only one' : '—'}
                    </span>
                  )}
                  {variants === 'error' && (
                    <span className="dash-field-error">
                      Could not read this product’s variants.
                    </span>
                  )}
                </span>

                <span className="mr-bundle-line-qty">
                  <label className="dash-label" htmlFor={`bm-qty-${i}`}>
                    Units per set
                  </label>
                  <input
                    id={`bm-qty-${i}`}
                    className="dash-input"
                    type="number"
                    min={1}
                    max={MAX_UNITS_PER_LINE}
                    value={m.quantity}
                    onChange={(e) =>
                      patch(i, {
                        quantity: clamp(Number(e.target.value) || 1),
                      })
                    }
                  />
                </span>

                <span className="mr-bundle-line-money mr-num">
                  <span className="dash-muted">
                    {currency} {formatMinor(unit)} each
                  </span>
                  <strong>
                    {currency} {formatMinor(unit * m.quantity)}
                  </strong>
                </span>

                <span className="mr-bundle-line-actions">
                  <button
                    type="button"
                    className="dash-btn-ghost mr-bundle-icon-btn"
                    aria-label={`Move ${p?.name ?? 'line'} up`}
                    disabled={i === 0}
                    onClick={() => onChange(moveMember(members, i, -1))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="dash-btn-ghost mr-bundle-icon-btn"
                    aria-label={`Move ${p?.name ?? 'line'} down`}
                    disabled={i === members.length - 1}
                    onClick={() => onChange(moveMember(members, i, 1))}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="dash-btn-ghost"
                    onClick={() => onChange(members.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </span>

                {i === duplicateIndex && (
                  <p className="dash-field-error mr-bundle-line-warn">
                    The same product and variant is already on line{' '}
                    {firstMatch(members, i) + 1}. Raise its units instead — two
                    lines of one variant are written to the same cart row and
                    one of them is lost.
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {members.length > 0 && (
        <p className="mr-bundle-lines-total">
          <span className="dash-muted">
            {members.length} {members.length === 1 ? 'line' : 'lines'} ·{' '}
            {unitCount} {unitCount === 1 ? 'unit' : 'units'}
          </span>
          <strong className="mr-num">
            {currency} {formatMinor(runningTotal)} bought separately
          </strong>
        </p>
      )}

      {/* ── Add a line ───────────────────────────────────────────────────── */}
      {loading ? (
        <p className="dash-help-text">Loading your catalogue…</p>
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
        <p className="mr-bundle-full">
          This set is at its limit of {MAX_MEMBERS} lines. Remove one to add a
          different product, or raise a line’s units to put more of it in the
          box.
        </p>
      ) : (
        <div className="mr-bundle-search">
          <div className="dash-field">
            <label className="dash-label" htmlFor="bundle-product-search">
              Add from your catalogue
            </label>
            <input
              id="bundle-product-search"
              className="dash-input dash-input-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // A search field inside a <form> submits it on Enter. Here
                  // Enter means "take the first match", and a half-built set
                  // must never be saved by a keystroke meant for the picker.
                  e.preventDefault();
                  if (shown[0] && trimmed) add(shown[0]);
                }
              }}
              placeholder="Search by product, brand or SKU…"
              autoComplete="off"
              role="combobox"
              aria-expanded={showResults}
              aria-controls="bundle-product-results"
            />
            <p className="dash-help-text">
              {trimmed
                ? `${results.length} of ${products.length} products match.`
                : `${products.length} products in your catalogue.`}{' '}
              {!trimmed && (
                <button
                  type="button"
                  className="dash-link mr-bundle-browse"
                  onClick={() => setBrowsing((b) => !b)}
                >
                  {browsing ? 'Hide the list' : 'Browse them all'}
                </button>
              )}
            </p>
          </div>

          {showResults && (
            <div id="bundle-product-results" className="mr-bundle-results" role="listbox">
              {shown.length === 0 ? (
                <p className="dash-help-text">
                  Nothing in your catalogue matches “{trimmed}”.
                </p>
              ) : (
                shown.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected="false"
                    className="mr-bundle-result"
                    onClick={() => add(p)}
                  >
                    <span className="mr-bundle-thumb">
                      {p.coverUrl ? (
                        <RetryingImage src={p.coverUrl} alt="" />
                      ) : (
                        <span className="mr-bundle-thumb-empty" aria-hidden="true" />
                      )}
                    </span>
                    <span className="mr-bundle-result-copy">
                      <strong>{p.name}</strong>
                      <span className="dash-muted">
                        {p.brandName}
                        {p.variantCount > 1 && ` · ${p.variantCount} variants`}
                        {p.status !== 'PUBLISHED' &&
                          ` · ${p.status.toLowerCase().replace(/_/g, ' ')}`}
                      </span>
                    </span>
                    <span className="mr-bundle-result-price mr-num">
                      {p.currency} {priceRange(p)}
                    </span>
                  </button>
                ))
              )}
              {results.length > shown.length && (
                <p className="dash-help-text">
                  {results.length - shown.length} more match. Keep typing to
                  narrow it.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function clamp(n: number): number {
  return Math.min(MAX_UNITS_PER_LINE, Math.max(1, Math.round(n)));
}

/** The earlier line `index` duplicates. */
function firstMatch(members: DraftMember[], index: number): number {
  const key = `${members[index].productId}::${members[index].variantId ?? '*'}`;
  return members.findIndex(
    (m) => `${m.productId}::${m.variantId ?? '*'}` === key,
  );
}

/**
 * A variant's name, in the words the admin typed.
 *
 * Variants have no `name` column — they are their answers to the global
 * variant lists ("Size: 100 ML", "Shade: Noir"). The SKU is the fallback, and
 * it is a real fallback: a product whose variants answer nothing at all still
 * has to be distinguishable in a select.
 */
export function variantLabel(v: ProductVariant): string {
  const values = v.values.map((x) => x.optionName).filter(Boolean);
  if (values.length) return values.join(' · ');
  const custom = Object.values(v.customValues ?? {}).filter(Boolean);
  if (custom.length) return custom.join(' · ');
  return v.sku || 'Variant';
}

/** `120.00` or `90.00–120.00`, matching what the row actually sells for. */
function priceRange(p: ProductListItem): string {
  if (p.priceMin == null) return p.basePrice.toFixed(2);
  if (p.priceMax == null || p.priceMax === p.priceMin) {
    return p.priceMin.toFixed(2);
  }
  return `${p.priceMin.toFixed(2)}–${p.priceMax.toFixed(2)}`;
}

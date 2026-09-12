'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CatalogSubnav from '@/components/dashboard/CatalogSubnav';
import ImageField from '@/components/dashboard/ImageField';
import { errorMessageToText } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import { getProduct, listProducts } from '@/lib/catalog/api';
import type { ProductListItem, ProductVariant } from '@/lib/catalog/types';
import {
  createBundle,
  deleteBundle,
  getBundle,
  slugify,
  updateBundle,
  type Bundle,
} from '@/lib/api/bundles';
import BundleMembersEditor, { type VariantState } from './BundleMembersEditor';
import {
  MAX_MEMBERS,
  computeEconomics,
  duplicateLineIndex,
  formatMinor,
  formatPercent,
  parsePriceToMinor,
  validateDraft,
  type DraftMember,
} from './bundle-economics';

/**
 * One screen for building a set and one for changing it — the same screen.
 *
 * The page this replaces put the whole of bundle management on a single route:
 * a create form at the top, a table underneath, and no way to change a set at
 * all once it existed. "Management" was two buttons, Hide and Delete; a typo in
 * a name, a price that turned out wrong, a product that should not be in the
 * box — every one of those meant deleting the set and rebuilding it, which
 * changes its slug and breaks the link anybody had shared.
 *
 * `next.config.ts` has been rewriting `/catalogue/bundles/new` and
 * `/catalogue/bundles/:id/edit` to app-router paths that did not exist, so both
 * URLs answered 404. They exist now and share this component, because a create
 * form and an edit form that drift apart are how "the edit screen is missing a
 * field" happens.
 *
 * ## Layout
 *
 * Four fields used to sit in one auto-fitting row — NAME, PRICE, PHOTO,
 * DESCRIPTION — at wildly different natural widths, with a one-line `<input>`
 * for a description that may run to 2,000 characters. The grouping now follows
 * the two questions a set actually asks: *what is this set* (identity, on the
 * left) and *what does it cost* (economics, in a column that stays put while
 * you scroll). What is INSIDE it is the third question and gets its own panel,
 * full width, because that is the part with rows in it.
 *
 * ## Economics
 *
 * The price box sits directly under the component sum, and the saving and the
 * discount percentage sit directly under the price box. The storefront has
 * always shown the shopper *"Instead of 1,700.00 EGP bought separately — you
 * save 100.00 EGP"*; the person choosing that number could not see it.
 */
export default function BundleForm({
  mode,
  bundleId,
}: {
  mode: 'create' | 'edit';
  bundleId?: string;
}) {
  const router = useRouter();

  const [products, setProducts] = React.useState<ProductListItem[]>([]);
  const [existing, setExisting] = React.useState<Bundle | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showErrors, setShowErrors] = React.useState(false);

  const [name, setName] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [imageUrl, setImageUrl] = React.useState('');
  /** This set's own cover, from the gallery (migration 0220) — not a pasted
   *  URL, which drifts out of imgproxy signature validity. */
  const [imageMediaId, setImageMediaId] = React.useState<string | null>(null);
  const [isActive, setIsActive] = React.useState(false);
  const [expiresAt, setExpiresAt] = React.useState('');
  const [members, setMembers] = React.useState<DraftMember[]>([]);

  /** Variants, per product, fetched only when a line needs to offer a choice. */
  const [variantsByProduct, setVariantsByProduct] = React.useState<
    Record<string, VariantState>
  >({});
  const pending = React.useRef(new Set<string>());

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prods, bundle] = await Promise.all([
        // 'house' = MiniRue's own catalogue. A partner's product must never be
        // offered; the server refuses one on save regardless.
        listProducts({ limit: 200, space: 'house' }),
        mode === 'edit' && bundleId ? getBundle(bundleId) : Promise.resolve(null),
      ]);
      setProducts(prods.items);
      if (bundle) {
        setExisting(bundle);
        setName(bundle.name);
        setPrice((bundle.priceMinor / 100).toFixed(2));
        setDescription(bundle.description ?? '');
        setImageUrl(bundle.imageUrl ?? '');
        setImageMediaId(bundle.imageMediaId ?? null);
        setIsActive(bundle.isActive);
        setExpiresAt(toLocalInput(bundle.expiresAt));
        setMembers(
          bundle.members.map((m) => ({
            productId: m.productId,
            variantId: m.variantId,
            quantity: m.quantity,
          })),
        );
      }
    } catch (e) {
      setError(errorMessageToText(e, 'Could not open this set'));
    } finally {
      setLoading(false);
    }
  }, [mode, bundleId]);

  useMountedEffect(load, [load]);

  const ensureVariants = React.useCallback((productId: string) => {
    if (pending.current.has(productId)) return;
    pending.current.add(productId);
    setVariantsByProduct((prev) =>
      prev[productId] ? prev : { ...prev, [productId]: 'loading' },
    );
    void getProduct(productId)
      .then((p) => {
        setVariantsByProduct((prev) => ({ ...prev, [productId]: p.variants }));
      })
      .catch(() => {
        setVariantsByProduct((prev) => ({ ...prev, [productId]: 'error' }));
      });
  }, []);

  // A set opened for editing already names its variants; load them so the
  // selects read as names rather than as blank boxes the admin has to click.
  React.useEffect(() => {
    for (const m of members) {
      const p = products.find((x) => x.id === m.productId);
      if (p && p.variantCount > 1) ensureVariants(m.productId);
    }
  }, [members, products, ensureVariants]);

  const byId = React.useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  /**
   * One unit of a line, priced the way the server prices it.
   *
   * `BundlesService.detail` takes the MINIMUM price across the product's
   * variants when a member names no variant, and the named variant's price when
   * it does. Matching that exactly is the point: a saving computed against a
   * different number than the storefront shows is worse than no saving shown at
   * all. `basePrice` on a list row is already `priceMin`, so the fallback
   * before a product's variants have loaded is the same figure.
   */
  const unitMinorFor = React.useCallback(
    (m: DraftMember): number => {
      const variants = variantsByProduct[m.productId];
      if (Array.isArray(variants) && variants.length > 0) {
        if (m.variantId) {
          const v = variants.find((x) => x.id === m.variantId);
          if (v) return Math.round(v.price * 100);
        }
        return Math.min(...variants.map((v: ProductVariant) => Math.round(v.price * 100)));
      }
      const p = byId.get(m.productId);
      return Math.round(((p?.priceMin ?? p?.basePrice ?? 0) as number) * 100);
    },
    [variantsByProduct, byId],
  );

  const priceMinor = parsePriceToMinor(price);
  const economics = React.useMemo(
    () =>
      computeEconomics(
        members.map((m) => ({ unitMinor: unitMinorFor(m), quantity: m.quantity })),
        priceMinor,
      ),
    [members, unitMinorFor, priceMinor],
  );

  const currency = products[0]?.currency ?? existing?.currency ?? 'EGP';
  const dupIndex = duplicateLineIndex(members);
  const errors = validateDraft({ name, priceMinor, members });
  const hasErrors = Object.values(errors).some((v) => v !== null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setShowErrors(true);
    if (hasErrors) {
      setError('Some of this set is not ready to save — see the notes below.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const shared = {
        name: name.trim(),
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        imageMediaId,
        priceMinor,
        isActive,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        members: members.map((m) => ({
          productId: m.productId,
          variantId: m.variantId,
          quantity: m.quantity,
        })),
      };
      if (mode === 'edit' && bundleId) {
        // `slug` is absent from UpdateBundleSchema on purpose — a set's web
        // address is the thing people share, and renaming must not move it.
        await updateBundle(bundleId, shared);
      } else {
        await createBundle({ ...shared, slug: slugify(name) });
      }
      router.push('/catalogue/bundles');
      router.refresh();
    } catch (err) {
      setError(
        errorMessageToText(
          err,
          mode === 'edit' ? 'Could not save the set' : 'Could not create the set',
        ),
      );
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing) return;
    if (!window.confirm(`Delete "${existing.name}"? Past orders are unaffected.`))
      return;
    setSaving(true);
    try {
      await deleteBundle(existing.id);
      router.push('/catalogue/bundles');
      router.refresh();
    } catch (err) {
      setError(errorMessageToText(err, 'Could not delete the set'));
      setSaving(false);
    }
  }

  const slug = mode === 'edit' ? existing?.slug ?? '' : slugify(name);
  const multiVariantLines = members.some(
    (m) => (byId.get(m.productId)?.variantCount ?? 0) > 1,
  );

  return (
    <>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">
            {mode === 'edit' ? existing?.name ?? 'Edit set' : 'New bundle'}
          </h1>
          <p className="dash-help-text">
            {mode === 'edit'
              ? 'Change what is in this set, what it costs and whether the shop shows it.'
              : 'Import products you already sell, name the set, give it one price.'}
          </p>
        </div>
        <Link className="dash-btn-secondary" href="/catalogue/bundles">
          Back to bundles
        </Link>
      </div>
      <CatalogSubnav />

      {error && <p className="dash-error">{error}</p>}

      <form onSubmit={submit} className="mr-bundle-layout">
        <div className="mr-bundle-main">
          {/* ── What this set is ─────────────────────────────────────────── */}
          <section className="dash-card mr-bundle-identity">
            <h2 className="dash-card-title">What this set is</h2>

            <div className="mr-bundle-identity-grid">
              <div className="mr-bundle-identity-copy">
                <div className="dash-field">
                  <label className="dash-label" htmlFor="b-name">
                    Name <span className="dash-required">*</span>
                  </label>
                  <input
                    id="b-name"
                    className={
                      showErrors && errors.name
                        ? 'dash-input dash-input-error'
                        : 'dash-input'
                    }
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Evening Set"
                    maxLength={120}
                  />
                  {showErrors && errors.name ? (
                    <p className="dash-field-error">{errors.name}</p>
                  ) : (
                    <p className="dash-help-text">
                      {slug ? (
                        <>
                          Web address: <code className="dash-slug">/bundles/{slug}</code>
                          {mode === 'edit' && ' — fixed, renaming will not move it.'}
                        </>
                      ) : (
                        'This is the name the shopper sees in their bag, not the product names.'
                      )}
                    </p>
                  )}
                </div>

                <div className="dash-field">
                  <label className="dash-label" htmlFor="b-desc">
                    Description
                  </label>
                  <textarea
                    id="b-desc"
                    className="dash-textarea"
                    rows={5}
                    maxLength={2000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What the set is for, and why the pieces belong together."
                  />
                  <p className="dash-help-text">
                    Shown on the set’s own page. {description.length}/2000.
                  </p>
                </div>
              </div>

              <div className="mr-bundle-identity-photo">
                <ImageField
                  label="Photo"
                  helpText="This set's own picture — the one a shopper sees on the set's page and on the line in their bag. It is NOT the Bundles tile on the shop page, which is set under Categories."
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
            </div>
          </section>

          {/* ── What is inside ───────────────────────────────────────────── */}
          <BundleMembersEditor
            products={products}
            members={members}
            onChange={setMembers}
            variantsByProduct={variantsByProduct}
            onNeedVariants={ensureVariants}
            unitMinorFor={unitMinorFor}
            currency={currency}
            loading={loading}
            duplicateIndex={dupIndex}
          />

          {showErrors && errors.members && (
            <p className="dash-error">{errors.members}</p>
          )}

          {mode === 'edit' && multiVariantLines && (
            <p className="dash-help-text mr-bundle-note">
              A set read back from the API always names a variant per line, even
              for lines that were saved as “cheapest” — the read
              resolves it and the response carries no flag saying which it was.
              Saving therefore pins each line to the variant shown above. That is
              the variant the shop would have shipped anyway; change it here if
              it is not the one you meant.
            </p>
          )}
        </div>

        {/* ── Economics, and whether the shop shows it ───────────────────── */}
        <aside className="mr-bundle-aside">
          <section className="dash-card mr-bundle-economics">
            <h2 className="dash-card-title">What it costs</h2>

            <dl className="mr-bundle-figures">
              <div className="mr-bundle-figure">
                <dt>Bought separately</dt>
                <dd className="mr-num">
                  {currency} {formatMinor(economics.componentTotalMinor)}
                </dd>
              </div>
              <div className="mr-bundle-figure mr-bundle-figure--sub">
                <dt>In the box</dt>
                <dd className="mr-num">
                  {members.length} {members.length === 1 ? 'line' : 'lines'} ·{' '}
                  {economics.unitCount}{' '}
                  {economics.unitCount === 1 ? 'unit' : 'units'}
                </dd>
              </div>
            </dl>

            <div className="dash-field">
              <label className="dash-label" htmlFor="b-price">
                Price for the whole set ({currency}){' '}
                <span className="dash-required">*</span>
              </label>
              <input
                id="b-price"
                className={
                  showErrors && errors.price
                    ? 'dash-input dash-input-error'
                    : 'dash-input'
                }
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
              {showErrors && errors.price && (
                <p className="dash-field-error">{errors.price}</p>
              )}
            </div>

            {economics.componentTotalMinor === 0 ? (
              <p className="dash-help-text">
                Add a product below and the saving appears here, as the shopper
                will read it.
              </p>
            ) : priceMinor === 0 ? (
              <p className="dash-help-text">
                Type a price and the saving appears here, as the shopper will
                read it.
              </p>
            ) : economics.overchargeMinor > 0 ? (
              <p className="mr-bundle-verdict" data-tone="warn">
                This set costs {currency}{' '}
                {formatMinor(economics.overchargeMinor)} MORE than buying the
                pieces separately. The shop will not show a saving.
              </p>
            ) : economics.savingMinor === 0 ? (
              <p className="mr-bundle-verdict" data-tone="warn">
                Priced exactly at the sum of its parts — there is no reason for a
                shopper to choose the set.
              </p>
            ) : (
              <p className="mr-bundle-verdict" data-tone="ok">
                <span className="mr-bundle-verdict-lead">
                  Saves {currency} {formatMinor(economics.savingMinor)}
                </span>
                <span className="mr-bundle-verdict-pct">
                  {economics.discountPercent != null &&
                    `${formatPercent(economics.discountPercent)} off`}
                </span>
                <span className="dash-muted">
                  The shop reads: “Instead of {currency}{' '}
                  {formatMinor(economics.componentTotalMinor)} bought separately
                  — you save {currency} {formatMinor(economics.savingMinor)}”.
                </span>
              </p>
            )}
          </section>

          <section className="dash-card mr-bundle-visibility">
            <h2 className="dash-card-title">Where it shows</h2>

            <label className="dash-checkbox-label">
              <input
                type="checkbox"
                className="dash-checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>Show it in the shop</span>
            </label>

            <div className="dash-field">
              <label className="dash-label" htmlFor="b-expires">
                Stop showing it after
              </label>
              <input
                id="b-expires"
                className="dash-input"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <p className="dash-help-text">
                Optional. Leave empty and it runs until you hide it.
              </p>
            </div>

            {/* The withdrawal a shopper cannot see coming. Worth saying here
                rather than in a changelog: the storefront's own list
                (`listPublic`) filters to active, unexpired, non-owner-scoped
                sets, and a set already sitting in someone's bag that drops out
                of that index loses its name and picture on that line. */}
            <p className="dash-help-text">
              Hiding a set, or letting it expire, also takes it out of the list
              the shop looks up names and photos in — a set already in
              someone’s bag keeps its price but loses its name there until
              they check out. Prefer expiry over deleting.
            </p>

            {mode === 'edit' && existing && (
              <dl className="mr-bundle-figures mr-bundle-figures--meta">
                <div className="mr-bundle-figure mr-bundle-figure--sub">
                  <dt>Times bought</dt>
                  <dd className="mr-num">{existing.usedCount}</dd>
                </div>
                <div className="mr-bundle-figure mr-bundle-figure--sub">
                  <dt>Shop sees it</dt>
                  <dd>
                    {!existing.isActive
                      ? 'Hidden'
                      : existing.inStock
                        ? 'Yes'
                        : 'No — a piece is out of stock'}
                  </dd>
                </div>
              </dl>
            )}
          </section>

          <div className="dash-card mr-bundle-actions">
            <button
              type="submit"
              className="dash-btn-primary"
              disabled={saving || loading}
            >
              {saving
                ? 'Saving…'
                : mode === 'edit'
                  ? 'Save changes'
                  : 'Create bundle'}
            </button>
            <Link className="dash-btn-secondary" href="/catalogue/bundles">
              Cancel
            </Link>
            {mode === 'edit' && existing && (
              <button
                type="button"
                className="dash-btn-danger"
                onClick={() => void remove()}
                disabled={saving}
              >
                Delete
              </button>
            )}
            <p className="dash-help-text">
              Only MiniRue’s own products can go in a set, at most{' '}
              {MAX_MEMBERS} lines. Discount codes never apply to a set, and a set
              disappears from the shop by itself if any piece runs out.
            </p>
          </div>
        </aside>
      </form>
    </>
  );
}

/**
 * An ISO instant as `<input type="datetime-local">` wants it, in LOCAL time.
 *
 * The input has no timezone of its own, so slicing the ISO string — which is
 * UTC — would show an Egyptian admin a time two or three hours off their own
 * clock and write that back as though they had chosen it.
 */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

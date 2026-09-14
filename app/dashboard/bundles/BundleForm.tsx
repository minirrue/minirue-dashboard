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
import {
  apiAccountingOverview,
  apiUpdateSetPricing,
  type PricingMode,
  type SetRow,
} from '@/lib/api/accounting';
import BundleMembersEditor, { type VariantState } from './BundleMembersEditor';
import {
  DEFAULT_SET_SAVING_BP,
  MAX_MEMBERS,
  computeEconomics,
  duplicateLineIndex,
  estimateSetPriceMinor,
  floorBreach,
  formatMinor,
  formatPercent,
  parsePriceToMinor,
  parseSavingToBp,
  savingBpToText,
  setPricingBody,
  validateDraft,
  type DraftMember,
} from './bundle-economics';
import './set-pricing.css';

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

  /**
   * Set pricing (#65, backend#166). `setRow` is this set's row from the
   * Accounting overview: its mode, saving, System price, floors and why.
   * `'unavailable'` means Accounting could not be read.
   */
  const [setRow, setSetRow] = React.useState<SetRow | null | 'unavailable'>(null);
  const [pricingMode, setPricingMode] = React.useState<PricingMode>('MANUAL');
  const [savingText, setSavingText] = React.useState(savingBpToText(DEFAULT_SET_SAVING_BP));
  const [pricingBusy, setPricingBusy] = React.useState(false);
  const [pricingStatus, setPricingStatus] = React.useState<
    { tone: 'ok' | 'error'; text: string } | null
  >(null);

  /** Variants, per product, fetched only when a line needs to offer a choice. */
  const [variantsByProduct, setVariantsByProduct] = React.useState<
    Record<string, VariantState>
  >({});
  const pending = React.useRef(new Set<string>());

  /** Take the backend's word for how the set is priced now. */
  const applySetRow = React.useCallback((row: SetRow) => {
    setSetRow(row);
    setPricingMode(row.mode);
    setSavingText(savingBpToText(row.effectiveSavingBp));
    setPrice((row.currentPriceMinor / 100).toFixed(2));
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prods, bundle, overview] = await Promise.all([
        // 'house' = MiniRue's own catalogue. A partner's product must never be
        // offered; the server refuses one on save regardless.
        listProducts({ limit: 200, space: 'house' }),
        mode === 'edit' && bundleId ? getBundle(bundleId) : Promise.resolve(null),
        // Accounting failing must not stop the set from opening.
        mode === 'edit' && bundleId
          ? apiAccountingOverview().catch(() => null)
          : Promise.resolve(null),
      ]);
      setProducts(prods.items);
      if (mode === 'edit') {
        const row = overview?.sets.find((s) => s.bundleId === bundleId) ?? null;
        setSetRow(row ?? 'unavailable');
        if (row) applySetRow(row);
      }
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
  }, [mode, bundleId, applySetRow]);

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

  const typedPriceMinor = parsePriceToMinor(price);
  const savingBp = parseSavingToBp(savingText);
  // Six lines at most: cheap enough to recompute on every render.
  const lines = members.map((m) => ({ unitMinor: unitMinorFor(m), quantity: m.quantity }));
  const componentTotalMinor = computeEconomics(lines, 0).componentTotalMinor;
  const row = setRow === 'unavailable' ? null : setRow;
  /** The saved System price is on screen only while the inputs still match it. */
  const systemSaved =
    row !== null && row.mode === 'SYSTEM' && savingBp === row.effectiveSavingBp;
  /**
   * The price the set would sell at: the typed one on My price; on System
   * price the backend's figure once saved, else the parts less the saving.
   */
  const priceMinor =
    pricingMode === 'MANUAL'
      ? typedPriceMinor
      : systemSaved
        ? row.currentPriceMinor
        : savingBp === null
          ? 0
          : estimateSetPriceMinor(componentTotalMinor, savingBp);
  const economics = computeEconomics(lines, priceMinor);

  const currency = products[0]?.currency ?? existing?.currency ?? 'EGP';
  const dupIndex = duplicateLineIndex(members);
  const errors = validateDraft({ name, priceMinor, members });
  const savingError =
    pricingMode === 'SYSTEM' && savingBp === null
      ? 'Type a saving from 0 to 90%.'
      : null;
  const hasErrors = Object.values(errors).some((v) => v !== null) || savingError !== null;

  function pricingBody() {
    return setPricingBody(pricingMode, {
      savingBp: savingBp ?? DEFAULT_SET_SAVING_BP,
      manualPriceMinor: typedPriceMinor,
    });
  }

  /** Saves only the pricing choice, through Accounting, and shows what the backend stored. */
  async function savePricing() {
    if (!bundleId) return;
    if (pricingMode === 'SYSTEM' ? savingError : errors.price) {
      setShowErrors(true);
      return;
    }
    setPricingBusy(true);
    setPricingStatus(null);
    try {
      const res = await apiUpdateSetPricing(bundleId, pricingBody());
      const fresh = res.overview.sets.find((s) => s.bundleId === bundleId);
      if (fresh) {
        applySetRow(fresh);
        setExisting((prev) => (prev ? { ...prev, priceMinor: fresh.currentPriceMinor } : prev));
      }
      setPricingStatus({
        tone: 'ok',
        text: `Saved on ${fresh?.mode === 'SYSTEM' ? 'System price' : 'My price'}${
          fresh ? ` — ${currency} ${formatMinor(fresh.currentPriceMinor)}` : ''
        }.`,
      });
      router.refresh();
    } catch (err) {
      setPricingStatus({ tone: 'error', text: errorMessageToText(err, 'Could not save the price') });
    } finally {
      setPricingBusy(false);
    }
  }

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
        // A typed price is sent on My price only: on a System price set a
        // changed price would switch it to My price (backend#167).
        await updateBundle(
          bundleId,
          pricingMode === 'MANUAL' ? { ...shared, priceMinor } : shared,
        );
        // A System price set is repriced (its pieces may have changed), and a
        // set leaving System price says so even when the number is the same.
        if (pricingMode === 'SYSTEM' || row?.mode === 'SYSTEM') {
          await apiUpdateSetPricing(bundleId, pricingBody());
        }
      } else {
        // A new set has no id yet: today's create first (on System price with
        // the estimate as a placeholder), then the pricing choice.
        const created = await createBundle({ ...shared, priceMinor, slug: slugify(name) });
        try {
          await apiUpdateSetPricing(created.id, pricingBody());
        } catch (err) {
          setError(
            `The set was created, but its pricing was not saved (${errorMessageToText(
              err,
              'Accounting did not answer',
            )}). Open it from the bundles list to set the price.`,
          );
          // `saving` stays on, so the set cannot be created a second time.
          return;
        }
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

            <SetPricing
              mode={mode}
              pricingMode={pricingMode}
              onPricingMode={(next) => {
                setPricingMode(next);
                setPricingStatus(null);
              }}
              savingText={savingText}
              onSavingText={setSavingText}
              savingError={showErrors ? savingError : null}
              price={price}
              onPrice={setPrice}
              priceError={showErrors && pricingMode === 'MANUAL' ? errors.price : null}
              typedPriceMinor={typedPriceMinor}
              estimateMinor={savingBp === null ? null : estimateSetPriceMinor(componentTotalMinor, savingBp)}
              setRow={setRow}
              systemSaved={systemSaved}
              currency={currency}
              busy={pricingBusy || saving || loading}
              status={pricingStatus}
              onSave={() => void savePricing()}
            />

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

interface SetPricingProps {
  mode: 'create' | 'edit';
  pricingMode: PricingMode;
  onPricingMode: (mode: PricingMode) => void;
  savingText: string;
  onSavingText: (text: string) => void;
  savingError: string | null;
  price: string;
  onPrice: (text: string) => void;
  priceError: string | null;
  typedPriceMinor: number;
  estimateMinor: number | null;
  setRow: SetRow | null | 'unavailable';
  systemSaved: boolean;
  currency: string;
  busy: boolean;
  status: { tone: 'ok' | 'error'; text: string } | null;
  onSave: () => void;
}

/**
 * How the set is priced (#65, backend#166): System price (the parts less a
 * saving, kept above the floor by the engine) or My price (typed, with a
 * floor warning). On an existing set each path saves on its own through
 * `PUT /v1/accounting/sets/:id`; a new set applies the choice right after
 * it is created.
 */
function SetPricing(props: SetPricingProps) {
  const { mode, pricingMode, setRow, currency, busy, status } = props;
  const row = setRow === 'unavailable' ? null : setRow;
  const money = (minor: number) => `${currency} ${formatMinor(minor)}`;
  const floors = row?.system?.floors ?? null;
  const breach = floorBreach(props.typedPriceMinor, floors);

  const option = (value: PricingMode, title: string, line: string, body: React.ReactNode) => {
    const selected = pricingMode === value;
    const id = `sp-${value.toLowerCase()}`;
    return (
      <div className="sp-option" data-selected={selected || undefined}>
        <div className="sp-option-head">
          <input
            type="radio"
            id={id}
            name="set-pricing-mode"
            className="sp-radio"
            checked={selected}
            onChange={() => props.onPricingMode(value)}
          />
          <h3 className="sp-title">
            <label htmlFor={id}>{title}</label>
          </h3>
          {row?.mode === value && <span className="sp-in-use">In use</span>}
        </div>
        <p className="sp-line">{line}</p>
        {selected && <div className="sp-body">{body}</div>}
      </div>
    );
  };

  const systemBody = (
    <>
      <div className="dash-field sp-field">
        <label className="dash-label" htmlFor="sp-saving">
          Saving off the pieces (%)
        </label>
        <input
          id="sp-saving"
          className={props.savingError ? 'dash-input dash-input-error' : 'dash-input'}
          type="number"
          min="0"
          max="90"
          step="0.01"
          inputMode="decimal"
          value={props.savingText}
          onChange={(e) => props.onSavingText(e.target.value)}
          aria-describedby={props.savingError ? 'sp-saving-error' : undefined}
        />
        {props.savingError && (
          <p id="sp-saving-error" className="dash-field-error">
            {props.savingError}
          </p>
        )}
      </div>

      {props.systemSaved && row ? (
        <div className="sp-result" aria-label="System price, read-only">
          <dl className="sp-figures">
            <div>
              <dt>Price</dt>
              <dd className="mr-num sp-price">{money(row.currentPriceMinor)}</dd>
            </div>
            <div>
              <dt>Floor</dt>
              <dd className="mr-num">
                {floors ? (
                  <>
                    {money(floors.law1ShownMinor)}
                    <span className="sp-sub">no-loss {money(floors.noLossShownMinor)}</span>
                  </>
                ) : (
                  'None yet'
                )}
              </dd>
            </div>
            <div>
              <dt>Margin</dt>
              <dd className="mr-num">
                {row.current.marginBp === null ? '—' : formatPercent(row.current.marginBp / 100)}
              </dd>
            </div>
          </dl>
          {row.why && <p className="sp-why">{row.why}</p>}
        </div>
      ) : (
        <p className="sp-estimate">
          {props.estimateMinor ? (
            <>
              About <span className="mr-num">{money(props.estimateMinor)}</span> before the floor
              and rounding.{' '}
            </>
          ) : null}
          {mode === 'edit'
            ? 'Save to see the real price, its floor and margin.'
            : 'The real price, floor and margin show once the set is created.'}
        </p>
      )}

      {mode === 'edit' && (
        <button type="button" className="dash-btn-secondary sp-save" disabled={busy} onClick={props.onSave}>
          {busy ? 'Saving…' : 'Save System price'}
        </button>
      )}
    </>
  );

  const manualBody = (
    <>
      <div className="dash-field sp-field">
        <label className="dash-label" htmlFor="b-price">
          Price for the whole set ({currency}) <span className="dash-required">*</span>
        </label>
        <input
          id="b-price"
          className={props.priceError ? 'dash-input dash-input-error' : 'dash-input'}
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          value={props.price}
          onChange={(e) => props.onPrice(e.target.value)}
          placeholder="0.00"
          aria-describedby="sp-floor"
        />
        {props.priceError && <p className="dash-field-error">{props.priceError}</p>}
      </div>

      <p id="sp-floor" className="sp-floor" data-tone={breach ? 'warn' : undefined}>
        {breach === 'NO_LOSS' && floors
          ? `Below the no-loss floor of ${money(floors.noLossShownMinor)}: this set loses money on every order.`
          : breach === 'LAW1' && floors
            ? `Below the Law 1 floor of ${money(floors.law1ShownMinor)}: it does not cover the pieces' cost plus box & trip.`
            : floors
              ? `Floor ${money(floors.law1ShownMinor)}, no-loss ${money(floors.noLossShownMinor)}.`
              : row
                ? 'No floor yet: a piece has no cost entered.'
                : mode === 'edit'
                  ? 'The floor could not be read from Accounting.'
                  : 'The floor shows once the set is created.'}
      </p>

      {mode === 'edit' && (
        <button type="button" className="dash-btn-secondary sp-save" disabled={busy} onClick={props.onSave}>
          {busy ? 'Saving…' : 'Save My price'}
        </button>
      )}
    </>
  );

  return (
    <div className="sp" role="group" aria-labelledby="sp-legend">
      <p id="sp-legend" className="sp-legend">
        How the set is priced
      </p>
      {setRow === 'unavailable' && (
        <p className="sp-note">Accounting could not be read, so the mode in use is not shown.</p>
      )}
      {option(
        'SYSTEM',
        'System price',
        'The pieces less a saving. Moves with their prices and never goes below the floor.',
        systemBody,
      )}
      {option(
        'MANUAL',
        'My price',
        'You type it. Nothing changes it, and you are warned below the floor.',
        manualBody,
      )}
      {row && row.warnings.length > 0 && (
        <ul className="sp-warnings" aria-label="Warnings">
          {row.warnings.map((w) => (
            <li key={w.key}>{w.title}</li>
          ))}
        </ul>
      )}
      <p className="sp-status" role="status" data-tone={status?.tone}>
        {status?.text}
      </p>
    </div>
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

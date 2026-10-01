'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImagePlus, Package } from 'lucide-react';
import GalleryPickerModal from '@/components/dashboard/GalleryPickerModal';
import type { GiveawayPutBody, GiveawaySettings, GiveawayView } from '@/lib/api/giveaway';
import { getProduct, listProducts } from '@/lib/catalog/api';

export type PrizeMode = 'catalogue' | 'custom';

/** The backend's limits (minirue-backend giveaway.dto.ts). */
export const PRIZE_TITLE_MAX = 160;
export const PRIZE_DESCRIPTION_MAX = 1000;

/** What the page knows about the prize product. A null field is not known yet and is fetched. */
export interface PrizeProduct {
  id: string;
  name: string | null;
  description: string | null;
  imageUrl: string | null;
}

/**
 * The prize part of the settings form. With a product, a null title or
 * description means "the product's own", which is what the backend shows
 * when the saved field is empty; a string is the admin's override.
 */
export interface PrizeDraft {
  mode: PrizeMode;
  product: PrizeProduct | null;
  title: string | null;
  description: string | null;
  /** A Gallery image the admin chose. With a product, null means the product's cover. */
  image: { id: string; url: string | null } | null;
}

/** The form's starting point, from the saved giveaway or the pool's defaults. */
export function prizeDraftFrom(view: GiveawayView, source: GiveawaySettings): PrizeDraft {
  const productId = source.prizeProductId ?? null;
  // The resolved prize belongs to the saved giveaway, and to this product.
  const prize = view.giveaway && view.prize && (view.prize.productId == null || view.prize.productId === productId)
    ? view.prize
    : null;
  const resolvedImage = prize && prize.mediaKind !== 'video' ? prize.imageUrl ?? null : null;
  const image = source.prizeGalleryItemId ? { id: source.prizeGalleryItemId, url: resolvedImage } : null;
  if (!productId) {
    return { mode: 'custom', product: null, title: source.prizeTitle ?? '', description: source.prizeDescription ?? '', image };
  }
  // An empty saved field is filled from the product, so the resolved prize shows the product's own value.
  return {
    mode: 'catalogue',
    product: {
      id: productId,
      name: !source.prizeTitle && prize?.title ? prize.title : null,
      description: !source.prizeDescription && prize ? prize.description ?? '' : null,
      imageUrl: !source.prizeGalleryItemId ? resolvedImage : null,
    },
    title: source.prizeTitle || null,
    description: source.prizeDescription || null,
    image,
  };
}

/** The prize part of the PUT body. Fields left to the product go out empty, so the backend fills them. */
export function prizeBody(prize: PrizeDraft): Pick<GiveawayPutBody, 'prizeProductId' | 'prizeTitle' | 'prizeDescription' | 'prizeGalleryItemId'> {
  return {
    prizeProductId: prize.mode === 'catalogue' && prize.product ? prize.product.id : null,
    prizeTitle: prize.title ?? '',
    prizeDescription: prize.description ?? '',
    prizeGalleryItemId: prize.image?.id ?? null,
  };
}

/** Why this prize cannot be saved yet, or null. */
export function prizeProblem(prize: PrizeDraft): string | null {
  if (prize.mode === 'catalogue' && !prize.product) return 'Choose a product from the catalogue, or switch to a custom prize.';
  if ((prize.title ?? '').length > PRIZE_TITLE_MAX) return `The prize title can be at most ${PRIZE_TITLE_MAX} characters.`;
  if ((prize.description ?? '').length > PRIZE_DESCRIPTION_MAX) {
    return `The prize description can be at most ${PRIZE_DESCRIPTION_MAX.toLocaleString('en-US')} characters. Shorten it before saving.`;
  }
  return null;
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** The product's own name, description and cover, from what the page has plus its catalogue record. */
function useProductInfo(product: PrizeProduct | null) {
  const detail = useQuery({
    queryKey: ['giveaway-prize-product', product?.id ?? null],
    queryFn: () => getProduct(product!.id),
    enabled: !!product,
    staleTime: 60_000,
  });
  if (!product) return null;
  const record = detail.data;
  const media = Array.isArray(record?.media) ? record.media : [];
  const cover = media.find((item) => item.role === 'COVER' && item.kind !== 'video' && !item.deletedAt)?.url ?? null;
  return {
    name: record?.name || product.name,
    description: typeof record?.description === 'string' ? record.description : product.description,
    imageUrl: product.imageUrl ?? cover,
    loading: detail.isPending,
  };
}

function Thumb({ url }: { url: string | null }) {
  if (!url) {
    return <span className="giveaway-thumb giveaway-thumb-empty" aria-hidden="true"><Package size={18} /></span>;
  }
  // eslint-disable-next-line @next/next/no-img-element -- catalogue and gallery URLs are already resized by imgproxy.
  return <img className="giveaway-thumb" src={url} alt="" width={48} height={48} loading="lazy" />;
}

function ProductSearch({ chosenId, onChoose, onCancel }: {
  chosenId: string | null;
  onChoose: (product: PrizeProduct) => void;
  onCancel: (() => void) | null;
}) {
  const [search, setSearch] = React.useState('');
  const term = useDebouncedValue(search.trim(), 250);
  const products = useQuery({
    queryKey: ['giveaway-prize-products', term],
    queryFn: () => listProducts({ search: term || undefined, limit: 8 }),
    staleTime: 30_000,
  });
  const items = products.data?.items ?? [];

  return (
    <div className="giveaway-product-search">
      <label className="dash-field" htmlFor="giveaway-product-search">
        <span className="dash-label">Search the catalogue</span>
        <input
          id="giveaway-product-search"
          className="dash-input"
          type="search"
          autoComplete="off"
          placeholder="Product name"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {products.isError ? (
        <p className="dash-inline-error" role="alert">
          Products could not load.{' '}
          <button type="button" className="dash-link-button" onClick={() => void products.refetch()}>Try again</button>
        </p>
      ) : !products.data ? (
        <p className="giveaway-product-note" aria-live="polite">Loading products…</p>
      ) : items.length === 0 ? (
        <p className="giveaway-product-note">{term ? `No products match “${term}”.` : 'The catalogue has no products yet.'}</p>
      ) : (
        <ul className="giveaway-product-results" aria-label="Products">
          {items.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                className="giveaway-product-option"
                aria-pressed={chosenId === product.id}
                onClick={() => onChoose({ id: product.id, name: product.name, description: null, imageUrl: product.coverUrl })}
              >
                <Thumb url={product.coverUrl} />
                <span>
                  <strong>{product.name}</strong>
                  {product.brandName && <small>{product.brandName}</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {onCancel && (
        <button type="button" className="dash-btn-ghost giveaway-product-cancel" onClick={onCancel}>Keep the current product</button>
      )}
    </div>
  );
}

/** "From the product" while a field follows the product; a way back once the admin has typed their own. */
function FieldSource({ following, label, onReset }: { following: boolean; label: string; onReset: () => void }) {
  return following
    ? <span className="giveaway-source">From the product</span>
    : <button type="button" className="dash-link-button giveaway-source" onClick={onReset}>{`Use the product’s ${label}`}</button>;
}

export default function PrizeChooser({ value, onChange, disabled, onError }: {
  value: PrizeDraft;
  onChange: (next: PrizeDraft) => void;
  disabled: boolean;
  onError: (message: string) => void;
}) {
  const [browsing, setBrowsing] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const info = useProductInfo(value.mode === 'catalogue' ? value.product : null);
  const set = (patch: Partial<PrizeDraft>) => onChange({ ...value, ...patch });
  const fromProduct = value.mode === 'catalogue' && !!value.product;
  const searching = !disabled && value.mode === 'catalogue' && (browsing || !value.product);
  const showFields = value.mode === 'custom' || (!!value.product && !browsing);

  function chooseMode(mode: PrizeMode) {
    if (mode === value.mode) return;
    if (mode === 'custom') {
      // Carry the text the admin is looking at into the custom prize.
      set({ mode, title: value.title ?? info?.name ?? '', description: value.description ?? info?.description ?? '' });
      return;
    }
    // Back to the product: text that still matches it follows the product again.
    const own = (text: string | null, productText: string | null | undefined) =>
      text !== null && productText != null && text.trim() === productText.trim() ? null : text;
    set({
      mode,
      title: value.product ? own(value.title, info?.name ?? value.product.name) : value.title,
      description: value.product ? own(value.description, info?.description ?? value.product.description) : value.description,
    });
  }

  const titleValue = fromProduct ? value.title ?? info?.name ?? '' : value.title ?? '';
  const descriptionValue = fromProduct ? value.description ?? info?.description ?? '' : value.description ?? '';
  const productName = info?.name ?? null;
  const descriptionPlaceholder = !fromProduct
    ? undefined
    : info?.description == null && info?.loading
      ? 'Loading the product’s description…'
      : info?.description
        ? info.description.slice(0, 140)
        : 'The product has no description. Type one to show with the prize.';

  return (
    <fieldset className="giveaway-prize" disabled={disabled} aria-describedby="giveaway-prize-hint">
      <legend className="dash-label">Prize</legend>
      <p id="giveaway-prize-hint" className="giveaway-prize-hint">
        Hidden on the storefront until the reveal. A catalogue product fills the title, description and image; you can change any of them.
      </p>
      <div className="giveaway-segmented">
        <label>
          <input type="radio" name="giveaway-prize-mode" value="catalogue" checked={value.mode === 'catalogue'} onChange={() => chooseMode('catalogue')} />
          <span>From catalogue</span>
        </label>
        <label>
          <input type="radio" name="giveaway-prize-mode" value="custom" checked={value.mode === 'custom'} onChange={() => chooseMode('custom')} />
          <span>Custom prize</span>
        </label>
      </div>

      {value.mode === 'catalogue' && (
        <div className="giveaway-prize-panel">
          {value.product && !browsing && (
            <div className="giveaway-chosen" data-testid="giveaway-chosen-product">
              <Thumb url={info?.imageUrl ?? null} />
              <div className="giveaway-chosen-text">
                <span>Chosen product</span>
                <strong>{productName ?? (info?.loading ? 'Loading product…' : 'Product not found in the catalogue')}</strong>
              </div>
              {!disabled && <button type="button" className="dash-btn-secondary" onClick={() => setBrowsing(true)}>Change product</button>}
            </div>
          )}
          {searching && (
            <ProductSearch
              chosenId={value.product?.id ?? null}
              onChoose={(product) => {
                // A new product fills every field from itself.
                set({ product, title: null, description: null, image: null });
                setBrowsing(false);
              }}
              onCancel={value.product ? () => setBrowsing(false) : null}
            />
          )}
          {!value.product && disabled && <p className="giveaway-product-note">No product was chosen.</p>}
        </div>
      )}

      {showFields && (
        <div className="giveaway-prize-panel giveaway-prize-fields">
          <div className="dash-field">
            <div className="giveaway-field-head">
              <label className="dash-label" htmlFor="giveaway-prize-title">Prize title</label>
              {fromProduct && <FieldSource following={value.title === null} label="name" onReset={() => set({ title: null })} />}
            </div>
            <input
              id="giveaway-prize-title"
              className="dash-input"
              value={titleValue}
              maxLength={PRIZE_TITLE_MAX}
              placeholder={fromProduct ? productName ?? undefined : 'What the winner gets'}
              onChange={(event) => set({ title: event.target.value })}
            />
          </div>
          <div className="dash-field">
            <div className="giveaway-field-head">
              <label className="dash-label" htmlFor="giveaway-prize-description">Prize description</label>
              {fromProduct && <FieldSource following={value.description === null} label="description" onReset={() => set({ description: null })} />}
            </div>
            <textarea
              id="giveaway-prize-description"
              className="dash-textarea"
              value={descriptionValue}
              maxLength={PRIZE_DESCRIPTION_MAX}
              placeholder={descriptionPlaceholder}
              onChange={(event) => set({ description: event.target.value })}
            />
          </div>
          <div className="dash-field giveaway-prize-image">
            <span className="dash-label">Prize image <span className="giveaway-optional">Optional</span></span>
            {value.image ? (
              <div className="giveaway-chosen" data-testid="giveaway-chosen-image">
                <Thumb url={value.image.url} />
                <div className="giveaway-chosen-text">
                  <span>From Gallery</span>
                  <strong>{fromProduct ? 'Shown instead of the product photo' : 'Image chosen'}</strong>
                </div>
                {!disabled && (
                  <div className="giveaway-chosen-actions">
                    <button type="button" className="dash-btn-secondary" onClick={() => setPickerOpen(true)}>Change</button>
                    <button type="button" className="dash-btn-ghost" onClick={() => set({ image: null })}>
                      {fromProduct ? 'Use the product photo' : 'Remove'}
                    </button>
                  </div>
                )}
              </div>
            ) : fromProduct ? (
              <div className="giveaway-chosen" data-testid="giveaway-product-image">
                <Thumb url={info?.imageUrl ?? null} />
                <div className="giveaway-chosen-text">
                  <span>From the product</span>
                  <strong>{info?.imageUrl ? 'Product photo' : 'The product’s cover photo'}</strong>
                </div>
                {!disabled && (
                  <button type="button" className="dash-btn-secondary" onClick={() => setPickerOpen(true)}>
                    <ImagePlus size={16} aria-hidden="true" />
                    Use a Gallery image
                  </button>
                )}
              </div>
            ) : (
              <button type="button" className="dash-btn-secondary giveaway-picker-button" onClick={() => setPickerOpen(true)}>
                <ImagePlus size={16} aria-hidden="true" />
                Add image from Gallery
              </button>
            )}
          </div>
        </div>
      )}
      {pickerOpen && (
        <GalleryPickerModal
          imagesOnly
          onClose={() => setPickerOpen(false)}
          onSelect={(item) => {
            if (item.kind !== 'image') {
              onError('Choose an image for the prize.');
              return;
            }
            set({ image: { id: item.id, url: item.url } });
            setPickerOpen(false);
          }}
        />
      )}
    </fieldset>
  );
}

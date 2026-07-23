'use client';

import React from 'react';
import type { ProductGridSection, ProductSource } from '@/lib/api/storefront';
import EntityPicker, { MultiProductPicker } from '../pickers/EntityPicker';

export function emptySourceFor(kind: ProductSource['kind']): ProductSource {
  if (kind === 'manual') return { kind: 'manual', productIds: [] };
  if (kind === 'category') return { kind: 'category', categoryId: '' };
  return { kind: 'brand', brandId: '' };
}

/** True when this source cannot possibly render anything on the storefront
 * yet — no category/brand chosen, or a manual pick list with nothing in it. */
function sourceIsEmpty(source: ProductSource): boolean {
  if (source.kind === 'category') return !source.categoryId;
  if (source.kind === 'brand') return !source.brandId;
  return source.productIds.length === 0;
}

export default function ProductGridEditor({
  section,
  onChange,
}: {
  section: ProductGridSection;
  onChange: (next: ProductGridSection) => void;
}) {
  const { source } = section;

  return (
    <div className="dash-form-section">
      <div className="dash-form-grid">
        <label className="dash-field">
          <span className="dash-label">Eyebrow (small line above the title)</span>
          <input className="dash-input" value={section.eyebrow}
            onChange={(e) => onChange({ ...section, eyebrow: e.target.value })} />
        </label>
        <label className="dash-field">
          <span className="dash-label">Title</span>
          <input className="dash-input" value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })} />
        </label>
        <label className="dash-field">
          <span className="dash-label">Where the items come from</span>
          <select
            className="dash-input"
            value={source.kind}
            onChange={(e) => {
              const kind = e.target.value as ProductSource['kind'];
              // Switching kinds must reset the previous kind's ids rather
              // than leaving stale, now-unreachable category/brand/product
              // ids sitting in the saved document.
              onChange({
                ...section,
                source: emptySourceFor(kind),
                display: kind === 'category' ? section.display : 'products',
              });
            }}
          >
            <option value="category">A category</option>
            <option value="brand">A brand</option>
            <option value="manual">Products I pick myself</option>
          </select>
        </label>
        <label className="dash-field">
          <span className="dash-label">Show</span>
          <select
            className="dash-input"
            value={section.display}
            disabled={source.kind !== 'category'}
            onChange={(e) =>
              onChange({ ...section, display: e.target.value as 'products' | 'brands' })
            }
          >
            <option value="products">The products themselves</option>
            <option value="brands">The brands inside the category</option>
          </select>
        </label>
        <label className="dash-field">
          <span className="dash-label">How many to show</span>
          <input className="dash-input" type="number" min={1} max={24} value={section.limit}
            onChange={(e) =>
              onChange({ ...section, limit: Math.min(24, Math.max(1, Number(e.target.value))) })
            } />
        </label>
        <label className="dash-field">
          <span className="dash-label">"View all" link (blank to hide it)</span>
          <input className="dash-input" value={section.viewAllHref ?? ''} placeholder="/products"
            onChange={(e) => onChange({ ...section, viewAllHref: e.target.value.trim() || null })} />
        </label>
      </div>

      {source.kind === 'category' && (
        <EntityPicker
          kind="category"
          label="Category"
          value={source.categoryId || null}
          onChange={(id) => onChange({ ...section, source: { kind: 'category', categoryId: id ?? '' } })}
        />
      )}
      {source.kind === 'brand' && (
        <EntityPicker
          kind="brand"
          label="Brand"
          value={source.brandId || null}
          onChange={(id) => onChange({ ...section, source: { kind: 'brand', brandId: id ?? '' } })}
        />
      )}
      {source.kind === 'manual' && (
        <MultiProductPicker
          value={source.productIds}
          onChange={(productIds) => onChange({ ...section, source: { kind: 'manual', productIds } })}
        />
      )}

      {source.kind !== 'category' && (
        <p style={{ fontSize: 13, color: 'var(--mr-fg-4)' }}>
          Showing brand cards instead of products only makes sense when the source is a category
          — a brand or hand-picked source has no set of brands to show, so this control is
          disabled until you switch the source back to a category.
        </p>
      )}

      {sourceIsEmpty(source) && (
        <p className="dash-inline-error">
          Nothing is chosen yet, so this section will show up empty on the live storefront.
          {source.kind === 'category' && ' Pick a category above.'}
          {source.kind === 'brand' && ' Pick a brand above.'}
          {source.kind === 'manual' && ' Add at least one product above.'}
        </p>
      )}
    </div>
  );
}

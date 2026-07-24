'use client';

import React from 'react';
import { useEntityOptions } from './EntityPicker';
import type { StorefrontPage } from '@/lib/api/storefront';

/**
 * Picks a footer link destination from what actually exists — the shop's own
 * pages, categories and brands — instead of a free-text path. Typos like
 * "/shipping" pointed at a page that was never created and 404'd silently.
 *
 * "Custom link" is still available for external URLs (Instagram, a press
 * article), and reveals the text box only when chosen.
 */
export type LinkKind = 'page' | 'category' | 'brand' | 'custom';

/** Recovers which kind an already-saved href came from, so editing an existing
 *  link opens on the right option rather than resetting to the first. */
export function inferLinkKind(href: string, pageSlugs: string[]): LinkKind {
  const value = (href ?? '').trim();
  if (!value) return 'page';
  if (/^https?:\/\//i.test(value)) return 'custom';
  if (value.startsWith('/categories/')) return 'category';
  if (value.startsWith('/brands/') || value.startsWith('/products?brand=')) return 'brand';
  if (pageSlugs.includes(value.replace(/^\//, ''))) return 'page';
  return 'custom';
}

export default function LinkTargetField({
  href,
  pages,
  onChange,
}: {
  href: string;
  /** The shop's own pages, so a footer link can point at one by name. */
  pages: StorefrontPage[];
  onChange: (href: string) => void;
}) {
  const pageSlugs = React.useMemo(
    () => pages.map((p) => p.slug.trim()).filter(Boolean),
    [pages],
  );
  const [kind, setKind] = React.useState<LinkKind>(() => inferLinkKind(href, pageSlugs));

  const { options: categories } = useEntityOptions('category');
  const { options: brands } = useEntityOptions('brand');

  // Categories and brands are stored as ids in the picker but as real paths in
  // the href, so map back and forth by label.
  const categoryHref = (slugOrName: string) => `/categories/${slugOrName}`;

  const selectStyle = { flex: '1 1 220px', minWidth: 0 } as const;

  return (
    <div style={{ display: 'flex', gap: 8, flex: '2 1 320px', minWidth: 0, flexWrap: 'wrap' }}>
      <select
        className="dash-input"
        style={{ flex: '0 1 150px', minWidth: 0 }}
        value={kind}
        onChange={(e) => {
          const next = e.target.value as LinkKind;
          setKind(next);
          // Clear the href when switching kind so a stale path from the
          // previous kind cannot be saved under the new one.
          onChange('');
        }}
      >
        <option value="page">Shop page</option>
        <option value="category">Category</option>
        <option value="brand">Brand</option>
        <option value="custom">Custom link</option>
      </select>

      {kind === 'page' && (
        <select
          className="dash-input"
          style={selectStyle}
          value={href.replace(/^\//, '')}
          onChange={(e) => onChange(e.target.value ? `/${e.target.value}` : '')}
        >
          <option value="">Select a page…</option>
          {pages
            .filter((p) => p.slug.trim())
            .map((p) => (
              <option key={p.id} value={p.slug.trim()}>
                {p.title || p.slug}
              </option>
            ))}
        </select>
      )}

      {kind === 'category' && (
        <select
          className="dash-input"
          style={selectStyle}
          value={href}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select a category…</option>
          {categories.map((c) => (
            <option key={c.id} value={categoryHref(c.id)}>
              {c.label.replace(/^—\s*/g, '')}
            </option>
          ))}
        </select>
      )}

      {kind === 'brand' && (
        <select
          className="dash-input"
          style={selectStyle}
          value={href}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select a brand…</option>
          {brands.map((b) => (
            <option key={b.id} value={`/products?brand=${encodeURIComponent(b.label)}`}>
              {b.label}
            </option>
          ))}
        </select>
      )}

      {kind === 'custom' && (
        <input
          className="dash-input"
          style={selectStyle}
          value={href}
          placeholder="https://instagram.com/…"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

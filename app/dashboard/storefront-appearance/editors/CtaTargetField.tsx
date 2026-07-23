'use client';

import React from 'react';
import type { CtaTarget } from '@/lib/api/storefront';
import EntityPicker from '../pickers/EntityPicker';

export default function CtaTargetField({
  value,
  onChange,
}: {
  value: CtaTarget;
  onChange: (next: CtaTarget) => void;
}) {
  return (
    <>
      <label className="dash-field">
        <span className="dash-label">Button goes to</span>
        <select
          className="dash-input"
          value={value.kind}
          onChange={(e) => {
            const kind = e.target.value as CtaTarget['kind'];
            if (kind === 'scroll') onChange({ kind: 'scroll' });
            else if (kind === 'url') onChange({ kind: 'url', url: '' });
            else if (kind === 'product') onChange({ kind: 'product', productId: '' });
            else if (kind === 'category') onChange({ kind: 'category', categoryId: '' });
            else onChange({ kind: 'brand', brandId: '' });
          }}
        >
          <option value="scroll">Scroll to the products below</option>
          <option value="product">A product page</option>
          <option value="category">A category page</option>
          <option value="brand">A brand's products</option>
          <option value="url">A custom link</option>
        </select>
      </label>

      {value.kind === 'url' && (
        <label className="dash-field">
          <span className="dash-label">Link</span>
          <input
            className="dash-input"
            value={value.url}
            placeholder="/journal or https://…"
            onChange={(e) => onChange({ kind: 'url', url: e.target.value })}
          />
        </label>
      )}
      {value.kind === 'product' && (
        <EntityPicker
          kind="product"
          label="Product"
          value={value.productId || null}
          onChange={(id) => onChange({ kind: 'product', productId: id ?? '' })}
        />
      )}
      {value.kind === 'category' && (
        <EntityPicker
          kind="category"
          label="Category"
          value={value.categoryId || null}
          onChange={(id) => onChange({ kind: 'category', categoryId: id ?? '' })}
        />
      )}
      {value.kind === 'brand' && (
        <EntityPicker
          kind="brand"
          label="Brand"
          value={value.brandId || null}
          onChange={(id) => onChange({ kind: 'brand', brandId: id ?? '' })}
        />
      )}
    </>
  );
}

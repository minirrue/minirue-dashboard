'use client';

import React, { useEffect, useState } from 'react';
import {
  listCategories,
  listManagedBrands,
  type ManagedBrand,
} from '@/lib/catalog/api';
import type { Category } from '@/lib/catalog/types';

/**
 * Where a product sits in the tree, plus its option-list picks.
 * specs/2026-07-22-product-tree-design.md
 *
 * Category → Brand → (the item itself). Just the two selects: global variants
 * describe a VARIANT, so they live in the Variants section, not here. An
 * earlier build rendered them on this form too, which is why a list called
 * 'Test' showed up under Brand on the product details screen.
 */

export interface ClassificationValue {
  categoryId: string;
  brandId: string;
}

interface Props {
  value: ClassificationValue;
  onChange: (next: ClassificationValue) => void;
  disabled?: boolean;
  errors?: { categoryId?: string; brandId?: string };
  tracePrefix: string;
}

export default function ProductClassification({
  value,
  onChange,
  disabled = false,
  errors = {},
  tracePrefix,
}: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<ManagedBrand[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listCategories(), listManagedBrands()])
      .then(([cats, brandRows]) => {
        if (cancelled) return;
        setCategories(cats.items);
        setBrands(brandRows);
      })
      .catch(() => {
        if (!cancelled)
          setLoadError('Could not load categories and brands.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function setCategory(categoryId: string) {
    onChange({ ...value, categoryId });
  }

  return (
    <>
      {loadError && <p className="dash-inline-error">{loadError}</p>}

      <div className="dash-field-row">
        <div className="dash-field">
          <label className="dash-label" htmlFor="pc-category">
            Category <span className="dash-required">*</span>
          </label>
          <select
            id="pc-category"
            className={`dash-select${errors.categoryId ? ' dash-input-error' : ''}`}
            value={value.categoryId}
            onChange={(e) => setCategory(e.target.value)}
            disabled={disabled}
            data-trace-id={`${tracePrefix}::EL-SELECT-product-category`}
          >
            <option value="">Select category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.categoryId && (
            <p className="dash-field-error">{errors.categoryId}</p>
          )}
        </div>

        <div className="dash-field">
          <label className="dash-label" htmlFor="pc-brand">
            Brand <span className="dash-required">*</span>
          </label>
          <select
            id="pc-brand"
            className={`dash-select${errors.brandId ? ' dash-input-error' : ''}`}
            value={value.brandId}
            onChange={(e) => onChange({ ...value, brandId: e.target.value })}
            disabled={disabled}
            data-trace-id={`${tracePrefix}::EL-SELECT-product-brand`}
          >
            <option value="">Select brand…</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {errors.brandId && <p className="dash-field-error">{errors.brandId}</p>}
        </div>
      </div>

    </>
  );
}

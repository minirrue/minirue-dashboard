'use client';

import React, { useEffect, useState } from 'react';
import {
  listCategories,
  listManagedBrands,
  listAttributes,
  type ManagedBrand,
} from '@/lib/catalog/api';
import type {
  AttributeRecord,
  AttributeOptionRecord,
  Category,
} from '@/lib/catalog/types';
import { listAttributeOptions } from '@/lib/catalog/api';

/**
 * Where a product sits in the tree, plus its option-list picks.
 * specs/2026-07-22-product-tree-design.md
 *
 * Category → Brand → (the item itself). The two selects are the first two
 * levels; the item being edited is the third. Attribute dropdowns below them
 * are whatever lists apply to the chosen category, so switching category
 * changes which questions get asked.
 *
 * Shared by the create and edit pages so the two cannot drift apart — they
 * previously each carried their own copy of a hardcoded gender list.
 */

export interface ClassificationValue {
  categoryId: string;
  brandId: string;
  /** attribute id -> chosen option id */
  attributes: Record<string, string>;
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
  const [attributes, setAttributes] = useState<AttributeRecord[]>([]);
  const [optionsByAttribute, setOptionsByAttribute] = useState<
    Record<string, AttributeOptionRecord[]>
  >({});
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

  // Re-fetch whenever the category changes: a list scoped to Cosmetics must
  // not appear on a Perfume item.
  useEffect(() => {
    if (!value.categoryId) {
      setAttributes([]);
      setOptionsByAttribute({});
      return;
    }
    let cancelled = false;
    listAttributes(value.categoryId)
      .then(async (attrs) => {
        if (cancelled) return;
        setAttributes(attrs);
        const entries = await Promise.all(
          attrs.map(
            async (a) =>
              [a.id, await listAttributeOptions(a.id)] as const,
          ),
        );
        if (cancelled) return;
        setOptionsByAttribute(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load the option lists.');
      });
    return () => {
      cancelled = true;
    };
  }, [value.categoryId]);

  function setCategory(categoryId: string) {
    // Picks are cleared: an option belonging to the old category's list would
    // be rejected by the server anyway, and silently keeping it would show the
    // admin a value that is not really set.
    onChange({ ...value, categoryId, attributes: {} });
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

      {value.categoryId && attributes.length === 0 && (
        <p className="dash-muted">
          This category has no option lists yet. Add them under Products →
          Option lists.
        </p>
      )}

      {attributes.map((attribute) => {
        const options = optionsByAttribute[attribute.id] ?? [];
        return (
          <div className="dash-field" key={attribute.id}>
            <label className="dash-label" htmlFor={`pc-attr-${attribute.id}`}>
              {attribute.name}
            </label>
            <select
              id={`pc-attr-${attribute.id}`}
              className="dash-select"
              value={value.attributes[attribute.id] ?? ''}
              onChange={(e) => {
                const next = { ...value.attributes };
                // Empty means "not set", so drop the key rather than sending
                // an empty string the server would reject as a non-uuid.
                if (e.target.value) next[attribute.id] = e.target.value;
                else delete next[attribute.id];
                onChange({ ...value, attributes: next });
              }}
              disabled={disabled}
              data-trace-id={`${tracePrefix}::EL-SELECT-attribute@${attribute.id}`}
            >
              <option value="">Not set</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </>
  );
}

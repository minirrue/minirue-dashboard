'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import CatalogSubnav from '@/components/dashboard/CatalogSubnav';
import { loadTree, listAdminAttributes } from '@/lib/catalog/api';
import type { TreeCategoryNode, AttributeRecord } from '@/lib/catalog/types';
import type { ApiError } from '@/lib/api/client';

const TRACE = 'PG-DASHBOARD-CAT-007';

/**
 * The catalogue map.
 * specs/2026-07-23-catalogue-navigation
 *
 * The model — category holds brands, brands hold products, and every product
 * in a category answers that category's global questions — was never drawn
 * anywhere. You had to hold it in your head across five screens. This one shows
 * it: the tree, the counts, and which questions each category asks, with a
 * plain-words note on global versus custom variants.
 *
 * Read-only on purpose. Every row links out to the screen that changes that
 * thing; nothing is edited here, so there is no way to break the catalogue from
 * the map.
 */

/** Brand → its product list, deep-linked by brand name (the list filters by name). */
function brandHref(brandName: string): string {
  return `/catalogue/products?brand=${encodeURIComponent(brandName)}`;
}

export default function CatalogOverviewClient() {
  const [tree, setTree] = useState<TreeCategoryNode[]>([]);
  const [attributes, setAttributes] = useState<AttributeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Two independent reads. Settle both before rendering so the "answers"
    // lines never flash empty and then fill in — a partial map reads as a
    // broken one.
    Promise.all([loadTree(), listAdminAttributes()])
      .then(([treeRes, attrRes]) => {
        if (cancelled) return;
        setTree(Array.isArray(treeRes) ? treeRes : []);
        setAttributes(Array.isArray(attrRes) ? attrRes : []);
      })
      .catch((e) => {
        if (!cancelled) setError((e as ApiError).message ?? 'Could not load the catalogue.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalProducts = useMemo(
    () => tree.reduce((n, c) => n + c.itemCount, 0),
    [tree],
  );

  /** The global questions a category asks: its own, plus the everywhere ones. */
  function answersFor(categoryId: string): string[] {
    return attributes
      .filter((a) => a.isActive)
      .filter((a) => a.categoryIds.length === 0 || a.categoryIds.includes(categoryId))
      .map((a) => a.name);
  }

  function toggle(categoryId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  return (
    <>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Catalogue</h1>
        <Link
          href="/catalogue/products/new"
          className="dash-btn-primary"
          data-trace-id={`${TRACE}::EL-LINK-new-product`}
        >
          New product
        </Link>
      </div>

      <CatalogSubnav />

      {loading ? (
        <div className="dash-card">
          <p className="dash-muted">Loading your catalogue…</p>
        </div>
      ) : error ? (
        <div className="dash-card">
          <p className="dash-inline-error">{error}</p>
        </div>
      ) : (
        <>
          <p className="dash-muted" style={{ marginTop: -8, marginBottom: 20 }}>
            {totalProducts} product{totalProducts === 1 ? '' : 's'} across{' '}
            {tree.length} categor{tree.length === 1 ? 'y' : 'ies'}.
          </p>

          {tree.length === 0 ? (
            <div className="dash-card">
              <p style={{ marginTop: 0 }}>Your catalogue is empty.</p>
              <p className="dash-muted">
                Start by making a category (say, Perfumes), then a brand inside
                it, then the products.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Link href="/catalogue/categories" className="dash-btn-secondary">
                  Add a category
                </Link>
                <Link href="/catalogue/products/new" className="dash-btn-primary">
                  New product
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {tree.map((category) => {
                const isCollapsed = collapsed.has(category.categoryId);
                const answers = answersFor(category.categoryId);
                return (
                  <section
                    key={category.categoryId}
                    className="dash-card"
                    data-trace-id={`${TRACE}::EL-REGION-category@${category.categoryId}`}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(category.categoryId)}
                        className="dash-catalog-tree-toggle"
                        aria-expanded={!isCollapsed}
                        data-trace-id={`${TRACE}::EL-BTN-toggle@${category.categoryId}`}
                      >
                        <span
                          className="dash-catalog-tree-caret"
                          data-open={!isCollapsed}
                          aria-hidden="true"
                        >
                          ▸
                        </span>
                        <span className="dash-catalog-tree-name">
                          {category.categoryName}
                        </span>
                      </button>
                      <span className="dash-muted">
                        {category.brands.length} brand
                        {category.brands.length === 1 ? '' : 's'} ·{' '}
                        {category.itemCount} product
                        {category.itemCount === 1 ? '' : 's'}
                      </span>
                    </div>

                    {!isCollapsed && (
                      <div style={{ marginTop: 16 }}>
                        {category.brands.length === 0 ? (
                          <p className="dash-muted" style={{ margin: '0 0 12px' }}>
                            No brands here yet.{' '}
                            <Link href="/catalogue/brands" className="dash-link">
                              Add one
                            </Link>
                            .
                          </p>
                        ) : (
                          <div className="dash-catalog-brand-grid">
                            {category.brands.map((brand) => (
                              <Link
                                key={brand.brandId}
                                href={brandHref(brand.brandName)}
                                className="dash-catalog-brand-chip"
                                data-trace-id={`${TRACE}::EL-LINK-brand@${brand.brandId}`}
                              >
                                <span className="dash-catalog-brand-name">
                                  {brand.brandName}
                                </span>
                                <span className="dash-catalog-brand-count">
                                  {brand.itemCount}
                                </span>
                              </Link>
                            ))}
                          </div>
                        )}

                        <div className="dash-catalog-answers">
                          <span className="dash-catalog-answers-label">
                            Every product here answers:
                          </span>{' '}
                          {answers.length === 0 ? (
                            <span className="dash-muted">
                              nothing yet —{' '}
                              <Link
                                href="/catalogue/global-variants"
                                className="dash-link"
                              >
                                add a global variant
                              </Link>
                              .
                            </span>
                          ) : (
                            answers.map((name, i) => (
                              <React.Fragment key={name}>
                                {i > 0 && ' · '}
                                <span className="dash-catalog-answer-pill">
                                  {name}
                                </span>
                              </React.Fragment>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          {/* Plain-words explainer — the distinction the user kept having to
              re-derive. Kept on the map so it is next to the thing it explains. */}
          <section
            className="dash-card"
            style={{ marginTop: 20 }}
            data-trace-id={`${TRACE}::EL-REGION-variant-explainer`}
          >
            <h2 style={{ marginTop: 0, fontSize: 17 }}>How variants work</h2>
            <div className="dash-catalog-explainer-grid">
              <div>
                <strong>Global variant</strong>
                <p className="dash-muted" style={{ margin: '4px 0 0' }}>
                  A question every product in a category has to answer — bottle
                  size, price. You set the question once; each product fills in
                  its own answer. Manage these on{' '}
                  <Link href="/catalogue/global-variants" className="dash-link">
                    Global variants
                  </Link>
                  .
                </p>
              </div>
              <div>
                <strong>Custom variant</strong>
                <p className="dash-muted" style={{ margin: '4px 0 0' }}>
                  A question only one product has — scent notes, spray type.
                  Most products do not have it, so you add it to just the one
                  product, on its own edit page.
                </p>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}

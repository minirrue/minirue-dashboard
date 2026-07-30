'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { listCategories, createCategory, updateCategory, deleteCategory } from '@/lib/catalog/api';
import type { Category } from '@/lib/catalog/types';
import type { ApiError } from '@/lib/api/client';
import CategoryTree, { type CategoryTreeApi } from './CategoryTree';
import NewCategoryForm, { type ParentOption } from './NewCategoryForm';
import CatalogSubnav from '@/components/dashboard/CatalogSubnav';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

const TRACE = 'PG-DASHBOARD-CAT-004';

/** Flatten helper for the "Parent Category" select. */
function flattenForSelect(categories: Category[], depth = 0): ParentOption[] {
  return categories.flatMap((cat) => [
    { id: cat.id, name: cat.name, depth },
    ...flattenForSelect(cat.children ?? [], depth + 1),
  ]);
}

/** Deep update helper — replaces one node in the tree in place. */
function updateCategoryInTree(tree: Category[], updated: Category): Category[] {
  return tree.map((cat) => {
    if (cat.id === updated.id) return { ...updated, children: cat.children };
    if (cat.children && cat.children.length > 0) {
      return { ...cat, children: updateCategoryInTree(cat.children, updated) };
    }
    return cat;
  });
}

/* ── Page ── */
export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await listCategories({ space: 'house' });
      // Guarded: a response missing this key set state to undefined and the
      // next .map()/.reduce() blanked the whole tab. Same bug as Settings
      // and Loyalty had.
      setCategories(Array.isArray(res?.items) ? res.items : []);
    } catch (e) {
      const err = e as ApiError;
      setLoadError(err.message ?? 'Failed to load categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useMountedEffect(() => {
    load();
  }, [load]);

  function handleCategoryUpdated(updated: Category) {
    setCategories((prev) => updateCategoryInTree(prev, updated));
  }

  const parentOptions = useMemo(() => flattenForSelect(categories), [categories]);

  // MiniRue's own space, bound once — the tree component itself never knows
  // it is talking to 'house' rather than a partner's space.
  const api: CategoryTreeApi<Category> = useMemo(
    () => ({
      update: (id, data) => updateCategory(id, data, 'house'),
      remove: (id) => deleteCategory(id, 'house'),
    }),
    [],
  );

  return (
    <>
      <div className="dash-page-header" data-trace-id={`${TRACE}::EL-REGION-categories-page-header`}>
        <h1 className="dash-page-title">Categories</h1>
      </div>

      <CatalogSubnav />

      <NewCategoryForm
        parentOptions={parentOptions}
        traceId={TRACE}
        onCreate={(input) =>
          createCategory({
            name: input.name,
            slug: input.slug ?? '',
            parentId: input.parentId,
            sortOrder: input.sortOrder,
            imageMediaId: input.imageMediaId,
            space: 'house',
          })
        }
        onCreated={load}
      />

      {/* Tree */}
      {loading ? (
        <div
          className="dash-card"
          style={{ padding: 0, overflow: 'hidden' }}
          data-trace-id={`${TRACE}::EL-REGION-categories-tree-skeleton`}
        >
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  {['Name', 'Slug', 'Children', 'Actions'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <td key={j}>
                        <span className="dash-skeleton" style={{ width: j === 2 ? 30 : '70%' }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : loadError ? (
        <div className="dash-card" data-trace-id={`${TRACE}::EL-REGION-categories-load-error`}>
          <p className="dash-inline-error">{loadError}</p>
          <button
            className="dash-btn-secondary"
            style={{ marginTop: 12 }}
            onClick={load}
            data-trace-id={`${TRACE}::EL-BTN-retry-load-categories`}
          >
            Retry
          </button>
        </div>
      ) : (
        <CategoryTree
          categories={categories}
          api={api}
          onCategoryUpdated={handleCategoryUpdated}
          onCategoryDeleted={load}
        />
      )}
    </>
  );
}

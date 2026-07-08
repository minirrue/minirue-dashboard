'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { listCategories, createCategory, deleteCategory } from '@/lib/catalog/api';
import type { Category } from '@/lib/catalog/types';
import type { ApiError } from '@/lib/api/client';
import CategoryTree from './CategoryTree';

/* ── Slug generation ── */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/* ── Form types ── */
interface AddFormValues {
  name: string;
  slug: string;
  parentId: string;
  sortOrder: string;
}

interface AddFormErrors {
  name?: string;
  slug?: string;
}

function validate(v: AddFormValues): AddFormErrors {
  const errors: AddFormErrors = {};
  if (!v.name.trim()) errors.name = 'Name is required.';
  if (!v.slug.trim()) errors.slug = 'Slug is required.';
  return errors;
}

/* ── Flatten helper for parent select ── */
function flattenForSelect(
  categories: Category[],
  depth = 0,
): Array<Category & { depth: number }> {
  return categories.flatMap((cat) => [
    { ...cat, depth },
    ...flattenForSelect(cat.children ?? [], depth + 1),
  ]);
}

/* ── Deep update helper ── */
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

  const [showAddForm, setShowAddForm] = useState(false);
  const [addValues, setAddValues] = useState<AddFormValues>({
    name: '',
    slug: '',
    parentId: '',
    sortOrder: '0',
  });
  const [addErrors, setAddErrors] = useState<AddFormErrors>({});
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await listCategories();
      setCategories(res.items);
    } catch (e) {
      const err = e as ApiError;
      setLoadError(err.message ?? 'Failed to load categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setAddField<K extends keyof AddFormValues>(key: K, value: string) {
    setAddValues((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-generate slug from name
      if (key === 'name') {
        next.slug = slugify(value);
      }
      return next;
    });
    if (addErrors[key as keyof AddFormErrors]) {
      setAddErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(addValues);
    if (Object.keys(errs).length > 0) {
      setAddErrors(errs);
      return;
    }
    setAddError(null);
    setAdding(true);
    try {
      await createCategory({
        name: addValues.name.trim(),
        slug: addValues.slug.trim(),
        parentId: addValues.parentId || undefined,
        sortOrder: Number(addValues.sortOrder) || 0,
      });
      setAddValues({ name: '', slug: '', parentId: '', sortOrder: '0' });
      setShowAddForm(false);
      await load();
    } catch (e) {
      const err = e as ApiError;
      setAddError(err.message ?? 'Failed to create category.');
    } finally {
      setAdding(false);
    }
  }

  function handleCategoryUpdated(updated: Category) {
    setCategories((prev) => updateCategoryInTree(prev, updated));
  }

  const flatOptions = flattenForSelect(categories);

  return (
    <>
      <div className="dash-page-header" data-trace-id="PG-DASHBOARD-CAT-004::EL-REGION-categories-page-header">
        <h1 className="dash-page-title">Categories</h1>
        {!showAddForm && (
          <button
            className="dash-btn-primary"
            onClick={() => setShowAddForm(true)}
            data-trace-id="PG-DASHBOARD-CAT-004::EL-BTN-show-add-category-form"
          >
            Add Category
          </button>
        )}
      </div>

      {/* Add category form */}
      {showAddForm && (
        <form
          className="dash-form-card"
          onSubmit={handleAddCategory}
          noValidate
          data-trace-id="PG-DASHBOARD-CAT-004::EL-FORM-add-category-form"
        >
          <h2 className="dash-section-title" style={{ marginBottom: 16 }}>
            New Category
          </h2>
          <div className="dash-field-row">
            <div className="dash-field">
              <label className="dash-label" htmlFor="cat-name">
                Name <span className="dash-required">*</span>
              </label>
              <input
                id="cat-name"
                className={`dash-input${addErrors.name ? ' dash-input-error' : ''}`}
                value={addValues.name}
                onChange={(e) => setAddField('name', e.target.value)}
                placeholder="e.g. Woody"
                disabled={adding}
                autoFocus
                data-trace-id="PG-DASHBOARD-CAT-004::EL-INPUT-add-category-name"
              />
              {addErrors.name && <p className="dash-field-error">{addErrors.name}</p>}
            </div>
            <div className="dash-field">
              <label className="dash-label" htmlFor="cat-slug">
                Slug <span className="dash-required">*</span>
              </label>
              <input
                id="cat-slug"
                className={`dash-input${addErrors.slug ? ' dash-input-error' : ''}`}
                value={addValues.slug}
                onChange={(e) => setAddField('slug', e.target.value)}
                placeholder="woody"
                disabled={adding}
                data-trace-id="PG-DASHBOARD-CAT-004::EL-INPUT-add-category-slug"
              />
              {addErrors.slug && <p className="dash-field-error">{addErrors.slug}</p>}
            </div>
          </div>
          <div className="dash-field-row">
            <div className="dash-field">
              <label className="dash-label" htmlFor="cat-parent">
                Parent Category
              </label>
              <select
                id="cat-parent"
                className="dash-select"
                value={addValues.parentId}
                onChange={(e) => setAddField('parentId', e.target.value)}
                disabled={adding}
                data-trace-id="PG-DASHBOARD-CAT-004::EL-SELECT-add-category-parent"
              >
                <option value="">None (top-level)</option>
                {flatOptions.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {'  '.repeat(cat.depth)}
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="dash-field">
              <label className="dash-label" htmlFor="cat-sort">
                Sort Order
              </label>
              <input
                id="cat-sort"
                type="number"
                className="dash-input"
                value={addValues.sortOrder}
                onChange={(e) => setAddField('sortOrder', e.target.value)}
                disabled={adding}
                data-trace-id="PG-DASHBOARD-CAT-004::EL-INPUT-add-category-sort-order"
              />
            </div>
          </div>

          {addError && <p className="dash-inline-error">{addError}</p>}

          <div className="dash-form-actions">
            <button
              type="submit"
              className="dash-btn-primary"
              disabled={adding}
              data-trace-id="PG-DASHBOARD-CAT-004::EL-BTN-create-category"
            >
              {adding ? 'Creating…' : 'Create Category'}
            </button>
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={() => {
                setShowAddForm(false);
                setAddValues({ name: '', slug: '', parentId: '', sortOrder: '0' });
                setAddErrors({});
                setAddError(null);
              }}
              disabled={adding}
              data-trace-id="PG-DASHBOARD-CAT-004::EL-BTN-cancel-add-category"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Tree */}
      {loading ? (
        <div
          className="dash-card"
          style={{ padding: 0, overflow: 'hidden' }}
          data-trace-id="PG-DASHBOARD-CAT-004::EL-REGION-categories-tree-skeleton"
        >
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
      ) : loadError ? (
        <div className="dash-card" data-trace-id="PG-DASHBOARD-CAT-004::EL-REGION-categories-load-error">
          <p className="dash-inline-error">{loadError}</p>
          <button
            className="dash-btn-secondary"
            style={{ marginTop: 12 }}
            onClick={load}
            data-trace-id="PG-DASHBOARD-CAT-004::EL-BTN-retry-load-categories"
          >
            Retry
          </button>
        </div>
      ) : (
        <CategoryTree
          categories={categories}
          onCategoryUpdated={handleCategoryUpdated}
          onCategoryDeleted={load}
        />
      )}
    </>
  );
}

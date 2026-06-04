'use client';

import React, { useState } from 'react';
import { updateCategory } from '@/lib/catalog/api';
import type { Category } from '@/lib/catalog/types';
import type { ApiError } from '@/lib/api/client';

interface EditValues {
  name: string;
  slug: string;
  sortOrder: string;
}

interface EditErrors {
  name?: string;
  slug?: string;
}

function validateEdit(v: EditValues): EditErrors {
  const errors: EditErrors = {};
  if (!v.name.trim()) errors.name = 'Name is required.';
  if (!v.slug.trim()) errors.slug = 'Slug is required.';
  return errors;
}

interface CategoryRowProps {
  category: Category;
  depth: number;
  onUpdated: (updated: Category) => void;
}

function CategoryRow({ category, depth, onUpdated }: CategoryRowProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<EditValues>({
    name: category.name,
    slug: category.slug,
    sortOrder: String(category.sortOrder),
  });
  const [errors, setErrors] = useState<EditErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasChildren = (category.children ?? []).length > 0;
  const childCount = category.children?.length ?? 0;

  function setField<K extends keyof EditValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof EditErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateEdit(values);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await updateCategory(category.id, {
        name: values.name.trim(),
        slug: values.slug.trim(),
        sortOrder: Number(values.sortOrder) || 0,
      });
      onUpdated(updated);
      setEditing(false);
    } catch (e) {
      const err = e as ApiError;
      setSaveError(err.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <tr className="dash-cat-row">
        <td style={{ paddingLeft: 14 + depth * 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {hasChildren ? (
              <button
                type="button"
                className="dash-tree-toggle"
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded ? '▾' : '▸'}
              </button>
            ) : (
              <span style={{ display: 'inline-block', width: 18 }} />
            )}
            {category.name}
          </div>
        </td>
        <td>
          <code className="dash-slug">{category.slug}</code>
        </td>
        <td style={{ textAlign: 'right' }}>
          {childCount > 0 ? childCount : <span style={{ color: 'var(--mr-fg-4)' }}>—</span>}
        </td>
        <td>
          <button
            type="button"
            className="dash-btn-ghost"
            onClick={() => {
              setEditing((v) => !v);
              setSaveError(null);
            }}
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </td>
      </tr>

      {editing && (
        <tr>
          <td colSpan={4} style={{ background: 'var(--mr-dash-sub)', padding: '12px 14px' }}>
            <form className="dash-inline-form" onSubmit={handleSave} noValidate>
              <div className="dash-field-row">
                <div className="dash-field">
                  <label className="dash-label" htmlFor={`cat-name-${category.id}`}>
                    Name <span className="dash-required">*</span>
                  </label>
                  <input
                    id={`cat-name-${category.id}`}
                    className={`dash-input${errors.name ? ' dash-input-error' : ''}`}
                    value={values.name}
                    onChange={(e) => setField('name', e.target.value)}
                    disabled={saving}
                  />
                  {errors.name && <p className="dash-field-error">{errors.name}</p>}
                </div>
                <div className="dash-field">
                  <label className="dash-label" htmlFor={`cat-slug-${category.id}`}>
                    Slug <span className="dash-required">*</span>
                  </label>
                  <input
                    id={`cat-slug-${category.id}`}
                    className={`dash-input${errors.slug ? ' dash-input-error' : ''}`}
                    value={values.slug}
                    onChange={(e) => setField('slug', e.target.value)}
                    disabled={saving}
                  />
                  {errors.slug && <p className="dash-field-error">{errors.slug}</p>}
                </div>
                <div className="dash-field">
                  <label className="dash-label" htmlFor={`cat-sort-${category.id}`}>
                    Sort Order
                  </label>
                  <input
                    id={`cat-sort-${category.id}`}
                    type="number"
                    className="dash-input"
                    value={values.sortOrder}
                    onChange={(e) => setField('sortOrder', e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
              {saveError && <p className="dash-inline-error">{saveError}</p>}
              <div className="dash-form-actions">
                <button type="submit" className="dash-btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="dash-btn-ghost"
                  onClick={() => { setEditing(false); setSaveError(null); }}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </td>
        </tr>
      )}

      {expanded &&
        hasChildren &&
        (category.children ?? []).map((child) => (
          <CategoryRow
            key={child.id}
            category={child}
            depth={depth + 1}
            onUpdated={onUpdated}
          />
        ))}
    </>
  );
}

interface Props {
  categories: Category[];
  onCategoryUpdated: (updated: Category) => void;
}

export default function CategoryTree({ categories, onCategoryUpdated }: Props) {
  if (categories.length === 0) {
    return (
      <p className="dash-help-text" style={{ padding: '20px 0' }}>
        No categories yet. Add your first category above.
      </p>
    );
  }

  return (
    <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="dash-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th style={{ textAlign: 'right' }}>Children</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <CategoryRow
              key={cat.id}
              category={cat}
              depth={0}
              onUpdated={onCategoryUpdated}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

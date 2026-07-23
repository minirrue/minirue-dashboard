'use client';

import React, { useEffect, useState } from 'react';
import CatalogSubnav from '@/components/dashboard/CatalogSubnav';
import {
  listAdminAttributes,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  listCategories,
} from '@/lib/catalog/api';
import type { AttributeRecord, Category } from '@/lib/catalog/types';
import type { ApiError } from '@/lib/api/client';
import DeleteChoiceDialog from '@/components/dashboard/DeleteChoiceDialog';

const TRACE = 'PG-DASHBOARD-CAT-006';

/**
 * Global variants — the fields every product in the chosen categories must
 * answer. specs/2026-07-24-free-entry-variant-values
 *
 * A global variant is JUST a field here: a name (Size, Concentration) and the
 * categories it applies to. The values are NOT set on this page any more — they
 * are typed on each product when you add a variant, and remembered for next
 * time. So this screen is only ever "what fields exist, and where do they
 * apply."
 */

/** A small labelled set of category checkboxes. */
function CategoryPicker({
  categories,
  selected,
  onToggle,
  disabled,
  idPrefix,
}: {
  categories: Category[];
  selected: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  if (categories.length === 0) {
    return <p className="dash-muted">No categories yet — add one first.</p>;
  }
  return (
    <div className="dash-checkbox-grid" data-trace-id={`${TRACE}::EL-REGION-${idPrefix}-categories`}>
      {categories.map((c) => (
        <label key={c.id} className="dash-checkbox-label">
          <input
            type="checkbox"
            className="dash-checkbox"
            checked={selected.includes(c.id)}
            onChange={() => onToggle(c.id)}
            disabled={disabled}
          />
          {c.name}
        </label>
      ))}
    </div>
  );
}

function GlobalVariantCard({
  attribute,
  categories,
  categoryNames,
  onUpdated,
  onDeleted,
}: {
  attribute: AttributeRecord;
  categories: Category[];
  categoryNames: string[];
  onUpdated: (a: AttributeRecord) => void;
  onDeleted: (id: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(attribute.name);
  const [editingCategories, setEditingCategories] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim() === attribute.name) {
      setRenaming(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onUpdated(await updateAttribute(attribute.id, { name: name.trim() }));
      setRenaming(false);
    } catch (e) {
      setError((e as ApiError).message ?? 'Rename failed.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleCategory(categoryId: string) {
    const current = attribute.categoryIds ?? [];
    const next = current.includes(categoryId)
      ? current.filter((x) => x !== categoryId)
      : [...current, categoryId];
    setBusy(true);
    setError(null);
    try {
      onUpdated(await updateAttribute(attribute.id, { categoryIds: next }));
    } catch (e) {
      setError((e as ApiError).message ?? 'Could not change the categories.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(mode: 'soft' | 'hard') {
    try {
      await deleteAttribute(attribute.id, mode);
      if (mode === 'hard') onDeleted(attribute.id);
      else onUpdated({ ...attribute, isActive: false });
      setConfirmDelete(false);
    } catch {
      // The dialog surfaces its own error.
    }
  }

  return (
    <section
      className="dash-card"
      style={{ marginBottom: 12, opacity: attribute.isActive ? 1 : 0.6 }}
      data-trace-id={`${TRACE}::EL-CARD-global-variant@${attribute.id}`}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 220 }}>
          {renaming ? (
            <form onSubmit={handleRename} style={{ display: 'flex', gap: 8 }}>
              <input
                className="dash-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                autoFocus
                maxLength={60}
                data-trace-id={`${TRACE}::EL-INPUT-rename@${attribute.id}`}
              />
              <button type="submit" className="dash-btn-primary" disabled={busy}>
                Save
              </button>
              <button
                type="button"
                className="dash-btn-ghost"
                onClick={() => {
                  setRenaming(false);
                  setName(attribute.name);
                }}
                disabled={busy}
              >
                Cancel
              </button>
            </form>
          ) : (
            <h2 style={{ margin: 0 }}>
              {attribute.name}
              {!attribute.isActive && <span className="dash-muted"> — deleted</span>}
            </h2>
          )}
          <p className="dash-muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
            Applies to:{' '}
            {categoryNames.length > 0 ? categoryNames.join(', ') : 'every category'}
          </p>
        </div>

        {attribute.isActive && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!renaming && (
              <button
                type="button"
                className="dash-btn-ghost"
                onClick={() => setRenaming(true)}
                data-trace-id={`${TRACE}::EL-BTN-rename-toggle@${attribute.id}`}
              >
                Rename
              </button>
            )}
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={() => setEditingCategories((v) => !v)}
              data-trace-id={`${TRACE}::EL-BTN-edit-categories@${attribute.id}`}
            >
              {editingCategories ? 'Done' : 'Categories'}
            </button>
            <button
              type="button"
              className="dash-btn-ghost dash-btn-danger"
              onClick={() => setConfirmDelete(true)}
              data-trace-id={`${TRACE}::EL-BTN-delete@${attribute.id}`}
            >
              Delete
            </button>
          </div>
        )}
        {!attribute.isActive && (
          <button
            type="button"
            className="dash-btn-secondary"
            onClick={async () => onUpdated(await updateAttribute(attribute.id, { isActive: true }))}
            data-trace-id={`${TRACE}::EL-BTN-restore@${attribute.id}`}
          >
            Restore
          </button>
        )}
      </div>

      {editingCategories && attribute.isActive && (
        <div style={{ marginTop: 12 }}>
          <p className="dash-help-text" style={{ marginBottom: 8 }}>
            Tick the categories whose products must answer this. None ticked
            means it applies everywhere.
          </p>
          <CategoryPicker
            categories={categories}
            selected={attribute.categoryIds ?? []}
            onToggle={toggleCategory}
            disabled={busy}
            idPrefix={`edit-${attribute.id}`}
          />
        </div>
      )}

      {error && <p className="dash-inline-error" style={{ marginTop: 8 }}>{error}</p>}

      {confirmDelete && (
        <DeleteChoiceDialog
          productName={attribute.name}
          onSoftDelete={() => handleDelete('soft')}
          onHardDelete={() => handleDelete('hard')}
          onCancel={() => setConfirmDelete(false)}
          traceIdPrefix={`${TRACE}::EL-MODAL-delete@${attribute.id}`}
          hardDeleteNote="The field goes for good, and every product that answered it loses that answer. The products themselves stay."
        />
      )}
    </section>
  );
}

export default function GlobalVariantsPage() {
  const [attributes, setAttributes] = useState<AttributeRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [newName, setNewName] = useState('');
  const [newCategoryIds, setNewCategoryIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([listAdminAttributes(), listCategories()])
      .then(([attrs, cats]) => {
        if (cancelled) return;
        setAttributes(Array.isArray(attrs) ? attrs : []);
        setCategories(Array.isArray(cats?.items) ? cats.items : []);
        setLoaded(true);
      })
      .catch((e: ApiError) => {
        if (!cancelled) setLoadError(e.message ?? 'Could not load global variants.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createAttribute({
        name: newName.trim(),
        categoryIds: newCategoryIds,
      });
      setAttributes((prev) => [...prev, created]);
      setNewName('');
      setNewCategoryIds([]);
    } catch (e) {
      setCreateError((e as ApiError).message ?? 'Could not add that field.');
    } finally {
      setCreating(false);
    }
  }

  function toggleNewCategory(id: string) {
    setNewCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function categoryNamesFor(attribute: AttributeRecord): string[] {
    return (attribute.categoryIds ?? [])
      .map((id) => categories.find((c) => c.id === id)?.name)
      .filter((n): n is string => !!n);
  }

  const activeVariants = attributes.filter((a) => a.isActive);
  const deletedVariants = attributes.filter((a) => !a.isActive);

  return (
    <div data-trace-id={`${TRACE}::EL-REGION-global-variants-page`}>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Global variants</h1>
      </div>

      <CatalogSubnav />

      <p className="dash-muted" style={{ maxWidth: 680 }}>
        A global variant is a field every product in the chosen categories must
        fill in — like <strong>Size</strong> or <strong>Concentration</strong>.
        You define the field here and pick where it applies. The actual values
        (50ml, EDP) are typed on each product when you add a variant, and
        remembered for next time — you never list them here.
      </p>

      <section className="dash-card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Add a global variant</h2>
        <form onSubmit={handleCreate}>
          <div className="dash-field" style={{ maxWidth: 420 }}>
            <label className="dash-label" htmlFor="gv-name">
              Field name <span className="dash-required">*</span>
            </label>
            <input
              id="gv-name"
              className="dash-input"
              placeholder="e.g. Size, Concentration"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={creating}
              maxLength={60}
              data-trace-id={`${TRACE}::EL-INPUT-new-name`}
            />
          </div>

          <div className="dash-field">
            <label className="dash-label">Which categories use it</label>
            <p className="dash-help-text" style={{ marginBottom: 8 }}>
              Leave all unticked to apply it to every category.
            </p>
            <CategoryPicker
              categories={categories}
              selected={newCategoryIds}
              onToggle={toggleNewCategory}
              disabled={creating}
              idPrefix="new"
            />
          </div>

          {createError && <p className="dash-inline-error">{createError}</p>}

          <button
            type="submit"
            className="dash-btn-primary"
            disabled={creating || !newName.trim()}
            data-trace-id={`${TRACE}::EL-BTN-create`}
          >
            {creating ? 'Adding…' : 'Add field'}
          </button>
        </form>
      </section>

      <div style={{ marginTop: 24 }}>
        {loading && <p>Loading…</p>}

        {loadError && (
          <div className="dash-card">
            <p className="dash-inline-error" style={{ marginBottom: 12 }}>{loadError}</p>
            <button
              type="button"
              className="dash-btn-secondary"
              onClick={() => setReloadKey((k) => k + 1)}
              data-trace-id={`${TRACE}::EL-BTN-retry-load`}
            >
              Try again
            </button>
          </div>
        )}

        {loaded && !loadError && activeVariants.length === 0 && deletedVariants.length === 0 && (
          <p className="dash-muted">No global variants yet. Add one above.</p>
        )}

        {activeVariants.map((a) => (
          <GlobalVariantCard
            key={a.id}
            attribute={a}
            categories={categories}
            categoryNames={categoryNamesFor(a)}
            onUpdated={(updated) =>
              setAttributes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
            }
            onDeleted={(id) => setAttributes((prev) => prev.filter((x) => x.id !== id))}
          />
        ))}

        {deletedVariants.length > 0 && (
          <>
            <h3 className="dash-muted" style={{ marginTop: 24 }}>Deleted</h3>
            {deletedVariants.map((a) => (
              <GlobalVariantCard
                key={a.id}
                attribute={a}
                categories={categories}
                categoryNames={categoryNamesFor(a)}
                onUpdated={(updated) =>
                  setAttributes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
                }
                onDeleted={(id) => setAttributes((prev) => prev.filter((x) => x.id !== id))}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

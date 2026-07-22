'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  listAdminAttributes,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  listAttributeOptions,
  createAttributeOption,
  updateAttributeOption,
  deleteAttributeOption,
  listCategories,
} from '@/lib/catalog/api';
import type {
  AttributeRecord,
  AttributeOptionRecord,
  Category,
} from '@/lib/catalog/types';
import type { ApiError } from '@/lib/api/client';
import DeleteChoiceDialog from '@/components/dashboard/DeleteChoiceDialog';

const TRACE = 'PG-DASHBOARD-CAT-007';

/**
 * Option lists — every dropdown the product form shows, owned by the admin.
 * specs/2026-07-22-product-tree-design.md
 *
 * This is where EDP / EDT / Parfum / Hair Mist live, along with Gender and
 * Fragrance family. All three were previously fixed in code: the first two as
 * hardcoded arrays, and Fragrance family as a free-text box, which is why no
 * two products spelled it the same way.
 *
 * A list can be scoped to one category, so Cosmetics can have Shade or SPF
 * without touching Perfume.
 */
function OptionRow({
  option,
  onUpdated,
  onDeleted,
}: {
  option: AttributeOptionRecord;
  onUpdated: (o: AttributeOptionRecord) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(option.name);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      onUpdated(await updateAttributeOption(option.id, { name: name.trim() }));
      setEditing(false);
    } catch (e) {
      setError((e as ApiError).message ?? 'Rename failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(mode: 'soft' | 'hard') {
    // The dialog shows its own error, so nothing is set here — showing it in
    // both places printed the same sentence twice on screen.
    await deleteAttributeOption(option.id, mode);
    setConfirmDelete(false);
    if (mode === 'hard') onDeleted(option.id);
    else onUpdated({ ...option, isActive: false });
  }

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 0',
        opacity: option.isActive ? 1 : 0.55,
      }}
      data-trace-id={`${TRACE}::EL-ROW-option@${option.id}`}
    >
      {editing ? (
        <form onSubmit={handleRename} style={{ display: 'flex', gap: 8 }}>
          <input
            className="dash-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            maxLength={60}
            autoFocus
            data-trace-id={`${TRACE}::EL-INPUT-rename-option@${option.id}`}
          />
          <button className="dash-btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            className="dash-btn-secondary"
            type="button"
            onClick={() => {
              setEditing(false);
              setName(option.name);
              setError(null);
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <span style={{ minWidth: 160 }}>
            {option.name}
            {!option.isActive && <span className="dash-muted"> — deleted</span>}
          </span>
          <button
            className="dash-btn-secondary"
            onClick={() => setEditing(true)}
            data-trace-id={`${TRACE}::EL-BTN-edit-option@${option.id}`}
          >
            Rename
          </button>
          {option.isActive ? (
            <button
              className="dash-btn-secondary"
              onClick={() => setConfirmDelete(true)}
              data-trace-id={`${TRACE}::EL-BTN-delete-option@${option.id}`}
            >
              Delete
            </button>
          ) : (
            <button
              className="dash-btn-secondary"
              onClick={async () =>
                onUpdated(
                  await updateAttributeOption(option.id, { isActive: true }),
                )
              }
              data-trace-id={`${TRACE}::EL-BTN-restore-option@${option.id}`}
            >
              Restore
            </button>
          )}
        </>
      )}
      {error && <p className="dash-field-error">{error}</p>}
      {confirmDelete && (
        <DeleteChoiceDialog
          productName={option.name}
          onSoftDelete={() => handleDelete('soft')}
          onHardDelete={() => handleDelete('hard')}
          onCancel={() => setConfirmDelete(false)}
          traceIdPrefix={`${TRACE}::EL-MODAL-delete-option@${option.id}`}
          hardDeleteNote="Also cleared from any product that had picked it — the products themselves stay."
        />
      )}
    </li>
  );
}

function AttributeCard({
  attribute,
  categoryName,
  onUpdated,
  onDeleted,
}: {
  attribute: AttributeRecord;
  categoryName: string | null;
  onUpdated: (a: AttributeRecord) => void;
  onDeleted: (id: string) => void;
}) {
  const [options, setOptions] = useState<AttributeOptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOption, setNewOption] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listAttributeOptions(attribute.id)
      .then((rows) => {
        if (!cancelled) setOptions(rows);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the values in this list.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attribute.id]);

  async function handleAddOption(e: React.FormEvent) {
    e.preventDefault();
    if (!newOption.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const created = await createAttributeOption(attribute.id, {
        name: newOption.trim(),
      });
      setOptions((prev) => [...prev, created]);
      setNewOption('');
    } catch (e) {
      setError((e as ApiError).message ?? 'Could not add that value.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteList(mode: 'soft' | 'hard') {
    await deleteAttribute(attribute.id, mode);
    setConfirmDelete(false);
    if (mode === 'hard') onDeleted(attribute.id);
    else onUpdated({ ...attribute, isActive: false });
  }

  return (
    <section
      className="dash-card"
      style={{ marginBottom: 20, opacity: attribute.isActive ? 1 : 0.6 }}
      data-trace-id={`${TRACE}::EL-CARD-attribute@${attribute.id}`}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>
          {attribute.name}
          {!attribute.isActive && <span className="dash-muted"> — deleted</span>}
        </h2>
        <div>
          <span className="dash-muted">
            {categoryName ? `Only in ${categoryName}` : 'Every category'}
          </span>{' '}
          {attribute.isActive ? (
            <button
              className="dash-btn-secondary"
              onClick={() => setConfirmDelete(true)}
              data-trace-id={`${TRACE}::EL-BTN-delete-attribute@${attribute.id}`}
            >
              Delete list
            </button>
          ) : (
            <button
              className="dash-btn-secondary"
              onClick={async () =>
                onUpdated(await updateAttribute(attribute.id, { isActive: true }))
              }
              data-trace-id={`${TRACE}::EL-BTN-restore-attribute@${attribute.id}`}
            >
              Restore list
            </button>
          )}
        </div>
      </div>

      {loading && <p className="dash-muted">Loading…</p>}
      {error && <p className="dash-inline-error">{error}</p>}

      {!loading && options.length === 0 && (
        <p className="dash-muted">No values yet.</p>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0' }}>
        {options.map((o) => (
          <OptionRow
            key={o.id}
            option={o}
            onUpdated={(updated) =>
              setOptions((prev) =>
                prev.map((x) => (x.id === updated.id ? updated : x)),
              )
            }
            onDeleted={(id) =>
              setOptions((prev) => prev.filter((x) => x.id !== id))
            }
          />
        ))}
      </ul>

      <form onSubmit={handleAddOption} style={{ display: 'flex', gap: 8 }}>
        <input
          className="dash-input"
          placeholder={`New value for ${attribute.name}…`}
          value={newOption}
          onChange={(e) => setNewOption(e.target.value)}
          disabled={adding}
          maxLength={60}
          data-trace-id={`${TRACE}::EL-INPUT-new-option@${attribute.id}`}
        />
        <button
          className="dash-btn-primary"
          type="submit"
          disabled={adding || !newOption.trim()}
          data-trace-id={`${TRACE}::EL-BTN-add-option@${attribute.id}`}
        >
          {adding ? 'Adding…' : 'Add'}
        </button>
      </form>

      {confirmDelete && (
        <DeleteChoiceDialog
          productName={attribute.name}
          onSoftDelete={() => handleDeleteList('soft')}
          onHardDelete={() => handleDeleteList('hard')}
          onCancel={() => setConfirmDelete(false)}
          traceIdPrefix={`${TRACE}::EL-MODAL-delete-attribute@${attribute.id}`}
          hardDeleteNote="The whole list and all its values go, and every product that used it loses that answer. The products themselves stay."
        />
      )}
    </section>
  );
}

export default function OptionListsPage() {
  const [attributes, setAttributes] = useState<AttributeRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listAdminAttributes(), listCategories()])
      .then(([attrs, cats]) => {
        if (cancelled) return;
        setAttributes(attrs);
        setCategories(cats.items);
      })
      .catch((e: ApiError) => {
        if (!cancelled)
          setLoadError(e.message ?? 'Could not load the option lists.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createAttribute({
        name: newName.trim(),
        categoryId: newCategoryId || null,
      });
      setAttributes((prev) => [...prev, created]);
      setNewName('');
      setNewCategoryId('');
    } catch (e) {
      setCreateError((e as ApiError).message ?? 'Could not add that list.');
    } finally {
      setCreating(false);
    }
  }

  function categoryNameFor(attribute: AttributeRecord): string | null {
    if (!attribute.categoryId) return null;
    return (
      categories.find((c) => c.id === attribute.categoryId)?.name ?? 'a category'
    );
  }

  return (
    <div data-trace-id={`${TRACE}::EL-REGION-option-lists-page`}>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Option lists</h1>
        <Link
          href="/products"
          className="dash-btn-secondary"
          data-trace-id={`${TRACE}::EL-LINK-back-to-products`}
        >
          Back to products
        </Link>
      </div>

      <p className="dash-muted">
        Every dropdown on the product form comes from a list here. Add a list,
        fill it with values, and it appears when adding or editing a product.
        Leave a list on “Every category” to use it everywhere, or tie it to one
        category so it only shows up there.
      </p>

      <form
        onSubmit={handleCreate}
        style={{ display: 'flex', gap: 8, margin: '16px 0', flexWrap: 'wrap' }}
      >
        <input
          className="dash-input"
          placeholder="New list, e.g. Shade"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          disabled={creating}
          maxLength={60}
          data-trace-id={`${TRACE}::EL-INPUT-new-attribute`}
        />
        <select
          className="dash-select"
          value={newCategoryId}
          onChange={(e) => setNewCategoryId(e.target.value)}
          disabled={creating}
          style={{ maxWidth: 220 }}
          data-trace-id={`${TRACE}::EL-SELECT-new-attribute-category`}
        >
          <option value="">Every category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              Only in {c.name}
            </option>
          ))}
        </select>
        <button
          className="dash-btn-primary"
          type="submit"
          disabled={creating || !newName.trim()}
          data-trace-id={`${TRACE}::EL-BTN-create-attribute`}
        >
          {creating ? 'Adding…' : 'Add list'}
        </button>
      </form>
      {createError && <p className="dash-inline-error">{createError}</p>}

      {loading && <p>Loading…</p>}
      {loadError && <p className="dash-inline-error">{loadError}</p>}

      {!loading && !loadError && attributes.length === 0 && (
        <p className="dash-muted">No option lists yet. Add one above.</p>
      )}

      {attributes.map((a) => (
        <AttributeCard
          key={a.id}
          attribute={a}
          categoryName={categoryNameFor(a)}
          onUpdated={(updated) =>
            setAttributes((prev) =>
              prev.map((x) => (x.id === updated.id ? updated : x)),
            )
          }
          onDeleted={(id) =>
            setAttributes((prev) => prev.filter((x) => x.id !== id))
          }
        />
      ))}
    </div>
  );
}

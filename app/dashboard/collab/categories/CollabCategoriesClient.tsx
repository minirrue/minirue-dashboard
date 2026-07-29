'use client';

import React, { useCallback, useState } from 'react';
import {
  apiCollabCategories,
  apiCollabCreateCategory,
  apiCollabDeleteCategory,
  apiCollabUpdateCategory,
  type CollabCategory,
} from '@/lib/api/collab-portal';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

const TRACE = 'PG-COLLAB-CATEGORIES-001';

/**
 * A partner's own categories.
 *
 * Each space keeps its own list (owner decision, 2026-07-29) — Helia's
 * "Perfumes" and MiniRue's are two different things that may share a name.
 * There is no space to choose here: the backend takes it from whoever is
 * signed in, so a partner can only ever see and change their own.
 *
 * Deliberately plain. This is the same list/rename/delete shape as the admin
 * Categories tab rather than a second interaction pattern to learn.
 */
export default function CollabCategoriesClient() {
  const [categories, setCategories] = useState<CollabCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiCollabCategories();
      setCategories(res.data ?? []);
    } catch (e) {
      setLoadError((e as ApiError).message ?? 'Could not load your categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useMountedEffect(() => {
    void load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setAddError(null);
    try {
      await apiCollabCreateCategory({ name });
      setNewName('');
      await load();
    } catch (err) {
      setAddError((err as ApiError).message ?? 'Could not add that category.');
    } finally {
      setAdding(false);
    }
  }

  async function handleRename(id: string) {
    const name = editName.trim();
    if (!name) return;
    setBusyId(id);
    setRowError(null);
    try {
      await apiCollabUpdateCategory(id, { name });
      setEditingId(null);
      await load();
    } catch (err) {
      setRowError((err as ApiError).message ?? 'Could not rename that category.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    // The backend refuses a category that still has products or children and
    // says why, so this only guards against a mis-click.
    if (!window.confirm(`Remove the category "${name}"?`)) return;
    setBusyId(id);
    setRowError(null);
    try {
      await apiCollabDeleteCategory(id);
      await load();
    } catch (err) {
      setRowError((err as ApiError).message ?? 'Could not remove that category.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div data-trace-id={`${TRACE}::EL-REGION-collab-categories-page`}>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Categories</h1>
      </div>

      <p className="dash-help-text" style={{ marginBottom: 16 }}>
        Your own categories. They appear on your shop page and are how shoppers
        browse what you sell. MiniRue&apos;s categories are separate — yours are
        yours to name.
      </p>

      <form
        onSubmit={handleAdd}
        className="dash-card"
        style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}
      >
        <label className="dash-field" style={{ flex: 1, minWidth: 200 }}>
          <span className="dash-label">New category</span>
          <input
            className="dash-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Jewellery"
            disabled={adding}
            data-trace-id={`${TRACE}::EL-INPUT-new-category-name`}
          />
        </label>
        <button
          type="submit"
          className="dash-btn-primary"
          disabled={adding || !newName.trim()}
          data-trace-id={`${TRACE}::EL-BTN-add-category`}
        >
          {adding ? 'Adding…' : 'Add'}
        </button>
        {addError && (
          <p className="dash-inline-error" style={{ width: '100%' }}>
            {addError}
          </p>
        )}
      </form>

      <div className="dash-card">
        {loading ? (
          <p className="dash-help-text">Loading your categories…</p>
        ) : loadError ? (
          <div>
            <p className="dash-inline-error">{loadError}</p>
            <button className="dash-btn-secondary" onClick={() => void load()}>
              Retry
            </button>
          </div>
        ) : categories.length === 0 ? (
          <p className="dash-help-text">
            No categories yet. Add one above and it will show on your shop page.
          </p>
        ) : (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            data-trace-id={`${TRACE}::EL-LIST-collab-categories`}
          >
            {rowError && <p className="dash-inline-error">{rowError}</p>}
            {categories.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
                data-trace-id={`${TRACE}::EL-ROW-collab-category@${c.id}`}
              >
                {editingId === c.id ? (
                  <>
                    <input
                      className="dash-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      disabled={busyId === c.id}
                      autoFocus
                      style={{ flex: 1, minWidth: 160 }}
                    />
                    <button
                      type="button"
                      className="dash-btn-primary"
                      onClick={() => void handleRename(c.id)}
                      disabled={busyId === c.id || !editName.trim()}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="dash-btn-ghost"
                      onClick={() => setEditingId(null)}
                      disabled={busyId === c.id}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      {/* The address it will have on the shop — the thing that
                          breaks if it is renamed later, so it is worth showing. */}
                      <div style={{ fontSize: 12, color: 'var(--mr-fg-3)' }}>
                        /{c.slug}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="dash-btn-ghost"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditName(c.name);
                        setRowError(null);
                      }}
                      disabled={busyId === c.id}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="dash-btn-ghost"
                      onClick={() => void handleDelete(c.id, c.name)}
                      disabled={busyId === c.id}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

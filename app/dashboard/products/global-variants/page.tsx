'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  listAdminVariantTypes,
  createVariantType,
  updateVariantType,
  deactivateVariantType,
  type VariantTypeRecord,
} from '@/lib/catalog/api';
import type { ApiError } from '@/lib/api/client';

const TRACE = 'PG-DASHBOARD-CAT-006';

/**
 * Global variants — CRUD over the shared variant-type vocabulary
 * (specs/2026-07-22-global-variants).
 *
 * Retiring a type is a soft delete, so this screen never blocks on "in use":
 * a retired row stays visible here, dimmed, with a Reactivate action, and the
 * products already using it keep displaying it.
 */
function VariantTypeRow({
  type,
  onUpdated,
}: {
  type: VariantTypeRecord;
  onUpdated: (updated: VariantTypeRecord) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(type.name);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      onUpdated(await updateVariantType(type.id, { name: trimmed }));
      setEditing(false);
    } catch (e) {
      setError((e as ApiError).message ?? 'Rename failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    setBusy(true);
    setError(null);
    try {
      if (type.isActive) {
        await deactivateVariantType(type.id);
        onUpdated({ ...type, isActive: false });
      } else {
        onUpdated(await updateVariantType(type.id, { isActive: true }));
      }
    } catch (e) {
      setError((e as ApiError).message ?? 'Update failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr
      style={type.isActive ? undefined : { opacity: 0.55 }}
      data-trace-id={`${TRACE}::EL-ROW-variant-type@${type.id}`}
    >
      <td>
        {editing ? (
          <form onSubmit={handleRename} style={{ display: 'flex', gap: 8 }}>
            <input
              className="dash-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              autoFocus
              maxLength={50}
              data-trace-id={`${TRACE}::EL-INPUT-rename-variant-type@${type.id}`}
            />
            <button className="dash-btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              className="dash-btn-secondary"
              type="button"
              onClick={() => {
                setEditing(false);
                setName(type.name);
                setError(null);
              }}
              disabled={saving}
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            {type.name}
            {!type.isActive && (
              <span className="dash-muted"> — retired</span>
            )}
          </>
        )}
        {error && <p className="dash-field-error">{error}</p>}
      </td>
      <td style={{ textAlign: 'right' }}>
        {!editing && (
          <>
            <button
              className="dash-btn-secondary"
              onClick={() => setEditing(true)}
              data-trace-id={`${TRACE}::EL-BTN-edit-variant-type@${type.id}`}
            >
              Rename
            </button>{' '}
            <button
              className="dash-btn-secondary"
              onClick={handleToggleActive}
              disabled={busy}
              data-trace-id={`${TRACE}::EL-BTN-toggle-variant-type@${type.id}`}
            >
              {busy ? '…' : type.isActive ? 'Retire' : 'Reactivate'}
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

export default function GlobalVariantsPage() {
  const [types, setTypes] = useState<VariantTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // `loading` starts true and nothing is set synchronously here, so the effect
  // never triggers a cascading render (react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    listAdminVariantTypes()
      .then((rows) => {
        if (!cancelled) setTypes(rows);
      })
      .catch((e: ApiError) => {
        if (!cancelled)
          setLoadError(e.message ?? 'Could not load variant types.');
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
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createVariantType(trimmed);
      setTypes((prev) => [...prev, created]);
      setNewName('');
    } catch (e) {
      setCreateError((e as ApiError).message ?? 'Could not add variant type.');
    } finally {
      setCreating(false);
    }
  }

  function handleUpdated(updated: VariantTypeRecord) {
    setTypes((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  return (
    <div data-trace-id={`${TRACE}::EL-REGION-global-variants-page`}>
      <div className="dash-page-header">
        <h1 className="dash-page-title">Global variants</h1>
        <Link
          href="/products"
          className="dash-btn-secondary"
          data-trace-id={`${TRACE}::EL-LINK-back-to-products`}
        >
          Back to products
        </Link>
      </div>

      <p className="dash-muted">
        These types are shared across every product. Retiring one hides it from
        the product form without changing any product already using it.
      </p>

      <form
        onSubmit={handleCreate}
        style={{ display: 'flex', gap: 8, margin: '16px 0' }}
      >
        <input
          className="dash-input"
          placeholder="New variant type…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          disabled={creating}
          maxLength={50}
          data-trace-id={`${TRACE}::EL-INPUT-new-variant-type`}
        />
        <button
          className="dash-btn-primary"
          type="submit"
          disabled={creating || !newName.trim()}
          data-trace-id={`${TRACE}::EL-BTN-create-variant-type`}
        >
          {creating ? 'Adding…' : 'Add'}
        </button>
      </form>
      {createError && <p className="dash-inline-error">{createError}</p>}

      {loading && <p>Loading…</p>}
      {loadError && <p className="dash-inline-error">{loadError}</p>}

      {!loading && !loadError && types.length === 0 && (
        <p className="dash-muted">
          No variant types yet. Add one above — products cannot have variants
          until at least one exists.
        </p>
      )}

      {!loading && types.length > 0 && (
        <table className="dash-table">
          <thead>
            <tr>
              <th>Name</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <VariantTypeRow key={t.id} type={t} onUpdated={handleUpdated} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

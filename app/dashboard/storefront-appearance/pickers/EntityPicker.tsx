'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { listCategories, listManagedBrands, listProducts } from '@/lib/catalog/api';
import { apiListCollaborators } from '@/lib/api/collaborators';
import type { Category } from '@/lib/catalog/types';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';

export type EntityKind = 'category' | 'brand' | 'product' | 'collaborator';

export interface EntityOption {
  id: string;
  label: string;
}

export function moveInList<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function flattenCategories(nodes: Category[]): EntityOption[] {
  const out: EntityOption[] = [];
  const walk = (list: Category[], depth: number): void => {
    for (const node of list) {
      out.push({ id: node.id, label: `${'— '.repeat(depth)}${node.name}` });
      if (node.children?.length) walk(node.children, depth + 1);
    }
  };
  walk(nodes, 0);
  return out;
}

/** One loader per entity kind, so every picker in the tab reads real rows. */
export function useEntityOptions(kind: EntityKind): {
  options: EntityOption[];
  loading: boolean;
  error: string | null;
} {
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (kind === 'category') {
        const res = await listCategories();
        setOptions(flattenCategories(res.items));
      } else if (kind === 'brand') {
        const brands = await listManagedBrands();
        setOptions(brands.map((b) => ({ id: b.id, label: b.name })));
      } else if (kind === 'product') {
        const res = await listProducts({ status: 'PUBLISHED', limit: 100 });
        setOptions(
          res.items.map((p) => ({
            id: p.id,
            label: p.brandName ? `${p.brandName} — ${p.name}` : p.name,
          })),
        );
      } else {
        const res = await apiListCollaborators({ limit: 100 });
        setOptions(
          res.items.map((c) => ({ id: c.id, label: c.brandName || c.brandSlug })),
        );
      }
    } catch {
      setError('Could not load options');
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useMountedEffect(() => { void load(); }, [load]);

  return { options, loading, error };
}

export default function EntityPicker({
  kind,
  value,
  onChange,
  label,
}: {
  kind: EntityKind;
  value: string | null;
  onChange: (id: string | null, label: string) => void;
  label: string;
}) {
  const { options, loading, error } = useEntityOptions(kind);

  return (
    <label className="dash-field">
      <span className="dash-label">{label}</span>
      <select
        className="dash-input"
        value={value ?? ''}
        disabled={loading}
        onChange={(e) => {
          const id = e.target.value || null;
          onChange(id, options.find((o) => o.id === id)?.label ?? '');
        }}
      >
        <option value="">{loading ? 'Loading…' : options.length === 0 && !error ? 'Nothing available yet' : 'Select…'}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      {error && <span className="dash-inline-error">{error}</span>}
      {!loading && !error && options.length === 0 && (
        <span className="dash-inline-error">No {kind}s yet — add one before choosing it here.</span>
      )}
    </label>
  );
}

/** Ordered multi-select — the running order is what the storefront renders. */
export function MultiProductPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { options, loading, error } = useEntityOptions('product');
  const [pending, setPending] = useState('');
  const labelById = useMemo(
    () => new Map(options.map((o) => [o.id, o.label])),
    [options],
  );

  return (
    <div className="dash-field">
      <span className="dash-label">Products (shown in this order)</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select
          className="dash-input"
          style={{ flex: '1 1 200px', minWidth: 0 }}
          value={pending}
          disabled={loading}
          onChange={(e) => setPending(e.target.value)}
        >
          <option value="">{loading ? 'Loading…' : 'Select a product…'}</option>
          {options
            .filter((o) => !value.includes(o.id))
            .map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
        </select>
        <button
          type="button"
          className="dash-btn-secondary"
          disabled={!pending}
          onClick={() => {
            onChange([...value, pending]);
            setPending('');
          }}
        >
          Add
        </button>
      </div>
      {error && <span className="dash-inline-error">{error}</span>}
      {!loading && !error && options.length === 0 && (
        <span className="dash-inline-error">No products yet — nothing can be added here.</span>
      )}
      <ol style={{ margin: '10px 0 0', paddingLeft: 18 }}>
        {value.map((id, index) => (
          <li key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ flex: 1 }}>{labelById.get(id) ?? id}</span>
            <button type="button" className="dash-btn-ghost" disabled={index === 0}
              onClick={() => onChange(moveInList(value, index, -1))}>Up</button>
            <button type="button" className="dash-btn-ghost" disabled={index === value.length - 1}
              onClick={() => onChange(moveInList(value, index, 1))}>Down</button>
            <button type="button" className="dash-btn-ghost"
              onClick={() => onChange(value.filter((v) => v !== id))}>Remove</button>
          </li>
        ))}
      </ol>
      {value.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--mr-fg-4)', margin: '6px 0 0' }}>
          No products picked yet — this section will not appear on the storefront.
        </p>
      )}
    </div>
  );
}

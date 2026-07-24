'use client';

import React from 'react';
import { newId } from '@/lib/api/storefront';
import type { NavItem, NavbarConfig } from '@/lib/api/storefront';
import EntityPicker, { moveInList } from '../pickers/EntityPicker';

export function blankNavItem(kind: NavItem['kind']): NavItem {
  const id = newId('nav');
  switch (kind) {
    case 'category':
      return { id, kind: 'category', categoryId: '', label: '' };
    case 'brand':
      return { id, kind: 'brand', brandId: '', label: '' };
    case 'product':
      return { id, kind: 'product', productId: '', label: '' };
    case 'collaborator':
      return { id, kind: 'collaborator', collaboratorId: '', label: '' };
    case 'link':
      return { id, kind: 'link', href: '', label: '' };
  }
}

const KIND_LABELS: Record<NavItem['kind'], string> = {
  category: 'Category',
  brand: 'Brand',
  product: 'Product',
  collaborator: 'Collaborator brand',
  link: 'Custom link',
};

function NavList({
  title,
  items,
  onChange,
}: {
  title: string;
  items: NavItem[];
  onChange: (next: NavItem[]) => void;
}) {
  const patch = (index: number, next: NavItem) =>
    onChange(items.map((item, i) => (i === index ? next : item)));

  return (
    <div className="dash-form-section">
      <div className="dash-section-header">
        <h2 className="dash-section-title">{title}</h2>
      </div>

      {items.map((item, index) => (
        <div key={item.id} className="dash-form-card" style={{ marginBottom: 10 }}>
          <div className="dash-row-actions" style={{ marginBottom: 8 }}>
            <strong style={{ flex: 1 }}>
              {index + 1}. {item.label || KIND_LABELS[item.kind]}
            </strong>
            <button type="button" className="dash-btn-ghost" disabled={index === 0}
              onClick={() => onChange(moveInList(items, index, -1))}>Move up</button>
            <button type="button" className="dash-btn-ghost" disabled={index === items.length - 1}
              onClick={() => onChange(moveInList(items, index, 1))}>Move down</button>
            <button type="button" className="dash-btn-ghost"
              onClick={() => onChange(items.filter((_, i) => i !== index))}>Remove</button>
          </div>

          <div className="dash-form-grid">
            <label className="dash-field">
              <span className="dash-label">Type</span>
              <select
                className="dash-input"
                value={item.kind}
                onChange={(e) => {
                  const next = blankNavItem(e.target.value as NavItem['kind']);
                  patch(index, { ...next, id: item.id, label: item.label });
                }}
              >
                {(Object.keys(KIND_LABELS) as NavItem['kind'][]).map((k) => (
                  <option key={k} value={k}>{KIND_LABELS[k]}</option>
                ))}
              </select>
            </label>
            <label className="dash-field">
              <span className="dash-label">Label shown in the nav</span>
              <input className="dash-input" value={item.label}
                onChange={(e) => patch(index, { ...item, label: e.target.value })} />
            </label>
          </div>

          {item.kind === 'link' && (
            <label className="dash-field">
              <span className="dash-label">Link</span>
              <input className="dash-input" value={item.href} placeholder="/journal or https://…"
                onChange={(e) => patch(index, { ...item, href: e.target.value })} />
            </label>
          )}
          {item.kind === 'category' && (
            <EntityPicker kind="category" label="Category" value={item.categoryId || null}
              onChange={(id, label) =>
                patch(index, { ...item, categoryId: id ?? '', label: item.label || label })
              } />
          )}
          {item.kind === 'brand' && (
            <EntityPicker kind="brand" label="Brand" value={item.brandId || null}
              onChange={(id, label) =>
                patch(index, { ...item, brandId: id ?? '', label: item.label || label })
              } />
          )}
          {item.kind === 'product' && (
            <EntityPicker kind="product" label="Product" value={item.productId || null}
              onChange={(id, label) =>
                patch(index, { ...item, productId: id ?? '', label: item.label || label })
              } />
          )}
          {item.kind === 'collaborator' && (
            <EntityPicker kind="collaborator" label="Collaborator" value={item.collaboratorId || null}
              onChange={(id, label) =>
                patch(index, { ...item, collaboratorId: id ?? '', label: item.label || label })
              } />
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(Object.keys(KIND_LABELS) as NavItem['kind'][]).map((kind) => (
          <button key={kind} type="button" className="dash-btn-secondary"
            onClick={() => onChange([...items, blankNavItem(kind)])}>
            Add {KIND_LABELS[kind].toLowerCase()}
          </button>
        ))}
      </div>

      {items.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--mr-fg-4)', marginTop: 8 }}>
          Empty — nothing will show in this menu.
        </p>
      )}
    </div>
  );
}

export default function NavbarEditor({
  navbar,
  onChange,
}: {
  navbar: NavbarConfig;
  onChange: (next: NavbarConfig) => void;
}) {
  return (
    <div className="dash-form-card">
      <p style={{ fontSize: 13, color: 'var(--mr-fg-3)' }}>
        The navigation is no longer built from your categories automatically. Adding a new
        category will not add a menu item on its own — whatever you list below is exactly what
        shoppers see, shown as a bar across the top on desktop and in a slide-out menu on mobile.
      </p>

      <p className="dash-help-text" style={{ marginTop: -4 }}>
        The search and account icons are always shown in the navbar, so there is
        nothing to switch on or off here.
      </p>

      <NavList title="Menu" items={navbar.items}
        onChange={(items) => onChange({ ...navbar, items })} />
    </div>
  );
}

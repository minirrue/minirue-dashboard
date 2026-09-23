'use client';

import React from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { newId } from '@/lib/api/storefront';
import type { NavItem, NavbarConfig } from '@/lib/api/storefront';
import { MultiProductPicker } from '../pickers/EntityPicker';
import { TargetField } from '../fields/TargetField';
import { TARGET_PILL, fromNav, isTargetComplete, moveInList, toNavItem } from '@/lib/storefront/targets';

/** The storefront dropdown shows at most three tiles — more would not fit the
 * desktop panel or the mobile sheet, so the cap is enforced here as well as in
 * the backend schema. */
export const MAX_FEATURED = 3;

export function blankNavItem(kind: NavItem['kind']): NavItem {
  const id = newId('nav');
  switch (kind) {
    case 'category':
      return { id, kind: 'category', categoryId: '', label: '', featuredProductIds: [] };
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

/**
 * The desktop menu bar. Whatever is listed here is exactly what shoppers see
 * across the top on desktop — nothing is added from categories automatically.
 * Search, account and bag icons are always shown by the storefront.
 */
export default function NavbarEditor({
  navbar,
  onChange,
}: {
  navbar: NavbarConfig;
  onChange: (next: NavbarConfig) => void;
}) {
  const items = navbar.items;
  const set = (next: NavItem[]) => onChange({ ...navbar, items: next });
  const patch = (index: number, next: NavItem) => set(items.map((item, i) => (i === index ? next : item)));

  return (
    <section className="sfe-panel" aria-labelledby="h-desktop-menu">
      <div className="sfe-panel-h">
        <div>
          <h2 id="h-desktop-menu">Desktop menu bar</h2>
          <span className="sfe-meta">Left to right, as shoppers see it. Search, account and bag icons always show.</span>
        </div>
        <button type="button" className="sfe-btn sfe-btn-sm" onClick={() => set([...items, blankNavItem('category')])}>
          <Plus aria-hidden /> Add item
        </button>
      </div>

      {items.length === 0 && <p className="sfe-empty">Empty. Nothing shows in the desktop menu bar.</p>}

      <ol className="sfe-rows">
        {items.map((item, index) => {
          const unfinished = !item.label.trim() || !isTargetComplete(fromNav(item));
          return (
            <li key={item.id} className="sfe-row" data-focus-key={`nav:${item.id}`}>
              <div className="sfe-move">
                <button type="button" aria-label={`Move ${item.label || 'item'} left`} disabled={index === 0} onClick={() => set(moveInList(items, index, -1))}>
                  <ChevronUp aria-hidden />
                </button>
                <button type="button" aria-label={`Move ${item.label || 'item'} right`} disabled={index === items.length - 1} onClick={() => set(moveInList(items, index, 1))}>
                  <ChevronDown aria-hidden />
                </button>
              </div>
              <div className="sfe-row-main">
                <div className="sfe-row-top">
                  <span className={`sfe-pill sfe-k-${item.kind}`}>{TARGET_PILL[item.kind]}</span>
                  <b>{item.label || 'Untitled'}</b>
                  {unfinished && <span className="sfe-pill sfe-s-warn">Unfinished</span>}
                </div>
                <div className="sfe-grid-2">
                  <label className="sfe-field">
                    <span className="sfe-label">Label in the menu</span>
                    <input className="sfe-input" value={item.label} onChange={(e) => patch(index, { ...item, label: e.target.value })} />
                  </label>
                  <TargetField
                    use="nav"
                    value={fromNav(item)}
                    onChange={(t, entityLabel) => {
                      const next = toNavItem(t, item);
                      patch(index, { ...next, label: item.label || entityLabel || '' });
                    }}
                  />
                </div>
                {item.kind === 'category' && (
                  <div className="sfe-sub">
                    <MultiProductPicker
                      label={`Dropdown pictures (up to ${MAX_FEATURED}, in this order)`}
                      emptyHint="Nothing picked. The item links straight to the category, with no dropdown."
                      value={item.featuredProductIds ?? []}
                      onChange={(ids) => patch(index, { ...item, featuredProductIds: ids.slice(0, MAX_FEATURED) })}
                    />
                    {(item.featuredProductIds ?? []).length >= MAX_FEATURED && (
                      <span className="sfe-hint">That is the maximum. Remove one before adding another.</span>
                    )}
                  </div>
                )}
              </div>
              <div className="sfe-row-act">
                <button type="button" className="sfe-icon-btn" aria-label={`Remove ${item.label || 'item'}`} onClick={() => set(items.filter((_, i) => i !== index))}>
                  <Trash2 aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

'use client';

/**
 * MobileMenuEditor — the "Mobile menu" tab under Storefront appearance.
 *
 * What used to be a hardcoded Home/Search/Account tile row and a hardcoded
 * Account pill in `MobileNavSheet.tsx` (the storefront rendered Account
 * twice) is now fully admin-configurable: up to 3 shortcut tiles, and one
 * optional pinned footer button. Follows the same shape/pattern as
 * `NavbarEditor.tsx` — a kind picker plus the matching `EntityPicker` — with
 * five extra built-in kinds (home/search/account/cart/brands) that need no
 * picker at all.
 */

import React from 'react';
import { newId } from '@/lib/api/storefront';
import type {
  MobileMenuConfig,
  MobileMenuFooterButton,
  MobileMenuIcon,
  MobileMenuShortcut,
  MobileMenuTarget,
} from '@/lib/api/storefront';
import { MOBILE_MENU_ICONS } from '@/lib/api/storefront';
import EntityPicker from '../pickers/EntityPicker';

const MAX_SHORTCUTS = 3;

const TARGET_KIND_LABELS: Record<MobileMenuTarget['kind'], string> = {
  home: 'Home',
  search: 'Search',
  account: 'Account',
  cart: 'Cart',
  brands: 'Brands index',
  category: 'A category',
  brand: 'A brand',
  product: 'A product',
  collaborator: 'A collaborator brand',
  link: 'Custom link',
};

const TARGET_KINDS = Object.keys(TARGET_KIND_LABELS) as MobileMenuTarget['kind'][];

export function blankTarget(kind: MobileMenuTarget['kind']): MobileMenuTarget {
  switch (kind) {
    case 'home':
    case 'search':
    case 'account':
    case 'cart':
    case 'brands':
      return { kind };
    case 'category':
      return { kind: 'category', categoryId: '' };
    case 'brand':
      return { kind: 'brand', brandId: '' };
    case 'product':
      return { kind: 'product', productId: '' };
    case 'collaborator':
      return { kind: 'collaborator', collaboratorId: '' };
    case 'link':
      return { kind: 'link', href: '' };
  }
}

export function blankShortcut(): MobileMenuShortcut {
  return { id: newId('mmi'), label: '', icon: 'home', target: { kind: 'home' } };
}

/**
 * A minimal copy of the storefront's `components/ui/Icon.tsx` glyph paths —
 * that component lives in the sibling minirue-frontend repo, so the paths
 * are duplicated here rather than imported. Purely decorative (picking by
 * sight), so drift between the two only ever costs a slightly different
 * preview glyph, never a broken render on either side.
 */
const ICON_PATHS: Record<MobileMenuIcon, React.ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  bag: <><path d="M6 7h12l-1 13H7L6 7z" /><path d="M9 7a3 3 0 0 1 6 0" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.5l-1-.9a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z" />,
  close: <path d="M5 5l14 14M19 5L5 19" />,
  arrowRight: <path d="M4 12h16M14 6l6 6-6 6" />,
  arrowLeft: <path d="M20 12H4M10 6l-6 6 6 6" />,
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M4 12l5 5L20 6" />,
  gift: <path d="M4 5h16v4H4zM6 9v11h12V9" />,
  truck: <><path d="M3 7h13l3 4v6a2 2 0 0 1-2 2H3V7z" /><circle cx="7" cy="19" r="2" /><circle cx="17" cy="19" r="2" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  x: <path d="M5 5l14 14M19 5L5 19" />,
  grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  external: <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></>,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronDown: <path d="M5 9l7 7 7-7" />,
  home: <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9.5z" />,
};

function IconPreview({ icon }: { icon: MobileMenuIcon }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: '0 0 auto' }}
    >
      {ICON_PATHS[icon]}
    </svg>
  );
}

function IconSelect({
  value,
  onChange,
}: {
  value: MobileMenuIcon;
  onChange: (icon: MobileMenuIcon) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <IconPreview icon={value} />
      <select
        className="dash-input"
        value={value}
        onChange={(e) => onChange(e.target.value as MobileMenuIcon)}
      >
        {MOBILE_MENU_ICONS.map((i) => (
          <option key={i} value={i}>{i}</option>
        ))}
      </select>
    </div>
  );
}

function TargetFields({
  target,
  onChange,
}: {
  target: MobileMenuTarget;
  onChange: (next: MobileMenuTarget) => void;
}) {
  return (
    <>
      <label className="dash-field">
        <span className="dash-label">Goes to</span>
        <select
          className="dash-input"
          value={target.kind}
          onChange={(e) => onChange(blankTarget(e.target.value as MobileMenuTarget['kind']))}
        >
          {TARGET_KINDS.map((k) => (
            <option key={k} value={k}>{TARGET_KIND_LABELS[k]}</option>
          ))}
        </select>
      </label>

      {target.kind === 'link' && (
        <label className="dash-field">
          <span className="dash-label">Link</span>
          <input
            className="dash-input"
            value={target.href}
            placeholder="/journal or https://…"
            onChange={(e) => onChange({ kind: 'link', href: e.target.value })}
          />
        </label>
      )}
      {target.kind === 'category' && (
        <EntityPicker
          kind="category"
          label="Category"
          value={target.categoryId || null}
          onChange={(id) => onChange({ kind: 'category', categoryId: id ?? '' })}
        />
      )}
      {target.kind === 'brand' && (
        <EntityPicker
          kind="brand"
          label="Brand"
          value={target.brandId || null}
          onChange={(id) => onChange({ kind: 'brand', brandId: id ?? '' })}
        />
      )}
      {target.kind === 'product' && (
        <EntityPicker
          kind="product"
          label="Product"
          value={target.productId || null}
          onChange={(id) => onChange({ kind: 'product', productId: id ?? '' })}
        />
      )}
      {target.kind === 'collaborator' && (
        <EntityPicker
          kind="collaborator"
          label="Collaborator"
          value={target.collaboratorId || null}
          onChange={(id) => onChange({ kind: 'collaborator', collaboratorId: id ?? '' })}
        />
      )}
    </>
  );
}

export default function MobileMenuEditor({
  mobileMenu,
  onChange,
}: {
  mobileMenu: MobileMenuConfig;
  onChange: (next: MobileMenuConfig) => void;
}) {
  const patchShortcut = (index: number, next: MobileMenuShortcut) =>
    onChange({
      ...mobileMenu,
      shortcuts: mobileMenu.shortcuts.map((s, i) => (i === index ? next : s)),
    });

  const footerButton = mobileMenu.footerButton;
  const patchFooterButton = (next: Partial<MobileMenuFooterButton>) =>
    onChange({
      ...mobileMenu,
      footerButton: footerButton ? { ...footerButton, ...next } : null,
    });

  return (
    <div className="dash-form-card">
      <p style={{ fontSize: 13, color: 'var(--mr-fg-3)' }}>
        Controls the phone menu: up to {MAX_SHORTCUTS} icon tiles at the top, and one optional
        button pinned to the bottom. Both used to be fixed — Home, Search and Account tiles,
        plus an Account button underneath them, showing Account twice. Set below, exactly as
        shown, with the icons from the storefront&apos;s own set.
      </p>

      <div className="dash-form-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">Shortcut tiles</h2>
          {mobileMenu.shortcuts.length < MAX_SHORTCUTS && (
            <button
              type="button"
              className="dash-btn-secondary"
              onClick={() => onChange({ ...mobileMenu, shortcuts: [...mobileMenu.shortcuts, blankShortcut()] })}
            >
              Add tile
            </button>
          )}
        </div>

        {mobileMenu.shortcuts.length === 0 && (
          <p className="dash-hint">No shortcut tiles — the top row of the phone menu is empty.</p>
        )}

        {mobileMenu.shortcuts.map((shortcut, index) => (
          <div key={shortcut.id} className="dash-form-card" style={{ marginBottom: 10 }}>
            <div className="dash-row-actions" style={{ marginBottom: 8 }}>
              <strong style={{ flex: 1 }}>
                {index + 1}. {shortcut.label || TARGET_KIND_LABELS[shortcut.target.kind]}
              </strong>
              <button
                type="button"
                className="dash-btn-ghost"
                onClick={() =>
                  onChange({
                    ...mobileMenu,
                    shortcuts: mobileMenu.shortcuts.filter((_, i) => i !== index),
                  })
                }
              >
                Remove
              </button>
            </div>
            <div className="dash-form-grid">
              <label className="dash-field">
                <span className="dash-label">Label</span>
                <input
                  className="dash-input"
                  value={shortcut.label}
                  onChange={(e) => patchShortcut(index, { ...shortcut, label: e.target.value })}
                />
              </label>
              <label className="dash-field">
                <span className="dash-label">Icon</span>
                <IconSelect
                  value={shortcut.icon}
                  onChange={(icon) => patchShortcut(index, { ...shortcut, icon })}
                />
              </label>
            </div>
            <TargetFields
              target={shortcut.target}
              onChange={(target) => patchShortcut(index, { ...shortcut, target })}
            />
          </div>
        ))}

        {mobileMenu.shortcuts.length >= MAX_SHORTCUTS && (
          <p className="dash-help-text">That is the maximum — remove one before adding another.</p>
        )}
      </div>

      <div className="dash-form-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">Footer button</h2>
          {!footerButton && (
            <button
              type="button"
              className="dash-btn-secondary"
              onClick={() =>
                onChange({
                  ...mobileMenu,
                  footerButton: { label: 'Account', icon: 'user', target: { kind: 'account' } },
                })
              }
            >
              Add footer button
            </button>
          )}
        </div>

        {!footerButton && (
          <p className="dash-hint">
            No button pinned to the bottom of the menu — nothing shows there.
          </p>
        )}

        {footerButton && (
          <>
            <div className="dash-row-actions" style={{ marginBottom: 8 }}>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className="dash-btn-ghost"
                onClick={() => onChange({ ...mobileMenu, footerButton: null })}
              >
                Remove
              </button>
            </div>
            <div className="dash-form-grid">
              <label className="dash-field">
                <span className="dash-label">Label</span>
                <input
                  className="dash-input"
                  value={footerButton.label}
                  onChange={(e) => patchFooterButton({ label: e.target.value })}
                />
              </label>
              <label className="dash-field">
                <span className="dash-label">Icon</span>
                <IconSelect
                  value={footerButton.icon}
                  onChange={(icon) => patchFooterButton({ icon })}
                />
              </label>
            </div>
            <TargetFields
              target={footerButton.target}
              onChange={(target) => patchFooterButton({ target })}
            />
          </>
        )}
      </div>
    </div>
  );
}

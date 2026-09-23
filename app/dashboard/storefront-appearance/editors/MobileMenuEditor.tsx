'use client';

/**
 * The phone menu — half of the Navigation tab (the desktop menu bar is the
 * other half). Up to 3 shortcut tiles and one optional pinned bottom button,
 * each pointing anywhere via the shared TargetField, including five built-in
 * destinations (home/search/account/cart/all makers) that need no picker.
 */

import React from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { newId } from '@/lib/api/storefront';
import type {
  MobileMenuConfig,
  MobileMenuFooterButton,
  MobileMenuIcon,
  MobileMenuShortcut,
  MobileMenuTarget,
} from '@/lib/api/storefront';
import { MOBILE_MENU_ICONS, isIncompleteMobileMenuItem } from '@/lib/api/storefront';
import { TargetField } from '../fields/TargetField';
import { blankTarget as blankUnified, fromMenu, moveInList, toMenu, type TargetKind } from '@/lib/storefront/targets';

export const MAX_SHORTCUTS = 3;

export function blankTarget(kind: MobileMenuTarget['kind']): MobileMenuTarget {
  return toMenu(blankUnified(kind as TargetKind));
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
    <div className="sfe-icon-select">
      <span className="sfe-icon-tile">
        <IconPreview icon={value} />
      </span>
      <select className="sfe-input" aria-label="Icon" value={value} onChange={(e) => onChange(e.target.value as MobileMenuIcon)}>
        {MOBILE_MENU_ICONS.map((i) => (
          <option key={i} value={i}>
            {i}
          </option>
        ))}
      </select>
    </div>
  );
}

export { IconPreview as MobileMenuIconPreview };

function MenuItemFields({
  item,
  onChange,
}: {
  item: { label: string; icon: MobileMenuIcon; target: MobileMenuTarget };
  onChange: (next: { label: string; icon: MobileMenuIcon; target: MobileMenuTarget }) => void;
}) {
  return (
    <div className="sfe-grid-3">
      <label className="sfe-field">
        <span className="sfe-label">Label</span>
        <input className="sfe-input" value={item.label} onChange={(e) => onChange({ ...item, label: e.target.value })} />
      </label>
      <div className="sfe-field">
        <span className="sfe-label">Icon</span>
        <IconSelect value={item.icon} onChange={(icon) => onChange({ ...item, icon })} />
      </div>
      <TargetField
        use="menu"
        value={fromMenu(item.target)}
        onChange={(t, entityLabel) => onChange({ ...item, target: toMenu(t), label: item.label || entityLabel || '' })}
      />
    </div>
  );
}

export default function MobileMenuEditor({
  mobileMenu,
  onChange,
}: {
  mobileMenu: MobileMenuConfig;
  onChange: (next: MobileMenuConfig) => void;
}) {
  const shortcuts = mobileMenu.shortcuts;
  const setShortcuts = (next: MobileMenuShortcut[]) => onChange({ ...mobileMenu, shortcuts: next });
  const footerButton = mobileMenu.footerButton;
  const setFooterButton = (next: MobileMenuFooterButton | null) => onChange({ ...mobileMenu, footerButton: next });

  return (
    <>
      <section className="sfe-panel" aria-labelledby="h-phone-tiles">
        <div className="sfe-panel-h">
          <div>
            <h2 id="h-phone-tiles">Phone menu tiles</h2>
            <span className="sfe-meta">
              Up to {MAX_SHORTCUTS} icon tiles at the top of the phone menu, in this order.
            </span>
          </div>
          {shortcuts.length < MAX_SHORTCUTS && (
            <button type="button" className="sfe-btn sfe-btn-sm" onClick={() => setShortcuts([...shortcuts, blankShortcut()])}>
              <Plus aria-hidden /> Add tile
            </button>
          )}
        </div>
        {shortcuts.length === 0 && <p className="sfe-empty">No tiles. The top row of the phone menu is empty.</p>}
        <ol className="sfe-rows">
          {shortcuts.map((tile, index) => (
            <li key={tile.id} className="sfe-row" data-focus-key={`tile:${tile.id}`}>
              <div className="sfe-move">
                <button type="button" aria-label={`Move tile ${index + 1} up`} disabled={index === 0} onClick={() => setShortcuts(moveInList(shortcuts, index, -1))}>
                  <ChevronUp aria-hidden />
                </button>
                <button type="button" aria-label={`Move tile ${index + 1} down`} disabled={index === shortcuts.length - 1} onClick={() => setShortcuts(moveInList(shortcuts, index, 1))}>
                  <ChevronDown aria-hidden />
                </button>
              </div>
              <div className="sfe-row-main">
                <div className="sfe-row-top">
                  <b>{tile.label || `Tile ${index + 1}`}</b>
                  {isIncompleteMobileMenuItem(tile) && <span className="sfe-pill sfe-s-warn">Unfinished</span>}
                </div>
                <MenuItemFields item={tile} onChange={(next) => setShortcuts(shortcuts.map((s, i) => (i === index ? { ...s, ...next } : s)))} />
              </div>
              <div className="sfe-row-act">
                <button type="button" className="sfe-icon-btn" aria-label={`Remove tile ${index + 1}`} onClick={() => setShortcuts(shortcuts.filter((_, i) => i !== index))}>
                  <Trash2 aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ol>
        {shortcuts.length >= MAX_SHORTCUTS && <p className="sfe-hint sfe-pad">That is the maximum. Remove one before adding another.</p>}
      </section>

      <section className="sfe-panel" aria-labelledby="h-phone-button" data-focus-key="menu-button">
        <div className="sfe-panel-h">
          <div>
            <h2 id="h-phone-button">Button at the bottom</h2>
            <span className="sfe-meta">One optional button pinned to the bottom of the phone menu.</span>
          </div>
          {footerButton ? (
            <button type="button" className="sfe-btn sfe-btn-sm sfe-btn-quiet" aria-label="Remove the bottom button" onClick={() => setFooterButton(null)}>
              <Trash2 aria-hidden /> Remove
            </button>
          ) : (
            <button type="button" className="sfe-btn sfe-btn-sm" onClick={() => setFooterButton({ label: 'Account', icon: 'user', target: { kind: 'account' } })}>
              <Plus aria-hidden /> Add button
            </button>
          )}
        </div>
        {footerButton ? (
          <div className="sfe-panel-b">
            <MenuItemFields item={footerButton} onChange={(next) => setFooterButton({ ...footerButton, ...next })} />
          </div>
        ) : (
          <p className="sfe-empty">No button. Nothing is pinned to the bottom of the phone menu.</p>
        )}
      </section>
    </>
  );
}


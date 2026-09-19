'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface RowActionsMenuItem {
  /** Unique within this menu's item list — used as the React key only. */
  key: string;
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  /** Colours the item like the equivalent standalone button used to be. */
  tone?: 'danger' | 'ok';
  traceId?: string;
}

export interface RowActionsMenuProps {
  items: RowActionsMenuItem[];
  /** Accessible name for the trigger, e.g. `Actions for ${row.name}`. */
  label: string;
  triggerTraceId?: string;
}

function KebabIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="5" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="12" cy="19" r="1.3" />
    </svg>
  );
}

/**
 * A single "..." trigger that expands into a dropdown of row actions —
 * Archive / Edit / Delete on the products table today, but generic: any
 * table row with more than one action per row should reach for this rather
 * than lining up separate buttons (minirue-dashboard#99).
 *
 * Portaled to `document.body` and positioned from the trigger's own
 * bounding rect rather than anchored with `position: absolute` on an
 * ordinary parent — every call site here lives inside a table row inside
 * `.dash-table-wrap` (`overflow-x: auto`) and `.dash-card`
 * (`overflow: hidden`), either of which would silently clip an
 * absolutely-positioned popover for any row that isn't near the very top of
 * the table.
 */
export default function RowActionsMenu({ items, label, triggerTraceId }: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; openUp: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);

  // Positions (and re-measures) the popover every time it opens, flipping
  // upward when there isn't enough room below the trigger — the products
  // table's last few rows sit close to the viewport's bottom edge on a
  // laptop screen, and a menu that always drops down would run off it.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = popoverRef.current?.offsetHeight ?? 160;
    const menuWidth = popoverRef.current?.offsetWidth ?? 168;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight + 12 && rect.top > menuHeight;
    setPos({
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)),
      openUp,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        triggerRef.current?.focus();
      }
    };
    // A scroll or resize invalidates the measured position outright rather
    // than tracking it live — the table only ever scrolls this menu out of
    // visual relevance anyway, so closing reads as intentional, not buggy.
    const handleScrollOrResize = () => close();
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    popoverRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [open]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="dash-actions-menu-trigger dash-btn-ghost"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        data-trace-id={triggerTraceId}
      >
        <KebabIcon />
      </button>
      {open && pos && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="dash-actions-menu-popover"
              style={{ top: pos.top, left: pos.left, transform: pos.openUp ? 'translateY(-100%)' : undefined }}
              role="menu"
              ref={popoverRef}
            >
              {items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  className={`dash-actions-menu-item${item.tone ? ` dash-actions-menu-item--${item.tone}` : ''}`}
                  onClick={() => {
                    close();
                    item.onClick();
                  }}
                  disabled={item.disabled}
                  data-trace-id={item.traceId}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

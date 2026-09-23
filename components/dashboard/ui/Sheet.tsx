'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './ui.css';

/**
 * A side sheet (a bottom sheet on phones). Shared by the Storefront editor and
 * Analytics: edit or inspect one thing without leaving the list. Esc and the
 * backdrop close it; focus is trapped inside and returned to the control that
 * opened it.
 *
 * The sheet is portalled to `<body>`, outside the screen's own scoped root, so
 * `scopeClassName` (e.g. `sfe`, `anx`) is put on the portal root to keep the
 * screen's scoped styles applying to whatever the sheet contains.
 */
export default function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
  size,
  labelId = 'mr-sheet-title',
  scopeClassName,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Shorthand for `size="wide"`. */
  wide?: boolean;
  /** `narrow` 440px, `md` 560px (default), `wide` 720px, from 721px up. */
  size?: 'narrow' | 'md' | 'wide';
  labelId?: string;
  scopeClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    const el = ref.current;
    const first =
      el?.querySelector<HTMLElement>('[data-autofocus]') ??
      el?.querySelector<HTMLElement>('input, select, textarea, button:not([data-sheet-close])');
    (first ?? el)?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      const back = opener.current as HTMLElement | null;
      if (back && document.contains(back)) back.focus();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const focusable = Array.from(
      ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((n) => n.offsetParent !== null);
    if (!focusable.length) return;
    const a = focusable[0];
    const z = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === a) {
      e.preventDefault();
      z.focus();
    } else if (!e.shiftKey && document.activeElement === z) {
      e.preventDefault();
      a.focus();
    }
  };

  const resolved = size ?? (wide ? 'wide' : 'md');
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className={`${scopeClassName ? `${scopeClassName} ` : ''}mr-sheet-root`}>
      <div className="mr-sheet-scrim" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        className={`mr-sheet mr-sheet--${resolved}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="mr-sheet-h">
          <div>
            <h2 id={labelId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="mr-sheet-close" aria-label="Close" data-sheet-close onClick={onClose}>
            <X aria-hidden />
          </button>
        </div>
        <div className="mr-sheet-b">{children}</div>
        {footer && <div className="mr-sheet-f">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

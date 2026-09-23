'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * A side sheet (bottom sheet on phones). Used for editing one thing at a time
 * without leaving the list: a home page section, a page, the publish summary.
 * Esc and the backdrop close it; focus is trapped inside and returned to the
 * control that opened it.
 */
export default function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
  labelId = 'sfe-sheet-title',
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  labelId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>('input, select, textarea, button:not([data-sheet-close])');
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
      ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
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

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="sfe sfe-sheet-root">
      <div className="sfe-scrim" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        className={`sfe-sheet${wide ? ' sfe-sheet-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="sfe-sheet-h">
          <div>
            <h2 id={labelId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="sfe-icon-btn" aria-label="Close" data-sheet-close onClick={onClose}>
            <X aria-hidden />
          </button>
        </div>
        <div className="sfe-sheet-b">{children}</div>
        {footer && <div className="sfe-sheet-f">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

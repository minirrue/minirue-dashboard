'use client';

import React from 'react';
import type { WidgetSize } from '@/lib/analytics/layout-store';

/**
 * The per-widget toolbar shown only while the page is in edit mode
 * (`OverviewGrid` mounts one above each visible widget card). Every control
 * is a real `<button>` with an `aria-label` — reachable by Tab, not a
 * drag-only affordance. The drag handle doubles as the keyboard-reorder
 * target: arrow keys move the widget while the handle has focus, mirroring
 * the pointer drag it also starts (native HTML5 DnD — no new dependency).
 */
export interface WidgetEditBarProps {
  title: string;
  size: WidgetSize;
  /** 1-based position, for the drag handle's aria-label. */
  position: number;
  total: number;
  onMoveEarlier: () => void;
  onMoveLater: () => void;
  onResize: () => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent<HTMLButtonElement>) => void;
}

const SIZE_LABEL: Record<WidgetSize, string> = { sm: 'S', md: 'M', lg: 'L', full: 'Full' };

export default function WidgetEditBar({
  title,
  size,
  position,
  total,
  onMoveEarlier,
  onMoveLater,
  onResize,
  onRemove,
  onDragStart,
}: WidgetEditBarProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      onMoveEarlier();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      onMoveLater();
    }
  }

  return (
    <div className="dash-widget-editbar" data-trace-id="PG-DASHBOARD-ANL-000::EL-WIDGET-EDITBAR">
      <button
        type="button"
        className="dash-widget-drag-handle"
        draggable
        onDragStart={onDragStart}
        onKeyDown={handleKeyDown}
        aria-label={`Reorder ${title}. Position ${position} of ${total}. Use the arrow keys to move it, or drag.`}
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="6" r="1.6" />
          <circle cx="16" cy="6" r="1.6" />
          <circle cx="8" cy="12" r="1.6" />
          <circle cx="16" cy="12" r="1.6" />
          <circle cx="8" cy="18" r="1.6" />
          <circle cx="16" cy="18" r="1.6" />
        </svg>
      </button>

      <span className="dash-widget-editbar-title">{title}</span>

      <button
        type="button"
        className="dash-btn-ghost dash-widget-size-btn"
        onClick={onResize}
        aria-label={`Change size of ${title} — currently ${size}`}
      >
        {SIZE_LABEL[size]}
      </button>

      <button
        type="button"
        className="dash-btn-ghost dash-widget-remove-btn"
        onClick={onRemove}
        aria-label={`Remove ${title} from the overview`}
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { SECTION_LABELS } from '@/lib/api/storefront';
import type { StorefrontSection } from '@/lib/api/storefront';

export default function SectionCard({
  section,
  index,
  total,
  onChange,
  onMove,
  onRemove,
  children,
}: {
  section: StorefrontSection;
  index: number;
  total: number;
  onChange: (next: StorefrontSection) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="dash-form-card" style={{ marginBottom: 16, opacity: section.enabled ? 1 : 0.6 }}>
      <div className="dash-row-actions" style={{ marginBottom: 12, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <strong>{SECTION_LABELS[section.type]}</strong>
          <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--mr-fg-4)' }}>
            {index + 1} of {total}
          </span>
          {!section.enabled && (
            <span className="dash-status" data-status="cancelled" style={{ marginLeft: 10 }}>
              <span className="dash-status-dot" />
              Hidden — keeps its settings, just off the live page
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={section.enabled}
              onChange={(e) => onChange({ ...section, enabled: e.target.checked })}
            />
            Show
          </label>
          <button type="button" className="dash-btn-ghost" disabled={index === 0} onClick={() => onMove(-1)}>
            Move up
          </button>
          <button
            type="button"
            className="dash-btn-ghost"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            Move down
          </button>
          <button type="button" className="dash-btn-ghost" onClick={() => setOpen((o) => !o)}>
            {open ? 'Collapse' : 'Edit'}
          </button>
          <button type="button" className="dash-btn-danger" onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>
      {open && children}
    </div>
  );
}

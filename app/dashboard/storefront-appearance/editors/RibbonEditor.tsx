'use client';

import React from 'react';
import type { RibbonSection } from '@/lib/api/storefront';

export default function RibbonEditor({
  section,
  onChange,
}: {
  section: RibbonSection;
  onChange: (next: RibbonSection) => void;
}) {
  return (
    <div className="dash-form-section">
      <label className="dash-field">
        <span className="dash-label">Phrases (one per line)</span>
        <textarea
          className="dash-input"
          rows={6}
          value={section.items.join('\n')}
          onChange={(e) =>
            onChange({
              ...section,
              items: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean),
            })
          }
        />
      </label>
      <div className="dash-form-grid">
        <label className="dash-field">
          <span className="dash-label">Seconds per full loop (higher is slower)</span>
          <input
            className="dash-input"
            type="number"
            min={10}
            max={180}
            value={section.speedSeconds}
            onChange={(e) =>
              onChange({
                ...section,
                speedSeconds: Math.min(180, Math.max(10, Number(e.target.value))),
              })
            }
          />
        </label>
        <label className="dash-field">
          <span className="dash-label">Colour</span>
          <select
            className="dash-input"
            value={section.surface}
            onChange={(e) => onChange({ ...section, surface: e.target.value as 'ink' | 'cream' })}
          >
            <option value="ink">Dark</option>
            <option value="cream">Light</option>
          </select>
        </label>
      </div>
      {section.items.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--mr-fg-4)' }}>
          No phrases yet — this ribbon will not appear on the storefront.
        </p>
      )}
    </div>
  );
}

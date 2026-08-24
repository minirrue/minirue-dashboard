'use client';

import React from 'react';
import type { RibbonSection } from '@/lib/api/storefront';

/**
 * Editor for the scrolling ribbon.
 *
 * The textarea is deliberately LOSSLESS: it splits on '\n' and nothing else,
 * so whatever is typed survives the round trip back through `items.join('\n')`.
 *
 * It used to trim each line and drop the empty ones right here in onChange,
 * which made the box unusable. Pressing Enter created an empty line that was
 * filtered out before React re-rendered, so the newline vanished and the caret
 * jumped to the end of the box; a trailing space was eaten by .trim() the same
 * way. The line only appeared once a real character followed, which reads as
 * "space makes a new line". Owner, 2026-08-24: "this typing area is bugged".
 *
 * Blank lines are cleaned in normalizeStorefrontLayoutForSave instead — at
 * save, once, rather than on every keystroke. The backend requires every
 * phrase to be non-empty, so that cleanup is not optional; it just belongs at
 * the other end of the edit.
 */
export default function RibbonEditor({
  section,
  onChange,
}: {
  section: RibbonSection;
  onChange: (next: RibbonSection) => void;
}) {
  // Blank lines are legitimate mid-edit now, so "is this ribbon empty?" has to
  // ask whether anything non-blank is left rather than counting array entries.
  const hasPhrase = section.items.some((item) => item.trim() !== '');

  return (
    <div className="dash-form-section">
      <label className="dash-field">
        <span className="dash-label">Phrases (one per line)</span>
        <textarea
          className="dash-input"
          rows={6}
          value={section.items.join('\n')}
          onChange={(e) =>
            onChange({ ...section, items: e.target.value.split('\n') })
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
      {!hasPhrase && (
        <p style={{ fontSize: 13, color: 'var(--mr-fg-4)' }}>
          No phrases yet — this ribbon will not appear on the storefront.
        </p>
      )}
    </div>
  );
}

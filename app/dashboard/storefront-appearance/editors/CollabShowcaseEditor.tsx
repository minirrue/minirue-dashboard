'use client';

import React, { useState } from 'react';
import type { CollabShowcaseSection, CollabShowcaseTab } from '@/lib/api/storefront';
import EntityPicker, { MultiProductPicker, moveInList, useEntityOptions } from '../pickers/EntityPicker';

export function blankTab(collaboratorId: string): CollabShowcaseTab {
  return { collaboratorId, label: null, productIds: [], limit: 4 };
}

export default function CollabShowcaseEditor({
  section,
  onChange,
}: {
  section: CollabShowcaseSection;
  onChange: (next: CollabShowcaseSection) => void;
}) {
  const { options } = useEntityOptions('collaborator');
  const [pending, setPending] = useState('');

  const patchTab = (index: number, patch: Partial<CollabShowcaseTab>) =>
    onChange({
      ...section,
      tabs: section.tabs.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    });

  const nameFor = (id: string) => options.find((o) => o.id === id)?.label ?? id;

  return (
    <div className="dash-form-section">
      <div className="dash-form-grid">
        <label className="dash-field">
          <span className="dash-label">Eyebrow</span>
          <input className="dash-input" value={section.eyebrow}
            onChange={(e) => onChange({ ...section, eyebrow: e.target.value })} />
        </label>
        <label className="dash-field">
          <span className="dash-label">Title</span>
          <input className="dash-input" value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })} />
        </label>
      </div>

      <p style={{ fontSize: 13, color: 'var(--mr-fg-3)' }}>
        Each collaborator gets a tab. The order here is the order shoppers scroll through — put the
        collaborator paying for the top slot first.
      </p>

      {section.tabs.map((tab, index) => (
        <div key={`${tab.collaboratorId}-${index}`} className="dash-form-card" style={{ marginBottom: 12 }}>
          <div className="dash-row-actions" style={{ marginBottom: 10 }}>
            <strong style={{ flex: 1 }}>
              Tab {index + 1} · {tab.label ?? nameFor(tab.collaboratorId)}
            </strong>
            <button type="button" className="dash-btn-ghost" disabled={index === 0}
              onClick={() => onChange({ ...section, tabs: moveInList(section.tabs, index, -1) })}>
              Move left
            </button>
            <button type="button" className="dash-btn-ghost" disabled={index === section.tabs.length - 1}
              onClick={() => onChange({ ...section, tabs: moveInList(section.tabs, index, 1) })}>
              Move right
            </button>
            <button type="button" className="dash-btn-ghost"
              onClick={() => onChange({ ...section, tabs: section.tabs.filter((_, i) => i !== index) })}>
              Remove
            </button>
          </div>

          <div className="dash-form-grid">
            <EntityPicker
              kind="collaborator"
              label="Collaborator"
              value={tab.collaboratorId}
              onChange={(id) => patchTab(index, { collaboratorId: id ?? '' })}
            />
            <label className="dash-field">
              <span className="dash-label">Tab label (blank uses their brand name)</span>
              <input className="dash-input" value={tab.label ?? ''}
                onChange={(e) => patchTab(index, { label: e.target.value || null })} />
            </label>
            <label className="dash-field">
              <span className="dash-label">How many products</span>
              <input className="dash-input" type="number" min={1} max={24} value={tab.limit}
                onChange={(e) =>
                  patchTab(index, { limit: Math.min(24, Math.max(1, Number(e.target.value))) })
                } />
            </label>
          </div>

          <MultiProductPicker
            value={tab.productIds}
            onChange={(productIds) => patchTab(index, { productIds })}
          />
          {tab.productIds.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--mr-fg-4)' }}>
              Nothing picked — this tab shows the collaborator's newest {tab.limit} items instead.
            </p>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8 }}>
        <select
          className="dash-input"
          value={pending}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) return;
            onChange({ ...section, tabs: [...section.tabs, blankTab(id)] });
            setPending('');
          }}
        >
          <option value="">Add a collaborator tab…</option>
          {options
            .filter((o) => !section.tabs.some((t) => t.collaboratorId === o.id))
            .map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
        </select>
      </div>

      {options.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--mr-fg-4)', marginTop: 8 }}>
          No collaborators yet — add one before a showcase tab can be created.
        </p>
      )}

      {section.tabs.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--mr-fg-4)', marginTop: 8 }}>
          No collaborators added — this section will not appear on the storefront.
        </p>
      )}
    </div>
  );
}

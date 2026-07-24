'use client';

import React, { useState } from 'react';
import type { CollabShowcaseSection, CollabShowcaseTab } from '@/lib/api/storefront';
import { apiGetCollaborator, apiListCollaborators } from '@/lib/api/collaborators';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import EntityPicker, { MultiProductPicker, moveInList, useEntityOptions } from '../pickers/EntityPicker';

export function blankTab(collaboratorId: string): CollabShowcaseTab {
  return { collaboratorId, label: null, productIds: [], limit: 4 };
}

/** Why a collaborator won't show up on the storefront, or null if it will. */
type IneligibleReason = 'inactive' | 'hidden';

interface CollabEligibility {
  active: boolean;
  visible: boolean;
}

/**
 * Storefront-visibility signal for the "won't appear" warnings below.
 * `apiListCollaborators` only returns collaborators that already have a
 * brand profile (the list query inner-joins on one), so brand-profile
 * presence is implied for anything in this map. Status comes straight off
 * that list; `storefrontVisible` isn't in the list payload, so it's filled
 * in with one detail fetch per collaborator. If either fetch fails, that
 * collaborator is simply left out of the map — no eligibility claim is made
 * for it, so no warning (true or false) gets shown. specs/2026-07-24-collab-showcase-eligibility-warning
 */
function useCollabEligibility(): {
  eligibility: Map<string, CollabEligibility>;
} {
  const [eligibility, setEligibility] = useState<Map<string, CollabEligibility>>(new Map());

  useMountedEffect(() => {
    void (async () => {
      try {
        const list = await apiListCollaborators({ limit: 100 });
        const details = await Promise.allSettled(
          list.items.map((item) => apiGetCollaborator(item.id)),
        );
        const map = new Map<string, CollabEligibility>();
        list.items.forEach((item, i) => {
          const detail = details[i];
          if (detail.status !== 'fulfilled') return;
          map.set(item.id, {
            active: item.status === 'ACTIVE',
            visible: detail.value.storefrontVisible ?? false,
          });
        });
        setEligibility(map);
      } catch {
        // Fail safe: no eligibility data means no annotations, not false ones.
      }
    })();
  }, []);

  return { eligibility };
}

function ineligibleReason(info: CollabEligibility | undefined): IneligibleReason | null {
  if (!info) return null;
  if (!info.active) return 'inactive';
  if (!info.visible) return 'hidden';
  return null;
}

export default function CollabShowcaseEditor({
  section,
  onChange,
}: {
  section: CollabShowcaseSection;
  onChange: (next: CollabShowcaseSection) => void;
}) {
  const { options } = useEntityOptions('collaborator');
  const { eligibility } = useCollabEligibility();
  const [pending, setPending] = useState('');

  const patchTab = (index: number, patch: Partial<CollabShowcaseTab>) =>
    onChange({
      ...section,
      tabs: section.tabs.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    });

  const nameFor = (id: string) => options.find((o) => o.id === id)?.label ?? id;

  const warningFor = (id: string): string | null => {
    const reason = ineligibleReason(eligibility.get(id));
    if (!reason) return null;
    const name = nameFor(id);
    if (reason === 'inactive') {
      return `${name} is not an active collaborator, so they won't appear on the storefront.`;
    }
    return `${name} won't appear on the storefront yet — turn on "Visible on storefront" on their collaborator profile (Collaborators → ${name}). If that's already on, they also need a brand profile set up.`;
  };

  // Section-level note only fires when every tab is a *known* non-starter —
  // an unloaded/unknown eligibility (no map entry) never counts as ineligible.
  const allTabsKnownIneligible =
    section.tabs.length > 0 &&
    section.tabs.every((tab) => ineligibleReason(eligibility.get(tab.collaboratorId)) !== null);

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
              // Switching collaborator drops the picked products — they belong
              // to the previous brand and would leak into this tab.
              onChange={(id) =>
                patchTab(index, { collaboratorId: id ?? '', productIds: [] })
              }
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

          {warningFor(tab.collaboratorId) && (
            <p className="dash-inline-error" style={{ marginBottom: 10 }}>
              {warningFor(tab.collaboratorId)}
            </p>
          )}

          {/* Scoped to this tab's collaborator — a showcase tab must never be
              able to feature another brand's (or MiniRue's own) products. */}
          <MultiProductPicker
            key={tab.collaboratorId}
            collaboratorId={tab.collaboratorId}
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
            .map((o) => {
              const reason = ineligibleReason(eligibility.get(o.id));
              const suffix = reason === 'inactive' ? ' — inactive' : reason === 'hidden' ? ' — not visible yet' : '';
              return (
                <option key={o.id} value={o.id}>{o.label}{suffix}</option>
              );
            })}
        </select>
      </div>

      {options.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--mr-fg-4)', marginTop: 8 }}>
          No collaborators yet — add one before a showcase tab can be created.
        </p>
      )}

      {/* An empty dropdown reads as broken. Say why it is empty: every
          collaborator already has a tab, so there is nothing left to add. */}
      {options.length > 0 &&
        options.every((o) => section.tabs.some((t) => t.collaboratorId === o.id)) && (
          <p style={{ fontSize: 13, color: 'var(--mr-fg-4)', marginTop: 8 }}>
            Every collaborator already has a tab here — add another collaborator
            under Collaborators to create one more.
          </p>
        )}

      {section.tabs.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--mr-fg-4)', marginTop: 8 }}>
          No collaborators added — this section will not appear on the storefront.
        </p>
      )}

      {allTabsKnownIneligible && (
        <p className="dash-inline-error" style={{ marginTop: 8 }}>
          None of the collaborators in this showcase will appear on the storefront yet — this
          whole section stays hidden until at least one is active and visible.
        </p>
      )}
    </div>
  );
}

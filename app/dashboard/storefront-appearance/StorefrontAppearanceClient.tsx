'use client';

import React, { useCallback, useState } from 'react';
import {
  apiGetStorefrontLayout,
  apiSaveStorefrontLayout,
  moveSection,
  newSection,
  normalizeStorefrontLayoutForSave,
  SECTION_LABELS,
} from '@/lib/api/storefront';
import type {
  CollabShowcaseSection,
  HeroSection,
  JournalSection,
  ProductGridSection,
  RibbonSection,
  SectionType,
  StorefrontLayout,
  StorefrontSection,
} from '@/lib/api/storefront';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import SectionCard from './SectionCard';
import HeroEditor from './editors/HeroEditor';
import RibbonEditor from './editors/RibbonEditor';
import ProductGridEditor from './editors/ProductGridEditor';
import JournalEditor from './editors/JournalEditor';
import CollabShowcaseEditor from './editors/CollabShowcaseEditor';
import NavbarEditor from './editors/NavbarEditor';
import FooterEditor from './editors/FooterEditor';
import PagesEditor from './PagesEditor';
import ProductSectionEditor from './editors/ProductSectionEditor';

const SECTION_TYPES: SectionType[] = [
  'hero',
  'collabShowcase',
  'ribbon',
  'productGrid',
  'journal',
];

type Tab = 'page' | 'navbar' | 'footer' | 'announcement' | 'productSection' | 'pages';

export default function StorefrontAppearanceClient() {
  const [layout, setLayout] = useState<StorefrontLayout | null>(null);
  const [tab, setTab] = useState<Tab>('page');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [droppedNavItemCount, setDroppedNavItemCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setLayout(await apiGetStorefrontLayout());
    } catch (e) {
      setLoadError((e as ApiError).message ?? 'Failed to load the storefront layout');
    } finally {
      setLoading(false);
    }
  }, []);

  useMountedEffect(() => { void load(); }, [load]);

  const patch = (next: Partial<StorefrontLayout>) => {
    setSaved(false);
    setLayout((prev) => (prev ? { ...prev, ...next } : prev));
  };

  const patchSection = (index: number, next: StorefrontSection) => {
    setSaved(false);
    setLayout((prev) =>
      prev
        ? { ...prev, sections: prev.sections.map((s, i) => (i === index ? next : s)) }
        : prev,
    );
  };

  const save = async () => {
    if (!layout) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    setDroppedNavItemCount(0);
    try {
      // Normalize on a copy — never mutate the on-screen layout. An
      // unfinished hero CTA target (kind picked, id not yet chosen) would
      // otherwise fail the backend's `.uuid()` check and block saving
      // every other change on the page, so it's coerced to a safe
      // default; an unfinished nav item (no target or no label) can't be
      // sensibly defaulted, so it's dropped and the admin is told.
      const { layout: toSave, droppedNavItemCount: dropped } =
        normalizeStorefrontLayoutForSave(layout);
      const result = await apiSaveStorefrontLayout(toSave);
      setLayout(result);
      setSaved(true);
      setDroppedNavItemCount(dropped);
    } catch (e) {
      setSaveError((e as ApiError).message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="dash-form-card">
        <span className="dash-skeleton" style={{ width: '100%', height: 160 }} />
      </div>
    );
  }

  // A failed (or not-yet-successful) load must never fall through to the
  // editor — rendering an empty document here and letting the admin hit Save
  // would overwrite their real storefront with nothing.
  if (loadError || !layout) {
    return (
      <div className="dash-card">
        <p className="dash-inline-error">{loadError ?? 'Storefront layout unavailable'}</p>
        <button type="button" className="dash-btn-secondary" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  const removeSection = (index: number) => {
    const section = layout.sections[index];
    const confirmed = window.confirm(
      `Remove the "${SECTION_LABELS[section.type]}" section? This deletes its configuration ` +
        'permanently — there is no undo. To keep the settings but take it off the live page, ' +
        'use "Show" instead.',
    );
    if (!confirmed) return;
    patch({
      sections: layout.sections
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, order: i })),
    });
  };

  const renderEditor = (section: StorefrontSection, index: number) => {
    switch (section.type) {
      case 'hero':
        return (
          <HeroEditor
            section={section}
            onChange={(next: HeroSection) => patchSection(index, next)}
          />
        );
      case 'ribbon':
        return (
          <RibbonEditor
            section={section}
            onChange={(next: RibbonSection) => patchSection(index, next)}
          />
        );
      case 'productGrid':
        return (
          <ProductGridEditor
            section={section}
            onChange={(next: ProductGridSection) => patchSection(index, next)}
          />
        );
      case 'journal':
        return (
          <JournalEditor
            section={section}
            onChange={(next: JournalSection) => patchSection(index, next)}
          />
        );
      case 'collabShowcase':
        return (
          <CollabShowcaseEditor
            section={section}
            onChange={(next: CollabShowcaseSection) => patchSection(index, next)}
          />
        );
    }
  };

  return (
    <>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Storefront</h1>
          <p className="dash-page-subtitle">
            Compose the home page section by section, and set the navigation and footer.
          </p>
        </div>
        <button type="button" className="dash-btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <div className="dash-tabstrip">
        {(['page', 'navbar', 'footer', 'announcement', 'productSection', 'pages'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? 'dash-btn-secondary' : 'dash-btn-ghost'}
            onClick={() => setTab(t)}
          >
            {t === 'page'
              ? 'Home page'
              : t === 'productSection'
                ? 'Product section'
                : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {saveError && <p className="dash-inline-error">{saveError}</p>}
      {saved && (
        <p className="dash-inline-ok">
          Storefront saved. The live site updates within about a minute — it caches for 60
          seconds, so a refresh right now may still show the old page.
        </p>
      )}
      {saved && droppedNavItemCount > 0 && (
        <p className="dash-inline-error">
          {droppedNavItemCount === 1
            ? '1 unfinished menu item was removed on save'
            : `${droppedNavItemCount} unfinished menu items were removed on save`}
          {' '}— it had no page picked or no label, so there was nothing to show shoppers. Check
          the Navbar tab if that wasn&apos;t intended.
        </p>
      )}

      {tab === 'page' && (
        <>
          {layout.sections.map((section, index) => (
            <SectionCard
              key={section.id}
              section={section}
              index={index}
              total={layout.sections.length}
              onChange={(next) => patchSection(index, next)}
              onMove={(direction) => patch({ sections: moveSection(layout.sections, index, direction) })}
              onRemove={() => removeSection(index)}
            >
              {renderEditor(section, index)}
            </SectionCard>
          ))}

          <div className="dash-form-card">
            <div className="dash-section-header">
              <h2 className="dash-section-title">Add a section</h2>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SECTION_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className="dash-btn-secondary"
                  onClick={() =>
                    patch({
                      sections: [...layout.sections, newSection(type, layout.sections.length)],
                    })
                  }
                >
                  {SECTION_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'navbar' && (
        <NavbarEditor navbar={layout.navbar} onChange={(navbar) => patch({ navbar })} />
      )}

      {tab === 'footer' && (
        <FooterEditor footer={layout.footer} onChange={(footer) => patch({ footer })} />
      )}

      {tab === 'productSection' && (
        <ProductSectionEditor
          // A layout saved before this field existed has no productSection
          // until the API backfills it on read; never dereference undefined.
          section={layout.productSection ?? { perks: [] }}
          onChange={(productSection) => patch({ productSection })}
        />
      )}

      {tab === 'pages' && (
        <PagesEditor pages={layout.pages} onChange={(pages) => patch({ pages })} />
      )}

      {tab === 'announcement' && (
        <div className="dash-form-card">
          <div className="dash-form-section">
            <div className="dash-section-header">
              <h2 className="dash-section-title">Announcement bar</h2>
            </div>
            <label className="dash-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={layout.announcement.enabled}
                onChange={(e) =>
                  patch({ announcement: { ...layout.announcement, enabled: e.target.checked } })
                }
              />
              <span>Show the announcement bar above the header</span>
            </label>
            <label className="dash-field">
              <span className="dash-label">Messages (one per line)</span>
              <textarea
                className="dash-input"
                rows={5}
                value={layout.announcement.messages.join('\n')}
                onChange={(e) =>
                  patch({
                    announcement: {
                      ...layout.announcement,
                      messages: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean),
                    },
                  })
                }
              />
            </label>
            <label className="dash-field">
              <span className="dash-label">Link URL (optional)</span>
              <input
                className="dash-input"
                value={layout.announcement.linkUrl ?? ''}
                placeholder="https://…"
                onChange={(e) =>
                  patch({
                    announcement: { ...layout.announcement, linkUrl: e.target.value.trim() || null },
                  })
                }
              />
            </label>
            {/* The announcement bar's background is no longer editable here
                (2026-07-24) — its colour is owned by the storefront theme.
                `layout.announcement.background` is still saved untouched, so
                whatever is set today keeps rendering. */}
            <label className="dash-field">
              <span className="dash-label">Favicon URL</span>
              <input
                className="dash-input"
                value={layout.faviconUrl ?? ''}
                placeholder="https://…"
                onChange={(e) => patch({ faviconUrl: e.target.value.trim() || null })}
              />
            </label>
          </div>
        </div>
      )}
    </>
  );
}

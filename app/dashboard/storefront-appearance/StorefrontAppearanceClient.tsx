'use client';

import React, { useCallback, useEffect, useState } from 'react';
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
import { apiGetSettings } from '@/lib/api/settings';
import type { StoreSettings } from '@/lib/api/settings';
import SectionCard from './SectionCard';
import HeroEditor from './editors/HeroEditor';
import LinkTargetField from './pickers/LinkTargetField';
import RibbonEditor from './editors/RibbonEditor';
import ProductGridEditor from './editors/ProductGridEditor';
import JournalEditor from './editors/JournalEditor';
import CollabShowcaseEditor from './editors/CollabShowcaseEditor';
import NavbarEditor from './editors/NavbarEditor';
import MobileMenuEditor from './editors/MobileMenuEditor';
import FooterEditor from './editors/FooterEditor';
import PagesEditor from './PagesEditor';
import ProductSectionEditor from './editors/ProductSectionEditor';
import TrustEditor from './editors/TrustEditor';
import type { PromiseTokenValues } from '@/lib/api/storefront';

/**
 * Live values for the promise-token preview and the "already advertised
 * automatically" panel, derived from Settings — never sent back to the
 * server; the storefront resolves the real values itself at render time.
 * Loaded best-effort: a failure here must never block editing or saving the
 * storefront layout, so it fails silently to `null` (undefined values).
 */
function derivePromiseFacts(settings: StoreSettings | null): PromiseTokenValues & {
  freeShippingIsTrue: boolean;
  sameDayIsTrue: boolean;
  codIsTrue: boolean;
} {
  if (!settings) return { freeShippingIsTrue: false, sameDayIsTrue: false, codIsTrue: false };

  const freeRates = (settings.shipping?.rates ?? []).filter((r) => r.feeCents === 0);
  const freeGovernorates = freeRates.map((r) => r.label);

  const sameDay = settings.fulfillment?.delivery?.sameDay;
  const sameDayGovernorates = sameDay?.enabled ? sameDay.governorates : [];

  const codLimitMinor = settings.payments?.codMaxOrderMinor ?? null;

  return {
    freeShippingIsTrue: freeGovernorates.length > 0,
    sameDayIsTrue: (sameDayGovernorates?.length ?? 0) > 0,
    codIsTrue: settings.payments != null,
    freeGovernorates: freeGovernorates.length > 0 ? freeGovernorates.join(', ') : null,
    sameDayGovernorates:
      sameDayGovernorates && sameDayGovernorates.length > 0 ? sameDayGovernorates.join(', ') : null,
    codLimit: codLimitMinor != null ? `EGP ${(codLimitMinor / 100).toLocaleString()}` : null,
    deliveryDays: settings.fulfillment?.delivery?.standard?.etaLabel ?? null,
  };
}

const SECTION_TYPES: SectionType[] = [
  'hero',
  'collabShowcase',
  'ribbon',
  'productGrid',
  'journal',
];

type Tab =
  | 'page'
  | 'navbar'
  | 'mobileMenu'
  | 'footer'
  | 'announcement'
  | 'productSection'
  | 'pages'
  | 'trust';

const TAB_LABELS: Record<Tab, string> = {
  page: 'Home page',
  navbar: 'Navbar',
  mobileMenu: 'Mobile menu',
  footer: 'Footer',
  announcement: 'Announcement',
  productSection: 'Product section',
  pages: 'Pages',
  trust: 'Trust',
};


/**
 * The announcement messages editor, one per line.
 *
 * Keeps what the admin typed verbatim while the field has focus, and only
 * converts it to the stored `string[]` on blur. See the comment at the call
 * site for what the previous every-keystroke conversion did to typing.
 */
function AnnouncementMessagesField({
  messages,
  onCommit,
}: {
  messages: string[];
  onCommit: (messages: string[]) => void;
}) {
  const [draft, setDraft] = useState(messages.join('\n'));

  // Re-sync when the value changes from elsewhere (a reload, or a discard),
  // but never while the admin is mid-edit — that is what caused the original
  // bug. Comparing against the committed form means an in-progress trailing
  // space or blank line does not count as a change.
  useEffect(() => {
    const committed = draft
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (committed.join('\n') !== messages.join('\n')) {
      setDraft(messages.join('\n'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  return (
    <textarea
      className="dash-input"
      rows={5}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() =>
        onCommit(
          draft
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean),
        )
      }
    />
  );
}

export default function StorefrontAppearanceClient() {
  const [layout, setLayout] = useState<StorefrontLayout | null>(null);
  const [tab, setTab] = useState<Tab>('page');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [droppedNavItemCount, setDroppedNavItemCount] = useState(0);
  const [droppedMobileMenuItemCount, setDroppedMobileMenuItemCount] = useState(0);
  // Best-effort only — powers the token preview and the "already advertised
  // automatically" panel. Never blocks loading or saving the layout itself:
  // a failure here leaves `settings` null and every derived fact reads as
  // unknown/false, which is the safe direction to fail in.
  const [settings, setSettings] = useState<StoreSettings | null>(null);

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
    try {
      setSettings(await apiGetSettings());
    } catch {
      setSettings(null);
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
    setDroppedMobileMenuItemCount(0);
    try {
      // Normalize on a copy — never mutate the on-screen layout. An
      // unfinished hero CTA target (kind picked, id not yet chosen) would
      // otherwise fail the backend's `.uuid()` check and block saving
      // every other change on the page, so it's coerced to a safe
      // default; an unfinished nav item or mobile-menu tile (no target or
      // no label) can't be sensibly defaulted, so it's dropped and the
      // admin is told.
      const {
        layout: toSave,
        droppedNavItemCount: dropped,
        droppedMobileMenuItemCount: droppedMobileMenu,
      } = normalizeStorefrontLayoutForSave(layout);
      const result = await apiSaveStorefrontLayout(toSave);
      setLayout(result);
      setSaved(true);
      setDroppedNavItemCount(dropped);
      setDroppedMobileMenuItemCount(droppedMobileMenu);
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
        {(
          ['page', 'navbar', 'mobileMenu', 'footer', 'announcement', 'productSection', 'pages', 'trust'] as Tab[]
        ).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? 'dash-btn-secondary' : 'dash-btn-ghost'}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
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
      {saved && droppedMobileMenuItemCount > 0 && (
        <p className="dash-inline-error">
          {droppedMobileMenuItemCount === 1
            ? '1 unfinished mobile-menu tile was removed on save'
            : `${droppedMobileMenuItemCount} unfinished mobile-menu tiles were removed on save`}
          {' '}— it had no destination picked or no label. Check the Mobile menu tab if that
          wasn&apos;t intended.
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

      {tab === 'mobileMenu' && (
        <MobileMenuEditor
          mobileMenu={layout.mobileMenu}
          onChange={(mobileMenu) => patch({ mobileMenu })}
        />
      )}

      {tab === 'footer' && (
        <FooterEditor
          footer={layout.footer}
          pages={layout.pages}
          onChange={(footer) => patch({ footer })}
        />
      )}

      {tab === 'productSection' && (
        <ProductSectionEditor
          // A layout saved before this field existed has no productSection
          // until the API backfills it on read; never dereference undefined.
          section={layout.productSection ?? { perks: [] }}
          facts={{
            ...derivePromiseFacts(settings),
            returnsDays: layout.trust?.returnsWindowDays != null ? String(layout.trust.returnsWindowDays) : null,
            returnsIsSet: layout.trust?.returnsWindowDays != null,
          }}
          onChange={(productSection) => patch({ productSection })}
        />
      )}

      {tab === 'pages' && (
        <PagesEditor pages={layout.pages} onChange={(pages) => patch({ pages })} />
      )}

      {tab === 'trust' && (
        <TrustEditor trust={layout.trust} onChange={(trust) => patch({ trust })} />
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
              {/* Driven by its own draft state, not by messages.join('\n').

                  Round-tripping the array on every keystroke made this field
                  impossible to type in. Press Enter and the new line is empty,
                  so .filter(Boolean) removed it and the re-joined value came
                  back WITHOUT the newline — so the bar could only ever hold one
                  message. Type a space and .map(l => l.trim()) deleted it
                  before the next character arrived, so no message could contain
                  a space.

                  That is the "enter does nothing, space does nothing" report,
                  and this — the announcement bar's own editor — is the screen it
                  was on. Splitting and trimming now happen on blur, when the
                  value is being committed rather than while it is being
                  written. */}
              <AnnouncementMessagesField
                messages={layout.announcement.messages}
                onCommit={(messages) =>
                  patch({
                    announcement: { ...layout.announcement, messages },
                  })
                }
              />
            </label>
            {/* This was the one CTA-style field in the whole Storefront
                section with no picker at all — a raw text box, so the only way
                to point the announcement at a page you had written was to type
                its address from memory and hope it matched. LinkTargetField
                reverse-infers the kind of an already-saved href, so existing
                announcements keep working with no migration. */}
            <div className="dash-field">
              <span className="dash-label">Link (optional)</span>
              <LinkTargetField
                href={layout.announcement.linkUrl ?? ''}
                pages={layout.pages ?? []}
                onChange={(href) =>
                  patch({
                    announcement: {
                      ...layout.announcement,
                      linkUrl: href.trim() || null,
                    },
                  })
                }
              />
            </div>
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
                onChange={(e) => patch({ faviconUrl: e.target.value || null })}
                onBlur={(e) => patch({ faviconUrl: e.target.value.trim() || null })}
              />
            </label>
          </div>
        </div>
      )}
    </>
  );
}

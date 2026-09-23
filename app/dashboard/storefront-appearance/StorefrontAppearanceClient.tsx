'use client';

/**
 * Storefront — everything shoppers see on minirueshop.com.
 *
 * Edit on the left, see the real shop on the right, publish when ready
 * (dashboard#102, from the approved Impeccable prototype
 * `.impeccable/prototypes/storefront/storefront-a.html`).
 *
 * The draft is local until Publish. Publishing runs the same save path as
 * before: `normalizeStorefrontLayoutForSave` (coerce half-finished hero
 * buttons, drop unfinished menu items and tiles, and say so), then
 * PATCH /v1/settings, then reload from what the server stored.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  ExternalLink,
  FileText,
  Info,
  Layers,
  LayoutGrid,
  Megaphone,
  Monitor,
  Pencil,
  RotateCcw,
  Smartphone,
  Trash2,
  Users,
  X,
} from 'lucide-react';
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
  PromiseTokenValues,
  RibbonSection,
  SectionType,
  StorefrontLayout,
  StorefrontSection,
} from '@/lib/api/storefront';
import type { ApiError } from '@/lib/api/client';
import { useMountedEffect } from '@/lib/hooks/useMountedEffect';
import { apiGetSettings } from '@/lib/api/settings';
import { listProducts } from '@/lib/catalog/api';
import type { StoreSettings } from '@/lib/api/settings';
import { countByTab, runChecks, type Check as CheckItem, type CheckTab } from '@/lib/storefront/checks';
import { TARGET_PILL } from '@/lib/storefront/targets';
import { storefrontOrigin } from '@/lib/storefront/origin';
import HeroEditor from './editors/HeroEditor';
import RibbonEditor from './editors/RibbonEditor';
import ProductGridEditor from './editors/ProductGridEditor';
import JournalEditor from './editors/JournalEditor';
import CollabShowcaseEditor from './editors/CollabShowcaseEditor';
import NavbarEditor from './editors/NavbarEditor';
import MobileMenuEditor from './editors/MobileMenuEditor';
import FooterEditor from './editors/FooterEditor';
import ProductSectionEditor from './editors/ProductSectionEditor';
import TrustEditor from './editors/TrustEditor';
import PagesEditor from './PagesEditor';
import { HrefTargetField } from './fields/TargetField';
import Sheet from '@/components/dashboard/ui/Sheet';
import Switch from '@/components/dashboard/ui/Switch';
import PreviewPane, { type PreviewDevice, type PreviewView } from './PreviewPane';
import './storefront-editor.css';

/* ── Facts for the promise preview (unchanged from the previous editor) ─── */

/**
 * Live values for the promise-token preview and the "already advertised
 * automatically" panel, derived from Settings — never sent back to the
 * server; the storefront resolves the real values itself at render time.
 * Loaded best-effort: a failure here must never block editing or publishing.
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
    sameDayGovernorates: sameDayGovernorates && sameDayGovernorates.length > 0 ? sameDayGovernorates.join(', ') : null,
    codLimit: codLimitMinor != null ? `EGP ${(codLimitMinor / 100).toLocaleString()}` : null,
    deliveryDays: settings.fulfillment?.delivery?.standard?.etaLabel ?? null,
  };
}

/* ── Vocabulary ─────────────────────────────────────────────────────────── */

type Tab = CheckTab;

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'home', label: 'Home page' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'footer', label: 'Footer' },
  { id: 'announcement', label: 'Announcement' },
  { id: 'product', label: 'Product page' },
  { id: 'pages', label: 'Pages' },
  { id: 'trust', label: 'Trust & contact' },
];

const SECTION_TYPES: SectionType[] = ['hero', 'collabShowcase', 'ribbon', 'productGrid', 'journal'];

const SECTION_ICON: Record<SectionType, React.ComponentType<{ 'aria-hidden'?: boolean }>> = {
  hero: Layers,
  collabShowcase: Users,
  ribbon: Megaphone,
  productGrid: LayoutGrid,
  journal: FileText,
};

const SECTION_HELP: Record<SectionType, string> = {
  hero: 'Big rotating banner at the top',
  collabShowcase: 'Tabs of partner products',
  ribbon: 'A moving line of short phrases',
  productGrid: 'A row of products or brands',
  journal: 'A story with a picture, or one product',
};

/** Which parts of the layout each tab owns — for "what changed" when publishing. */
const AREAS: Array<{ tab: Tab; keys: Array<keyof StorefrontLayout> }> = [
  { tab: 'home', keys: ['sections'] },
  { tab: 'navigation', keys: ['navbar', 'mobileMenu'] },
  { tab: 'footer', keys: ['footer'] },
  { tab: 'announcement', keys: ['announcement', 'faviconUrl'] },
  { tab: 'product', keys: ['productSection'] },
  { tab: 'pages', keys: ['pages'] },
  { tab: 'trust', keys: ['trust'] },
];

const tabLabel = (t: Tab) => TABS.find((x) => x.id === t)!.label;

const cairoTime = (d: Date) =>
  d.toLocaleString('en-US', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

function sectionTitle(s: StorefrontSection): string {
  switch (s.type) {
    case 'hero': return s.slides[0]?.headline || 'Hero';
    case 'ribbon': return s.items.find((i) => i.trim()) || 'Ribbon';
    case 'productGrid': return s.title || 'Products';
    case 'journal': return s.title || 'Journal';
    case 'collabShowcase': return s.title || 'Collaborators';
  }
}

function sectionSummary(s: StorefrontSection): string {
  switch (s.type) {
    case 'hero':
      return `${s.slides.length} slide${s.slides.length === 1 ? '' : 's'} · changes every ${Math.round(s.autoplayMs / 1000)}s`;
    case 'ribbon':
      return `${s.items.filter((i) => i.trim()).length} phrases · ${s.surface === 'ink' ? 'black' : 'cream'} · one loop every ${s.speedSeconds}s`;
    case 'productGrid': {
      const from = s.source.kind === 'manual' ? `${s.source.productIds.length} picked` : s.source.kind === 'category' ? 'from a category' : 'from a brand';
      return `${s.display === 'brands' ? 'Brands' : 'Products'} · ${from} · up to ${s.limit}`;
    }
    case 'journal':
      return s.mode === 'product' ? 'Shows one product' : `Story · picture on the ${s.imageSide}`;
    case 'collabShowcase':
      return `${s.tabs.length} partner tab${s.tabs.length === 1 ? '' : 's'}`;
  }
}

/** The announcement messages editor, one per line (unchanged behaviour).
 *
 * Keeps what the admin typed verbatim while the field has focus, and only
 * converts it to the stored `string[]` on blur. Round-tripping the array on
 * every keystroke made Enter and Space do nothing (a filter and a trim ran
 * before the next character arrived). */
function AnnouncementMessagesField({ messages, onCommit }: { messages: string[]; onCommit: (messages: string[]) => void }) {
  const [draft, setDraft] = useState(messages.join('\n'));
  useEffect(() => {
    const committed = draft.split('\n').map((l) => l.trim()).filter(Boolean);
    if (committed.join('\n') !== messages.join('\n')) setDraft(messages.join('\n'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);
  return (
    <textarea
      className="sfe-input"
      rows={4}
      value={draft}
      aria-label="Messages, one per line"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft.split('\n').map((l) => l.trim()).filter(Boolean))}
    />
  );
}

/* ── Toasts ─────────────────────────────────────────────────────────────── */

interface Toast {
  id: number;
  msg: string;
  undo?: () => void;
}

/* ── The editor ─────────────────────────────────────────────────────────── */

export default function StorefrontAppearanceClient() {
  const [layout, setLayout] = useState<StorefrontLayout | null>(null);
  const [baseline, setBaseline] = useState<string>('');
  const [tab, setTab] = useState<Tab>('home');
  const [navPart, setNavPart] = useState<'desktop' | 'phone'>('desktop');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<Date | null>(null);
  const [dropped, setDropped] = useState<{ nav: number; menu: number } | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [phonePreview, setPhonePreview] = useState(false);
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [previewPageId, setPreviewPageId] = useState<string | null>(null);
  // The product the Product page preview shows: the newest published one,
  // until the owner follows a product link in Browse mode.
  const [previewProductSlug, setPreviewProductSlug] = useState<string | null>(null);
  const [checksOpen, setChecksOpen] = useState(false);
  // Per-viewer convenience. Safe to read at first render: the editor shows the
  // loading skeleton until the layout arrives, so this never affects hydration.
  const [legendOpen, setLegendOpen] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem('mr-sfe-legend') === '1';
    } catch {
      return false; // storage blocked: the legend starts closed
    }
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  const notify = useCallback((msg: string, undo?: () => void) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, msg, undo }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), undo ? 6000 : 3600);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const l = await apiGetStorefrontLayout();
      setLayout(l);
      setBaseline(JSON.stringify(l));
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

  useMountedEffect(() => {
    void load();
  }, [load]);

  const patch = useCallback((next: Partial<StorefrontLayout>) => {
    setLayout((prev) => (prev ? { ...prev, ...next } : prev));
  }, []);
  const patchSection = (id: string, next: StorefrontSection) =>
    setLayout((prev) => (prev ? { ...prev, sections: prev.sections.map((s) => (s.id === id ? next : s)) } : prev));

  const checks = useMemo(() => (layout ? runChecks(layout) : []), [layout]);
  const counts = useMemo(() => countByTab(checks), [checks]);
  const blocking = checks.filter((c) => c.severity === 'block');
  const warnings = checks.filter((c) => c.severity === 'warn');

  const changedTabs = useMemo(() => {
    if (!layout || !baseline) return [] as Tab[];
    const base = JSON.parse(baseline) as StorefrontLayout;
    return AREAS.filter((a) => a.keys.some((k) => JSON.stringify(base[k] ?? null) !== JSON.stringify(layout[k] ?? null))).map((a) => a.tab);
  }, [layout, baseline]);
  const normalizedDrops = useMemo(() => {
    if (!layout) return 0;
    const r = normalizeStorefrontLayoutForSave(layout);
    return r.droppedNavItemCount + r.droppedMobileMenuItemCount;
  }, [layout]);
  const dirty = changedTabs.length > 0;
  /** Publishing would change the live shop: an edit, or unfinished items to clean up. */
  const publishable = dirty || normalizedDrops > 0;

  const facts = useMemo(() => derivePromiseFacts(settings), [settings]);

  /* ── Publishing ── */

  const publish = async () => {
    if (!layout) return;
    setSaving(true);
    setSaveError(null);
    setDropped(null);
    try {
      // Normalize on a copy — never mutate the on-screen layout.
      const { layout: toSave, droppedNavItemCount, droppedMobileMenuItemCount } = normalizeStorefrontLayoutForSave(layout);
      const result = await apiSaveStorefrontLayout(toSave);
      setLayout(result);
      setBaseline(JSON.stringify(result));
      setPublishedAt(new Date());
      setDropped({ nav: droppedNavItemCount, menu: droppedMobileMenuItemCount });
      setPublishOpen(false);
      notify('Published. The live shop updates within about a minute');
    } catch (e) {
      setSaveError((e as ApiError).message ?? 'Failed to publish');
    } finally {
      setSaving(false);
    }
  };

  const askPublish = () => {
    if (blocking.length) {
      setChecksOpen(true);
      notify(`${blocking.length} thing${blocking.length > 1 ? 's' : ''} must be fixed before publishing`);
      return;
    }
    setSaveError(null);
    setPublishOpen(true);
  };

  const discard = () => {
    if (!layout) return;
    const snapshot = layout;
    setLayout(JSON.parse(baseline));
    setOpenSection(null);
    notify('Changes discarded', () => setLayout(snapshot));
  };

  /* ── Navigation between areas ── */

  const goTab = (t: Tab) => {
    setTab(t);
    setOpenSection(null);
  };

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length].id;
    goTab(next);
    tabRefs.current[next]?.focus();
  };

  const focusKey = (key: string) =>
    window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-focus-key="${key}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.querySelector<HTMLElement>('input, select, textarea, button')?.focus({ preventScroll: true });
    }, 60);

  const fix = (c: CheckItem) => {
    goTab(c.tab);
    if (c.tab === 'navigation' && c.focus?.field) setNavPart(c.focus.field.startsWith('nav:') ? 'desktop' : 'phone');
    if (c.focus?.sectionId) window.setTimeout(() => setOpenSection(c.focus!.sectionId!), 0);
    if (c.focus?.pageId) {
      setPreviewPageId(c.focus.pageId);
      focusKey(`page:${c.focus.pageId}`);
    } else if (c.focus?.field) {
      focusKey(c.focus.field);
    }
  };

  const showsProduct = tab === 'product' || tab === 'trust';
  useEffect(() => {
    if (!showsProduct || previewProductSlug) return;
    let live = true;
    listProducts({ status: 'PUBLISHED', limit: 1 })
      .then((res) => {
        if (live && res.items[0]) setPreviewProductSlug(res.items[0].slug);
      })
      .catch(() => {
        // The preview keeps its loading state; Try again re-runs it.
      });
    return () => {
      live = false;
    };
  }, [showsProduct, previewProductSlug]);

  // Browse mode: a link followed inside the preview. Products and pages the
  // current view can show are shown in place; anything else gets a note.
  const pages = layout?.pages;
  const onPreviewNavigate = useCallback(
    (href: string) => {
      const parts = href.split(/[?#]/)[0].split('/').filter(Boolean);
      const productSlug =
        parts[0] === 'shop' && parts.length === 3 ? parts[2] : parts[0] === 'products' && parts.length === 2 ? parts[1] : null;
      if (productSlug && showsProduct) {
        setPreviewProductSlug(productSlug);
        return true;
      }
      const page = tab === 'pages' && parts.length === 1 ? pages?.find((p) => p.slug === parts[0]) : undefined;
      if (page) {
        setPreviewPageId(page.id);
        return true;
      }
      return false;
    },
    [showsProduct, tab, pages],
  );

  const onPreviewSelect = useCallback((target: string) => {
    if (target === 'navbar') {
      setTab('navigation');
      setNavPart('desktop');
    } else if (target === 'footer' || target === 'announcement') {
      setTab(target);
    } else if (target === 'promises') {
      setTab('product');
    } else {
      setTab('home');
      setOpenSection(target);
    }
  }, []);

  /* ── States ── */

  if (loading) {
    return (
      <div className="sfe sfe-page" aria-busy="true">
        <div className="sfe-head">
          <h1>Storefront</h1>
          <p>Loading your shop’s layout…</p>
        </div>
        <div className="sfe-work">
          <div className="sfe-editor">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className="sfe-sk" style={{ height: 72 }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // A failed load must never fall through to the editor — an empty document
  // published here would overwrite the real storefront with nothing.
  if (loadError || !layout) {
    return (
      <div className="sfe sfe-page">
        <div className="sfe-head">
          <h1>Storefront</h1>
        </div>
        <div className="sfe-work">
          <div className="sfe-panel sfe-state" role="alert">
            <span className="sfe-state-ico">
              <AlertTriangle aria-hidden />
            </span>
            <h2>The storefront settings couldn’t load</h2>
            <p>{loadError ?? 'Storefront layout unavailable'}. Editing is paused so an empty page can’t be published over your real shop.</p>
            <button type="button" className="sfe-btn sfe-btn-primary" onClick={() => void load()}>
              <RotateCcw aria-hidden /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Preview per tab ── */

  const selectedPage = layout.pages.find((p) => p.id === previewPageId) ?? layout.pages[0] ?? null;
  const pv: { view: PreviewView; title: string; subtitle: string; highlight?: string | null; lock?: PreviewDevice } = (() => {
    switch (tab) {
      case 'navigation':
        return navPart === 'phone'
          ? { view: 'menu', title: 'Phone menu', subtitle: 'What opens from the menu icon on a phone', lock: 'phone' }
          : { view: 'home', title: 'Desktop menu bar', subtitle: 'The bar across the top of every page', highlight: 'navbar' };
      case 'footer':
        return { view: 'home', title: 'Footer', subtitle: 'The bottom of every page', highlight: 'footer' };
      case 'announcement':
        return { view: 'home', title: 'Announcement bar', subtitle: 'The thin bar above the menu', highlight: 'announcement' };
      case 'product':
      case 'trust':
        return { view: 'product', title: 'Product page', subtitle: 'A product as shoppers see it', highlight: tab === 'product' ? 'promises' : null };
      case 'pages':
        return { view: 'page', title: selectedPage?.title || 'Page', subtitle: selectedPage ? `minirueshop.com/${selectedPage.slug}` : 'No pages yet' };
      default:
        return { view: 'home', title: 'Home page', subtitle: 'Scroll to see every section', highlight: openSection };
    }
  })();

  const preview = (
    <PreviewPane
      layout={layout}
      view={pv.view}
      page={tab === 'pages' && selectedPage ? { slug: selectedPage.slug, title: selectedPage.title, body: selectedPage.body } : null}
      productSlug={previewProductSlug}
      highlight={pv.highlight ?? null}
      device={device}
      onDeviceChange={setDevice}
      lockDevice={pv.lock}
      onSelect={onPreviewSelect}
      onNavigate={onPreviewNavigate}
      title={pv.title}
      subtitle={`${pv.subtitle}. Unpublished changes included.`}
    />
  );

  const section = layout.sections.find((s) => s.id === openSection) ?? null;
  const sectionIndex = section ? layout.sections.indexOf(section) : -1;

  const renderEditor = (s: StorefrontSection) => {
    switch (s.type) {
      case 'hero':
        return <HeroEditor section={s} onChange={(next: HeroSection) => patchSection(s.id, next)} />;
      case 'ribbon':
        return <RibbonEditor section={s} onChange={(next: RibbonSection) => patchSection(s.id, next)} />;
      case 'productGrid':
        return <ProductGridEditor section={s} onChange={(next: ProductGridSection) => patchSection(s.id, next)} />;
      case 'journal':
        return <JournalEditor section={s} onChange={(next: JournalSection) => patchSection(s.id, next)} />;
      case 'collabShowcase':
        return <CollabShowcaseEditor section={s} onChange={(next: CollabShowcaseSection) => patchSection(s.id, next)} />;
    }
  };

  const altMissing = (s: StorefrontSection) => checks.filter((c) => c.focus?.sectionId === s.id).length;

  /* ── Tab bodies ── */

  const body = (() => {
    switch (tab) {
      case 'home': {
        const shown = layout.sections.filter((s) => s.enabled).length;
        return (
          <>
            <p className="sfe-answer">
              Shoppers see <b>{shown} of {layout.sections.length} sections</b>, top to bottom in this order. Click a section here, or in the preview, to edit it.
            </p>
            <section className="sfe-panel" aria-labelledby="h-sections">
              <div className="sfe-panel-h">
                <div>
                  <h2 id="h-sections">Home page sections</h2>
                  <span className="sfe-meta">Use the arrows to reorder. Hidden sections keep their settings.</span>
                </div>
              </div>
              {layout.sections.length === 0 && <p className="sfe-empty">No sections yet. Add one below.</p>}
              <ol className="sfe-rows">
                {layout.sections.map((s, i) => {
                  const Icon = SECTION_ICON[s.type];
                  const warn = altMissing(s);
                  return (
                    <li key={s.id} className={`sfe-row${s.enabled ? '' : ' sfe-row-hidden'}${openSection === s.id ? ' sfe-selected' : ''}`}>
                      <div className="sfe-move">
                        <button type="button" aria-label={`Move ${SECTION_LABELS[s.type]} up`} disabled={i === 0} onClick={() => patch({ sections: moveSection(layout.sections, i, -1) })}>
                          <ChevronUp aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${SECTION_LABELS[s.type]} down`}
                          disabled={i === layout.sections.length - 1}
                          onClick={() => patch({ sections: moveSection(layout.sections, i, 1) })}
                        >
                          <ChevronDown aria-hidden />
                        </button>
                      </div>
                      <div className="sfe-row-main">
                        <div className="sfe-row-top">
                          <span className={`sfe-pill sfe-t-${s.type}`}>
                            <Icon aria-hidden />
                            {SECTION_LABELS[s.type]}
                          </span>
                          <b className="sfe-ellipsis">{sectionTitle(s)}</b>
                          {warn > 0 && (
                            <span className="sfe-pill sfe-s-warn">
                              <AlertTriangle aria-hidden />
                              {warn} picture{warn > 1 ? 's' : ''} without a description
                            </span>
                          )}
                        </div>
                        <span className="sfe-summary">{sectionSummary(s)}</span>
                      </div>
                      <div className="sfe-row-act">
                        <Switch
                          checked={s.enabled}
                          onChange={(v) => {
                            patchSection(s.id, { ...s, enabled: v });
                            notify(v ? 'Section shown' : 'Section hidden. Settings kept');
                          }}
                          label={`Show ${SECTION_LABELS[s.type]}`}
                          stateLabels={['Shown', 'Hidden']}
                        />
                        <button type="button" className="sfe-btn sfe-btn-sm" onClick={() => setOpenSection(s.id)}>
                          <Pencil aria-hidden /> Edit
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
            <section className="sfe-panel" aria-labelledby="h-add">
              <div className="sfe-panel-h">
                <h2 id="h-add">Add a section</h2>
                <span className="sfe-meta">Added at the bottom, hidden until you switch it on</span>
              </div>
              <div className="sfe-panel-b sfe-add-grid">
                {SECTION_TYPES.map((type) => {
                  const Icon = SECTION_ICON[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      className="sfe-add"
                      onClick={() => {
                        const s = { ...newSection(type, layout.sections.length), enabled: false } as StorefrontSection;
                        patch({ sections: [...layout.sections, s] });
                        setOpenSection(s.id);
                        notify(`${SECTION_LABELS[type]} added, hidden until you switch it on`);
                      }}
                    >
                      <span className={`sfe-pill sfe-t-${type}`}>
                        <Icon aria-hidden />
                        {SECTION_LABELS[type]}
                      </span>
                      <small>{SECTION_HELP[type]}</small>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        );
      }
      case 'navigation':
        return (
          <>
            <p className="sfe-answer">
              Shoppers get two menus: a <b>bar across the top on desktop</b> and a <b>menu that slides up on phones</b>. Both are set here.
            </p>
            <div className="sfe-tg sfe-tg-lg" role="group" aria-label="Which menu">
              <button type="button" aria-pressed={navPart === 'desktop'} onClick={() => setNavPart('desktop')}>
                <Monitor aria-hidden /> Desktop menu bar
                {checks.some((c) => c.tab === 'navigation' && c.focus?.field?.startsWith('nav:')) && <span className="sfe-dot" aria-label="needs a look" />}
              </button>
              <button type="button" aria-pressed={navPart === 'phone'} onClick={() => setNavPart('phone')}>
                <Smartphone aria-hidden /> Phone menu
                {checks.some((c) => c.tab === 'navigation' && !c.focus?.field?.startsWith('nav:')) && <span className="sfe-dot" aria-label="needs a look" />}
              </button>
            </div>
            {navPart === 'desktop' ? (
              <NavbarEditor navbar={layout.navbar} onChange={(navbar) => patch({ navbar })} />
            ) : (
              <MobileMenuEditor mobileMenu={layout.mobileMenu ?? { shortcuts: [], footerButton: null }} onChange={(mobileMenu) => patch({ mobileMenu })} />
            )}
          </>
        );
      case 'footer':
        return (
          <>
            <p className="sfe-answer">
              The bottom of every page: {layout.footer.columns.length} link column{layout.footer.columns.length === 1 ? '' : 's'}
              {layout.footer.newsletterEnabled ? ', a newsletter sign-up' : ''}, social accounts and payment marks.
            </p>
            <FooterEditor footer={layout.footer} pages={layout.pages} onChange={(footer) => patch({ footer })} />
          </>
        );
      case 'announcement':
        return (
          <>
            <p className="sfe-answer">
              The thin black bar above the menu.{' '}
              {layout.announcement.enabled ? (
                <b>{layout.announcement.messages.length} message{layout.announcement.messages.length === 1 ? '' : 's'} rotate across it.</b>
              ) : (
                <b>It is switched off.</b>
              )}
            </p>
            <section className="sfe-panel" aria-labelledby="h-ann">
              <div className="sfe-panel-h">
                <h2 id="h-ann">Announcement bar</h2>
                <Switch
                  checked={layout.announcement.enabled}
                  onChange={(v) => patch({ announcement: { ...layout.announcement, enabled: v } })}
                  label="Announcement bar"
                  stateLabels={['Shown', 'Hidden']}
                />
              </div>
              <div className="sfe-panel-b">
                <label className="sfe-field">
                  <span className="sfe-label">Messages, one per line</span>
                  <AnnouncementMessagesField
                    messages={layout.announcement.messages}
                    onCommit={(messages) => patch({ announcement: { ...layout.announcement, messages } })}
                  />
                  <span className="sfe-hint">Short works best: under 40 characters each.</span>
                </label>
                <HrefTargetField
                  use="announcement"
                  label="Tapping the bar goes to (optional)"
                  optional
                  href={layout.announcement.linkUrl ?? ''}
                  pages={layout.pages ?? []}
                  onChange={(href) => patch({ announcement: { ...layout.announcement, linkUrl: href.trim() || null } })}
                />
                {/* The bar's colour is owned by the storefront theme (2026-07-24);
                    `announcement.background` is still saved untouched. */}
              </div>
            </section>
            <section className="sfe-panel" aria-labelledby="h-fav">
              <div className="sfe-panel-h">
                <h2 id="h-fav">Browser tab icon</h2>
              </div>
              <div className="sfe-panel-b">
                <label className="sfe-field">
                  <span className="sfe-label">Favicon address</span>
                  <input
                    className="sfe-input"
                    inputMode="url"
                    value={layout.faviconUrl ?? ''}
                    placeholder="https://…"
                    onChange={(e) => patch({ faviconUrl: e.target.value || null })}
                    onBlur={(e) => patch({ faviconUrl: e.target.value.trim() || null })}
                  />
                  <span className="sfe-hint">The small icon in the browser tab. A square PNG or ICO.</span>
                </label>
              </div>
            </section>
          </>
        );
      case 'product':
        return (
          <>
            <p className="sfe-answer">The promises under “Add to bag” on every product. The words are yours; the shop only shows each one where it is true today.</p>
            <ProductSectionEditor
              // A layout saved before this field existed has no productSection
              // until the API backfills it on read; never dereference undefined.
              section={layout.productSection ?? { perks: [] }}
              facts={{
                ...facts,
                returnsDays: layout.trust?.returnsWindowDays != null ? String(layout.trust.returnsWindowDays) : null,
                returnsIsSet: layout.trust?.returnsWindowDays != null,
              }}
              onChange={(productSection) => patch({ productSection })}
              onGoToTrust={() => {
                goTab('trust');
                focusKey('returnsWindowDays');
              }}
            />
          </>
        );
      case 'pages':
        return (
          <>
            <p className="sfe-answer">
              Standalone pages at <b>minirueshop.com/&lt;address&gt;</b>. A page with a problem can’t be published, so it is never silently lost.
            </p>
            <PagesEditor
              pages={layout.pages}
              onChange={(pages) => patch({ pages })}
              selectedId={selectedPage?.id ?? null}
              onSelect={setPreviewPageId}
              notify={notify}
            />
          </>
        );
      case 'trust':
        return (
          <>
            <p className="sfe-answer">
              The plain facts behind your promises. <b>Leave a field empty rather than guess</b>: the shop never claims something that isn’t set.
            </p>
            <div data-focus-key="returnsWindowDays">
              <TrustEditor trust={layout.trust} onChange={(trust) => patch({ trust })} />
            </div>
          </>
        );
    }
  })();

  const stateText = dirty
    ? `${changedTabs.length} area${changedTabs.length > 1 ? 's' : ''} changed · not live yet`
    : normalizedDrops
      ? 'Live · unfinished items waiting to be cleaned up'
      : 'Live · everything published';

  return (
    <div className="sfe sfe-page">
      <header className="sfe-head">
        <h1>Storefront</h1>
        <p>Everything shoppers see on minirueshop.com. Edit on the left, check it on the right, publish when ready.</p>
      </header>

      <div className="sfe-tabs" role="tablist" aria-label="Storefront areas">
        {TABS.map((t, i) => {
          const c = counts[t.id];
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`sfe-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="sfe-editor"
              tabIndex={tab === t.id ? 0 : -1}
              className="sfe-tab"
              onClick={() => goTab(t.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {t.label}
              {c && (
                <span className={`sfe-count${c.block ? ' sfe-count-bad' : ''}`} aria-label={`${c.n} to check`}>
                  {c.n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="sfe-bar" role="toolbar" aria-label="Publishing">
        <span className={`sfe-state ${dirty ? 'sfe-state-draft' : 'sfe-state-live'}`} role="status">
          <span className="sfe-state-dot" aria-hidden />
          {stateText}
        </span>
        <span className="sfe-bar-note">
          {dirty ? 'Shoppers still see the last published version.' : publishedAt ? `Published ${cairoTime(publishedAt)} (Cairo time)` : ''}
        </span>
        <span className="sfe-spacer" />
        <button type="button" className="sfe-btn sfe-pv-open" onClick={() => setPhonePreview(true)}>
          <Eye aria-hidden /> Preview
        </button>
        <a className="sfe-btn sfe-btn-quiet sfe-hide-phone" href={storefrontOrigin()} target="_blank" rel="noopener noreferrer">
          <ExternalLink aria-hidden /> View live site
        </a>
        <button type="button" className="sfe-btn sfe-hide-phone" disabled={!dirty || saving} onClick={discard}>
          Discard changes
        </button>
        <button type="button" className="sfe-btn sfe-btn-primary sfe-hide-phone" disabled={!publishable || saving} onClick={askPublish}>
          <Check aria-hidden /> Publish
        </button>
      </div>

      <div className="sfe-dq">
        <span>The live shop updates about a minute after you publish (it caches for 60 seconds).</span>
        <button
          type="button"
          className={`sfe-chip-toggle${blocking.length ? ' sfe-chip-bad' : warnings.length ? ' sfe-chip-warn' : ''}`}
          aria-expanded={checksOpen}
          aria-controls="sfe-checks"
          onClick={() => setChecksOpen((v) => !v)}
        >
          {blocking.length ? <Ban aria-hidden /> : warnings.length ? <AlertTriangle aria-hidden /> : <Check aria-hidden />}
          {blocking.length ? `${blocking.length} must fix` : ''}
          {blocking.length && warnings.length ? ' · ' : ''}
          {warnings.length ? `${warnings.length} to check` : ''}
          {!blocking.length && !warnings.length ? 'All checks pass' : ''}
          <ChevronDown aria-hidden className="sfe-chev" />
        </button>
        <button
          type="button"
          className="sfe-chip-toggle"
          aria-expanded={legendOpen}
          aria-controls="sfe-legend"
          onClick={() =>
            setLegendOpen((v) => {
              try {
                window.localStorage.setItem('mr-sfe-legend', v ? '0' : '1');
              } catch {
                /* per-viewer convenience only */
              }
              return !v;
            })
          }
        >
          <Info aria-hidden /> Legend <ChevronDown aria-hidden className="sfe-chev" />
        </button>
      </div>

      {saveError && (
        <p className="sfe-banner sfe-banner-bad" role="alert">
          Couldn’t publish: {saveError}. Nothing on the live shop changed, and your edits are still here.
        </p>
      )}
      {dropped && dropped.nav > 0 && (
        <p className="sfe-banner sfe-banner-warn" role="status">
          {dropped.nav === 1 ? '1 unfinished menu item was removed on save' : `${dropped.nav} unfinished menu items were removed on save`} — it had no page picked or
          no label, so there was nothing to show shoppers. Check the Navigation tab if that wasn&apos;t intended.
        </p>
      )}
      {dropped && dropped.menu > 0 && (
        <p className="sfe-banner sfe-banner-warn" role="status">
          {dropped.menu === 1 ? '1 unfinished mobile-menu tile was removed on save' : `${dropped.menu} unfinished mobile-menu tiles were removed on save`} — it had no
          destination picked or no label. Check the Navigation tab if that wasn&apos;t intended.
        </p>
      )}

      <div className={`sfe-ah${checksOpen ? ' sfe-open' : ''}`} id="sfe-checks">
        <div>
          <section className="sfe-fold" aria-labelledby="h-checks">
            <div className="sfe-fold-h">
              <h2 id="h-checks">Before you publish</h2>
              <button type="button" className="sfe-icon-btn" aria-label="Close checks" onClick={() => setChecksOpen(false)}>
                <X aria-hidden />
              </button>
            </div>
            <ul className="sfe-checks">
              {checks.length === 0 && (
                <li className="sfe-check">
                  <span className="sfe-ok">
                    <Check aria-hidden />
                  </span>
                  <div>
                    <b>Everything checks out</b>
                    <p>Nothing unfinished, no clashing addresses, no placeholders showing.</p>
                  </div>
                </li>
              )}
              {checks.map((c) => (
                <li key={c.id} className="sfe-check">
                  <span className={c.severity === 'block' ? 'sfe-bad' : c.severity === 'warn' ? 'sfe-warn' : 'sfe-info'}>
                    {c.severity === 'block' ? <Ban aria-hidden /> : c.severity === 'warn' ? <AlertTriangle aria-hidden /> : <Info aria-hidden />}
                  </span>
                  <div>
                    <b>{c.title}</b>
                    <p>{c.detail}</p>
                  </div>
                  <button type="button" className="sfe-btn sfe-btn-sm" onClick={() => fix(c)}>
                    Go to {tabLabel(c.tab)}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div className={`sfe-ah${legendOpen ? ' sfe-open' : ''}`} id="sfe-legend">
        <div>
          <Legend onClose={() => setLegendOpen(false)} />
        </div>
      </div>

      <div className="sfe-work">
        <main className="sfe-editor" id="sfe-editor" role="tabpanel" aria-labelledby={`sfe-tab-${tab}`}>
          {body}
        </main>
        <div className="sfe-pv-slot">{preview}</div>
      </div>

      <div className="sfe-mbar">
        <button type="button" className="sfe-btn" onClick={() => setPhonePreview(true)}>
          <Eye aria-hidden /> Preview
        </button>
        <button type="button" className="sfe-btn sfe-btn-primary" disabled={!publishable || saving} onClick={askPublish}>
          <Check aria-hidden /> Publish
        </button>
      </div>

      {section && (
        <Sheet
          scopeClassName="sfe"
          wide
          title={
            <span className="sfe-row-top">
              <span className={`sfe-pill sfe-t-${section.type}`}>{SECTION_LABELS[section.type]}</span>
              {sectionTitle(section)}
            </span>
          }
          subtitle={`${section.enabled ? 'Shown' : 'Hidden'} · section ${sectionIndex + 1} of ${layout.sections.length}`}
          onClose={() => {
            setOpenSection(null);
            setConfirmRemove(false);
          }}
          footer={
            <>
              <button type="button" className="sfe-btn sfe-btn-quiet sfe-danger-text" onClick={() => setConfirmRemove(true)}>
                <Trash2 aria-hidden /> Remove section
              </button>
              <button type="button" className="sfe-btn sfe-btn-primary" onClick={() => setOpenSection(null)}>
                Done
              </button>
            </>
          }
        >
          {confirmRemove && (
            <div className="sfe-confirm" role="alert">
              <p>
                <b>Remove “{SECTION_LABELS[section.type]}”?</b> Its settings are deleted. To keep them and just take it off the page, hide it instead.
              </p>
              <div className="sfe-row-inline">
                <button
                  type="button"
                  className="sfe-btn"
                  data-autofocus
                  onClick={() => {
                    patchSection(section.id, { ...section, enabled: false });
                    setConfirmRemove(false);
                    setOpenSection(null);
                    notify('Section hidden. Settings kept');
                  }}
                >
                  Hide instead
                </button>
                <button
                  type="button"
                  className="sfe-btn sfe-btn-danger"
                  onClick={() => {
                    const before = layout.sections;
                    patch({ sections: layout.sections.filter((x) => x.id !== section.id).map((x, i) => ({ ...x, order: i })) });
                    setConfirmRemove(false);
                    setOpenSection(null);
                    notify('Section removed', () => patch({ sections: before }));
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          )}
          <div className="sfe-legacy">{renderEditor(section)}</div>
        </Sheet>
      )}

      {publishOpen && (
        <Sheet
          scopeClassName="sfe"
          title="Publish to minirueshop.com"
          subtitle={dirty ? `${changedTabs.length} area${changedTabs.length > 1 ? 's' : ''} changed` : 'Cleaning up unfinished items'}
          onClose={() => setPublishOpen(false)}
          footer={
            <>
              <button type="button" className="sfe-btn" onClick={() => setPublishOpen(false)}>
                Not yet
              </button>
              <button type="button" className="sfe-btn sfe-btn-primary" data-autofocus disabled={saving} onClick={() => void publish()}>
                <Check aria-hidden /> {saving ? 'Publishing…' : 'Publish now'}
              </button>
            </>
          }
        >
          <ul className="sfe-checks">
            {changedTabs.map((t) => (
              <li key={t} className="sfe-check">
                <span className="sfe-ok">
                  <Pencil aria-hidden />
                </span>
                <div>
                  <b>{tabLabel(t)}</b>
                </div>
              </li>
            ))}
          </ul>
          {normalizedDrops > 0 && (
            <div className="sfe-banner sfe-banner-warn">
              {normalizedDrops} unfinished menu item{normalizedDrops > 1 ? 's' : ''} or tile{normalizedDrops > 1 ? 's' : ''} will be left out.
            </div>
          )}
          {warnings.length > 0 && (
            <p className="sfe-hint">
              {warnings.length} thing{warnings.length > 1 ? 's' : ''} to check (see “Before you publish”). They won’t stop publishing.
            </p>
          )}
          <p className="sfe-hint">Shoppers see the new version within about a minute.</p>
          {saving && (
            <div className="sfe-progress" role="progressbar" aria-label="Publishing">
              <i />
            </div>
          )}
          {saveError && (
            <p className="sfe-error" role="alert">
              Couldn’t publish: {saveError}
            </p>
          )}
        </Sheet>
      )}

      {phonePreview && (
        <Sheet scopeClassName="sfe" wide title="Preview" subtitle="Unpublished changes included" onClose={() => setPhonePreview(false)}>
          <div className="sfe-pv-in-sheet">{preview}</div>
        </Sheet>
      )}

      <div className="sfe-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="sfe-toast">
            <Check aria-hidden />
            <span>{t.msg}</span>
            {t.undo && (
              <button
                type="button"
                onClick={() => {
                  t.undo!();
                  setToasts((all) => all.filter((x) => x.id !== t.id));
                }}
              >
                Undo
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Legend: every pill, label and colour in this editor ─────────────────── */

function Legend({ onClose }: { onClose: () => void }) {
  const row = (k: React.ReactNode, t: string, key: string) => (
    <div className="sfe-lg-row" key={key}>
      <span className="sfe-lg-k">{k}</span>
      <span>{t}</span>
    </div>
  );
  return (
    <section className="sfe-fold" aria-labelledby="h-legend">
      <div className="sfe-fold-h">
        <h2 id="h-legend">Legend</h2>
        <button type="button" className="sfe-icon-btn" aria-label="Close legend" onClick={onClose}>
          <X aria-hidden />
        </button>
      </div>
      <div className="sfe-lg-grid">
        <div className="sfe-lg-g">
          <h3>Home page sections</h3>
          {SECTION_TYPES.map((t) => {
            const Icon = SECTION_ICON[t];
            return row(
              <span className={`sfe-pill sfe-t-${t}`}>
                <Icon aria-hidden />
                {SECTION_LABELS[t]}
              </span>,
              SECTION_HELP[t],
              t,
            );
          })}
        </div>
        <div className="sfe-lg-g">
          <h3>Where a link goes</h3>
          {(
            [
              ['category', 'A category page, e.g. Skincare'],
              ['brand', 'Every product of one brand'],
              ['product', 'One product page'],
              ['collaborator', 'A partner’s shop space'],
              ['page', 'One of your Pages, e.g. /shipping'],
              ['link', 'Any address you type'],
              ['home', 'Built into the shop: Home, Search, Cart, Account, All makers'],
            ] as const
          ).map(([k, t]) => row(<span className={`sfe-pill sfe-k-${k}`}>{TARGET_PILL[k]}</span>, t, k))}
        </div>
        <div className="sfe-lg-g">
          <h3>Status</h3>
          {row(<span className="sfe-pill sfe-s-ok"><Eye aria-hidden />Shown</span>, 'Visible on the live shop after you publish', 'shown')}
          {row(<span className="sfe-pill sfe-s-muted">Hidden</span>, 'Kept with its settings, not shown to shoppers', 'hidden')}
          {row(<span className="sfe-pill sfe-s-warn"><AlertTriangle aria-hidden />Unfinished</span>, 'Missing something. Left out, or shown oddly, until fixed', 'unf')}
          {row(<span className="sfe-pill sfe-s-bad"><Ban aria-hidden />Can’t publish</span>, 'Blocks publishing until fixed, e.g. a clashing page address', 'bad')}
          {row(<span className="sfe-state sfe-state-draft sfe-state-sm"><span className="sfe-state-dot" />Not live yet</span>, 'You have changes shoppers can’t see until you publish', 'draft')}
          {row(<span className="sfe-count">2</span>, 'On a tab: how many things there need a look (red: must fix)', 'count')}
        </div>
        <div className="sfe-lg-g">
          <h3>Product page promises</h3>
          {row(<span className="sfe-pill sfe-s-muted">Always</span>, 'Printed exactly as written, on every product', 'always')}
          {row(<span className="sfe-pill sfe-s-info"><Info aria-hidden />Only where true</span>, 'Shown only when the shop’s live settings make it true', 'cond')}
          {row(<span className="sfe-token">{'{deliveryDays}'}</span>, 'Filled in from Settings when the page loads. Never typed by hand', 'token')}
        </div>
      </div>
    </section>
  );
}

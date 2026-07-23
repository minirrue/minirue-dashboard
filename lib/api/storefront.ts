import { apiFetch } from './client';

export type SectionType =
  | 'hero'
  | 'ribbon'
  | 'collabShowcase'
  | 'productGrid'
  | 'journal';

export interface SectionBase {
  id: string;
  type: SectionType;
  enabled: boolean;
  order: number;
}

export type CtaTarget =
  | { kind: 'scroll' }
  | { kind: 'url'; url: string }
  | { kind: 'product'; productId: string }
  | { kind: 'category'; categoryId: string }
  | { kind: 'brand'; brandId: string };

export interface HeroSlide {
  id: string;
  eyebrow: string;
  headline: string;
  sub: string;
  tagline: string;
  /** 'image' renders imageGalleryItemId full-bleed; 'editorial' renders the bottle art on `background`. */
  mode: 'image' | 'editorial';
  imageGalleryItemId: string | null;
  /**
   * Alt text for the rendered image. Real content, not metadata — admin-authored
   * words, never derived from a filename or omitted.
   */
  imageAlt: string;
  /**
   * When mode is 'image' and imageGalleryItemId is null, the renderer shows this
   * slide's `background` colour. There is no bundled stock-photo fallback.
   */
  background: string;
  bottle: string | null;
  cap: string | null;
  ctaLabel: string | null;
  ctaTarget: CtaTarget;
}

export interface HeroSection extends SectionBase {
  type: 'hero';
  slides: HeroSlide[];
  autoplayMs: number;
  ariaLabel: string;
  /** null hides the scroll cue entirely rather than only renaming it. */
  scrollCueLabel: string | null;
}

export interface RibbonSection extends SectionBase {
  type: 'ribbon';
  items: string[];
  speedSeconds: number;
  surface: 'ink' | 'cream';
}

export type ProductSource =
  | { kind: 'category'; categoryId: string }
  | { kind: 'brand'; brandId: string }
  | { kind: 'manual'; productIds: string[] };

export interface ProductGridSection extends SectionBase {
  type: 'productGrid';
  eyebrow: string;
  title: string;
  /** 'brands' shows the source category's brands as cards instead of its items. */
  display: 'products' | 'brands';
  source: ProductSource;
  limit: number;
  viewAllHref: string | null;
}

export interface JournalSection extends SectionBase {
  type: 'journal';
  mode: 'editorial' | 'product';
  eyebrow: string;
  title: string;
  body: string;
  imageGalleryItemId: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  productId: string | null;
  imageSide: 'left' | 'right';
  /** Small overlay label on the image, e.g. "Editorial · N°4". null hides it. */
  badge: string | null;
}

export interface CollabShowcaseTab {
  collaboratorId: string;
  /** null = use the collaborator's own brand display name. */
  label: string | null;
  /** Empty = show the brand's newest items up to `limit`. */
  productIds: string[];
  limit: number;
}

export interface CollabShowcaseSection extends SectionBase {
  type: 'collabShowcase';
  eyebrow: string;
  title: string;
  tabs: CollabShowcaseTab[];
}

export type StorefrontSection =
  | HeroSection
  | RibbonSection
  | ProductGridSection
  | JournalSection
  | CollabShowcaseSection;

export type NavItem =
  | { id: string; kind: 'category'; categoryId: string; label: string }
  | { id: string; kind: 'brand'; brandId: string; label: string }
  | { id: string; kind: 'product'; productId: string; label: string }
  | { id: string; kind: 'collaborator'; collaboratorId: string; label: string }
  | { id: string; kind: 'link'; href: string; label: string };

export interface NavbarConfig {
  items: NavItem[];
  showSearch: boolean;
  showAccount: boolean;
}

export type SocialNetwork =
  | 'instagram' | 'tiktok' | 'facebook' | 'x' | 'youtube' | 'whatsapp' | 'pinterest';

export type PaymentBadge = 'visa' | 'mastercard' | 'instapay';

export interface FooterColumn {
  id: string;
  title: string;
  links: Array<{ id: string; label: string; href: string }>;
}

export interface FooterConfig {
  tagline: string | null;
  newsletterEnabled: boolean;
  newsletterEyebrow: string;
  newsletterBlurb: string;
  columns: FooterColumn[];
  socials: Array<{ id: string; network: SocialNetwork; url: string }>;
  paymentBadges: PaymentBadge[];
  legalLine: string;
  secondaryLine: string;
}

export interface AnnouncementConfig {
  enabled: boolean;
  messages: string[];
  linkUrl: string | null;
  background: string | null;
}

export interface StorefrontLayout {
  version: 2;
  announcement: AnnouncementConfig;
  faviconUrl: string | null;
  sections: StorefrontSection[];
  navbar: NavbarConfig;
  footer: FooterConfig;
}

let idCounter = 0;

/** Stable within a session and unique — the backend only requires uniqueness. */
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: 'Hero carousel',
  collabShowcase: 'Collaborator showcase',
  ribbon: 'Scrolling ribbon',
  productGrid: 'Product section',
  journal: 'The Journal',
};

export function newSection(type: SectionType, order: number): StorefrontSection {
  const base = { id: newId(type), enabled: true, order };
  switch (type) {
    case 'hero':
      return {
        ...base,
        type: 'hero',
        autoplayMs: 6000,
        ariaLabel: 'Featured collections',
        scrollCueLabel: 'Scroll',
        slides: [
          {
            id: newId('slide'),
            mode: 'editorial',
            eyebrow: '',
            headline: '',
            sub: '',
            tagline: '',
            imageGalleryItemId: null,
            imageAlt: '',
            background: '#0B0B0B',
            bottle: null,
            cap: null,
            ctaLabel: 'Shop the edit',
            ctaTarget: { kind: 'scroll' },
          },
        ],
      };
    case 'ribbon':
      return { ...base, type: 'ribbon', items: [], speedSeconds: 38, surface: 'ink' };
    case 'productGrid':
      return {
        ...base,
        type: 'productGrid',
        eyebrow: '',
        title: '',
        display: 'products',
        source: { kind: 'manual', productIds: [] },
        limit: 4,
        viewAllHref: '/products',
      };
    case 'journal':
      return {
        ...base,
        type: 'journal',
        mode: 'editorial',
        eyebrow: 'The Journal',
        title: '',
        body: '',
        imageGalleryItemId: null,
        ctaLabel: null,
        ctaHref: null,
        productId: null,
        imageSide: 'left',
        badge: null,
      };
    case 'collabShowcase':
      return { ...base, type: 'collabShowcase', eyebrow: '', title: '', tabs: [] };
  }
}

function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim() === '';
}

/**
 * A hero CTA target that names a product/category/brand but has no id yet
 * (the admin picked the kind but hasn't chosen the target) is invalid against
 * the backend's `.uuid()` schema. Rather than block the whole save, fall back
 * to the safe "scroll to products" default — losing the half-made choice is
 * acceptable and clearly better than a 400 that blocks every other edit.
 */
export function normalizeCtaTarget(target: CtaTarget): CtaTarget {
  if (target.kind === 'product' && isBlank(target.productId)) return { kind: 'scroll' };
  if (target.kind === 'category' && isBlank(target.categoryId)) return { kind: 'scroll' };
  if (target.kind === 'brand' && isBlank(target.brandId)) return { kind: 'scroll' };
  return target;
}

/** True when a nav item is missing its target id/href or its label — unsalvageable, not defaultable. */
function isIncompleteNavItem(item: NavItem): boolean {
  if (isBlank(item.label)) return true;
  switch (item.kind) {
    case 'category':
      return isBlank(item.categoryId);
    case 'brand':
      return isBlank(item.brandId);
    case 'product':
      return isBlank(item.productId);
    case 'collaborator':
      return isBlank(item.collaboratorId);
    case 'link':
      return isBlank(item.href);
  }
}

export interface NormalizeResult {
  layout: StorefrontLayout;
  /** Count of navbar items dropped for being unfinished. */
  droppedNavItemCount: number;
}

/**
 * Prepares a layout for `PATCH /v1/settings`: coerces half-finished hero CTA
 * targets to a safe default, and drops navbar items that have no sensible
 * default (missing target id/href, or missing label). Never mutates the
 * input — operates on a deep copy so on-screen state isn't touched.
 *
 * Invariant this guarantees: the returned layout can never contain an
 * empty-string uuid field (productId/categoryId/brandId/collaboratorId) or
 * an empty nav item label.
 */
export function normalizeStorefrontLayoutForSave(layout: StorefrontLayout): NormalizeResult {
  const next: StorefrontLayout = JSON.parse(JSON.stringify(layout));

  for (const section of next.sections) {
    if (section.type !== 'hero') continue;
    for (const slide of section.slides) {
      slide.ctaTarget = normalizeCtaTarget(slide.ctaTarget);
    }
  }

  let droppedNavItemCount = 0;
  const cleanNavList = (items: NavItem[]): NavItem[] =>
    items.filter((item) => {
      if (isIncompleteNavItem(item)) {
        droppedNavItemCount += 1;
        return false;
      }
      return true;
    });

  next.navbar = {
    ...next.navbar,
    items: cleanNavList(next.navbar.items),
  };

  return { layout: next, droppedNavItemCount };
}

export function moveSection(
  sections: StorefrontSection[],
  index: number,
  direction: -1 | 1,
): StorefrontSection[] {
  const target = index + direction;
  if (target < 0 || target >= sections.length) return sections;
  const next = [...sections];
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((s, i) => ({ ...s, order: i }));
}

interface SettingsEnvelope {
  storefront?: StorefrontLayout;
  [key: string]: unknown;
}

export async function apiGetStorefrontLayout(): Promise<StorefrontLayout> {
  const settings = await apiFetch<SettingsEnvelope>('/settings', { auth: true });
  if (!settings.storefront) {
    throw new Error('Store settings have no storefront layout — run the 0017 upgrade script');
  }
  return settings.storefront;
}

export async function apiSaveStorefrontLayout(
  layout: StorefrontLayout,
): Promise<StorefrontLayout> {
  const settings = await apiFetch<SettingsEnvelope>('/settings', {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ storefront: layout }),
  });
  return settings.storefront ?? layout;
}

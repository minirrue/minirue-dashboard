/**
 * One model for "where does this go when tapped", shared by every place in the
 * Storefront editor that picks a destination:
 *
 *   hero button (CtaTarget) · desktop menu item (NavItem) · phone menu tile and
 *   bottom button (MobileMenuTarget) · footer link and announcement link (href)
 *
 * These used to be four separate pickers with four kind lists, four label
 * tables and two copies of the "is it finished?" rule. The wire shapes stay
 * exactly as the backend stores them — only the editor side is unified, via
 * the adapters below.
 */
import type { CtaTarget, MobileMenuTarget, NavItem, StorefrontPage } from '@/lib/api/storefront';

export type TargetKind =
  | 'scroll'
  | 'home'
  | 'search'
  | 'account'
  | 'cart'
  | 'brands'
  | 'page'
  | 'category'
  | 'brand'
  | 'product'
  | 'collaborator'
  | 'link';

/** A destination in editor terms. `id` for catalogue entities, `href` for pages and links. */
export interface Target {
  kind: TargetKind;
  id?: string;
  href?: string;
}

export type TargetUse = 'cta' | 'nav' | 'menu' | 'footer' | 'announcement';

/** Which destinations each place may offer — exactly what its backend schema accepts. */
export const TARGET_KINDS: Record<TargetUse, TargetKind[]> = {
  cta: ['scroll', 'product', 'category', 'brand', 'link'],
  nav: ['category', 'brand', 'product', 'collaborator', 'link'],
  menu: ['home', 'search', 'account', 'cart', 'brands', 'category', 'brand', 'product', 'collaborator', 'link'],
  footer: ['page', 'category', 'brand', 'link'],
  announcement: ['page', 'category', 'brand', 'link'],
};

export const TARGET_LABELS: Record<TargetKind, string> = {
  scroll: 'Scroll to the products below',
  home: 'Home',
  search: 'Search',
  account: 'Account',
  cart: 'Cart',
  brands: 'All makers (/collab)',
  page: 'A shop page',
  category: 'A category',
  brand: 'A brand',
  product: 'A product',
  collaborator: 'A collaborator brand',
  link: 'Custom link',
};

/** Short names for pills and the legend. */
export const TARGET_PILL: Record<TargetKind, string> = {
  scroll: 'Scroll',
  home: 'Built-in',
  search: 'Built-in',
  account: 'Built-in',
  cart: 'Built-in',
  brands: 'Built-in',
  page: 'Page',
  category: 'Category',
  brand: 'Brand',
  product: 'Product',
  collaborator: 'Collaborator',
  link: 'Link',
};

const BUILT_IN: ReadonlySet<TargetKind> = new Set(['scroll', 'home', 'search', 'account', 'cart', 'brands']);

export const isBuiltIn = (kind: TargetKind): boolean => BUILT_IN.has(kind);
export const needsEntity = (kind: TargetKind): kind is 'category' | 'brand' | 'product' | 'collaborator' =>
  kind === 'category' || kind === 'brand' || kind === 'product' || kind === 'collaborator';

const blank = (v: string | undefined | null): boolean => !v || v.trim() === '';

/** The one "is this destination finished?" rule. Built-ins need nothing beyond the kind. */
export function isTargetComplete(t: Target): boolean {
  if (isBuiltIn(t.kind)) return true;
  if (needsEntity(t.kind)) return !blank(t.id);
  return !blank(t.href);
}

export function blankTarget(kind: TargetKind): Target {
  if (isBuiltIn(kind)) return { kind };
  if (needsEntity(kind)) return { kind, id: '' };
  return { kind, href: '' };
}

/* ── Adapters to and from the stored shapes ─────────────────────────────── */

export function fromCta(c: CtaTarget): Target {
  switch (c.kind) {
    case 'scroll': return { kind: 'scroll' };
    case 'url': return { kind: 'link', href: c.url };
    case 'product': return { kind: 'product', id: c.productId };
    case 'category': return { kind: 'category', id: c.categoryId };
    case 'brand': return { kind: 'brand', id: c.brandId };
  }
}

export function toCta(t: Target): CtaTarget {
  switch (t.kind) {
    case 'link': return { kind: 'url', url: t.href ?? '' };
    case 'product': return { kind: 'product', productId: t.id ?? '' };
    case 'category': return { kind: 'category', categoryId: t.id ?? '' };
    case 'brand': return { kind: 'brand', brandId: t.id ?? '' };
    default: return { kind: 'scroll' };
  }
}

export function fromNav(item: NavItem): Target {
  switch (item.kind) {
    case 'category': return { kind: 'category', id: item.categoryId };
    case 'brand': return { kind: 'brand', id: item.brandId };
    case 'product': return { kind: 'product', id: item.productId };
    case 'collaborator': return { kind: 'collaborator', id: item.collaboratorId };
    case 'link': return { kind: 'link', href: item.href };
  }
}

/** Rebuilds a nav item for a new destination, keeping its id and label (and featured products while it stays a category). */
export function toNavItem(t: Target, prev: NavItem): NavItem {
  const base = { id: prev.id, label: prev.label };
  switch (t.kind) {
    case 'category':
      return {
        ...base,
        kind: 'category',
        categoryId: t.id ?? '',
        featuredProductIds: prev.kind === 'category' ? prev.featuredProductIds ?? [] : [],
      };
    case 'brand': return { ...base, kind: 'brand', brandId: t.id ?? '' };
    case 'product': return { ...base, kind: 'product', productId: t.id ?? '' };
    case 'collaborator': return { ...base, kind: 'collaborator', collaboratorId: t.id ?? '' };
    default: return { ...base, kind: 'link', href: t.href ?? '' };
  }
}

export function fromMenu(m: MobileMenuTarget): Target {
  switch (m.kind) {
    case 'category': return { kind: 'category', id: m.categoryId };
    case 'brand': return { kind: 'brand', id: m.brandId };
    case 'product': return { kind: 'product', id: m.productId };
    case 'collaborator': return { kind: 'collaborator', id: m.collaboratorId };
    case 'link': return { kind: 'link', href: m.href };
    default: return { kind: m.kind };
  }
}

export function toMenu(t: Target): MobileMenuTarget {
  switch (t.kind) {
    case 'home': case 'search': case 'account': case 'cart': case 'brands':
      return { kind: t.kind };
    case 'category': return { kind: 'category', categoryId: t.id ?? '' };
    case 'brand': return { kind: 'brand', brandId: t.id ?? '' };
    case 'product': return { kind: 'product', productId: t.id ?? '' };
    case 'collaborator': return { kind: 'collaborator', collaboratorId: t.id ?? '' };
    default: return { kind: 'link', href: t.href ?? '' };
  }
}

/* ── Plain hrefs (footer links, announcement link) ──────────────────────── */

/**
 * Canonical storefront addresses, matching the storefront's own routes
 * (minirue-frontend next.config redirects): `/categories/:slug` → `/shop/:slug`,
 * `/products` → `/shop/all`. New links are written canonical so shoppers never
 * pass through a 308; old saved links are still recognised below.
 */
export const hrefFor = {
  page: (slug: string) => `/${slug.replace(/^\//, '')}`,
  category: (slug: string) => `/shop/${slug}`,
  /**
   * By id, not name: the storefront's listing treats `brandId` as the scoped
   * filter and `brand` (a case-sensitive name match) as legacy — a rename would
   * silently empty a name-based link. The picker only has the id anyway.
   */
  brand: (id: string) => `/shop/all?brandId=${encodeURIComponent(id)}`,
};

export type HrefKind = 'page' | 'category' | 'brand' | 'link';

const CATEGORY_HREF = /^\/(?:shop|categories)\/([^/?#]+)\/?$/;
const isBrandHref = (v: string) =>
  (/^\/(shop\/all|products)\b/.test(v) && /[?&]brand(Id)?=/.test(v)) || /^\/brands\/[^/?#]+\/?$/.test(v);

/** Which kind an already-saved href came from, so editing opens on the right option. */
export function kindOfHref(href: string, pageSlugs: string[]): HrefKind {
  const v = (href ?? '').trim();
  if (!v) return 'page';
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return 'link';
  if (isBrandHref(v)) return 'brand';
  if (CATEGORY_HREF.test(v) && !v.startsWith('/shop/all')) return 'category';
  if (pageSlugs.includes(v.replace(/^\//, ''))) return 'page';
  return 'link';
}

/**
 * Whether a kind the owner chose can still describe the stored href. An empty
 * href suits every kind (they just picked it); any href suits a custom link.
 * Used to keep a deliberate choice instead of snapping back to the inferred one.
 */
export function kindCanHold(kind: TargetKind, href: string, pageSlugs: string[]): boolean {
  const v = (href ?? '').trim();
  if (!v || kind === 'link') return true;
  return kindOfHref(v, pageSlugs) === kind;
}

/** Slug of a category href, old or new form. */
export function categorySlugOfHref(href: string): string | null {
  const m = CATEGORY_HREF.exec((href ?? '').trim());
  return m ? decodeURIComponent(m[1]) : null;
}

/** What a brand href names: an id (canonical), or a legacy name/slug to resolve. */
export function brandRefOfHref(href: string): { id?: string; nameOrSlug?: string } | null {
  const v = (href ?? '').trim();
  const id = /[?&]brandId=([^&#]+)/.exec(v);
  if (id) return { id: decodeURIComponent(id[1]) };
  const name = /[?&]brand=([^&#]+)/.exec(v);
  if (name) return { nameOrSlug: decodeURIComponent(name[1].replace(/\+/g, ' ')) };
  const slug = /^\/brands\/([^/?#]+)\/?$/.exec(v);
  if (slug) return { nameOrSlug: decodeURIComponent(slug[1]) };
  return null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Finds the brand a saved href means, so a legacy link opens on the right brand and re-saves canonical. */
export function resolveBrandHref(href: string, brands: Array<{ id: string; label: string }>): string {
  const ref = brandRefOfHref(href);
  if (!ref) return '';
  if (ref.id) return brands.some((b) => b.id === ref.id) ? hrefFor.brand(ref.id) : '';
  const hit = brands.find((b) => norm(b.label) === norm(ref.nameOrSlug ?? ''));
  return hit ? hrefFor.brand(hit.id) : '';
}

export function pageSlugs(pages: StorefrontPage[]): string[] {
  return pages.map((p) => p.slug.trim()).filter(Boolean);
}

/* ── Lists ──────────────────────────────────────────────────────────────── */

/** The one reorder helper (sections, slides, menu items, columns, tiles, perks). */
export function moveInList<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

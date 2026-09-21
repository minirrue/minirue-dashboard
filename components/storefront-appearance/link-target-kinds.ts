/**
 * The one vocabulary for "where does this link go" in Storefront Appearance.
 *
 * ## Why this file exists
 *
 * The tab currently holds four separate, partly-overlapping answers:
 *
 *   - `NavItem['kind']`          — 5 kinds  (NavbarEditor.tsx:29-35, picker :71-142)
 *   - `CtaTarget['kind']`        — 5 kinds  (CtaTargetField.tsx:18-72)
 *   - `MobileMenuTarget['kind']` — 10 kinds (MobileMenuEditor.tsx:29-42, :142-209)
 *   - `LinkKind`                 — 4 kinds  (pickers/LinkTargetField.tsx:15, :56-134)
 *
 * Each one re-declares its own kind list, its own blank-value factory, its own
 * conditional picker and — where it builds URLs at all — its own idea of what a
 * category or a brand URL looks like. Four lists that mean one thing is how
 * `/products?brand=<label>` came to be emitted by one of them long after
 * `/products` became a permanent redirect.
 *
 * So the kinds live here once, as a registry that each call site *subsets*
 * rather than restates, together with the blank-value factory, the canonical
 * URL for each kind, and the inference that reads a stored URL back.
 *
 * ## The id-vs-href split, and why the registry is honest about it
 *
 * The four call sites do not store the same thing, and no amount of wishing
 * makes them:
 *
 *   - `NavItem`, `CtaTarget` and `MobileMenuTarget` store a **structured
 *     target** — an entity id (`categoryId`, `brandId`, `productId`,
 *     `collaboratorId`) that the storefront resolves at render time.
 *   - `LinkTargetField` (footer links) stores a **plain href string**, built
 *     from a slug.
 *
 * Both are projections of the same target. The structured form is the richer
 * one; the href is a *partial* projection of it, and the registry says exactly
 * where it stops:
 *
 *   - `product` needs `/shop/<categorySlug>/<productSlug>` and the product
 *     picker supplies neither slug (see `EntityPicker.fetchOptions`, which maps
 *     products to `{ id, label }`). There is no href for it.
 *   - `collaborator` needs `/collab/<slug>`; the collaborator picker likewise
 *     supplies only `{ id, label }`.
 *   - `scroll` is in-page behaviour on a hero CTA. It is not a URL at all.
 *
 * Those three are therefore **structured-only** — `hrefForTarget` returns
 * `null` for them, they are absent from {@link HREF_LINK_KINDS}, and
 * {@link targetFromHref} never produces one. That last point is what makes the
 * href projection safe: round-tripping an href through the registry is total
 * over `HREF_LINK_KINDS`, so no href-storing call site can be handed a target
 * it cannot write back.
 *
 * ## The canonical URL shapes, and where they come from
 *
 * The authority is the storefront's own route table — `next.config.ts`
 * `redirects()` and `lib/routes.ts` in the sibling minirue-frontend repo, both
 * read on 2026-09-21. Every permanent (308) redirect there is a URL this tab
 * must never *emit*, and must always still *understand*:
 *
 *   | entity        | canonical                     | legacy, 308s to it            |
 *   |---------------|-------------------------------|-------------------------------|
 *   | page          | `/<slug>`                     | `/pages/<slug>`               |
 *   | category      | `/shop/<slug>`                | `/categories/<slug>`          |
 *   | brand         | `/shop/all?brandId=<id>`      | `/products?brand=<name>`,     |
 *   |               |                               | `/shop/all?brand=<name>`,     |
 *   |               |                               | `/brands/<slug>`              |
 *   | brands index  | `/collab`                     | `/brands`                     |
 *
 * The brand row is the one that was actually broken, and it is worth saying why
 * `?brandId=` rather than `?brand=`. The storefront's own listing page
 * documents it at `app/shop/all/page.tsx:85-113`: `brandId` is "the scoped
 * filter a house brand tile links with", `brand` (by name) is "legacy", and the
 * name filter compiles to a case-SENSITIVE `eq(brands.name, brand)` scoped to
 * house brands. A link built from a name therefore breaks the moment the brand
 * is renamed or its capitalisation is corrected, and breaks *silently* — an
 * empty listing, not a 404. The id survives both. It is also the only shape the
 * brand picker can actually produce: brand options carry `{ id, label }` and no
 * slug, so `?brandId=` is simultaneously the most robust shape and the only one
 * expressible from the data in hand.
 */

import { slugify } from '@/lib/api/storefront';
import type { EntityKind, EntityOption } from '@/app/dashboard/storefront-appearance/pickers/EntityPicker';

/* ------------------------------------------------------------------ */
/* The kinds                                                           */
/* ------------------------------------------------------------------ */

/**
 * Every destination any of the four call sites can express, named once.
 *
 * The custom-link kind is spelled `url` here because that is what `CtaTarget`
 * calls it. `MobileMenuTarget` and `NavItem` spell the same thing `link` with
 * an `href` field; {@link readStoredTarget} accepts that spelling and
 * {@link writeStoredTarget} puts it back, so neither call site has to be
 * rewritten to use this registry and neither has to lie about what it stores.
 */
export type LinkTargetKind =
  | 'home'
  | 'search'
  | 'account'
  | 'cart'
  | 'brands'
  | 'scroll'
  | 'page'
  | 'category'
  | 'brand'
  | 'product'
  | 'collaborator'
  | 'url';

/**
 * The canonical value for one target.
 *
 * The optional slug/name fields on `category` and `brand` exist for exactly one
 * reason: a URL saved in a legacy shape carries a slug or a name and no id, and
 * dropping it on read would blank the picker in front of an admin whose link is
 * in fact perfectly well aimed. They are resolved to an id against the live
 * option lists by {@link resolveTarget} as soon as those load, and the next save
 * writes the canonical id form.
 */
export type LinkTargetValue =
  | { kind: 'home' }
  | { kind: 'search' }
  | { kind: 'account' }
  | { kind: 'cart' }
  | { kind: 'brands' }
  | { kind: 'scroll' }
  | { kind: 'page'; slug: string }
  | { kind: 'category'; categoryId: string; categorySlug?: string }
  | { kind: 'brand'; brandId: string; brandName?: string; brandSlug?: string }
  | { kind: 'product'; productId: string }
  | { kind: 'collaborator'; collaboratorId: string }
  | { kind: 'url'; url: string };

/**
 * What a call site may hand in: the canonical value, or the `{ kind: 'link';
 * href }` spelling that `NavItem` and `MobileMenuTarget` already store.
 */
export type StoredLinkTarget = LinkTargetValue | { kind: 'link'; href: string };

/** Which spelling of the custom-link kind a call site stores. */
export type CustomLinkDialect = 'url' | 'link';

export interface LinkKindSpec {
  kind: LinkTargetKind;
  /** Default wording. Overridable per call site — see `kindLabels`. */
  label: string;
  /** The picker this kind needs, when it needs one. */
  entity?: EntityKind;
  /**
   * The canonical path, for the kinds that are a fixed route. `null` marks a
   * kind whose URL depends on which entity was chosen, or that has no URL.
   */
  path: string | null;
}

/**
 * The registry. A call site names the subset it offers and in what order; it
 * never restates what a kind *is*.
 *
 * `brands` resolves to `/collab`, not `/brands`: `/brands` was retired on
 * 2026-08-21 and 308s to `/collab` (next.config.ts, "`/brands` retired"), so
 * emitting `/brands` would put every mobile-menu tile behind a redirect for the
 * same reason the footer brand links were.
 */
export const LINK_TARGET_KINDS: Record<LinkTargetKind, LinkKindSpec> = {
  home: { kind: 'home', label: 'Home', path: '/' },
  search: { kind: 'search', label: 'Search', path: '/search' },
  account: { kind: 'account', label: 'Account', path: '/account' },
  cart: { kind: 'cart', label: 'Cart', path: '/cart' },
  brands: { kind: 'brands', label: 'Brands index', path: '/collab' },
  scroll: { kind: 'scroll', label: 'Scroll to the products below', path: null },
  page: { kind: 'page', label: 'Shop page', path: null },
  category: { kind: 'category', label: 'Category', entity: 'category', path: null },
  brand: { kind: 'brand', label: 'Brand', entity: 'brand', path: null },
  product: { kind: 'product', label: 'Product', entity: 'product', path: null },
  collaborator: {
    kind: 'collaborator',
    label: 'Collaborator brand',
    entity: 'collaborator',
    path: null,
  },
  url: { kind: 'url', label: 'Custom link', path: null },
};

/** Registry order. A call site subsets this; it does not reorder it casually. */
export const ALL_LINK_TARGET_KINDS = Object.keys(LINK_TARGET_KINDS) as LinkTargetKind[];

/**
 * The kinds that have an href projection, and so the only kinds an
 * href-storing call site may offer. See the id-vs-href note at the top.
 */
export const HREF_LINK_KINDS: readonly LinkTargetKind[] = [
  'page',
  'category',
  'brand',
  'home',
  'search',
  'account',
  'cart',
  'brands',
  'url',
];

export function isHrefKind(kind: LinkTargetKind): boolean {
  return HREF_LINK_KINDS.includes(kind);
}

/** The backend's maximum for every href column in the layout document. */
export const HREF_MAX_LENGTH = 500;

/* ------------------------------------------------------------------ */
/* Blank values and kind changes                                       */
/* ------------------------------------------------------------------ */

/** The empty value for a kind — the one blank-value factory for all four. */
export function blankTarget(kind: LinkTargetKind): LinkTargetValue {
  switch (kind) {
    case 'page':
      return { kind: 'page', slug: '' };
    case 'category':
      return { kind: 'category', categoryId: '' };
    case 'brand':
      return { kind: 'brand', brandId: '' };
    case 'product':
      return { kind: 'product', productId: '' };
    case 'collaborator':
      return { kind: 'collaborator', collaboratorId: '' };
    case 'url':
      return { kind: 'url', url: '' };
    default:
      return { kind } as LinkTargetValue;
  }
}

/**
 * What the target becomes when the admin picks a kind from the dropdown.
 *
 * **Re-picking the kind already chosen returns the current target unchanged,
 * by identity.** That is the fix for `LinkTargetField.tsx:60-66`, which called
 * `onChange('')` on every `change` event from the kind select, including one
 * that selected the option already selected — so choosing "Brand" on a link
 * that was already a brand link wiped the saved href. The caller emits only
 * when the returned target is not the one passed in.
 *
 * A kind that genuinely changed does still blank the value, deliberately: a
 * `/shop/beauty` left over from the category kind is not a valid brand link,
 * and carrying it across would save a path under a kind that cannot mean it.
 */
export function nextTargetForKind(
  current: LinkTargetValue,
  kind: LinkTargetKind,
): LinkTargetValue {
  return current.kind === kind ? current : blankTarget(kind);
}

/* ------------------------------------------------------------------ */
/* The two stored dialects                                             */
/* ------------------------------------------------------------------ */

/** Read either stored spelling into the canonical value. */
export function readStoredTarget(raw: StoredLinkTarget): {
  target: LinkTargetValue;
  dialect: CustomLinkDialect;
} {
  if (raw.kind === 'link') {
    return { target: { kind: 'url', url: raw.href }, dialect: 'link' };
  }
  return { target: raw, dialect: 'url' };
}

/** Write the canonical value back in the dialect the call site stores. */
export function writeStoredTarget(
  target: LinkTargetValue,
  dialect: CustomLinkDialect,
): StoredLinkTarget {
  if (target.kind === 'url' && dialect === 'link') {
    return { kind: 'link', href: target.url };
  }
  return target;
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

/**
 * What the href codec needs to turn ids into slugs and back.
 *
 * All of it is optional: inference is deliberately *structural* and never
 * depends on a list having loaded, so the kind shown in the dropdown is correct
 * on the first frame rather than flickering when the category list arrives.
 * The lists are used only to resolve an id, which affects what the entity
 * picker highlights, not which picker is shown.
 */
export interface LinkTargetContext {
  /** The shop's own page slugs, without the leading slash. */
  pageSlugs?: readonly string[];
  /** From `useEntityOptions('category')` — these carry `slug`. */
  categories?: readonly EntityOption[];
  /** From `useEntityOptions('brand')` — `{ id, label }`, never a slug. */
  brands?: readonly EntityOption[];
}

const EMPTY_CONTEXT: LinkTargetContext = {};

/* ------------------------------------------------------------------ */
/* Canonical URL for a target                                          */
/* ------------------------------------------------------------------ */

function categorySlugFor(
  target: Extract<LinkTargetValue, { kind: 'category' }>,
  ctx: LinkTargetContext,
): string {
  if (target.categoryId) {
    const hit = ctx.categories?.find((c) => c.id === target.categoryId);
    if (hit?.slug) return hit.slug;
  }
  return target.categorySlug ?? '';
}

/**
 * The URL a target points at, or `null` when the kind has no URL at all.
 *
 * `null` and `''` mean different things and the distinction is load-bearing:
 * `null` is "this kind cannot be an href" (a caller storing hrefs must not
 * offer it), while `''` is "this kind can, but nothing has been chosen yet".
 */
export function hrefForTarget(
  target: LinkTargetValue,
  ctx: LinkTargetContext = EMPTY_CONTEXT,
): string | null {
  const spec = LINK_TARGET_KINDS[target.kind];
  if (spec.path !== null) return spec.path;

  switch (target.kind) {
    case 'page':
      return target.slug ? `/${target.slug.replace(/^\/+/, '')}` : '';
    case 'category': {
      const slug = categorySlugFor(target, ctx);
      return slug ? `/shop/${slug}` : '';
    }
    case 'brand':
      // Never `?brand=<name>` again — see the header note.
      return target.brandId ? `/shop/all?brandId=${encodeURIComponent(target.brandId)}` : '';
    case 'url':
      return target.url;
    default:
      // product, collaborator, scroll — structured-only.
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Inference                                                           */
/* ------------------------------------------------------------------ */

function splitHref(href: string): { path: string; query: URLSearchParams } {
  const at = href.indexOf('?');
  if (at === -1) return { path: href, query: new URLSearchParams() };
  return {
    path: href.slice(0, at),
    query: new URLSearchParams(href.slice(at + 1)),
  };
}

function brandFromQuery(query: URLSearchParams): LinkTargetValue | null {
  const brandId = (query.get('brandId') ?? '').trim();
  if (brandId) return { kind: 'brand', brandId };
  const brandName = (query.get('brand') ?? '').trim();
  if (brandName) return { kind: 'brand', brandId: '', brandName };
  return null;
}

/**
 * Read a stored href back into a target.
 *
 * Only ever returns a kind in {@link HREF_LINK_KINDS}, so the round trip
 * `targetFromHref` → `hrefForTarget` is total: an href-storing call site can
 * never be handed a target it has no way to write back. `/collab/<slug>` is
 * therefore a custom link rather than a `collaborator` target — the
 * collaborator picker has no slug to match it against, so claiming the kind
 * would show an empty picker over a perfectly good link.
 *
 * Every legacy shape in the table at the top of this file is recognised. That
 * is the half of the brand fix that matters to links already saved: the picker
 * emits `/shop/all?brandId=…` from now on, and the thousands of
 * `/products?brand=…` hrefs already in the database still open on "Brand" with
 * the right brand highlighted.
 */
export function targetFromHref(
  href: string,
  ctx: LinkTargetContext = EMPTY_CONTEXT,
): LinkTargetValue {
  const raw = (href ?? '').trim();
  if (!raw) return { kind: 'page', slug: '' };
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) {
    return { kind: 'url', url: raw };
  }

  const { path, query } = splitHref(raw);
  const clean = path.replace(/\/+$/, '') || '/';
  const segments = clean.split('/').filter(Boolean);

  if (clean === '/') return { kind: 'home' };
  if (clean === '/search') return { kind: 'search' };
  if (clean === '/account') return { kind: 'account' };
  if (clean === '/cart') return { kind: 'cart' };
  // `/brands` 308s to `/collab`; both mean the makers index.
  if (clean === '/brands' || clean === '/collab') return { kind: 'brands' };

  // Brand filters. `/products` 308s to `/shop/all`, carrying its query with it,
  // so the two paths are one shape wearing two addresses.
  if (clean === '/shop/all' || clean === '/products') {
    const brand = brandFromQuery(query);
    if (brand) return brand;
    return { kind: 'url', url: raw };
  }

  // `/brands/<slug>` 308s to `/<slug>`, which is now a partner space. It was
  // nonetheless accepted as a brand link by the old `inferLinkKind` (:24), so
  // it is still read as one — resolved by slugified label, best effort, so an
  // admin sees the brand they meant rather than an empty picker.
  if (segments.length === 2 && segments[0] === 'brands') {
    return { kind: 'brand', brandId: '', brandSlug: segments[1] };
  }

  // A category: `/shop/<slug>`, or the `/categories/<slug>` that 308s to it.
  if (segments.length === 2 && (segments[0] === 'shop' || segments[0] === 'categories')) {
    return { kind: 'category', categoryId: '', categorySlug: segments[1] };
  }

  // The shop's own pages: `/<slug>`, or the `/pages/<slug>` that 308s to it.
  const slugs = ctx.pageSlugs ?? [];
  if (segments.length === 2 && segments[0] === 'pages' && slugs.includes(segments[1])) {
    return { kind: 'page', slug: segments[1] };
  }
  if (segments.length === 1 && slugs.includes(segments[0])) {
    return { kind: 'page', slug: segments[0] };
  }

  return { kind: 'url', url: raw };
}

/**
 * Which kind a stored href belongs to.
 *
 * The drop-in replacement for `pickers/LinkTargetField.tsx:19`, which took a
 * bare `string[]` of page slugs; this takes the whole context instead so a call
 * site gains category and brand resolution without another signature change.
 */
export function inferLinkKind(
  href: string,
  ctx: LinkTargetContext = EMPTY_CONTEXT,
): LinkTargetKind {
  return targetFromHref(href, ctx).kind;
}

/**
 * Whether a kind is still a truthful description of a stored href.
 *
 * This is the test behind the second defect's fix. `LinkTargetField.tsx:43`
 * seeded its kind with `useState(() => inferLinkKind(href, pageSlugs))` and
 * never looked again — but the client replaces the whole layout after a save
 * (`setLayout(result)`), so an href that comes back re-inferring differently
 * left the dropdown describing a value that was no longer there.
 *
 * Re-deriving the kind unconditionally would be the wrong cure: an empty href
 * infers as `page`, so an admin who picks "Custom link" and has not yet typed
 * anything would watch the dropdown snap back on the next render. Hence this
 * asymmetry — an empty href is representable by every kind, and any href at all
 * is representable as a custom link, so the admin's choice survives exactly as
 * long as it remains true of what is stored.
 */
export function canKindRepresentHref(
  kind: LinkTargetKind,
  href: string,
  ctx: LinkTargetContext = EMPTY_CONTEXT,
): boolean {
  if (!(href ?? '').trim()) return true;
  if (kind === 'url') return true;
  return targetFromHref(href, ctx).kind === kind;
}

/* ------------------------------------------------------------------ */
/* Resolving a legacy target against the live option lists             */
/* ------------------------------------------------------------------ */

/**
 * Fill in the entity id a legacy URL did not carry.
 *
 * A brand match is tried by exact name first — the storefront's name filter is
 * case-sensitive, so the exact spelling is the one that was actually working —
 * then case-insensitively, then by slugified label for the `/brands/<slug>`
 * shape. Widening beyond the exact match cannot break a link, because the
 * result is only ever used to highlight a picker row and to write the id form.
 */
export function resolveTarget(
  target: LinkTargetValue,
  ctx: LinkTargetContext = EMPTY_CONTEXT,
): LinkTargetValue {
  if (target.kind === 'category' && !target.categoryId && target.categorySlug) {
    const hit = ctx.categories?.find((c) => c.slug === target.categorySlug);
    return hit ? { ...target, categoryId: hit.id } : target;
  }

  if (target.kind === 'brand' && !target.brandId) {
    const brands = ctx.brands ?? [];
    if (target.brandName) {
      const exact = brands.find((b) => b.label === target.brandName);
      const loose =
        exact ??
        brands.find((b) => b.label.toLowerCase() === target.brandName!.toLowerCase());
      return loose ? { ...target, brandId: loose.id } : target;
    }
    if (target.brandSlug) {
      const hit = brands.find((b) => slugify(b.label) === target.brandSlug);
      return hit ? { ...target, brandId: hit.id } : target;
    }
  }

  return target;
}

import { apiFetch } from './client';
import { HERO_COLOR_FIELDS, sanitizeHeroColor } from '../hero-slide-colors';

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
   * Optional portrait image shown on mobile. Falls back to imageGalleryItemId
   * (the landscape/desktop image) when null. The crop is baked into the
   * uploaded gallery image, so no crop rectangle is stored.
   */
  mobileImageGalleryItemId: string | null;
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
  /*
   * Per-slide colour overrides for the four text runs and the CTA.
   *
   * `null` means "use the storefront theme default" and is the value every
   * existing slide has — these are overrides, not settings, and a slide nobody
   * has touched must keep rendering exactly as it does today.
   *
   * The backend accepts a hex string matching
   * /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/ or null, and nothing else. An
   * empty string is NOT a way to clear one: it fails the regex and zod
   * rejects the entire layout save. Produce values only via
   * `lib/hero-slide-colors.ts`; `normalizeStorefrontLayoutForSave` sanitises
   * all six on the way out as a backstop.
   *
   * Optional because a layout saved before this feature existed has no such
   * keys, and an absent key and a null both mean the same thing to the
   * backend: theme default.
   */
  eyebrowColor?: string | null;
  headlineColor?: string | null;
  subColor?: string | null;
  taglineColor?: string | null;
  ctaBgColor?: string | null;
  ctaTextColor?: string | null;
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
  | {
      id: string;
      kind: 'category';
      categoryId: string;
      label: string;
      /** Up to 3 products pinned to this category's storefront nav dropdown, in
       * the order shoppers see them. Optional — items saved before the dropdown
       * existed have no such key and the backend defaults it to []. */
      featuredProductIds?: string[];
    }
  | { id: string; kind: 'brand'; brandId: string; label: string }
  | { id: string; kind: 'product'; productId: string; label: string }
  | { id: string; kind: 'collaborator'; collaboratorId: string; label: string }
  | { id: string; kind: 'link'; href: string; label: string };

export interface NavbarConfig {
  items: NavItem[];
  showSearch: boolean;
  showAccount: boolean;
}

/** Mirrors the storefront's `components/ui/Icon.tsx` glyph names exactly —
 * that file lives in the sibling minirue-frontend repo, so this list is kept
 * in sync by hand. The editor can only offer these, never a free string. */
export type MobileMenuIcon =
  | 'search' | 'user' | 'bag' | 'heart' | 'close' | 'arrowRight' | 'arrowLeft'
  | 'minus' | 'plus' | 'check' | 'gift' | 'truck' | 'menu' | 'x' | 'grid' | 'external'
  | 'share' | 'chevronRight' | 'chevronLeft' | 'chevronDown' | 'home';

export const MOBILE_MENU_ICONS: MobileMenuIcon[] = [
  'home', 'search', 'user', 'bag', 'heart', 'grid', 'gift', 'truck', 'check',
  'menu', 'x', 'external', 'share', 'plus', 'minus', 'close',
  'arrowRight', 'arrowLeft', 'chevronRight', 'chevronLeft', 'chevronDown',
];

/** Same discriminated-union shape as `NavItem`/`CtaTarget`, plus five
 * built-ins that are not links: `home`/`cart`/`brands` are fixed routes,
 * `search` opens the search sheet, `account` depends on sign-in state. */
export type MobileMenuTarget =
  | { kind: 'home' }
  | { kind: 'search' }
  | { kind: 'account' }
  | { kind: 'cart' }
  | { kind: 'brands' }
  | { kind: 'category'; categoryId: string }
  | { kind: 'brand'; brandId: string }
  | { kind: 'product'; productId: string }
  | { kind: 'collaborator'; collaboratorId: string }
  | { kind: 'link'; href: string };

export interface MobileMenuShortcut {
  id: string;
  label: string;
  icon: MobileMenuIcon;
  target: MobileMenuTarget;
}

/** The bottom pill. No `id` — there is only ever one, `null` hides it. */
export interface MobileMenuFooterButton {
  label: string;
  icon: MobileMenuIcon;
  target: MobileMenuTarget;
}

export interface MobileMenuConfig {
  shortcuts: MobileMenuShortcut[];
  footerButton: MobileMenuFooterButton | null;
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

export interface StorefrontPage {
  id: string;
  /** url-safe, e.g. "privacy" -> /pages/privacy */
  slug: string;
  title: string;
  /** Markdown */
  body: string;
  /** hidden pages 404 on the storefront */
  enabled: boolean;
}

/**
 * Icon names the storefront can render for a product-page service promise.
 * The original five (`truck` | `gift` | `check` | `heart` | `grid`) stay
 * valid forever — a perk saved before this list grew keeps rendering
 * exactly as it did. The rest were added for MiniRue's own promise themes
 * (dashboard#125 owner ask: icons that mean something for THESE rows, not a
 * generic badge set) — delivery, same-day, cash on delivery, returns,
 * packaging, reviews, authenticity, premium, support, secure checkout, and
 * clean beauty. This dashboard only owns the NAMES, the picker, and the
 * per-`showWhen` default; the storefront draws the actual glyphs as inline
 * SVG in its own line style — see `PRODUCT_PERK_ICON_PATHS` below for the
 * dashboard's own preview copies, kept in sync by hand the same way
 * `MobileMenuIcon`'s are.
 */
export type ProductPerkIcon =
  | 'truck'
  | 'gift'
  | 'check'
  | 'heart'
  | 'grid'
  | 'clock'
  | 'cash'
  | 'returns'
  | 'package'
  | 'star'
  | 'shield'
  | 'sparkle'
  | 'support'
  | 'lock'
  | 'leaf';

export const PRODUCT_PERK_ICONS: ProductPerkIcon[] = [
  'truck', 'clock', 'cash', 'returns', 'package', 'star', 'shield', 'sparkle',
  'support', 'lock', 'leaf', 'gift', 'check', 'heart', 'grid',
];

/**
 * A new promise row starts with the icon that matches its condition, so it
 * looks sensible before the owner has touched it — he can still pick any
 * other icon from the visual grid. `always` has no obvious icon (the row
 * could be about anything), so it keeps the long-standing `truck` default a
 * blank new row has always started with.
 */
export function defaultPerkIcon(showWhen: PromiseShowWhen): ProductPerkIcon {
  switch (showWhen) {
    case 'freeShipping':
      return 'truck';
    case 'sameDay':
      return 'clock';
    case 'cod':
      return 'cash';
    case 'returns':
      return 'returns';
    case 'reviews':
      return 'star';
    case 'always':
      return 'truck';
  }
}

/**
 * Decides whether a promise row is even eligible to appear on a given
 * product — checked BEFORE `enabled`. `always` prints the owner's line
 * exactly as written (this is how a hand-authored line like "premium gift
 * wrap on every order" gets advertised: the owner types it, it shows). The
 * other five are storefront-computed against live settings, per product:
 * `freeShipping` only where the delivery fee actually is 0, `sameDay` only
 * where same-day fulfillment covers the shopper's governorate, `cod` only
 * when cash-on-delivery is on and the order is under the COD limit,
 * `returns` only when a returns window is set below, `reviews` only when the
 * product has reviews. Nothing here invents a fact — this dashboard never
 * seeds copy claiming any of these; the owner writes the words, this field
 * only controls when those words are allowed to appear.
 */
export type PromiseShowWhen =
  | 'always'
  | 'freeShipping'
  | 'sameDay'
  | 'cod'
  | 'returns'
  | 'reviews';

export const PROMISE_SHOW_WHEN_OPTIONS: Array<{ value: PromiseShowWhen; label: string }> = [
  { value: 'always', label: 'Always — print exactly as written' },
  { value: 'freeShipping', label: 'Only where delivery is free' },
  { value: 'sameDay', label: 'Only where same-day delivery is offered' },
  { value: 'cod', label: 'Only where cash on delivery applies' },
  { value: 'returns', label: 'Only when a returns window is set' },
  { value: 'reviews', label: 'Only when the product has reviews' },
];

/**
 * Tokens the owner may type into a promise's `text`. The storefront
 * substitutes each with the live value from settings at render time — this
 * dashboard never resolves them, it only lists and previews them (see
 * `previewPromiseText`).
 */
export const PROMISE_TOKEN_LIST = [
  '{deliveryDays}',
  '{freeGovernorates}',
  '{sameDayGovernorates}',
  '{codLimit}',
  '{returnsDays}',
  '{fee}',
] as const;

export type PromiseToken = (typeof PROMISE_TOKEN_LIST)[number];

/**
 * One owner-authored row shown (subject to `showWhen`) under every product.
 * `enabled`, `showWhen` and `order` are optional so a perk saved before this
 * feature existed keeps rendering exactly as it did — absent `enabled` means
 * true, absent `showWhen` means `'always'` (today's unconditional behavior),
 * absent `order` falls back to the row's position in the array.
 */
export interface ProductPerk {
  id: string;
  icon: ProductPerkIcon;
  text: string;
  enabled?: boolean;
  showWhen?: PromiseShowWhen;
  order?: number;
}

/** Admin-editable service promises shown on every product page. */
export interface ProductSectionConfig {
  perks: ProductPerk[];
}

/**
 * The plain facts behind the promises — not advertising copy themselves.
 * Every field optional/nullable: absent or null means "not set", and the
 * storefront and this dashboard must never present an unset fact as though
 * it were true. Free delivery / same-day / COD are NOT stored here — those
 * are derived live from shipping rates, fulfillment settings and the COD
 * limit, which already exist elsewhere in Settings.
 */
export interface TrustSettings {
  /** Days the owner accepts returns. null = no window set — the storefront must not claim one exists. */
  returnsWindowDays: number | null;
  /** For the contact page and the product page's contact link. */
  whatsappNumber: string | null;
  /** Free text, e.g. "Sun–Thu, 10am–6pm Cairo time". */
  supportHours: string | null;
}

export function defaultTrustSettings(): TrustSettings {
  return { returnsWindowDays: null, whatsappNumber: null, supportHours: null };
}

export interface StorefrontLayout {
  version: 2;
  productSection: ProductSectionConfig;
  announcement: AnnouncementConfig;
  faviconUrl: string | null;
  sections: StorefrontSection[];
  navbar: NavbarConfig;
  mobileMenu: MobileMenuConfig;
  footer: FooterConfig;
  pages: StorefrontPage[];
  /** Optional — absent on any layout saved before this feature existed. */
  trust?: TrustSettings;
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
            mobileImageGalleryItemId: null,
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

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function newPage(): StorefrontPage {
  return { id: newId('page'), slug: '', title: '', body: '', enabled: true };
}

/**
 * Lowercases, replaces runs of anything that isn't a-z/0-9 with a single
 * hyphen, and strips leading/trailing hyphens — matches the backend's
 * `^[a-z0-9]+(?:-[a-z0-9]+)*$` slug regex.
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The "pages customers look for" (issue dashboard#125), created in one click
 * with starter copy the owner edits. Every body below is deliberately honest
 * placeholder prose: it names exactly what real detail is missing and tells
 * the owner to fill it in, and it never invents a registration number,
 * address, phone number, tax id, or a returns window. `createTrustPages` only
 * adds whichever of these do not already exist (matched by slug) — it never
 * overwrites a page the owner has already written.
 *
 * Three things about this list are load-bearing and were got wrong once:
 *
 * 1. **The slugs match the shop's real addresses.** They used to read
 *    `shipping-delivery` and `returns-refunds` while the live storefront
 *    served `/shipping` and `/returns`, so one click would have created a
 *    SECOND shipping page and a SECOND returns page — both orphaned, both
 *    free to contradict the real ones. The slugs and titles here are the same
 *    ones the backend seeds in `storefront-defaults.ts`.
 * 2. **`terms` and `privacy` are in the list.** They 404 on the live shop
 *    today. That is not cosmetic: Meta and TikTok both require a reachable
 *    privacy policy from an advertiser running their pixels, and both pixels
 *    are live here. `mergeDefaults` will never restore them once they were
 *    dropped from the stored array, so this button is the way back.
 * 3. **Shipping and Returns state their numbers as `{tokens}`, never as
 *    literals.** The owner's rule: any dynamic fact on a trust page is
 *    fetched server-side from the one place the dashboard sets it. The token
 *    names are exactly the ones the storefront's promise filler understands
 *    (`PROMISE_TOKEN_NAMES` below) — so a Shipping page can never quote a
 *    delivery window the product-page chip disagrees with, because both read
 *    the same setting.
 *
 * Terms and Privacy are drafting scaffolds, not legal advice, and each says
 * so in its own first paragraph so the owner cannot miss it.
 */
export const TRUST_PAGE_STARTERS: Array<Pick<StorefrontPage, 'slug' | 'title' | 'body'>> = [
  {
    slug: 'contact',
    title: 'Contact',
    body: [
      '# Contact',
      '',
      "We're happy to help before or after you order.",
      '',
      '**Phone / WhatsApp:** *(add your number here — this line is a placeholder until you do)*',
      '',
      '**Email:** *(add your support email here)*',
      '',
      '**Hours:** *(add the days and times you can be reached)*',
      '',
      '**Where we are:** *(add your city or address here, or leave this out if you operate online-only)*',
    ].join('\n'),
  },
  {
    slug: 'about',
    title: 'About',
    body: [
      '# About',
      '',
      "*(Write who MiniRue is in your own words — this paragraph is a placeholder.)*",
      '',
      "We're a shop working on original brands and a small, careful selection of products. Replace this section with your own story: how you started, what you look for before you list something, and why it's worth a customer's trust.",
      '',
      '## Why these products',
      '',
      "*(Say, plainly, why you carry what you carry — sourcing, quality checks, or anything else that's true and specific to you.)*",
    ].join('\n'),
  },
  {
    slug: 'shipping',
    title: 'Shipping',
    body: [
      '# Shipping',
      '',
      '**Delivery time:** {deliveryDays}.',
      '',
      '**Free delivery:** free to {freeGovernorates}.',
      '',
      '**Same-day delivery:** available in {sameDayGovernorates}.',
      '',
      '**Delivery fee:** {fee} — the checkout shows it again before you pay.',
      '',
      '**Cash on delivery:** available on orders up to {codLimit}.',
      '',
      '*(The lines above read your live shipping settings, so this page can never promise something the checkout does not do. Change them under Storefront appearance, not here.)*',
      '',
      '*(Add anything else that is true for your shop below — how you pack, what happens when nobody is home, how you let someone know an order is running late. Those lines are yours to write.)*',
      '',
      'We get in touch if anything about an order or its delivery changes.',
    ].join('\n'),
  },
  {
    slug: 'returns',
    title: 'Returns',
    body: [
      '# Returns',
      '',
      'You have {returnsDays} days from the day an order arrives to ask for a return. That number is read from your returns setting, so this page and the product page can never disagree.',
      '',
      '**Condition:** *(say what state an item has to be in to come back — unopened, original packaging, tags still on. Replace this line.)*',
      '',
      '**How to start one:** get in touch on the [Contact](/contact) page with the order number and what you would like to return. We reply with the next step.',
      '',
      '**Refunds:** *(say how the money goes back — same payment method, cash, store credit — and how long that takes once the item is with us. Replace this line.)*',
      '',
      '**What cannot come back:** *(list anything you cannot accept — opened cosmetics, for instance. Delete this line if nothing applies.)*',
    ].join('\n'),
  },
  {
    slug: 'terms',
    title: 'Terms of Service',
    body: [
      '# Terms of Service',
      '',
      '**Draft — not legal advice.** *(This page is a scaffold your dashboard wrote, not a lawyer. It lists what a shop like this normally has to say and leaves every fact about YOUR business blank. Have someone qualified read it, fill in every bracketed line, and delete this paragraph before you publish.)*',
      '',
      '## Who you are buying from',
      '',
      '*(Add the trading name and the legal entity behind it. Ways to reach us live on the [Contact](/contact) page, and the registration details on the [Imprint / legal](/imprint-legal) page — fill those in first.)*',
      '',
      '## Placing an order',
      '',
      'An order is an offer to buy. It becomes a contract when we confirm it. We may decline an order — an item that has just sold out, an address we cannot reach — and nothing is charged when we do.',
      '',
      '## Prices and payment',
      '',
      'Prices are shown on the product page, and the checkout is the last word on what is charged, delivery included. *(Add which payment methods you accept, and whether the prices you show include tax.)*',
      '',
      '## Delivery',
      '',
      'See the [Shipping](/shipping) page. A delivery estimate is an estimate, not a guarantee.',
      '',
      '## Returns and cancellation',
      '',
      'See the [Returns](/returns) page. *(If a statutory cancellation right applies where you sell, say so here in your own words. Do not guess at one.)*',
      '',
      '## What the product pages say',
      '',
      'We describe and photograph items as carefully as we can. A screen never shows colour exactly, and a small difference between the photo and the item is not a fault.',
      '',
      '## Your account',
      '',
      'Keep your account details to yourself. Anything done from an account is treated as done by the person it belongs to — tell us straight away if that stops being true.',
      '',
      '## Things outside our control',
      '',
      '*(Say what happens to an order when something genuinely outside your control holds it up. Replace this line.)*',
      '',
      '## Which law applies',
      '',
      '*(Name the country whose law governs these terms and where a dispute would be heard. Do not leave this blank and do not guess — it is the line a dispute turns on.)*',
      '',
      '## Changes to these terms',
      '',
      'We may update this page. The version live when an order is placed is the one that applies to that order.',
      '',
      '## Getting in touch',
      '',
      'Use the [Contact](/contact) page.',
    ].join('\n'),
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    body: [
      '# Privacy Policy',
      '',
      '**Draft — not legal advice.** *(This page is a scaffold your dashboard wrote, not a lawyer. It describes the tools a shop like this normally runs and leaves every fact about YOUR business blank. Check every section against what is actually switched on, have someone qualified read it, and delete this paragraph before you publish.)*',
      '',
      '## What we collect',
      '',
      '- What you give us when you order: your name, delivery address, phone number, email, and what is in the order.',
      '- What you give us when you make an account or sign up for our emails.',
      '- What your browser sends when you visit: the pages you view, a rough location from your IP address, and your device and browser type.',
      '',
      '## The advertising and analytics tools on this site',
      '',
      'This shop runs the Meta (Facebook and Instagram) pixel and the TikTok pixel. They record that a browser viewed a product, added something to the cart, or finished an order, and they send that to Meta and to TikTok so our ads can be measured and shown to people likely to be interested. *(Check this list against what is actually installed before you publish, and delete anything you do not run. If you add another tool later — analytics, a chat widget — add it here the same day.)*',
      '',
      '## Cookies',
      '',
      'Cookies keep a cart from emptying between pages, keep an account signed in, and let the tools above recognise a browser that has been here before. *(If you show a cookie banner, say here what choosing to reject turns off. Do not describe a banner you have not built.)*',
      '',
      '## Why we use any of it',
      '',
      'To take and deliver an order, to answer a question about one, to keep the shop working and safe, and to advertise. Nothing else.',
      '',
      '## Who else sees it',
      '',
      'The courier who brings an order, the payment provider who takes the money, and the advertising platforms named above. *(Add the actual companies by name — a customer cannot check a policy that never names anyone.)*',
      '',
      '## How long we keep it',
      '',
      '*(Say how long you keep order records, and how long you keep everything else. Order records usually have to be kept for a set period for tax — find the real period where you sell rather than writing a round number here.)*',
      '',
      '## What you can ask us for',
      '',
      'You can ask what we hold about you, ask us to correct it, ask us to delete it, and ask us to stop sending you marketing email. *(Add any further rights that apply where you sell.)*',
      '',
      '## How to ask',
      '',
      'Write to us on the [Contact](/contact) page and say what you would like done. *(Add a dedicated address for data requests if you have one, and the time you aim to reply within.)*',
      '',
      '## Children',
      '',
      'This shop is not meant for children, and we do not knowingly collect anything about them.',
      '',
      '## Changes to this page',
      '',
      'We may update this page. *(Add the date it last changed, and update that date whenever you edit it.)*',
    ].join('\n'),
  },
  {
    slug: 'imprint-legal',
    title: 'Imprint / legal',
    body: [
      '# Imprint / legal',
      '',
      '*(This page is a placeholder. Every line below needs a real detail before this page means anything — do not publish it as-is.)*',
      '',
      '**Business name:** *(add your registered business name)*',
      '',
      '**Registration number:** *(add your commercial registration / tax number, if applicable)*',
      '',
      '**Registered address:** *(add your registered business address)*',
      '',
      '**Contact:** see the [Contact](/contact) page.',
    ].join('\n'),
  },
];

/**
 * Adds whichever `TRUST_PAGE_STARTERS` are not already present by slug,
 * enabled, with their starter copy. Never touches or duplicates a page that
 * already exists at that slug — an owner who already wrote a real "Contact"
 * page keeps it untouched. Returns the pages actually added, so the caller
 * (the "Create the pages customers look for" button) can tell the owner how
 * many were created versus already there.
 */
export function createTrustPages(pages: StorefrontPage[]): {
  pages: StorefrontPage[];
  added: StorefrontPage[];
} {
  const existingSlugs = new Set(pages.map((p) => p.slug.trim()));
  const added: StorefrontPage[] = TRUST_PAGE_STARTERS.filter(
    (starter) => !existingSlugs.has(starter.slug),
  ).map((starter) => ({
    id: newId('page'),
    slug: starter.slug,
    title: starter.title,
    body: starter.body,
    enabled: true,
  }));
  return { pages: [...pages, ...added], added };
}

function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim() === '';
}

export function newPerk(): ProductPerk {
  return { id: newId('perk'), icon: 'truck', text: '', enabled: true, showWhen: 'always', order: 0 };
}

/**
 * Live values to preview a promise's tokens with, so the editor can show
 * "Free delivery to Cairo, Giza" instead of the raw `{freeGovernorates}`
 * literal. All optional/nullable — an unset value previews as an em dash
 * rather than a blank, so a missing fact is visibly missing, not silently
 * dropped.
 */
export interface PromiseTokenValues {
  deliveryDays?: string | null;
  freeGovernorates?: string | null;
  sameDayGovernorates?: string | null;
  codLimit?: string | null;
  returnsDays?: string | null;
  fee?: string | null;
}

/**
 * Every `{token}` the storefront knows how to fill, and the only ones that may
 * appear in a promise or in a trust-page starter body. Kept in step by hand
 * with `tokenValue()` in minirue-frontend/lib/storefront/promises.ts — a token
 * this list does not contain is filled by nobody and reaches a customer as a
 * literal `{brace}`, so a test asserts the starters use nothing else.
 */
export const PROMISE_TOKEN_NAMES: ReadonlyArray<keyof PromiseTokenValues> = [
  'deliveryDays',
  'freeGovernorates',
  'sameDayGovernorates',
  'codLimit',
  'returnsDays',
  'fee',
];

/**
 * Renders `text` with every `{token}` substituted for a live value, for the
 * editor's own preview only — the storefront does the real substitution
 * against live settings at render time. Never persisted; this is display-only.
 */
export function previewPromiseText(text: string, values: PromiseTokenValues): string {
  const dash = '—';
  return text
    .replace(/\{deliveryDays\}/g, values.deliveryDays ?? dash)
    .replace(/\{freeGovernorates\}/g, values.freeGovernorates ?? dash)
    .replace(/\{sameDayGovernorates\}/g, values.sameDayGovernorates ?? dash)
    .replace(/\{codLimit\}/g, values.codLimit ?? dash)
    .replace(/\{returnsDays\}/g, values.returnsDays ?? dash)
    .replace(/\{fee\}/g, values.fee ?? dash);
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

/** Same "missing target id/href" check as a nav item, for a mobile-menu
 * target. The five built-in kinds (home/search/account/cart/brands) need
 * nothing beyond the kind itself, so they can never be incomplete. */
function isIncompleteMobileMenuTarget(target: MobileMenuTarget): boolean {
  switch (target.kind) {
    case 'category':
      return isBlank(target.categoryId);
    case 'brand':
      return isBlank(target.brandId);
    case 'product':
      return isBlank(target.productId);
    case 'collaborator':
      return isBlank(target.collaboratorId);
    case 'link':
      return isBlank(target.href);
    case 'home':
    case 'search':
    case 'account':
    case 'cart':
    case 'brands':
      return false;
  }
}

function isIncompleteMobileMenuItem(item: {
  label: string;
  target: MobileMenuTarget;
}): boolean {
  return isBlank(item.label) || isIncompleteMobileMenuTarget(item.target);
}

export interface NormalizeResult {
  layout: StorefrontLayout;
  /** Count of navbar items dropped for being unfinished. */
  droppedNavItemCount: number;
  /** Count of mobile-menu shortcuts/footer button dropped for being unfinished. */
  droppedMobileMenuItemCount: number;
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
    if (section.type === 'hero') {
      for (const slide of section.slides) {
        slide.ctaTarget = normalizeCtaTarget(slide.ctaTarget);
        // Belt and braces on the colour contract. The editor cannot emit a
        // bad hex, but one malformed value fails zod for the WHOLE layout —
        // the admin would lose every unrelated edit in the same save. Coerce
        // anything unexpected to null, which renders as the theme default.
        for (const field of HERO_COLOR_FIELDS) {
          slide[field] = sanitizeHeroColor(slide[field]);
        }
      }
      continue;
    }
    // The ribbon textarea is lossless while it is being typed (see
    // RibbonEditor) so the admin can press Enter and get a line. That leaves
    // blank entries behind, and the API rejects them outright —
    // `z.array(z.string().min(1))` — which would fail the entire save over a
    // stray newline. Cleaning here is the other half of that trade.
    if (section.type === 'ribbon') {
      section.items = section.items
        .map((item) => item.trim())
        .filter((item) => item !== '');
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

  let droppedMobileMenuItemCount = 0;
  // Defensive, not just decorative: `mobileMenu` is required in the type, but
  // a layout object built by code written before this field existed (an
  // older in-memory fixture, or a stale page that hasn't reloaded) still has
  // it `undefined` at runtime. Falling back rather than crashing here means
  // saving anything else on such a page still succeeds.
  const mobileMenuSource = next.mobileMenu ?? { shortcuts: [], footerButton: null };
  const cleanShortcuts = mobileMenuSource.shortcuts.filter((item) => {
    if (isIncompleteMobileMenuItem(item)) {
      droppedMobileMenuItemCount += 1;
      return false;
    }
    return true;
  });
  let footerButton = mobileMenuSource.footerButton;
  if (footerButton && isIncompleteMobileMenuItem(footerButton)) {
    droppedMobileMenuItemCount += 1;
    footerButton = null;
  }
  next.mobileMenu = { shortcuts: cleanShortcuts.slice(0, 3), footerButton };

  next.pages = next.pages.filter(
    (page) => !isBlank(page.title) && SLUG_PATTERN.test(page.slug),
  );

  // `order` is optional on the wire, but always written as the row's actual
  // position on save — the array order and the field can never disagree once
  // this has run, however many times a layout has round-tripped through an
  // older client that doesn't know the field exists.
  if (next.productSection) {
    next.productSection = {
      ...next.productSection,
      perks: next.productSection.perks.map((perk, i) => ({ ...perk, order: i })),
    };
  }

  return { layout: next, droppedNavItemCount, droppedMobileMenuItemCount };
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

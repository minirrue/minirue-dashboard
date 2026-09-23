import { landingKey } from './source';

/**
 * One visitor's journey, step by step, with the page-type pill every step
 * carries (dashboard#128): Home, Category, Product, Bag, Checkout, Page,
 * Unknown path, Action, Left.
 *
 * Page types come from the step's own event first (a `product_view` is a
 * product whatever its URL), then from the shop's real routes: `/`, `/shop`,
 * `/shop/all`, `/shop/<category>`, `/shop/<category>/<product>`. When the
 * catalogue is known, a `/shop/…` slug it does not contain is an unknown path
 * (a typo or an old link), still counted as a visit.
 */

export type PageKind = 'home' | 'category' | 'product' | 'bag' | 'checkout' | 'page' | 'unknown' | 'action' | 'exit';

export const PAGE_KIND_LABEL: Record<PageKind, string> = {
  home: 'Home',
  category: 'Category',
  product: 'Product',
  bag: 'Bag',
  checkout: 'Checkout',
  page: 'Page',
  unknown: 'Unknown path',
  action: 'Action',
  exit: 'Left',
};

export const PAGE_KIND_HINT: Record<PageKind, string> = {
  home: 'The shop’s home page',
  category: 'A category list, e.g. /shop/skincare, or all products',
  product: 'A single product page',
  bag: 'Added to bag or opened the bag',
  checkout: 'Any checkout step (contact, delivery, payment)',
  page: 'One of the shop’s own pages: about, contact, policies, search, account',
  unknown: 'A path the shop doesn’t know (typo, old link). Still counted.',
  action: 'Something done on a page (scrolled, read a section, swiped photos)',
  exit: 'Where the visit ended',
};

/** Slugs the shop actually serves, from the catalogue. `null` = not loaded yet. */
export interface KnownRoutes {
  categories: Set<string>;
  products: Set<string>;
}

const OWN_PAGES = /^\/(search|account|login|register|signup|about|contact|shipping|returns|terms|privacy|imprint-legal|faq|brands|collab|wishlist|orders|track)(\/|$)/;

export function pageKindOfPath(rawPath: string | null | undefined, routes?: KnownRoutes | null): PageKind {
  const path = landingKey(rawPath);
  if (!path) return 'unknown';
  if (path === '/') return 'home';
  if (/^\/(cart|bag)(\/|$)/.test(path)) return 'bag';
  if (/^\/checkout(\/|$)/.test(path)) return 'checkout';
  if (path === '/shop' || path === '/shop/all' || path === '/products') return 'category';
  const m = /^\/shop\/([^/]+)(?:\/([^/]+))?$/.exec(path);
  if (m) {
    const [, cat, prod] = m;
    if (prod) return !routes || routes.products.has(decodeURIComponent(prod)) ? 'product' : 'unknown';
    return !routes || routes.categories.has(decodeURIComponent(cat)) ? 'category' : 'unknown';
  }
  if (/^\/products\/[^/]+$/.test(path)) return 'product';
  if (/^\/categories\/[^/]+$/.test(path)) return 'category';
  if (OWN_PAGES.test(path)) return 'page';
  // Trust pages live at the top level (minirueshop.com/terms). A single
  // lowercase segment is most likely one of them; anything deeper is unknown.
  if (/^\/[a-z0-9-]+$/.test(path) && !routes) return 'page';
  return 'unknown';
}

const BAG_EVENTS = new Set(['add_to_cart', 'remove_from_cart', 'cart_view']);
const CHECKOUT_EVENTS = /^(begin_checkout|checkout_|payment_|purchase$)/;
const NAV_EVENTS = new Set(['page_view', 'session_start', 'landing']);

export function stepKind(step: { kind: string; path?: string | null }, routes?: KnownRoutes | null): PageKind {
  if (step.kind === 'exit') return 'exit';
  if (step.kind === 'product_view') return 'product';
  if (BAG_EVENTS.has(step.kind)) return 'bag';
  if (CHECKOUT_EVENTS.test(step.kind)) return 'checkout';
  if (NAV_EVENTS.has(step.kind) || !step.kind) return pageKindOfPath(step.path, routes);
  return 'action';
}

/* ── The journey view model ─────────────────────────────────────────────── */

export interface JourneyStep {
  at: string;
  kind: string;
  label: string;
  path?: string | null;
  seconds?: number | null;
  scrollPct?: number | null;
  valueMinor?: number | null;
  productName?: string | null;
  orderNumber?: string | null;
}

export interface JourneySession {
  sessionId: string | null;
  startedAt: string;
  endedAt: string | null;
  touch: { platform: string | null; medium: string | null; campaign: string | null; landingPath: string | null; referrer?: string | null };
  summary: string;
  steps: JourneyStep[];
}

export interface ViewStep extends JourneyStep {
  page: PageKind;
  /** The step people should notice: an add to bag, checkout or purchase. */
  key: boolean;
}

export interface ViewSession {
  sessionId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  touch: JourneySession['touch'];
  summary: string;
  steps: ViewStep[];
}

const PAGE_VIEW_LABEL = /^Page view$/i;

/** A readable line for a navigation step whose server label is just "Page view". */
function stepLabel(step: JourneyStep, page: PageKind, first: boolean): string {
  if (!PAGE_VIEW_LABEL.test(step.label) && !/^Viewed page/.test(step.label)) return step.label;
  const where = page === 'home' ? 'Home' : landingKey(step.path) || 'a page';
  return `${first ? 'Landed on' : 'Went to'} ${where}`;
}

/**
 * Sessions newest first, each step with its page type, and a synthetic
 * "Left" step at the end: where the visit ended is part of the story.
 */
export function viewSessions(sessions: JourneySession[], routes?: KnownRoutes | null): ViewSession[] {
  const sorted = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return sorted.map((s) => {
    const steps: ViewStep[] = s.steps
      .filter((st) => st.kind !== 'scroll_depth' || st.scrollPct != null)
      .map((st, i) => {
        const page = stepKind(st, routes);
        return {
          ...st,
          page,
          label: stepLabel(st, page, i === 0),
          key: page === 'bag' || page === 'checkout',
        };
      });
    const lastAt = s.endedAt ?? steps[steps.length - 1]?.at ?? s.startedAt;
    const bought = steps.some((st) => st.kind === 'purchase');
    if (steps.length) {
      steps.push({
        at: lastAt,
        kind: 'exit',
        label: bought ? 'Left after paying' : 'Left',
        page: 'exit',
        key: false,
      });
    }
    const durationSeconds = Math.max(0, Math.round((new Date(lastAt).getTime() - new Date(s.startedAt).getTime()) / 1000));
    return { sessionId: s.sessionId, startedAt: s.startedAt, endedAt: s.endedAt, durationSeconds, touch: s.touch, summary: s.summary, steps };
  });
}

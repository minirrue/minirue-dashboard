/**
 * "Before you publish" — every rule the Storefront editor warns about, in one
 * pure function so the tab badges, the checks drawer, the publish sheet and
 * the tests all read the same answer.
 *
 * Severity:
 *   block — publishing would lose or break something; Publish is refused
 *   warn  — shoppers would see something odd; Publish is allowed
 *   info  — worth knowing, nothing is wrong
 */
import {
  SLUG_PATTERN,
  isIncompleteMobileMenuItem,
  isIncompleteNavItem,
  type StorefrontLayout,
  type StorefrontPage,
} from '@/lib/api/storefront';

export type CheckTab = 'home' | 'navigation' | 'footer' | 'announcement' | 'product' | 'pages' | 'trust';
export type CheckSeverity = 'block' | 'warn' | 'info';

export interface Check {
  id: string;
  tab: CheckTab;
  severity: CheckSeverity;
  title: string;
  detail: string;
  /** What the "fix" button focuses: a section id, a page id, or a field key. */
  focus?: { sectionId?: string; slideIndex?: number; pageId?: string; field?: string };
}

/**
 * Top-level storefront addresses a page can never use, because a real route or
 * a permanent redirect answers first (minirue-frontend `app/*` and the
 * `next.config` redirects). `bundles` and `collab` were missing from the old
 * list. The server still has the final say on partner addresses when saving.
 */
export const RESERVED_PAGE_SLUGS: ReadonlySet<string> = new Set([
  'account', 'api', 'brands', 'bundles', 'cart', 'categories', 'checkout', 'collab',
  'favicon.ico', 'forgot', 'login', 'logout', 'orders', 'pages', 'products',
  'reset-password', 'robots.txt', 'search', 'shop', 'signup', 'sitemap.xml',
]);

/** Why a page can't be published at its address, or null when it can. */
export function pageAddressProblem(page: StorefrontPage, all: StorefrontPage[]): string | null {
  const slug = page.slug.trim();
  if (!page.title.trim()) return 'The title is empty.';
  if (!slug) return 'The address is empty.';
  if (!SLUG_PATTERN.test(slug)) return 'The address may only use lowercase letters, numbers and single hyphens, e.g. privacy-policy.';
  if (RESERVED_PAGE_SLUGS.has(slug)) return `/${slug} is a built-in shop address, so this page could never be reached.`;
  if (all.filter((p) => p.slug.trim() === slug).length > 1) return `/${slug} is also used by another page.`;
  return null;
}

const PLACEHOLDER = /\[[^\]\n]{2,}\]/;

export function hasPlaceholders(text: string): boolean {
  return PLACEHOLDER.test(text);
}

export function runChecks(layout: StorefrontLayout): Check[] {
  const out: Check[] = [];

  // Home page ----------------------------------------------------------------
  for (const section of layout.sections) {
    if (section.type !== 'hero' || !section.enabled) continue;
    section.slides.forEach((slide, i) => {
      if (slide.mode === 'image' && slide.imageGalleryItemId && !slide.imageAlt.trim()) {
        out.push({
          id: `alt-${slide.id}`,
          tab: 'home',
          severity: 'warn',
          title: `Hero slide ${i + 1}: the picture has no description`,
          detail: 'Screen readers and Google read it. One short sentence is enough.',
          focus: { sectionId: section.id, slideIndex: i, field: 'imageAlt' },
        });
      }
    });
  }
  if (!layout.sections.some((s) => s.enabled)) {
    out.push({
      id: 'no-sections',
      tab: 'home',
      severity: 'warn',
      title: 'Every home page section is hidden',
      detail: 'Shoppers would see only the menu and the footer.',
    });
  }

  // Navigation ---------------------------------------------------------------
  const unfinishedNav = layout.navbar.items.filter(isIncompleteNavItem);
  unfinishedNav.forEach((item) => {
    out.push({
      id: `nav-${item.id}`,
      tab: 'navigation',
      severity: 'warn',
      title: `Menu item “${item.label.trim() || 'Untitled'}” is unfinished`,
      detail: item.label.trim()
        ? 'It has no destination picked, so it is left out when you publish.'
        : 'It has no label, so it is left out when you publish.',
      focus: { field: `nav:${item.id}` },
    });
  });
  const menu = layout.mobileMenu ?? { shortcuts: [], footerButton: null };
  menu.shortcuts.forEach((tile, i) => {
    if (isIncompleteMobileMenuItem(tile)) {
      out.push({
        id: `tile-${tile.id}`,
        tab: 'navigation',
        severity: 'warn',
        title: `Phone menu tile ${i + 1} is unfinished`,
        detail: 'It needs a label and a destination, or it is left out when you publish.',
        focus: { field: `tile:${tile.id}` },
      });
    }
  });
  if (menu.footerButton && isIncompleteMobileMenuItem(menu.footerButton)) {
    out.push({
      id: 'menu-button',
      tab: 'navigation',
      severity: 'warn',
      title: 'The phone menu’s bottom button is unfinished',
      detail: 'It needs a label and a destination, or it is removed when you publish.',
      focus: { field: 'menu-button' },
    });
  }

  // Footer -------------------------------------------------------------------
  layout.footer.columns.forEach((col) => {
    col.links.forEach((link) => {
      if (!link.label.trim() || !link.href.trim()) {
        out.push({
          id: `flink-${link.id}`,
          tab: 'footer',
          severity: 'warn',
          title: `Footer link in “${col.title || 'Untitled column'}” is unfinished`,
          detail: 'A link needs both a label and a destination.',
          focus: { field: `flink:${link.id}` },
        });
      }
    });
  });

  // Announcement ------------------------------------------------------------
  if (layout.announcement.enabled && !layout.announcement.messages.some((m) => m.trim())) {
    out.push({
      id: 'ann-empty',
      tab: 'announcement',
      severity: 'warn',
      title: 'The announcement bar is on but has no message',
      detail: 'Shoppers would see an empty black bar.',
    });
  }

  // Pages --------------------------------------------------------------------
  layout.pages.forEach((page) => {
    const problem = pageAddressProblem(page, layout.pages);
    if (problem) {
      out.push({
        id: `page-${page.id}`,
        tab: 'pages',
        severity: 'block',
        title: `Page “${page.title.trim() || 'Untitled'}” can’t be published`,
        // Saving today silently deletes such a page (normalizeStorefrontLayoutForSave
        // filters it out) — so it blocks instead of disappearing.
        detail: problem,
        focus: { pageId: page.id },
      });
    } else if (page.enabled && hasPlaceholders(page.body)) {
      out.push({
        id: `ph-${page.id}`,
        tab: 'pages',
        severity: 'warn',
        title: `Page “${page.title}” still shows [placeholders]`,
        detail: 'Shoppers would see the brackets. Fill them in or hide the page.',
        focus: { pageId: page.id },
      });
    }
  });

  // Trust & product promises ------------------------------------------------
  const returnsDays = layout.trust?.returnsWindowDays ?? null;
  if (returnsDays == null) {
    const returnsPerk = (layout.productSection?.perks ?? []).some(
      (p) => p.enabled !== false && (p.showWhen === 'returns' || p.text.includes('{returnsDays}')),
    );
    const pagesUsing = layout.pages.filter((p) => p.enabled && p.body.includes('{returnsDays}')).map((p) => p.title);
    if (returnsPerk || pagesUsing.length) {
      out.push({
        id: 'returns-unset',
        tab: 'trust',
        severity: 'warn',
        title: 'No returns window is set',
        detail:
          (returnsPerk ? 'The returns promise stays hidden on product pages' : '') +
          (returnsPerk && pagesUsing.length ? ', and ' : '') +
          (pagesUsing.length ? `${pagesUsing.join(', ')} shows an empty number` : '') +
          '.',
        focus: { field: 'returnsWindowDays' },
      });
    }
  }
  if (!layout.trust?.whatsappNumber) {
    out.push({
      id: 'whatsapp-unset',
      tab: 'trust',
      severity: 'info',
      title: 'No WhatsApp number',
      detail: 'The Contact page and product pages can’t offer a chat link.',
      focus: { field: 'whatsappNumber' },
    });
  }

  return out;
}

export function countByTab(checks: Check[]): Partial<Record<CheckTab, { n: number; block: boolean }>> {
  const out: Partial<Record<CheckTab, { n: number; block: boolean }>> = {};
  for (const c of checks) {
    if (c.severity === 'info') continue;
    const cur = out[c.tab] ?? { n: 0, block: false };
    out[c.tab] = { n: cur.n + 1, block: cur.block || c.severity === 'block' };
  }
  return out;
}

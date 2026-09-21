import {
  createTrustPages,
  defaultPerkIcon,
  newSection,
  normalizeStorefrontLayoutForSave,
  previewPromiseText,
  PRODUCT_PERK_ICONS,
  PROMISE_TOKEN_NAMES,
  SLUG_PATTERN,
  TRUST_PAGE_STARTERS,
} from '@/lib/api/storefront';
import type { StorefrontLayout, StorefrontPage } from '@/lib/api/storefront';

function baseLayout(): StorefrontLayout {
  return {
    version: 2,
    productSection: { perks: [] },
    announcement: { enabled: false, messages: [], linkUrl: null, background: null },
    faviconUrl: null,
    sections: [newSection('hero', 0)],
    navbar: { items: [], showSearch: true, showAccount: true },
    mobileMenu: { shortcuts: [], footerButton: null },
    footer: {
      tagline: null,
      newsletterEnabled: false,
      newsletterEyebrow: '',
      newsletterBlurb: '',
      columns: [],
      socials: [],
      paymentBadges: [],
      legalLine: '',
      secondaryLine: '',
    },
    pages: [],
  };
}

const STARTER_COUNT = TRUST_PAGE_STARTERS.length;

function page(slug: string): StorefrontPage {
  return { id: `p-${slug}`, slug, title: slug, body: 'owner wrote this', enabled: true };
}

describe('TRUST_PAGE_STARTERS', () => {
  it('covers exactly the pages customers look for, with no duplicate slug', () => {
    expect(TRUST_PAGE_STARTERS.map((s) => s.slug)).toEqual([
      'contact',
      'about',
      'shipping',
      'returns',
      'terms',
      'privacy',
      'imprint-legal',
    ]);
    expect(new Set(TRUST_PAGE_STARTERS.map((s) => s.slug)).size).toBe(STARTER_COUNT);
  });

  it('uses the shop’s real addresses, not near-miss slugs that would orphan a live page', () => {
    const slugs = TRUST_PAGE_STARTERS.map((s) => s.slug);
    expect(slugs).not.toContain('shipping-delivery');
    expect(slugs).not.toContain('returns-refunds');
  });

  it('includes terms and privacy — the pixels require a reachable privacy policy', () => {
    const slugs = TRUST_PAGE_STARTERS.map((s) => s.slug);
    expect(slugs).toContain('terms');
    expect(slugs).toContain('privacy');
  });

  it('gives every starter a valid slug and a non-empty title and body', () => {
    for (const starter of TRUST_PAGE_STARTERS) {
      expect(starter.slug).toMatch(SLUG_PATTERN);
      expect(starter.title.trim()).not.toBe('');
      expect(starter.body.trim()).not.toBe('');
    }
  });

  it('marks the legal scaffolds as drafts, not legal advice', () => {
    for (const slug of ['terms', 'privacy']) {
      const starter = TRUST_PAGE_STARTERS.find((s) => s.slug === slug)!;
      expect(starter.body).toMatch(/not legal advice/i);
    }
  });

  it('states shipping and returns facts as tokens, never as numbers typed into the page', () => {
    const shipping = TRUST_PAGE_STARTERS.find((s) => s.slug === 'shipping')!;
    const returns = TRUST_PAGE_STARTERS.find((s) => s.slug === 'returns')!;
    for (const token of ['deliveryDays', 'freeGovernorates', 'sameDayGovernorates', 'fee', 'codLimit']) {
      expect(shipping.body).toContain(`{${token}}`);
    }
    expect(returns.body).toContain('{returnsDays}');
  });

  it('only ever uses a token the storefront knows how to fill', () => {
    const known = new Set<string>(PROMISE_TOKEN_NAMES as readonly string[]);
    for (const starter of TRUST_PAGE_STARTERS) {
      for (const match of starter.body.matchAll(/\{(\w+)\}/g)) {
        expect(known.has(match[1])).toBe(true);
      }
    }
  });

  it('never invents a phone number, address, registration number or delivery promise', () => {
    const forbidden = [
      /\+?\d[\d\s-]{6,}\d/, // anything that looks like a real phone number
      /cairo|giza|alexandria/i, // a specific real place
      /\b\d+\s*(day|hour)s?\b/i, // a concrete delivery time or returns window
    ];
    for (const starter of TRUST_PAGE_STARTERS) {
      for (const pattern of forbidden) {
        expect(starter.body).not.toMatch(pattern);
      }
    }
  });
});

describe('createTrustPages', () => {
  it('adds every starter to an empty page list', () => {
    const { pages, added } = createTrustPages([]);
    expect(added).toHaveLength(STARTER_COUNT);
    expect(pages).toHaveLength(STARTER_COUNT);
    expect(pages.map((p) => p.slug).sort()).toEqual(
      TRUST_PAGE_STARTERS.map((s) => s.slug).sort(),
    );
    expect(pages.every((p) => p.enabled)).toBe(true);
  });

  it('never overwrites or duplicates a page the owner already wrote', () => {
    const existing: StorefrontPage[] = [
      { id: 'p1', slug: 'contact', title: 'Reach us', body: 'Call 01234567890', enabled: true },
    ];
    const { pages, added } = createTrustPages(existing);
    expect(added).toHaveLength(STARTER_COUNT - 1); // everything except contact
    const contactPage = pages.find((p) => p.slug === 'contact');
    expect(contactPage).toEqual(existing[0]);
  });

  it('on the live shop adds only terms, privacy and imprint-legal', () => {
    // minirueshop.com today: /about, /contact, /shipping and /returns all
    // return 200; /terms and /privacy 404. One click must fill the holes and
    // leave the four live pages completely alone.
    const live = ['about', 'contact', 'shipping', 'returns'].map(page);
    const { pages, added } = createTrustPages(live);
    expect(added.map((p) => p.slug)).toEqual(['terms', 'privacy', 'imprint-legal']);
    expect(pages.filter((p) => p.slug === 'shipping')).toHaveLength(1);
    expect(pages.filter((p) => p.slug === 'returns')).toHaveLength(1);
    for (const existing of live) {
      expect(pages.find((p) => p.id === existing.id)).toEqual(existing);
    }
  });

  it('is idempotent — running it twice adds nothing the second time', () => {
    const first = createTrustPages([]).pages;
    const second = createTrustPages(first);
    expect(second.added).toHaveLength(0);
    expect(second.pages).toHaveLength(STARTER_COUNT);
  });
});

describe('previewPromiseText', () => {
  it('substitutes known tokens with live values', () => {
    const out = previewPromiseText('Free delivery to {freeGovernorates}', {
      freeGovernorates: 'Cairo, Giza',
    });
    expect(out).toBe('Free delivery to Cairo, Giza');
  });

  it('shows a dash for a token with no live value, rather than dropping it silently', () => {
    const out = previewPromiseText('Returns within {returnsDays} days', {});
    expect(out).toBe('Returns within — days');
  });

  it('leaves text with no tokens untouched', () => {
    expect(previewPromiseText('Hand-wrapped, always.', {})).toBe('Hand-wrapped, always.');
  });
});

describe('defaultPerkIcon', () => {
  it('suggests a themed icon for each derived condition', () => {
    expect(defaultPerkIcon('freeShipping')).toBe('truck');
    expect(defaultPerkIcon('sameDay')).toBe('clock');
    expect(defaultPerkIcon('cod')).toBe('cash');
    expect(defaultPerkIcon('returns')).toBe('returns');
    expect(defaultPerkIcon('reviews')).toBe('star');
  });

  it('only ever suggests a value from the real icon list', () => {
    for (const showWhen of ['always', 'freeShipping', 'sameDay', 'cod', 'returns', 'reviews'] as const) {
      expect(PRODUCT_PERK_ICONS).toContain(defaultPerkIcon(showWhen));
    }
  });

  it('keeps the five original icon names valid', () => {
    for (const legacy of ['truck', 'gift', 'check', 'heart', 'grid'] as const) {
      expect(PRODUCT_PERK_ICONS).toContain(legacy);
    }
  });
});

describe('normalizeStorefrontLayoutForSave — promises', () => {
  it('writes perk order to match array position', () => {
    const layout = baseLayout();
    layout.productSection = {
      perks: [
        { id: 'a', icon: 'truck', text: 'First' },
        { id: 'b', icon: 'gift', text: 'Second', order: 99 },
      ],
    };
    const { layout: out } = normalizeStorefrontLayoutForSave(layout);
    expect(out.productSection.perks.map((p) => p.order)).toEqual([0, 1]);
  });

  it('preserves enabled/showWhen on each perk untouched', () => {
    const layout = baseLayout();
    layout.productSection = {
      perks: [{ id: 'a', icon: 'heart', text: 'Gift wrap on request', enabled: false, showWhen: 'always' }],
    };
    const { layout: out } = normalizeStorefrontLayoutForSave(layout);
    expect(out.productSection.perks[0].enabled).toBe(false);
    expect(out.productSection.perks[0].showWhen).toBe('always');
  });
});

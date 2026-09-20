import {
  createTrustPages,
  defaultPerkIcon,
  newSection,
  normalizeStorefrontLayoutForSave,
  previewPromiseText,
  PRODUCT_PERK_ICONS,
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

describe('createTrustPages', () => {
  it('adds all five starters to an empty page list', () => {
    const { pages, added } = createTrustPages([]);
    expect(added).toHaveLength(5);
    expect(pages).toHaveLength(5);
    expect(pages.map((p) => p.slug).sort()).toEqual(
      TRUST_PAGE_STARTERS.map((s) => s.slug).sort(),
    );
    expect(pages.every((p) => p.enabled)).toBe(true);
  });

  it('never invents a phone number, address, registration number or delivery promise', () => {
    const forbidden = [
      /\+?\d[\d\s-]{6,}\d/, // anything that looks like a real phone number
      /cairo|giza|alexandria/i, // a specific real place
      /\b\d+\s*(day|hour)s?\b/i, // a concrete delivery time
    ];
    for (const starter of TRUST_PAGE_STARTERS) {
      for (const pattern of forbidden) {
        expect(starter.body).not.toMatch(pattern);
      }
    }
  });

  it('never overwrites or duplicates a page the owner already wrote', () => {
    const existing: StorefrontPage[] = [
      { id: 'p1', slug: 'contact', title: 'Reach us', body: 'Call 01234567890', enabled: true },
    ];
    const { pages, added } = createTrustPages(existing);
    expect(added).toHaveLength(4); // everything except contact
    const contactPage = pages.find((p) => p.slug === 'contact');
    expect(contactPage).toEqual(existing[0]);
  });

  it('is idempotent — running it twice adds nothing the second time', () => {
    const first = createTrustPages([]).pages;
    const second = createTrustPages(first);
    expect(second.added).toHaveLength(0);
    expect(second.pages).toHaveLength(5);
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

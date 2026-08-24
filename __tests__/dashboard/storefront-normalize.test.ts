import { newSection, normalizeStorefrontLayoutForSave } from '@/lib/api/storefront';
import type { StorefrontLayout, NavItem } from '@/lib/api/storefront';

function baseLayout(): StorefrontLayout {
  return {
    version: 2,
    productSection: { perks: [] },
    announcement: { enabled: false, messages: [], linkUrl: null, background: null },
    faviconUrl: null,
    sections: [newSection('hero', 0)],
    navbar: {
      items: [],
      showSearch: true,
      showAccount: true,
    },
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

describe('normalizeStorefrontLayoutForSave', () => {
  it('coerces an unfinished product CTA target to scroll', () => {
    const layout = baseLayout();
    const hero = layout.sections[0];
    if (hero.type !== 'hero') throw new Error('expected hero');
    hero.slides[0].ctaTarget = { kind: 'product', productId: '' };

    const { layout: out } = normalizeStorefrontLayoutForSave(layout);
    const outHero = out.sections[0];
    if (outHero.type !== 'hero') throw new Error('expected hero');
    expect(outHero.slides[0].ctaTarget).toEqual({ kind: 'scroll' });
  });

  it('leaves a finished CTA target untouched', () => {
    const layout = baseLayout();
    const hero = layout.sections[0];
    if (hero.type !== 'hero') throw new Error('expected hero');
    hero.slides[0].ctaTarget = { kind: 'category', categoryId: '11111111-1111-1111-1111-111111111111' };

    const { layout: out } = normalizeStorefrontLayoutForSave(layout);
    const outHero = out.sections[0];
    if (outHero.type !== 'hero') throw new Error('expected hero');
    expect(outHero.slides[0].ctaTarget).toEqual({
      kind: 'category',
      categoryId: '11111111-1111-1111-1111-111111111111',
    });
  });

  it('drops nav items with an empty target id, and reports the count', () => {
    const layout = baseLayout();
    const complete: NavItem = {
      id: 'nav-1',
      kind: 'category',
      categoryId: '11111111-1111-1111-1111-111111111111',
      label: 'Fragrance',
    };
    const incompleteId: NavItem = { id: 'nav-2', kind: 'product', productId: '', label: 'Featured' };
    layout.navbar.items = [complete, incompleteId];

    const { layout: out, droppedNavItemCount } = normalizeStorefrontLayoutForSave(layout);
    expect(out.navbar.items).toEqual([complete]);
    expect(droppedNavItemCount).toBe(1);
  });

  it('drops nav items with an empty label', () => {
    const layout = baseLayout();
    const incompleteLabel: NavItem = {
      id: 'nav-3',
      kind: 'brand',
      brandId: '22222222-2222-2222-2222-222222222222',
      label: '',
    };
    layout.navbar.items = [incompleteLabel];

    const { layout: out, droppedNavItemCount } = normalizeStorefrontLayoutForSave(layout);
    expect(out.navbar.items).toEqual([]);
    expect(droppedNavItemCount).toBe(1);
  });

  it('drops link nav items with an empty href', () => {
    const layout = baseLayout();
    layout.navbar.items = [{ id: 'nav-4', kind: 'link', href: '', label: 'Journal' }];

    const { layout: out, droppedNavItemCount } = normalizeStorefrontLayoutForSave(layout);
    expect(out.navbar.items).toEqual([]);
    expect(droppedNavItemCount).toBe(1);
  });

  it('never mutates the input layout', () => {
    const layout = baseLayout();
    const hero = layout.sections[0];
    if (hero.type !== 'hero') throw new Error('expected hero');
    hero.slides[0].ctaTarget = { kind: 'product', productId: '' };
    layout.navbar.items = [{ id: 'nav-5', kind: 'link', href: '', label: '' }];

    normalizeStorefrontLayoutForSave(layout);

    expect(hero.slides[0].ctaTarget).toEqual({ kind: 'product', productId: '' });
    expect(layout.navbar.items).toHaveLength(1);
  });

  it('produces a layout with no empty-string uuid fields or empty nav labels — the invariant', () => {
    const layout = baseLayout();
    const hero = layout.sections[0];
    if (hero.type !== 'hero') throw new Error('expected hero');
    hero.slides[0].ctaTarget = { kind: 'product', productId: '' };
    layout.navbar.items = [
      { id: 'nav-6', kind: 'product', productId: '', label: 'Bestseller' },
      { id: 'nav-7', kind: 'link', href: '/journal', label: '' },
      { id: 'nav-8', kind: 'category', categoryId: '33333333-3333-3333-3333-333333333333', label: 'New in' },
    ];

    const { layout: out } = normalizeStorefrontLayoutForSave(layout);

    for (const section of out.sections) {
      if (section.type !== 'hero') continue;
      for (const slide of section.slides) {
        if (slide.ctaTarget.kind === 'product') expect(slide.ctaTarget.productId).not.toBe('');
        if (slide.ctaTarget.kind === 'category') expect(slide.ctaTarget.categoryId).not.toBe('');
        if (slide.ctaTarget.kind === 'brand') expect(slide.ctaTarget.brandId).not.toBe('');
      }
    }
    for (const item of out.navbar.items) {
      expect(item.label.trim()).not.toBe('');
      if (item.kind === 'category') expect(item.categoryId).not.toBe('');
      if (item.kind === 'brand') expect(item.brandId).not.toBe('');
      if (item.kind === 'product') expect(item.productId).not.toBe('');
      if (item.kind === 'collaborator') expect(item.collaboratorId).not.toBe('');
      if (item.kind === 'link') expect(item.href).not.toBe('');
    }
    expect(out.navbar.items).toEqual([
      { id: 'nav-8', kind: 'category', categoryId: '33333333-3333-3333-3333-333333333333', label: 'New in' },
    ]);
  });
});

/**
 * The ribbon textarea now keeps blank lines and trailing spaces while the
 * admin is still typing (see ribbon-editor.test.tsx), so the cleanup that used
 * to happen on every keystroke has to happen here instead. The backend rejects
 * an empty phrase outright — `z.array(z.string().min(1))` — so a layout that
 * reached the API with a blank item would fail the whole save.
 */
describe('normalizeStorefrontLayoutForSave — ribbon phrases', () => {
  it('trims phrases and drops the blank lines left behind by typing', () => {
    const layout = baseLayout();
    layout.sections = [
      {
        id: 'ribbon-1',
        type: 'ribbon',
        enabled: true,
        order: 0,
        items: ['  shipping all over egypt ', '', '   ', "New S/S '26"],
        speedSeconds: 38,
        surface: 'ink',
      },
    ];

    const { layout: out } = normalizeStorefrontLayoutForSave(layout);
    const ribbon = out.sections[0];
    if (ribbon.type !== 'ribbon') throw new Error('expected a ribbon section');
    expect(ribbon.items).toEqual(['shipping all over egypt', "New S/S '26"]);
  });

  it('leaves the on-screen layout untouched', () => {
    const layout = baseLayout();
    layout.sections = [
      {
        id: 'ribbon-1',
        type: 'ribbon',
        enabled: true,
        order: 0,
        items: ['one', ''],
        speedSeconds: 38,
        surface: 'ink',
      },
    ];

    normalizeStorefrontLayoutForSave(layout);
    const original = layout.sections[0];
    if (original.type !== 'ribbon') throw new Error('expected a ribbon section');
    expect(original.items).toEqual(['one', '']);
  });
});

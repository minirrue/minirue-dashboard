import { countByTab, hasPlaceholders, pageAddressProblem, runChecks } from '@/lib/storefront/checks';
import { newSection, normalizeStorefrontLayoutForSave } from '@/lib/api/storefront';
import type { StorefrontLayout, StorefrontPage } from '@/lib/api/storefront';

function layout(patch: Partial<StorefrontLayout> = {}): StorefrontLayout {
  return {
    version: 2,
    productSection: { perks: [] },
    announcement: { enabled: false, messages: [], linkUrl: null, background: null },
    faviconUrl: null,
    sections: [{ ...newSection('ribbon', 0), enabled: true }],
    navbar: { items: [], showSearch: true, showAccount: true },
    mobileMenu: { shortcuts: [], footerButton: null },
    footer: {
      tagline: null, newsletterEnabled: false, newsletterEyebrow: '', newsletterBlurb: '',
      columns: [], socials: [], paymentBadges: [], legalLine: '', secondaryLine: '',
    },
    pages: [],
    trust: { returnsWindowDays: 14, whatsappNumber: '+201000000000', supportHours: null },
    ...patch,
  };
}

const page = (slug: string, extra: Partial<StorefrontPage> = {}): StorefrontPage => ({
  id: `pg-${slug}`, slug, title: slug || 'Untitled', body: '', enabled: true, ...extra,
});

describe('storefront checks — before you publish (dashboard#102)', () => {
  it('passes a clean layout', () => {
    expect(runChecks(layout())).toEqual([]);
  });

  it('blocks a page whose address can never be reached, instead of letting save delete it', () => {
    const pages = [page('shop'), page('bundles'), page('collab'), page('Bad Slug'), page('')];
    for (const p of pages) expect(pageAddressProblem(p, pages)).not.toBeNull();
    const checks = runChecks(layout({ pages }));
    expect(checks.filter((c) => c.severity === 'block')).toHaveLength(5);
    // Proof of why it blocks: the save path silently drops invalid addresses.
    const saved = normalizeStorefrontLayoutForSave(layout({ pages: [page('Bad Slug')] })).layout;
    expect(saved.pages).toHaveLength(0);
  });

  it('blocks a duplicated address, and allows a normal one', () => {
    const pages = [page('about'), { ...page('about'), id: 'pg-about-2' }];
    expect(pageAddressProblem(pages[0], pages)).toMatch(/also used/);
    expect(pageAddressProblem(page('privacy-policy'), [page('privacy-policy')])).toBeNull();
  });

  it('warns when a shown page still has [placeholders]', () => {
    expect(hasPlaceholders('Company: [registered company name]')).toBe(true);
    expect(hasPlaceholders('[x]')).toBe(false); // too short to be a placeholder
    const checks = runChecks(layout({ pages: [page('terms', { body: 'Reg no.: [number]' })] }));
    expect(checks.map((c) => c.id)).toContain('ph-pg-terms');
  });

  it('names unfinished menu items and phone tiles, the same ones publishing drops', () => {
    const l = layout({
      navbar: { items: [{ id: 'n1', kind: 'category', categoryId: '', label: 'New in' }], showSearch: true, showAccount: true },
      mobileMenu: { shortcuts: [{ id: 't1', label: '', icon: 'grid', target: { kind: 'brands' } }], footerButton: null },
    });
    const ids = runChecks(l).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['nav-n1', 'tile-t1']));
    const r = normalizeStorefrontLayoutForSave(l);
    expect(r.droppedNavItemCount + r.droppedMobileMenuItemCount).toBe(2);
  });

  it('warns about a hero picture with no description', () => {
    const hero = newSection('hero', 0);
    if (hero.type !== 'hero') throw new Error('expected hero');
    hero.enabled = true;
    hero.slides[0] = { ...hero.slides[0], mode: 'image', imageGalleryItemId: 'g1', imageAlt: '' };
    const checks = runChecks(layout({ sections: [hero] }));
    expect(checks.find((c) => c.id.startsWith('alt-'))?.focus).toMatchObject({ sectionId: hero.id, slideIndex: 0 });
  });

  it('warns when returns are promised but no window is set', () => {
    const l = layout({
      trust: { returnsWindowDays: null, whatsappNumber: '+20', supportHours: null },
      productSection: { perks: [{ id: 'p1', icon: 'returns', text: '{returnsDays}-day returns', showWhen: 'returns', enabled: true }] },
    });
    expect(runChecks(l).map((c) => c.id)).toContain('returns-unset');
  });

  it('counts per tab, ignoring info and marking blockers', () => {
    const counts = countByTab(runChecks(layout({ pages: [page('shop')], trust: { returnsWindowDays: 14, whatsappNumber: null, supportHours: null } })));
    expect(counts.pages).toEqual({ n: 1, block: true });
    expect(counts.trust).toBeUndefined(); // "no WhatsApp" is info only
  });
});

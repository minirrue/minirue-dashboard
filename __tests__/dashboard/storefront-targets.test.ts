import {
  TARGET_KINDS,
  blankTarget,
  fromCta,
  fromMenu,
  fromNav,
  hrefFor,
  isTargetComplete,
  kindCanHold,
  kindOfHref,
  moveInList,
  resolveBrandHref,
  toCta,
  toMenu,
  toNavItem,
} from '@/lib/storefront/targets';
import type { CtaTarget, MobileMenuTarget, NavItem } from '@/lib/api/storefront';

/**
 * One destination model for the whole Storefront editor (dashboard#102).
 * The stored shapes must round-trip exactly — the backend schema has not changed.
 */
describe('storefront targets — one model, stored shapes unchanged', () => {
  it('round-trips every hero button shape', () => {
    const shapes: CtaTarget[] = [
      { kind: 'scroll' },
      { kind: 'url', url: '/shop/all' },
      { kind: 'product', productId: 'p1' },
      { kind: 'category', categoryId: 'c1' },
      { kind: 'brand', brandId: 'b1' },
    ];
    for (const s of shapes) expect(toCta(fromCta(s))).toEqual(s);
  });

  it('round-trips every phone-menu target, built-ins included', () => {
    const shapes: MobileMenuTarget[] = [
      { kind: 'home' }, { kind: 'search' }, { kind: 'account' }, { kind: 'cart' }, { kind: 'brands' },
      { kind: 'category', categoryId: 'c1' }, { kind: 'brand', brandId: 'b1' },
      { kind: 'product', productId: 'p1' }, { kind: 'collaborator', collaboratorId: 'k1' },
      { kind: 'link', href: '/x' },
    ];
    for (const s of shapes) expect(toMenu(fromMenu(s))).toEqual(s);
  });

  it('keeps a menu item’s id, label and featured products when its destination changes within a category', () => {
    const item: NavItem = { id: 'n1', kind: 'category', categoryId: 'c1', label: 'Skincare', featuredProductIds: ['p1'] };
    expect(toNavItem({ kind: 'category', id: 'c2' }, item)).toEqual({ ...item, categoryId: 'c2' });
    expect(toNavItem({ kind: 'link', href: '/shop/all' }, item)).toEqual({ id: 'n1', kind: 'link', href: '/shop/all', label: 'Skincare' });
    expect(fromNav(item)).toEqual({ kind: 'category', id: 'c1' });
  });

  it('has one “finished?” rule: built-ins need nothing, entities need an id, links need an href', () => {
    expect(isTargetComplete({ kind: 'home' })).toBe(true);
    expect(isTargetComplete({ kind: 'scroll' })).toBe(true);
    expect(isTargetComplete(blankTarget('category'))).toBe(false);
    expect(isTargetComplete({ kind: 'category', id: 'c1' })).toBe(true);
    expect(isTargetComplete(blankTarget('link'))).toBe(false);
    expect(isTargetComplete({ kind: 'link', href: '  ' })).toBe(false);
  });

  it('offers each place only what its backend schema accepts', () => {
    expect(TARGET_KINDS.cta).toEqual(['scroll', 'product', 'category', 'brand', 'link']);
    expect(TARGET_KINDS.nav).not.toContain('scroll');
    expect(TARGET_KINDS.footer).toEqual(['page', 'category', 'brand', 'link']);
  });

  it('is the one reorder helper', () => {
    expect(moveInList(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    const list = ['a', 'b'];
    expect(moveInList(list, 0, -1)).toBe(list); // refuses to move past either end
  });
});

describe('storefront targets — canonical links, older links still read', () => {
  const pages = ['shipping', 'about'];

  it('writes the canonical addresses the storefront serves without a redirect', () => {
    expect(hrefFor.category('skincare')).toBe('/shop/skincare');
    expect(hrefFor.brand('brand-1')).toBe('/shop/all?brandId=brand-1');
    expect(hrefFor.page('shipping')).toBe('/shipping');
  });

  it('recognises every shape that was ever saved', () => {
    expect(kindOfHref('/shop/skincare', pages)).toBe('category');
    expect(kindOfHref('/categories/skincare', pages)).toBe('category');
    expect(kindOfHref('/shop/all?brandId=brand-1', pages)).toBe('brand');
    expect(kindOfHref('/products?brand=Dior', pages)).toBe('brand');
    expect(kindOfHref('/shop/all?brand=Dior', pages)).toBe('brand');
    expect(kindOfHref('/brands/dior', pages)).toBe('brand');
    expect(kindOfHref('/shipping', pages)).toBe('page');
    expect(kindOfHref('https://instagram.com/minirue', pages)).toBe('link');
    expect(kindOfHref('mailto:hi@minirueshop.com', pages)).toBe('link');
    expect(kindOfHref('/not-a-page', pages)).toBe('link');
  });

  it('resolves a legacy brand name or slug onto the real brand, so it re-saves canonical', () => {
    const brands = [{ id: 'brand-1', label: 'Dior' }];
    expect(resolveBrandHref('/products?brand=Dior', brands)).toBe('/shop/all?brandId=brand-1');
    expect(resolveBrandHref('/brands/dior', brands)).toBe('/shop/all?brandId=brand-1');
    expect(resolveBrandHref('/shop/all?brandId=gone', brands)).toBe('');
  });

  it('keeps a deliberate choice while it can still describe the stored href (an empty custom link stays custom)', () => {
    expect(kindCanHold('link', '', pages)).toBe(true);
    expect(kindCanHold('link', '/shop/skincare', pages)).toBe(true);
    expect(kindCanHold('page', '/shop/skincare', pages)).toBe(false);
    expect(kindCanHold('category', '/shop/skincare', pages)).toBe(true);
  });
});

import { newSection, moveSection, newId } from '@/lib/api/storefront';
import type { StorefrontSection } from '@/lib/api/storefront';

describe('newSection', () => {
  it('creates a hero with one blank slide', () => {
    const s = newSection('hero', 0);
    expect(s.type).toBe('hero');
    if (s.type !== 'hero') throw new Error('expected hero');
    expect(s.slides).toHaveLength(1);
    expect(s.enabled).toBe(true);
    expect(s.order).toBe(0);
  });

  it('creates a manual-source product grid', () => {
    const s = newSection('productGrid', 3);
    if (s.type !== 'productGrid') throw new Error('expected productGrid');
    expect(s.source).toEqual({ kind: 'manual', productIds: [] });
    expect(s.order).toBe(3);
  });

  it('gives every section a unique id', () => {
    const ids = new Set([newSection('ribbon', 0).id, newSection('ribbon', 1).id]);
    expect(ids.size).toBe(2);
  });
});

describe('moveSection', () => {
  const list = (): StorefrontSection[] => [
    newSection('hero', 0),
    newSection('ribbon', 1),
    newSection('journal', 2),
  ];

  it('swaps with the previous section and renumbers', () => {
    const out = moveSection(list(), 1, -1);
    expect(out.map((s) => s.type)).toEqual(['ribbon', 'hero', 'journal']);
    expect(out.map((s) => s.order)).toEqual([0, 1, 2]);
  });

  it('is a no-op at the top', () => {
    const out = moveSection(list(), 0, -1);
    expect(out.map((s) => s.type)).toEqual(['hero', 'ribbon', 'journal']);
  });

  it('is a no-op at the bottom', () => {
    const out = moveSection(list(), 2, 1);
    expect(out.map((s) => s.type)).toEqual(['hero', 'ribbon', 'journal']);
  });
});

describe('newId', () => {
  it('prefixes and stays unique', () => {
    expect(newId('slide')).toMatch(/^slide-/);
    expect(newId('slide')).not.toBe(newId('slide'));
  });
});

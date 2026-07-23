import { blankNavItem } from '@/app/dashboard/storefront-appearance/editors/NavbarEditor';

describe('blankNavItem', () => {
  it('creates a link item with an empty href', () => {
    const item = blankNavItem('link');
    expect(item.kind).toBe('link');
    if (item.kind !== 'link') throw new Error('expected link');
    expect(item.href).toBe('');
    expect(item.label).toBe('');
    expect(item.id).toMatch(/^nav-/);
  });

  it('creates a category item with no category chosen', () => {
    const item = blankNavItem('category');
    if (item.kind !== 'category') throw new Error('expected category');
    expect(item.categoryId).toBe('');
  });

  it('gives each item a unique id', () => {
    expect(blankNavItem('link').id).not.toBe(blankNavItem('link').id);
  });
});

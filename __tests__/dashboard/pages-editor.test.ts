import { newPage, slugify, SLUG_PATTERN } from '@/lib/api/storefront';

describe('slugify', () => {
  it('lowercases and hyphenates punctuation', () => {
    expect(slugify('Privacy Policy!')).toBe('privacy-policy');
  });

  it('collapses runs of non-alphanumerics and strips leading/trailing hyphens', () => {
    expect(slugify('  Shipping & Returns ')).toBe('shipping-returns');
  });

  it('produces slugs matching the backend slug regex', () => {
    expect(SLUG_PATTERN.test(slugify('Privacy Policy!'))).toBe(true);
    expect(SLUG_PATTERN.test(slugify('  Shipping & Returns '))).toBe(true);
  });
});

describe('newPage', () => {
  it('creates a blank, enabled page with a unique id', () => {
    const a = newPage();
    const b = newPage();
    expect(a.id).not.toBe(b.id);
    expect(a.title).toBe('');
    expect(a.slug).toBe('');
    expect(a.body).toBe('');
    expect(a.enabled).toBe(true);
  });
});

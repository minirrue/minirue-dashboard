import { moveSlide } from '@/app/dashboard/storefront-appearance/editors/HeroEditor';
import type { HeroSlide } from '@/lib/api/storefront';

const slide = (id: string): HeroSlide => ({
  id, eyebrow: '', headline: '', sub: '', tagline: '',
  mode: 'editorial', imageGalleryItemId: null, imageAlt: '', background: '#000',
  bottle: null, cap: null, ctaLabel: null, ctaTarget: { kind: 'scroll' },
});

describe('moveSlide', () => {
  it('reorders slides', () => {
    expect(moveSlide([slide('a'), slide('b')], 1, -1).map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('leaves ids untouched so React keys stay stable', () => {
    const out = moveSlide([slide('a'), slide('b'), slide('c')], 0, 1);
    expect(out.map((s) => s.id)).toEqual(['b', 'a', 'c']);
  });

  it('refuses to move past the ends', () => {
    expect(moveSlide([slide('a')], 0, 1).map((s) => s.id)).toEqual(['a']);
  });
});

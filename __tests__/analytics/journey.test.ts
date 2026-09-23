import { describe, expect, it } from '@jest/globals';
import { pageKindOfPath, stepKind, viewSessions, type KnownRoutes } from '@/lib/analytics/journey';

const routes: KnownRoutes = { categories: new Set(['skincare']), products: new Set(['arencia-retinal-booster-shot']) };

describe('page types from the shop’s real routes', () => {
  it('home, shop, category, product, bag, checkout, own pages', () => {
    expect(pageKindOfPath('/', routes)).toBe('home');
    expect(pageKindOfPath('/?utm_source=tiktok', routes)).toBe('home');
    expect(pageKindOfPath('/shop', routes)).toBe('category');
    expect(pageKindOfPath('/shop/all', routes)).toBe('category');
    expect(pageKindOfPath('/shop/skincare', routes)).toBe('category');
    expect(pageKindOfPath('/shop/skincare/arencia-retinal-booster-shot', routes)).toBe('product');
    expect(pageKindOfPath('/cart', routes)).toBe('bag');
    expect(pageKindOfPath('/checkout/delivery', routes)).toBe('checkout');
    expect(pageKindOfPath('/terms', routes)).toBe('page');
  });

  it('a /shop slug the catalogue doesn’t have is an unknown path', () => {
    expect(pageKindOfPath('/shop/skincaree', routes)).toBe('unknown');
    expect(pageKindOfPath('/shop/skincare/old-product', routes)).toBe('unknown');
    // Before the catalogue loads, a well-formed /shop path is trusted.
    expect(pageKindOfPath('/shop/skincaree', null)).toBe('category');
  });

  it('the event decides first, the path second', () => {
    expect(stepKind({ kind: 'product_view', path: '/weird' }, routes)).toBe('product');
    expect(stepKind({ kind: 'add_to_cart', path: '/shop/skincare' }, routes)).toBe('bag');
    expect(stepKind({ kind: 'checkout_shipping_selected' }, routes)).toBe('checkout');
    expect(stepKind({ kind: 'purchase' }, routes)).toBe('checkout');
    expect(stepKind({ kind: 'page_view', path: '/' }, routes)).toBe('home');
    expect(stepKind({ kind: 'section_dwell', path: '/' }, routes)).toBe('action');
  });
});

describe('the journey view', () => {
  const sessions = [
    {
      sessionId: 'old',
      startedAt: '2026-09-16T19:10:00.000Z',
      endedAt: '2026-09-16T19:16:00.000Z',
      touch: { platform: 'Instagram', medium: 'social', campaign: null, landingPath: '/' },
      summary: 'Looked at 1 product, added nothing.',
      steps: [{ at: '2026-09-16T19:10:00.000Z', kind: 'page_view', label: 'Page view', path: '/' }],
    },
    {
      sessionId: 'new',
      startedAt: '2026-09-18T18:04:00.000Z',
      endedAt: '2026-09-18T18:08:00.000Z',
      touch: { platform: 'TikTok', medium: 'paid', campaign: 'Minirueshop', landingPath: '/shop/skincare' },
      summary: 'Added to bag, did not check out.',
      steps: [
        { at: '2026-09-18T18:04:00.000Z', kind: 'page_view', label: 'Page view', path: '/shop/skincare?ttclid=1' },
        { at: '2026-09-18T18:05:00.000Z', kind: 'product_view', label: 'Viewed Arencia Retinal Booster Shot', path: '/shop/skincare/arencia-retinal-booster-shot' },
        { at: '2026-09-18T18:07:00.000Z', kind: 'add_to_cart', label: 'Added to bag', valueMinor: 113900 },
      ],
    },
  ];

  it('newest session first, every step typed, ending in Left', () => {
    const v = viewSessions(sessions, routes);
    expect(v.map((s) => s.sessionId)).toEqual(['new', 'old']);
    expect(v[0].steps.map((s) => s.page)).toEqual(['category', 'product', 'bag', 'exit']);
    expect(v[0].steps[0].label).toBe('Landed on /shop/skincare');
    expect(v[0].steps[2].key).toBe(true);
    expect(v[0].steps[3]).toMatchObject({ kind: 'exit', label: 'Left', at: '2026-09-18T18:08:00.000Z' });
    expect(v[0].durationSeconds).toBe(240);
    expect(v[1].steps[0].label).toBe('Landed on Home');
  });
});

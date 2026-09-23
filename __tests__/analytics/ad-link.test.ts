import { SHOP_ORIGIN, buildUtmLink, slugifyUtm } from '@/lib/analytics/ad-link';

/**
 * PG-DASHBOARD-ACCTG-007 (minirue-dashboard#64). The Growth tab's UTM link
 * builder. The backend (backend#165) maps an order to a spend row by
 * `lower(trim(utm_campaign))`, and to META / TIKTOK / GOOGLE by a utm_source
 * naming the network, so the builder normalises values the same way.
 */

describe('slugifyUtm', () => {
  it('lowercases, trims and joins words with hyphens', () => {
    expect(slugifyUtm('  Eid Sale 2026 ')).toBe('eid-sale-2026');
  });

  it('drops characters that would need escaping and collapses repeats', () => {
    expect(slugifyUtm('Summer / Glow -- Launch!')).toBe('summer-glow-launch');
    expect(slugifyUtm('lip_oil.v2')).toBe('lip_oil.v2');
  });

  it('keeps Arabic letters and digits', () => {
    expect(slugifyUtm('عرض العيد')).toBe('عرض-العيد');
  });
});

describe('buildUtmLink', () => {
  const base = { path: '', source: 'facebook', medium: 'paid_social', campaign: 'eid-sale' };

  it('tags the shop home page in source, medium, campaign order', () => {
    expect(buildUtmLink(base)).toEqual({
      ok: true,
      url: `${SHOP_ORIGIN}/?utm_source=facebook&utm_medium=paid_social&utm_campaign=eid-sale`,
    });
    expect(SHOP_ORIGIN).toBe('https://minirueshop.com');
  });

  it('accepts a path with or without its leading slash', () => {
    const a = buildUtmLink({ ...base, path: 'products/revox-plex' });
    const b = buildUtmLink({ ...base, path: '/products/revox-plex' });
    expect(a).toEqual(b);
    expect(a.ok && a.url).toBe(
      'https://minirueshop.com/products/revox-plex?utm_source=facebook&utm_medium=paid_social&utm_campaign=eid-sale',
    );
  });

  it('accepts a pasted shop URL, keeps its own query and hash, and replaces old utm tags', () => {
    const r = buildUtmLink({
      ...base,
      path: 'https://www.minirueshop.com/products/x?color=red&utm_source=old#reviews',
    });
    expect(r.ok && r.url).toBe(
      'https://minirueshop.com/products/x?color=red&utm_source=facebook&utm_medium=paid_social&utm_campaign=eid-sale#reviews',
    );
  });

  it('normalises the values the way the backend matches them', () => {
    const r = buildUtmLink({ ...base, source: ' TikTok ', medium: 'Paid Social', campaign: 'Eid Sale' });
    expect(r.ok && r.url).toContain('utm_source=tiktok&utm_medium=paid-social&utm_campaign=eid-sale');
  });

  it('adds utm_content only when given', () => {
    const r = buildUtmLink({ ...base, content: 'Video A' });
    expect(r.ok && r.url).toMatch(/&utm_campaign=eid-sale&utm_content=video-a$/);
  });

  it('refuses a link to another site', () => {
    expect(buildUtmLink({ ...base, path: 'https://example.com/x' })).toEqual({
      ok: false,
      errors: { path: 'Use a page on minirueshop.com.' },
    });
  });

  it('names every missing required field and builds nothing', () => {
    expect(buildUtmLink({ path: '/', source: ' ', medium: '', campaign: '!!' })).toEqual({
      ok: false,
      errors: {
        source: 'Add where the ad runs, e.g. facebook.',
        medium: 'Add the kind of traffic, e.g. paid.',
        campaign: 'Add the campaign name.',
      },
    });
  });

  it('refuses a campaign longer than the spend log stores (120 characters)', () => {
    const r = buildUtmLink({ ...base, campaign: 'a'.repeat(121) });
    expect(r).toEqual({ ok: false, errors: { campaign: 'Keep the campaign to 120 characters.' } });
  });
});

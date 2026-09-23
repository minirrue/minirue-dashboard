import { describe, expect, it } from '@jest/globals';
import { AD_PLATFORMS, buildAdLink, classifyAdLink, knownRoutes, landingChoices } from '@/lib/analytics/ad-link';

/** Analytics: "Build a correct ad link" (dashboard#128). */
describe('buildAdLink: platform-correct dynamic parameters', () => {
  const base = { landingPath: '/shop/skincare/arencia-retinal-booster-shot', campaign: 'Retinal Launch Sep26' };

  it('TikTok fills __CAMPAIGN_ID__, __AID_NAME__ and the ad name', () => {
    const r = buildAdLink({ ...base, platform: 'tiktok' });
    expect(r.ok && r.url).toBe(
      'https://minirueshop.com/shop/skincare/arencia-retinal-booster-shot?utm_source=tiktok&utm_medium=paid&utm_campaign=retinal-launch-sep26&utm_id=__CAMPAIGN_ID__&utm_content=__CID_NAME__&utm_term=__AID_NAME__',
    );
  });

  it('Meta keeps its {{…}} macros literal, as Ads Manager needs them', () => {
    const r = buildAdLink({ ...base, platform: 'meta', content: 'UGC video 02' });
    expect(r.ok && r.params).toBe(
      'utm_source={{site_source_name}}&utm_medium=paid&utm_campaign=retinal-launch-sep26&utm_id={{campaign.id}}&utm_content=ugc-video-02&utm_term={{adset.name}}',
    );
  });

  it('Google uses {campaignid} and {keyword} with cpc', () => {
    const r = buildAdLink({ ...base, platform: 'google' });
    expect(r.ok && r.params).toBe('utm_source=google&utm_medium=cpc&utm_campaign=retinal-launch-sep26&utm_id={campaignid}&utm_content={creative}&utm_term={keyword}');
  });

  it('the URL is the landing page plus exactly the params-only string', () => {
    const r = buildAdLink({ ...base, platform: 'tiktok' });
    if (!r.ok) throw new Error('expected a link');
    expect(r.url).toBe(`https://minirueshop.com${base.landingPath}?${r.params}`);
    expect(AD_PLATFORMS.tiktok.paramsField && AD_PLATFORMS.meta.paramsField).toBe(true);
  });

  it('requires a readable campaign name, never a bare number', () => {
    expect(buildAdLink({ ...base, platform: 'tiktok', campaign: '  ' })).toMatchObject({ ok: false, errors: { campaign: expect.stringContaining('readable name') } });
    expect(buildAdLink({ ...base, platform: 'tiktok', campaign: '120250555651910697' })).toMatchObject({ ok: false, errors: { campaign: expect.stringContaining('number') } });
  });

  it('encodes a non-Latin name but never a macro', () => {
    const r = buildAdLink({ ...base, platform: 'tiktok', campaign: 'عرض العيد' });
    expect(r.ok && r.params).toContain(`utm_campaign=${encodeURIComponent('عرض-العيد')}&utm_id=__CAMPAIGN_ID__`);
  });

  it('refuses anything that is not a path on the shop', () => {
    expect(buildAdLink({ ...base, platform: 'tiktok', landingPath: 'https://evil.example' })).toMatchObject({ ok: false, errors: { landing: 'Pick a page on the shop.' } });
  });
});

describe('landing pages come only from the real routes', () => {
  const categories = [{ id: 'c1', name: 'Skincare', slug: 'skincare', children: [{ id: 'c2', name: 'Serums', slug: 'serums' }] }];
  const products = [
    { id: 'p1', name: 'Arencia Retinal Booster Shot', slug: 'arencia-retinal-booster-shot', categoryId: 'c1', status: 'PUBLISHED' },
    { id: 'p2', name: 'Draft thing', slug: 'draft-thing', categoryId: 'c1', status: 'DRAFT' },
    { id: 'p3', name: 'Night Serum', slug: 'night-serum', categoryId: 'c2', status: 'PUBLISHED' },
    { id: 'p4', name: 'Orphan', slug: 'orphan', categoryId: 'gone', status: 'PUBLISHED' },
  ];

  it('/, /shop, /shop/all, every category, every published product under its own category', () => {
    expect(landingChoices(categories, products).map((c) => c.value)).toEqual([
      '/',
      '/shop',
      '/shop/all',
      '/shop/serums',
      '/shop/skincare',
      '/shop/skincare/arencia-retinal-booster-shot',
      '/shop/serums/night-serum',
    ]);
  });

  it('knows which slugs exist', () => {
    const r = knownRoutes(categories, products);
    expect(r.categories.has('serums')).toBe(true);
    expect(r.products.has('night-serum')).toBe(true);
  });
});

describe('classifyAdLink: how analytics will file the link', () => {
  const routes = knownRoutes([{ id: 'c', name: 'Skincare', slug: 'skincare' }], []);

  it('a correct TikTok link is paid, credited and lands on a real page', () => {
    const r = buildAdLink({ platform: 'tiktok', landingPath: '/shop/skincare', campaign: 'eid' });
    if (!r.ok) throw new Error('expected a link');
    const reading = classifyAdLink(r.url, routes);
    expect(reading.ok).toBe(true);
    expect(reading.touches.map((t) => t.touch.platform)).toEqual(['TikTok']);
    expect(reading.lines[0]).toBe('Filed as TikTok · Paid ads.');
    expect(reading.lines[1]).toBe('Credited to campaign “eid”.');
  });

  it('Meta’s {{site_source_name}} files as Facebook or Instagram, totalled under Meta', () => {
    const r = buildAdLink({ platform: 'meta', landingPath: '/', campaign: 'eid' });
    if (!r.ok) throw new Error('expected a link');
    const reading = classifyAdLink(r.url);
    expect(reading.touches.map((t) => t.touch.platform)).toEqual(['Facebook', 'Instagram']);
    expect(reading.lines[0]).toBe('Filed as Facebook or Instagram · Paid ads, totalled under Meta.');
  });

  it('flags an unfilled placeholder and an unknown page', () => {
    const reading = classifyAdLink('https://minirueshop.com/shop/skincaree?utm_source=tiktok&utm_medium=paid&utm_campaign=__CAMPAIGN_NAME__', routes);
    expect(reading.ok).toBe(false);
    expect(reading.campaignState).toBe('macro');
    expect(reading.landing).toBe('unknown');
  });
});

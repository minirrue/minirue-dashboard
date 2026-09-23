import { describe, expect, it } from '@jest/globals';
import {
  campaignLabel,
  campaignState,
  channelOf,
  classifyTouch,
  isUncredited,
  landingKey,
  networkOf,
  parseUtm,
  platformPill,
  shortPath,
  sourceLabel,
  stripClickIds,
} from '@/lib/analytics/source';

/**
 * `classifyTouch` is a port of the backend's source normalizer
 * (analytics-web/util/source-normalizer.util.ts). These are the backend
 * spec's own cases, so the ad-link readout can never disagree with how the
 * server files a visit.
 */
describe('classifyTouch (same rules as the backend)', () => {
  it('tells Facebook from Instagram, both on the Meta network', () => {
    expect(classifyTouch({ utmSource: 'fb', utmMedium: 'paid' })).toEqual({ platform: 'Facebook', medium: 'paid', source: 'fb', network: 'Meta' });
    expect(classifyTouch({ utmSource: 'ig', utmMedium: 'paid' })).toMatchObject({ platform: 'Instagram', medium: 'paid', network: 'Meta' });
    expect(classifyTouch({ referrerHost: 'l.instagram.com' })).toMatchObject({ platform: 'Instagram', medium: 'social' });
    expect(classifyTouch({ referrerHost: 'm.facebook.com' })).toMatchObject({ platform: 'Facebook', medium: 'social' });
  });

  it('a bare fbclid is Meta, paid, app unknown', () => {
    expect(classifyTouch({ clickIds: { fbclid: 'x' } })).toMatchObject({ platform: 'Meta', medium: 'paid', network: 'Meta' });
  });

  it('TikTok, Google and click ids', () => {
    expect(classifyTouch({ utmSource: 'tiktok', utmMedium: 'paid' })).toMatchObject({ platform: 'TikTok', medium: 'paid', network: 'TikTok' });
    expect(classifyTouch({ clickIds: { ttclid: 'x' } })).toMatchObject({ platform: 'TikTok', medium: 'paid' });
    expect(classifyTouch({ utmSource: 'google', utmMedium: 'cpc' })).toMatchObject({ platform: 'Google', medium: 'paid' });
    expect(classifyTouch({ referrerHost: 'www.google.com.eg' })).toMatchObject({ platform: 'Google', medium: 'organic' });
  });

  it('only paid / cpc / paidsocial / ppc / ads mean paid: paid_social is not paid', () => {
    expect(classifyTouch({ utmSource: 'facebook', utmMedium: 'paid_social' }).medium).toBe('social');
    expect(classifyTouch({ utmSource: 'facebook', utmMedium: 'paidsocial' }).medium).toBe('paid');
  });

  it('an unrecognised source is kept by name, never folded into Other', () => {
    expect(classifyTouch({ utmSource: 'meta', utmMedium: 'paid' })).toMatchObject({ platform: 'meta', medium: 'paid', network: null });
    expect(classifyTouch({ referrerHost: 'blog.example.com' })).toMatchObject({ platform: 'blog.example.com', medium: 'referral' });
  });

  it('email by source or medium, and nothing at all is Direct', () => {
    expect(classifyTouch({ utmSource: 'newsletter' })).toMatchObject({ platform: 'Email', medium: 'email' });
    expect(classifyTouch({ utmSource: 'brevo', utmMedium: 'email' })).toMatchObject({ platform: 'Email', medium: 'email' });
    expect(classifyTouch({})).toEqual({ platform: 'Direct', medium: 'direct', source: 'direct', network: null });
  });
});

describe('channels and pills', () => {
  it('folds six mediums into four channels', () => {
    expect(channelOf('paid')).toBe('paid');
    expect(channelOf('social')).toBe('social');
    expect(channelOf('direct')).toBe('direct');
    expect(channelOf(null)).toBe('direct');
    expect(channelOf('organic')).toBe('referral');
    expect(channelOf('email')).toBe('referral');
  });

  it('names the network and the pill', () => {
    expect(networkOf('Instagram')).toBe('Meta');
    expect(networkOf('TikTok')).toBe('TikTok');
    expect(networkOf('Google')).toBeNull();
    expect(platformPill('Facebook')).toBe('facebook');
    expect(platformPill(null)).toBe('direct');
    expect(platformPill('example.com')).toBe('referral');
  });
});

describe('campaign names (the __CAMPAIGN_NAME__ problem)', () => {
  it('classifies every shape a campaign arrives in', () => {
    expect(campaignState('Minirueshop')).toBe('named');
    expect(campaignState('__CAMPAIGN_NAME__')).toBe('macro');
    expect(campaignState('{{campaign.name}}')).toBe('macro');
    expect(campaignState('{campaignid}')).toBe('macro');
    expect(campaignState('120250555651910697')).toBe('id-only');
    expect(campaignState('(none)')).toBe('missing');
    expect(campaignState(null)).toBe('missing');
    expect(campaignState('eid-2026')).toBe('named');
  });

  it('labels them the way the owner reads them', () => {
    expect(campaignLabel('__CAMPAIGN_NAME__')).toBe('campaign name missing');
    expect(campaignLabel('120250555651910697')).toBe('unnamed campaign');
    expect(campaignLabel('')).toBe('no campaign tag');
  });

  it('a paid visitor is uncredited unless the campaign is named', () => {
    expect(isUncredited('paid', '__CAMPAIGN_NAME__')).toBe(true);
    expect(isUncredited('paid', 'Minirueshop')).toBe(false);
    expect(isUncredited('social', null)).toBe(false);
  });

  it('source labels', () => {
    expect(sourceLabel({ platform: 'TikTok', medium: 'paid', campaign: 'Minirueshop' })).toBe('TikTok · Minirueshop');
    expect(sourceLabel({ platform: 'TikTok', medium: 'paid', campaign: '__CAMPAIGN_NAME__' })).toBe('TikTok · campaign name missing');
    expect(sourceLabel({ platform: 'Facebook', medium: 'paid', campaign: '120250555651910697' })).toBe('Facebook · unnamed campaign');
    expect(sourceLabel({ platform: 'TikTok', medium: 'social', campaign: null })).toBe('TikTok (organic)');
    expect(sourceLabel({ platform: 'Instagram', medium: 'social' })).toBe('Instagram');
    expect(sourceLabel({ platform: null, medium: 'direct' })).toBe('Direct');
  });
});

describe('urls', () => {
  const raw = 'https://minirueshop.com/shop/skincare?utm_source=tiktok&utm_campaign=Minirue%20shop&ttclid=E.C.P.123&fbclid=x#top';

  it('splits out utm parts and names the click ids', () => {
    const r = parseUtm(raw);
    expect(r.path).toBe('/shop/skincare');
    expect(r.utm.utm_source).toBe('tiktok');
    expect(r.utm.utm_campaign).toBe('Minirue shop');
    expect(r.utm.utm_medium).toBeNull();
    expect(r.clickIds).toEqual(['ttclid', 'fbclid']);
  });

  it('strips click ids but keeps the utm tags', () => {
    expect(stripClickIds('/shop/skincare?utm_source=tiktok&ttclid=abc')).toBe('/shop/skincare?utm_source=tiktok');
    expect(stripClickIds('/shop?gclid=1')).toBe('/shop');
  });

  it('prints a short path and a grouping key', () => {
    expect(shortPath('/shop/skincare?utm_source=tiktok&ttclid=abc')).toBe('/shop/skincare · ad tags');
    expect(shortPath('/')).toBe('/');
    expect(landingKey('/shop/skincare/?x=1')).toBe('/shop/skincare');
    expect(landingKey('/')).toBe('/');
    expect(landingKey(null)).toBe('');
  });
});

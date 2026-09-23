import type { PersonRow } from '@/lib/api/story';

let seq = 0;

/** A `/people` row (lib/api/story PersonRow) with sensible defaults: a direct bounce in Cairo. */
export function person(o: Partial<PersonRow> = {}): PersonRow {
  seq += 1;
  return {
    visitorId: `v-${seq}`,
    visitorNumber: 1000 + seq,
    trafficClass: 'REAL',
    customer: null,
    country: 'EG',
    city: 'Cairo',
    device: 'mobile',
    platform: 'Direct',
    medium: 'direct',
    campaign: null,
    landingPath: '/',
    referrerUrl: null,
    landingUrl: '/',
    productsViewed: [],
    furthestStage: null,
    cartValueMinor: 0,
    orders: 0,
    revenueMinor: 0,
    contactable: false,
    lastSeenAt: '2026-09-20T10:00:00.000Z',
    firstSeenAt: '2026-09-20T09:00:00.000Z',
    stopReason: 'bounced',
    stopDetail: 'Left after one page, no interaction.',
    ...o,
  };
}

export const tiktokNamed = (o: Partial<PersonRow> = {}) =>
  person({
    platform: 'TikTok',
    medium: 'paid',
    campaign: 'Minirueshop',
    landingPath: '/shop/skincare?utm_source=tiktok&utm_medium=paid&utm_campaign=Minirueshop&ttclid=abc',
    landingUrl: '/shop/skincare?utm_source=tiktok&utm_medium=paid&utm_campaign=Minirueshop',
    ...o,
  });

export const tiktokMacro = (o: Partial<PersonRow> = {}) =>
  person({
    platform: 'TikTok',
    medium: 'paid',
    campaign: '__CAMPAIGN_NAME__',
    landingPath: '/shop/skincare',
    landingUrl: '/shop/skincare?utm_source=tiktok&utm_medium=paid&utm_campaign=__CAMPAIGN_NAME__',
    ...o,
  });

export const metaIdOnly = (o: Partial<PersonRow> = {}) =>
  person({
    platform: 'Facebook',
    medium: 'paid',
    campaign: '120250555651910697',
    landingUrl: '/?utm_source=fb&utm_medium=paid&utm_campaign=120250555651910697',
    ...o,
  });

export const instagram = (o: Partial<PersonRow> = {}) => person({ platform: 'Instagram', medium: 'social', referrerUrl: 'l.instagram.com/', ...o });

/**
 * UTM link builder for the Growth tab (minirue-dashboard#64). Pure, so it is
 * tested on its own. The backend (backend#165) maps an order to a spend row by
 * `lower(trim(utm_campaign))` and to META / TIKTOK / GOOGLE by a utm_source that
 * names the network, so values are normalised to the same lowercase form here.
 */

export const SHOP_ORIGIN = 'https://minirueshop.com';

/** The spend log stores `utm_campaign` up to 120 characters. */
export const UTM_CAMPAIGN_MAX = 120;

const SHOP_HOSTS = new Set(['minirueshop.com', 'www.minirueshop.com']);
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id'];

export interface UtmLinkInput {
  /** A shop path (`/products/x`, `products/x`), a pasted shop URL, or blank for the home page. */
  path: string;
  source: string;
  medium: string;
  campaign: string;
  content?: string;
}

export type UtmField = 'path' | 'source' | 'medium' | 'campaign';

export type UtmLinkResult =
  | { ok: true; url: string }
  | { ok: false; errors: Partial<Record<UtmField, string>> };

/** Lowercase, trimmed, words joined by hyphens; letters, digits, `_` and `.` kept. */
export function slugifyUtm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_.]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function parseShopUrl(raw: string): URL | null {
  const text = raw.trim();
  const absolute = /^[a-z][a-z\d+.-]*:\/\//i.test(text)
    ? text
    : /^(www\.)?minirueshop\.com(\/|\?|#|$)/i.test(text)
      ? `https://${text}`
      : `${SHOP_ORIGIN}/${text.replace(/^\/+/, '')}`;
  try {
    const url = new URL(absolute);
    return SHOP_HOSTS.has(url.hostname.toLowerCase()) ? url : null;
  } catch {
    return null;
  }
}

export function buildUtmLink(input: UtmLinkInput): UtmLinkResult {
  const errors: Partial<Record<UtmField, string>> = {};
  const url = parseShopUrl(input.path);
  if (!url) errors.path = 'Use a page on minirueshop.com.';

  const source = slugifyUtm(input.source);
  const medium = slugifyUtm(input.medium);
  const campaign = slugifyUtm(input.campaign);
  const content = slugifyUtm(input.content ?? '');
  if (!source) errors.source = 'Add where the ad runs, e.g. facebook.';
  if (!medium) errors.medium = 'Add the kind of traffic, e.g. paid_social.';
  if (!campaign) errors.campaign = 'Add the campaign name.';
  else if (campaign.length > UTM_CAMPAIGN_MAX) {
    errors.campaign = `Keep the campaign to ${UTM_CAMPAIGN_MAX} characters.`;
  }

  if (!url || Object.keys(errors).length > 0) return { ok: false, errors };

  const params = new URLSearchParams(url.search);
  for (const key of UTM_KEYS) params.delete(key);
  params.append('utm_source', source);
  params.append('utm_medium', medium);
  params.append('utm_campaign', campaign);
  if (content) params.append('utm_content', content);

  return { ok: true, url: `${SHOP_ORIGIN}${url.pathname}?${params.toString()}${url.hash}` };
}

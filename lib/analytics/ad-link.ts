import { campaignState, channelOf, classifyTouch, networkOf, parseUtm, type NormalizedSource } from './source';
import { pageKindOfPath, type KnownRoutes, type PageKind } from './journey';

/**
 * Tagged ad links, one module for both builders (dashboard#128, #64):
 *
 * - `buildUtmLink`: the Accounting Growth tab's free-form builder (moved
 *   here from `lib/accounting/utm-link.ts`, unchanged in behaviour).
 * - `buildAdLink`: Analytics' "Build a correct ad link", which only offers
 *   the shop's real routes, requires a readable campaign name, and fills the
 *   id, ad-set and ad fields with each platform's own dynamic parameters so
 *   the platform writes them in when the ad runs.
 *
 * `classifyAdLink` then reads the finished link back through the same
 * normalizer the backend uses, so the owner sees how analytics will file the
 * visit before spending a pound on it.
 */

export const SHOP_ORIGIN = 'https://minirueshop.com';

/** The spend log stores `utm_campaign` up to 120 characters. */
export const UTM_CAMPAIGN_MAX = 120;

const SHOP_HOSTS = new Set(['minirueshop.com', 'www.minirueshop.com']);
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id'];

/** Lowercase, trimmed, words joined by hyphens; letters (any script), digits, `_` and `.` kept. */
export function slugifyUtm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_.]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseShopUrl(raw: string): URL | null {
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

/* ── Accounting's free-form builder ─────────────────────────────────────── */

export interface UtmLinkInput {
  /** A shop path (`/products/x`, `products/x`), a pasted shop URL, or blank for the home page. */
  path: string;
  source: string;
  medium: string;
  campaign: string;
  content?: string;
}

export type UtmField = 'path' | 'source' | 'medium' | 'campaign';

export type UtmLinkResult = { ok: true; url: string } | { ok: false; errors: Partial<Record<UtmField, string>> };

export function buildUtmLink(input: UtmLinkInput): UtmLinkResult {
  const errors: Partial<Record<UtmField, string>> = {};
  const url = parseShopUrl(input.path);
  if (!url) errors.path = 'Use a page on minirueshop.com.';

  const source = slugifyUtm(input.source);
  const medium = slugifyUtm(input.medium);
  const campaign = slugifyUtm(input.campaign);
  const content = slugifyUtm(input.content ?? '');
  if (!source) errors.source = 'Add where the ad runs, e.g. facebook.';
  if (!medium) errors.medium = 'Add the kind of traffic, e.g. paid.';
  if (!campaign) errors.campaign = 'Add the campaign name.';
  else if (campaign.length > UTM_CAMPAIGN_MAX) errors.campaign = `Keep the campaign to ${UTM_CAMPAIGN_MAX} characters.`;

  if (!url || Object.keys(errors).length > 0) return { ok: false, errors };

  const params = new URLSearchParams(url.search);
  for (const key of UTM_PARAMS) params.delete(key);
  params.append('utm_source', source);
  params.append('utm_medium', medium);
  params.append('utm_campaign', campaign);
  if (content) params.append('utm_content', content);

  return { ok: true, url: `${SHOP_ORIGIN}${url.pathname}?${params.toString()}${url.hash}` };
}

/* ── Analytics' platform-correct builder ────────────────────────────────── */

export type AdPlatform = 'tiktok' | 'meta' | 'google';

export interface AdPlatformSpec {
  label: string;
  /** utm_source: a fixed name, or a platform macro. */
  source: string;
  medium: string;
  /** Dynamic parameters the platform fills in when the ad runs. */
  idMacro: string;
  termMacro: string;
  /** Used for utm_content when no creative name is typed. */
  contentMacro: string;
  /** Where the link goes in the ad platform. */
  pasteHint: string;
  /** The platform has a separate "URL parameters" field, so params-only is the easiest paste. */
  paramsField: boolean;
}

export const AD_PLATFORMS: Record<AdPlatform, AdPlatformSpec> = {
  tiktok: {
    label: 'TikTok',
    source: 'tiktok',
    medium: 'paid',
    idMacro: '__CAMPAIGN_ID__',
    termMacro: '__AID_NAME__',
    contentMacro: '__CID_NAME__',
    pasteHint: 'Ads Manager → ad → Destination: paste the link in Website URL, or only the parameters in URL parameters.',
    paramsField: true,
  },
  meta: {
    label: 'Meta (Facebook + Instagram)',
    // Meta fills {{site_source_name}} with fb, ig, msg or an: fb and ig
    // become Facebook and Instagram in analytics and both total under Meta.
    source: '{{site_source_name}}',
    medium: 'paid',
    idMacro: '{{campaign.id}}',
    termMacro: '{{adset.name}}',
    contentMacro: '{{ad.name}}',
    pasteHint: 'Ads Manager → ad → Destination: paste the link in Website URL, or only the parameters in URL parameters.',
    paramsField: true,
  },
  google: {
    label: 'Google',
    source: 'google',
    medium: 'cpc',
    idMacro: '{campaignid}',
    termMacro: '{keyword}',
    contentMacro: '{creative}',
    pasteHint: 'Google Ads → campaign → Settings → Campaign URL options → Final URL suffix: paste only the parameters.',
    paramsField: true,
  },
};

export const AD_PLATFORM_ORDER: AdPlatform[] = ['tiktok', 'meta', 'google'];

const MACRO_RE = /^(__[A-Z_]+__|\{\{[a-z_.]+\}\}|\{[a-z_]+\})$/;

/** A value goes into the URL as-is when it is a platform macro (the platform must see its braces), otherwise encoded. */
function encodePart(value: string): string {
  return MACRO_RE.test(value) ? value : encodeURIComponent(value);
}

export interface AdLinkInput {
  platform: AdPlatform;
  /** A real route from `landingChoices`. */
  landingPath: string;
  campaign: string;
  /** Optional creative name; the platform's ad-name macro when blank. */
  content?: string;
}

export type AdLinkErrors = Partial<Record<'campaign' | 'landing', string>>;

export type AdLinkResult =
  | { ok: true; url: string; params: string; parts: [string, string][]; campaignSlug: string }
  | { ok: false; errors: AdLinkErrors; campaignSlug: string };

export function buildAdLink(input: AdLinkInput): AdLinkResult {
  const spec = AD_PLATFORMS[input.platform];
  const campaignSlug = slugifyUtm(input.campaign);
  const errors: AdLinkErrors = {};
  if (!campaignSlug) errors.campaign = 'Give the campaign a readable name. An empty name ends up as “campaign name missing”.';
  else if (campaignSlug.length > UTM_CAMPAIGN_MAX) errors.campaign = `Keep the campaign to ${UTM_CAMPAIGN_MAX} characters.`;
  else if (/^\d+$/.test(campaignSlug)) errors.campaign = 'Use words, not the campaign’s number: a number alone shows as “unnamed campaign”.';
  const path = input.landingPath.trim();
  if (!/^\/[^\s?#]*$/.test(path)) errors.landing = 'Pick a page on the shop.';
  if (Object.keys(errors).length) return { ok: false, errors, campaignSlug };

  const content = slugifyUtm(input.content ?? '') || spec.contentMacro;
  const parts: [string, string][] = [
    ['utm_source', spec.source],
    ['utm_medium', spec.medium],
    ['utm_campaign', campaignSlug],
    ['utm_id', spec.idMacro],
    ['utm_content', content],
    ['utm_term', spec.termMacro],
  ];
  const params = parts.map(([k, v]) => `${k}=${encodePart(v)}`).join('&');
  return { ok: true, url: `${SHOP_ORIGIN}${path}?${params}`, params, parts, campaignSlug };
}

/* ── Landing pages: only the shop's real routes ─────────────────────────── */

export interface LandingChoice {
  value: string;
  label: string;
  group: 'Shop' | 'Categories' | 'Products';
}

export interface CatalogueCategory {
  id: string;
  name: string;
  slug: string;
  children?: CatalogueCategory[];
}

export interface CatalogueProduct {
  id: string;
  name: string;
  slug: string;
  categoryId?: string;
  status?: string;
}

function flatten(cats: CatalogueCategory[]): CatalogueCategory[] {
  return cats.flatMap((c) => [c, ...flatten(c.children ?? [])]);
}

/**
 * `/`, `/shop`, `/shop/all`, every category `/shop/<category-slug>` and every
 * published product `/shop/<category-slug>/<product-slug>`, built from the
 * dashboard's own catalogue APIs, never typed by hand.
 */
export function landingChoices(categories: CatalogueCategory[], products: CatalogueProduct[]): LandingChoice[] {
  const flat = flatten(categories).filter((c) => c.slug);
  const slugById = new Map(flat.map((c) => [c.id, c.slug]));
  const out: LandingChoice[] = [
    { value: '/', label: 'Home', group: 'Shop' },
    { value: '/shop', label: 'Shop', group: 'Shop' },
    { value: '/shop/all', label: 'All products', group: 'Shop' },
  ];
  for (const c of [...flat].sort((a, b) => a.name.localeCompare(b.name))) {
    out.push({ value: `/shop/${c.slug}`, label: c.name, group: 'Categories' });
  }
  const seen = new Set<string>();
  for (const p of [...products].sort((a, b) => a.name.localeCompare(b.name))) {
    if (p.status && p.status !== 'PUBLISHED') continue;
    const cat = p.categoryId ? slugById.get(p.categoryId) : undefined;
    if (!cat || !p.slug) continue;
    const value = `/shop/${cat}/${p.slug}`;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push({ value, label: p.name, group: 'Products' });
  }
  return out;
}

/** The known slugs, for telling a real `/shop/…` path from an unknown one. */
export function knownRoutes(categories: CatalogueCategory[], products: CatalogueProduct[]): KnownRoutes {
  return {
    categories: new Set(flatten(categories).map((c) => c.slug).filter(Boolean)),
    products: new Set(products.map((p) => p.slug).filter(Boolean)),
  };
}

/* ── How analytics will file the link ───────────────────────────────────── */

export interface AdLinkReading {
  /** One or more ways the visit can be filed (Meta fills fb or ig). */
  touches: { when: string; touch: NormalizedSource }[];
  channel: string;
  campaign: string;
  campaignState: ReturnType<typeof campaignState>;
  landing: PageKind;
  landingPath: string;
  /** Plain sentences, the first one is the verdict. */
  lines: string[];
  ok: boolean;
}

export function classifyAdLink(url: string, routes?: KnownRoutes | null): AdLinkReading {
  const { path, utm } = parseUtm(url);
  const source = utm.utm_source ?? '';
  const medium = utm.utm_medium ?? '';
  const campaign = utm.utm_campaign ?? '';
  const variants: { when: string; source: string }[] =
    source === '{{site_source_name}}'
      ? [
          { when: 'Shown on Facebook (Meta fills in fb)', source: 'fb' },
          { when: 'Shown on Instagram (Meta fills in ig)', source: 'ig' },
        ]
      : [{ when: 'Every click', source }];
  const touches = variants.map((v) => ({ when: v.when, touch: classifyTouch({ utmSource: v.source, utmMedium: medium }) }));
  const first = touches[0].touch;
  const state = campaignState(campaign);
  const landing = pageKindOfPath(path, routes);
  const lines: string[] = [];
  const platforms = [...new Set(touches.map((t) => t.touch.platform))];
  const net = networkOf(first.platform);
  lines.push(
    `Filed as ${platforms.join(' or ')} · ${first.medium === 'paid' ? 'Paid ads' : channelOf(first.medium) === 'social' ? 'Social' : first.medium}` +
      (net && platforms.length > 1 ? `, totalled under ${net}` : '') +
      '.',
  );
  lines.push(
    state === 'named'
      ? `Credited to campaign “${campaign}”.`
      : state === 'macro'
        ? 'The campaign is a placeholder: every visit would show as “campaign name missing”.'
        : state === 'id-only'
          ? 'The campaign is only a number: visits would show as “unnamed campaign”.'
          : 'No campaign: visits could not be credited to any campaign.',
  );
  lines.push(
    landing === 'unknown'
      ? `Lands on ${path}, which the shop doesn’t know. Pick a real page.`
      : `Lands on ${path} (${landing === 'home' ? 'the home page' : `a ${landing} page`}).`,
  );
  lines.push('utm_id, utm_content and utm_term are filled in by the ad platform when the ad runs, so leave the placeholders as they are.');
  const ok = first.medium === 'paid' && state === 'named' && landing !== 'unknown';
  return { touches, channel: first.medium, campaign, campaignState: state, landing, landingPath: path, lines, ok };
}

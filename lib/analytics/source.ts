/**
 * Where a visitor came from: one module for every source, channel and
 * campaign rule in Analytics (dashboard#128, #114).
 *
 * `classifyTouch` is a line-for-line port of the backend's source-family
 * normalizer (`minirue-backend/src/analytics-web/util/source-normalizer.util.ts`,
 * dashboard#123), so the ad-link builder can say exactly how analytics will
 * file a link before it is ever clicked. Keep the two in step: the test
 * `__tests__/analytics/source.test.ts` pins the same cases the backend's
 * spec does.
 *
 * Before this file the dashboard had four partial copies of these rules:
 * `__CAMPAIGN_NAME__` filtered in the Command Center, a placeholder regex in
 * the Sources table, a click-id regex in `shortPath`, and a Facebook /
 * Instagram → Meta map in the story client.
 */

export type NormalizedMedium = 'paid' | 'social' | 'organic' | 'referral' | 'email' | 'direct';

export interface ClickIds {
  fbclid?: string | null;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  ttclid?: string | null;
  scCid?: string | null;
}

export interface SourceTouchInput {
  utmSource?: string | null;
  utmMedium?: string | null;
  referrerHost?: string | null;
  clickIds?: ClickIds | null;
}

export interface NormalizedSource {
  platform: string;
  medium: NormalizedMedium;
  source: string;
  network: 'Meta' | 'TikTok' | null;
}

const PAID_MEDIUM_RE = /^(cpc|paid|paidsocial|ppc|ads)$/;

const SOCIAL_PLATFORMS = new Set([
  'Meta',
  'Facebook',
  'Instagram',
  'TikTok',
  'Snapchat',
  'X/Twitter',
  'YouTube',
  'WhatsApp',
  'Telegram',
  'Pinterest',
  'LinkedIn',
]);

const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();
const trimmed = (v: string | null | undefined) => (v ?? '').trim();
const bareHost = (host: string) => host.replace(/^(www|m|l|lm|vm)\./, '');
const hostMatches = (host: string, suffixes: readonly string[]) => {
  const bare = bareHost(host);
  return suffixes.some((s) => bare === s || bare.endsWith(`.${s}`));
};
const isGoogleHost = (host: string) => /(^|\.)google\.[a-z.]+$/.test(host);
const hasClickId = (c: ClickIds | null | undefined) =>
  !!c && Object.values(c).some((v) => typeof v === 'string' && v.trim().length > 0);

interface PlatformMatch {
  platform: string;
  matchedOn: string;
  network: 'Meta' | 'TikTok' | null;
}
const hit = (platform: string, matchedOn: string, network: 'Meta' | 'TikTok' | null = null): PlatformMatch => ({
  platform,
  matchedOn,
  network,
});

function metaPlatformFor(source: string, host: string): 'Facebook' | 'Instagram' | null {
  if (source === 'ig' || source.includes('instagram')) return 'Instagram';
  if (source === 'fb' || source.includes('facebook')) return 'Facebook';
  if (host) {
    if (hostMatches(host, ['instagram.com'])) return 'Instagram';
    if (hostMatches(host, ['facebook.com', 'fb.com'])) return 'Facebook';
  }
  return null;
}

function detectPlatform(
  rawSource: string,
  source: string,
  rawHost: string,
  host: string,
  medium: string,
  clickIds: ClickIds | null | undefined,
): PlatformMatch {
  if (clickIds?.fbclid) {
    const app = metaPlatformFor(source, host);
    return hit(app ?? 'Meta', rawSource || rawHost || 'facebook', 'Meta');
  }
  if (clickIds?.ttclid) return hit('TikTok', rawSource || 'tiktok', 'TikTok');
  if (clickIds?.gclid || clickIds?.gbraid || clickIds?.wbraid) return hit('Google', rawSource || 'google');
  if (clickIds?.scCid) return hit('Snapchat', rawSource || 'snapchat');

  if (source) {
    const app = metaPlatformFor(source, '');
    if (app) return hit(app, rawSource, 'Meta');
    if (source.includes('tiktok')) return hit('TikTok', rawSource, 'TikTok');
    if (source.includes('google')) return hit('Google', rawSource);
    if (source === 'sc' || source.includes('snapchat')) return hit('Snapchat', rawSource);
    if (source === 'x' || source.includes('twitter')) return hit('X/Twitter', rawSource);
    if (source.includes('youtube')) return hit('YouTube', rawSource);
    if (source.includes('whatsapp')) return hit('WhatsApp', rawSource);
    if (source.includes('telegram')) return hit('Telegram', rawSource);
    if (source.includes('pinterest')) return hit('Pinterest', rawSource);
    if (source.includes('linkedin')) return hit('LinkedIn', rawSource);
    if (source.includes('email') || source.includes('newsletter')) return hit('Email', rawSource);
  }

  if (host) {
    const app = metaPlatformFor('', host);
    if (app) return hit(app, rawHost, 'Meta');
    if (hostMatches(host, ['tiktok.com'])) return hit('TikTok', rawHost, 'TikTok');
    if (isGoogleHost(host)) return hit('Google', rawHost);
    if (hostMatches(host, ['snapchat.com'])) return hit('Snapchat', rawHost);
    if (hostMatches(host, ['twitter.com', 'x.com', 't.co'])) return hit('X/Twitter', rawHost);
    if (hostMatches(host, ['youtube.com', 'youtu.be'])) return hit('YouTube', rawHost);
    if (host === 'wa.me' || hostMatches(host, ['whatsapp.com'])) return hit('WhatsApp', rawHost);
    if (host === 't.me' || hostMatches(host, ['telegram.org'])) return hit('Telegram', rawHost);
    if (hostMatches(host, ['pinterest.com'])) return hit('Pinterest', rawHost);
    if (hostMatches(host, ['linkedin.com'])) return hit('LinkedIn', rawHost);
  }

  if (medium.includes('email') || medium.includes('newsletter')) return hit('Email', rawSource || rawHost || medium);
  if (rawSource) return hit(rawSource, rawSource);
  if (rawHost) return hit(rawHost, rawHost);
  return hit('Direct', 'direct');
}

function detectMedium(platform: string, medium: string, clicked: boolean, host: string): NormalizedMedium {
  if (clicked || PAID_MEDIUM_RE.test(medium)) return 'paid';
  if (platform === 'Email') return 'email';
  if (medium.includes('email') || medium.includes('newsletter')) return 'email';
  if (SOCIAL_PLATFORMS.has(platform)) return 'social';
  if (platform === 'Google') return 'organic';
  if (medium === 'organic') return 'organic';
  if (host) return 'referral';
  if (platform === 'Direct') return 'direct';
  return 'referral';
}

/** How analytics files one touch. Never throws; the worst case is Direct. */
export function classifyTouch(input: SourceTouchInput): NormalizedSource {
  const rawSource = trimmed(input.utmSource);
  const rawHost = trimmed(input.referrerHost);
  const source = norm(input.utmSource);
  const medium = norm(input.utmMedium);
  const host = norm(input.referrerHost);
  const clicked = hasClickId(input.clickIds);
  const { platform, matchedOn, network } = detectPlatform(rawSource, source, rawHost, host, medium, input.clickIds);
  return { platform, medium: detectMedium(platform, medium, clicked, host), source: matchedOn || rawSource || rawHost || 'direct', network };
}

/* ── Channels: the four colours of the source split ─────────────────────── */

export type Channel = 'paid' | 'social' | 'direct' | 'referral';

/** Fixed order and chart slots (mr-tokens chart palette, never reordered). */
export const CHANNELS: Record<Channel, { label: string; color: string; hint: string }> = {
  paid: { label: 'Paid ads', color: 'var(--mr-chart-1)', hint: 'Visitors from TikTok, Meta or Google ads' },
  social: { label: 'Social', color: 'var(--mr-chart-2)', hint: 'Unpaid posts on Instagram, Facebook or TikTok' },
  direct: { label: 'Direct', color: 'var(--mr-chart-3)', hint: 'Typed the address or used a saved link' },
  referral: { label: 'Referral / other', color: 'var(--mr-chart-4)', hint: 'Other websites, search and email' },
};
export const CHANNEL_ORDER: Channel[] = ['paid', 'social', 'direct', 'referral'];

/** The backend's six mediums, folded into the four channels the owner reads. */
export function channelOf(medium: string | null | undefined): Channel {
  const m = norm(medium);
  if (m === 'paid') return 'paid';
  if (m === 'social') return 'social';
  if (m === 'direct' || !m) return 'direct';
  return 'referral';
}

/**
 * Facebook and Instagram share one Meta pixel, so they are shown apart (the
 * ads tag utm_source=fb / ig) and totalled under Meta (backend#223).
 */
export function networkOf(platform: string | null | undefined): 'Meta' | 'TikTok' | null {
  if (platform === 'Facebook' || platform === 'Instagram' || platform === 'Meta') return 'Meta';
  if (platform === 'TikTok') return 'TikTok';
  return null;
}

/** The colour-coded platform pill a source gets everywhere. */
export type PlatformPill = 'tiktok' | 'instagram' | 'facebook' | 'meta' | 'google' | 'direct' | 'referral';

export function platformPill(platform: string | null | undefined): PlatformPill {
  switch (platform) {
    case 'TikTok':
      return 'tiktok';
    case 'Instagram':
      return 'instagram';
    case 'Facebook':
      return 'facebook';
    case 'Meta':
      return 'meta';
    case 'Google':
      return 'google';
    case 'Direct':
    case null:
    case undefined:
    case '':
      return 'direct';
    default:
      return 'referral';
  }
}

/* ── Campaign names ─────────────────────────────────────────────────────── */

/**
 * - `named`: a readable utm_campaign, credited as-is.
 * - `macro`: an ad-platform placeholder that was never filled in, e.g.
 *   TikTok's `__CAMPAIGN_NAME__` or Meta's `{{campaign.name}}`.
 * - `id-only`: only the platform's numeric campaign id, e.g. `120250555651910697`.
 * - `missing`: no campaign at all.
 */
export type CampaignState = 'named' | 'macro' | 'id-only' | 'missing';

const MACRO_RE = /^(__[A-Z0-9_]+__|\{\{[^}]+\}\}|\{[a-z_]+\})$/i;
const NONE_RE = /^(\(none\)|\(not set\)|none|null|undefined|-)?$/i;

export function campaignState(raw: string | null | undefined): CampaignState {
  const v = (raw ?? '').trim();
  if (NONE_RE.test(v)) return 'missing';
  if (MACRO_RE.test(v)) return 'macro';
  if (/^\d{8,}$/.test(v)) return 'id-only';
  return 'named';
}

/** True when a paid visitor's campaign cannot be credited to a named campaign. */
export function isUncredited(medium: string | null | undefined, campaign: string | null | undefined): boolean {
  return channelOf(medium) === 'paid' && campaignState(campaign) !== 'named';
}

/** "Minirueshop", "campaign name missing", "unnamed campaign", or "no campaign tag". */
export function campaignLabel(raw: string | null | undefined): string {
  switch (campaignState(raw)) {
    case 'named':
      return (raw ?? '').trim();
    case 'macro':
      return 'campaign name missing';
    case 'id-only':
      return 'unnamed campaign';
    default:
      return 'no campaign tag';
  }
}

/** The one line a source reads as: "TikTok · Minirueshop", "Instagram", "Direct". */
export function sourceLabel(p: { platform?: string | null; medium?: string | null; campaign?: string | null }): string {
  const platform = p.platform || 'Direct';
  const state = campaignState(p.campaign);
  if (channelOf(p.medium) === 'paid') return `${platform} · ${campaignLabel(p.campaign)}`;
  if (state === 'named') return `${platform} · ${(p.campaign ?? '').trim()}`;
  if (channelOf(p.medium) === 'social' && platform === 'TikTok') return 'TikTok (organic)';
  return platform;
}

/* ── URLs: utm parts and click ids ──────────────────────────────────────── */

/** Every click-id param an ad platform appends. Stripped for display, kept in raw values. */
export const CLICK_ID_PARAMS = [
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'ttclid',
  'sccid',
  'ScCid',
  'msclkid',
  'yclid',
  'twclid',
  'li_fat_id',
  'igshid',
  'dclid',
] as const;
const CLICK_ID_SET = new Set(CLICK_ID_PARAMS.map((p) => p.toLowerCase()));

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_content', 'utm_term'] as const;
export type UtmKey = (typeof UTM_KEYS)[number];

function splitUrl(raw: string): { path: string; query: string } {
  const noHash = raw.split('#')[0];
  const i = noHash.indexOf('?');
  const beforeQuery = i < 0 ? noHash : noHash.slice(0, i);
  const query = i < 0 ? '' : noHash.slice(i + 1);
  const path = beforeQuery.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '') || '/';
  return { path, query };
}

/** The utm parts of a URL or path, plus which click ids it carried. */
export function parseUtm(raw: string | null | undefined): {
  path: string;
  utm: Record<UtmKey, string | null>;
  clickIds: string[];
} {
  const utm = Object.fromEntries(UTM_KEYS.map((k) => [k, null])) as Record<UtmKey, string | null>;
  if (!raw) return { path: '/', utm, clickIds: [] };
  const { path, query } = splitUrl(raw.trim());
  const clickIds: string[] = [];
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = decodeSafe(eq < 0 ? pair : pair.slice(0, eq));
    const value = eq < 0 ? '' : decodeSafe(pair.slice(eq + 1).replace(/\+/g, ' '));
    const lower = key.toLowerCase();
    if ((UTM_KEYS as readonly string[]).includes(lower)) utm[lower as UtmKey] = value;
    else if (CLICK_ID_SET.has(lower)) clickIds.push(lower);
  }
  return { path, utm, clickIds };
}

function decodeSafe(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/** The path without its click ids: "/shop/skincare?utm_source=tiktok". */
export function stripClickIds(raw: string | null | undefined): string {
  if (!raw) return '/';
  const { path, query } = splitUrl(raw.trim());
  const kept = query
    .split('&')
    .filter((pair) => pair && !CLICK_ID_SET.has(decodeSafe(pair.split('=')[0]).toLowerCase()));
  return kept.length ? `${path}?${kept.join('&')}` : path;
}

/**
 * A path fit to print. Ad links arrive carrying a 200-character click id
 * which ran straight out of the story card; the page itself is what a human
 * reads, so the tags become a short "· ad tags" note.
 */
export function shortPath(raw: string | null | undefined): string {
  if (!raw) return '';
  const { path, query } = splitUrl(raw);
  const clean = path.length > 72 ? `${path.slice(0, 69)}…` : path;
  if (!query) return clean || '/';
  const tagged = /(fbclid|ttclid|gclid|msclkid|yclid|utm_)/i.test(query);
  return `${clean || '/'}${tagged ? ' · ad tags' : ''}`;
}

/** The plain path a landing is grouped by: no query, no trailing slash. */
export function landingKey(raw: string | null | undefined): string {
  if (!raw) return '';
  const { path } = splitUrl(raw);
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/** "paid ad", "social", ... for the small medium note under a source. */
export const MEDIUM_LABEL: Record<string, string> = {
  paid: 'Paid ad',
  social: 'Social',
  organic: 'Search',
  email: 'Email',
  referral: 'Other site',
  direct: 'Direct',
};

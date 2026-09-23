import type {
  AbandonedRow,
  AudienceSummary,
  AudienceTimeseriesPoint,
  ProductRow,
  QualityReport,
  ReconcileReport,
} from '@/lib/api/analytics-insights';
import type { PersonRow } from '@/lib/api/story';
import type { TrafficFlag } from '@/lib/api/traffic-flags';
import type { StaffDeviceStatus } from '@/lib/api/analytics';
import type { AnalyticsRangeState } from './range';
import { egp, fmtInt, pctOf, placeLabel, deviceLabel, plural } from './format';
import {
  biggestDrop,
  countStages,
  funnelSteps,
  outcomeOf,
  OUTCOMES,
  STOP_REASON_LABEL,
  type FunnelStep,
  type Outcome,
  type StageCounts,
} from './funnel';
import {
  campaignLabel,
  campaignState,
  channelOf,
  CHANNELS,
  CHANNEL_ORDER,
  isUncredited,
  landingKey,
  networkOf,
  parseUtm,
  sourceLabel,
  type CampaignState,
  type Channel,
} from './source';
import { pageKindOfPath, type KnownRoutes } from './journey';
import { countedVisitors, matchesFilters, visitorLabel, type Filters, activeFilterCount } from './visitors';

/**
 * The Analytics view model (dashboard#128): everything the seven sections
 * show, computed once from the API data. The screen renders it and the
 * export serialises it, so "what you see is what you export" holds by
 * construction. Pure, no React, fully tested.
 */

export type SectionId = 'overview' | 'people' | 'journeys' | 'sources' | 'flow' | 'ads' | 'quality';

export const SECTIONS: { id: SectionId; label: string; short: string }[] = [
  { id: 'overview', label: 'Overview', short: 'Overview' },
  { id: 'people', label: 'People', short: 'People' },
  { id: 'journeys', label: 'Journeys', short: 'Journeys' },
  { id: 'sources', label: 'Sources', short: 'Sources' },
  { id: 'flow', label: 'Flow', short: 'Flow' },
  { id: 'ads', label: 'Social ads quality', short: 'Ads' },
  { id: 'quality', label: 'Data quality', short: 'Quality' },
];

export function isSectionId(v: string | null | undefined): v is SectionId {
  return !!v && SECTIONS.some((s) => s.id === v);
}

export interface ModelInputs {
  range: AnalyticsRangeState;
  filters: Filters;
  people: PersonRow[];
  peopleCapped?: boolean;
  visits?: Map<string, { sessions: number; pages: number }> | null;
  summary?: AudienceSummary | null;
  timeseries?: AudienceTimeseriesPoint[] | null;
  products?: ProductRow[] | null;
  carts?: AbandonedRow[] | null;
  quality?: QualityReport | null;
  recon?: ReconcileReport | null;
  flags?: TrafficFlag[] | null;
  staffDevice?: StaffDeviceStatus | null;
  routes?: KnownRoutes | null;
}

export interface CountedRow extends StageCounts {
  key: string;
  label: string;
}

export interface ChannelRow extends CountedRow {
  channel: Channel;
  campaigns: (CountedRow & { state: CampaignState; flag: string | null })[];
}

export interface SourceRow extends CountedRow {
  channel: Channel;
  platform: string;
  campaignRaw: string | null;
  state: CampaignState;
  flag: string | null;
  raw: string;
  landings: (CountedRow & { raw: string })[];
}

export interface PathRow extends CountedRow {
  channel: Channel;
  source: string;
  sourceKey: string;
  landing: string;
  flag: string | null;
  people: PersonRow[];
}

export interface PersonView {
  id: string;
  label: string;
  number: number | null;
  platform: string;
  source: string;
  channel: Channel;
  campaignState: CampaignState;
  place: string;
  device: string;
  sessions: number | null;
  pages: number | null;
  outcome: Outcome;
  outcomeLabel: string;
  stopDetail: string | null;
  cartMinor: number;
  contactable: boolean;
  orders: number;
  revenueMinor: number;
  lastSeenAt: string;
  firstSeenAt: string;
  products: string[];
  landingPath: string;
  customerId: string | null;
  row: PersonRow;
}

export interface CartView {
  key: string;
  visitorId: string | null;
  label: string;
  valueMinor: number;
  items: number;
  stage: string;
  source: string;
  channel: Channel | null;
  contactable: boolean;
  lastSeenAt: string;
  products: string[];
}

export interface ProductView {
  name: string;
  viewers: number;
  addToCartEvents: number | null;
}

export interface AdLinkRow {
  key: string;
  platform: string;
  network: 'Meta' | 'TikTok' | null;
  campaign: string;
  state: CampaignState;
  path: string;
  visitors: number;
  utm: { source: string | null; medium: string | null; campaign: string | null; id: string | null; content: string | null; term: string | null };
  /** How many of the five stored parts (source, medium, campaign, content, term) are present. */
  present: number;
}

export type CheckStatus = 'ok' | 'warn' | 'bad' | 'unk' | 'na';

export interface CheckCell {
  status: CheckStatus;
  label?: string;
  note?: string;
}

export interface AdsCheck {
  id: string;
  group: string;
  name: string;
  detail: string;
  meta: CheckCell;
  tiktok: CheckCell;
  from: 'code' | 'platform' | 'data';
}

export interface QaCheck {
  id: string;
  status: CheckStatus;
  title: string;
  detail: string;
  tag: string;
  go?: SectionId;
}

export interface ExclusionRow {
  reason: string;
  label: string;
  group: 'bots' | 'us' | 'flagged' | 'counted';
  events: number;
  share: number;
  rule: string;
}

export interface Answer {
  text: string;
  /** The part to bold. */
  strong?: string;
  action: string;
  jump: { section: SectionId; anchor?: string };
}

export interface NextStep {
  id: string;
  severity: 'high' | 'warn' | 'info';
  title: string;
  detail: string;
  go: SectionId;
  filters?: Partial<Filters>;
  search?: string;
  visitorId?: string;
}

/* ── Building blocks ────────────────────────────────────────────────────── */

function counted(key: string, label: string, people: PersonRow[]): CountedRow {
  return { key, label, ...countStages(people) };
}

function groupBy<K>(people: PersonRow[], keyOf: (p: PersonRow) => K): Map<K, PersonRow[]> {
  const m = new Map<K, PersonRow[]>();
  for (const p of people) {
    const k = keyOf(p);
    const list = m.get(k);
    if (list) list.push(p);
    else m.set(k, [p]);
  }
  return m;
}

const byVisitedDesc = (a: CountedRow, b: CountedRow) => b.visited - a.visited || a.label.localeCompare(b.label);

export function flagOf(state: CampaignState, paid: boolean): string | null {
  if (!paid) return null;
  if (state === 'macro') return 'Untagged';
  if (state === 'id-only') return 'ID only';
  if (state === 'missing') return 'No campaign';
  return null;
}

/** `platform::campaign` for paid (and named) sources; the platform alone otherwise. */
export function sourceKeyOf(p: PersonRow): string {
  return sourceLabel(p);
}

function rawValuesOf(people: PersonRow[]): string {
  const p = people[0];
  if (!p) return '';
  const { utm } = parseUtm(p.landingUrl ?? p.landingPath ?? '');
  const { clickIds } = parseUtm(p.landingPath ?? '');
  const bits: string[] = [];
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const) {
    if (utm[k]) bits.push(`${k}=${utm[k]}`);
  }
  const tags = bits.length ? bits.join('&') : 'no utm';
  const ref = p.referrerUrl ? `referrer ${p.referrerUrl}` : 'no referrer';
  return `${tags} · ${ref}${clickIds.length ? ` · ${clickIds.join(', ')} present` : ''}`;
}

/* ── Sections ───────────────────────────────────────────────────────────── */

export function channelRows(people: PersonRow[]): ChannelRow[] {
  const byChannel = groupBy(people, (p) => channelOf(p.medium));
  return CHANNEL_ORDER.filter((c) => byChannel.has(c))
    .map((c) => {
      const members = byChannel.get(c)!;
      const campaigns = [...groupBy(members, sourceKeyOf)].map(([key, ps]) => {
        const state = campaignState(ps[0].campaign);
        return { ...counted(key, key, ps), state, flag: flagOf(state, c === 'paid') };
      });
      return { ...counted(c, CHANNELS[c].label, members), channel: c, campaigns: campaigns.sort(byVisitedDesc) };
    })
    .sort(byVisitedDesc);
}

export function sourceRows(people: PersonRow[]): SourceRow[] {
  return [...groupBy(people, sourceKeyOf)]
    .map(([key, ps]) => {
      const channel = channelOf(ps[0].medium);
      const state = campaignState(ps[0].campaign);
      const landings = [...groupBy(ps, (p) => landingKey(p.landingPath) || '(no landing recorded)')].map(([path, lp]) => ({
        ...counted(path, path, lp),
        raw: `landing_path=${path}`,
      }));
      return {
        ...counted(key, key, ps),
        channel,
        platform: ps[0].platform || 'Direct',
        campaignRaw: ps[0].campaign,
        state,
        flag: flagOf(state, channel === 'paid'),
        raw: rawValuesOf(ps),
        landings: landings.sort(byVisitedDesc),
      };
    })
    .sort(byVisitedDesc);
}

export function landingRows(people: PersonRow[], routes?: KnownRoutes | null): (CountedRow & { unknown: boolean })[] {
  return [...groupBy(people, (p) => landingKey(p.landingPath) || '')]
    .map(([path, ps]) => ({
      ...counted(path || '(not recorded)', path === '/' ? 'Home (/)' : path || 'Not recorded', ps),
      unknown: !!path && pageKindOfPath(path, routes) === 'unknown',
    }))
    .sort(byVisitedDesc);
}

export function pathRows(people: PersonRow[]): PathRow[] {
  return [...groupBy(people, (p) => `${sourceKeyOf(p)}→${landingKey(p.landingPath) || ''}`)]
    .map(([key, ps]) => {
      const channel = channelOf(ps[0].medium);
      const landing = landingKey(ps[0].landingPath);
      return {
        ...counted(key, key, ps),
        channel,
        source: sourceKeyOf(ps[0]),
        sourceKey: sourceKeyOf(ps[0]),
        landing: landing === '/' ? 'Home (/)' : landing || 'Not recorded',
        flag: flagOf(campaignState(ps[0].campaign), channel === 'paid'),
        people: ps,
      };
    })
    .sort(byVisitedDesc);
}

export function productViews(people: PersonRow[], rollup?: ProductRow[] | null): ProductView[] {
  const viewers = new Map<string, number>();
  for (const p of people) for (const name of new Set(p.productsViewed)) viewers.set(name, (viewers.get(name) ?? 0) + 1);
  const events = new Map<string, number>();
  for (const r of rollup ?? []) if (r.name) events.set(r.name, (events.get(r.name) ?? 0) + r.addToCarts);
  return [...viewers]
    .map(([name, n]) => ({ name, viewers: n, addToCartEvents: rollup ? (events.get(name) ?? 0) : null }))
    .sort((a, b) => b.viewers - a.viewers || a.name.localeCompare(b.name));
}

export function outcomeSplit(people: PersonRow[]): { key: Outcome; label: string; color: string; n: number }[] {
  const counts = new Map<Outcome, number>();
  for (const p of people) counts.set(outcomeOf(p), (counts.get(outcomeOf(p)) ?? 0) + 1);
  return OUTCOMES.map((o) => ({ ...o, n: counts.get(o.key) ?? 0 }))
    .filter((o) => o.n > 0)
    .sort((a, b) => b.n - a.n);
}

export function personViews(people: PersonRow[], visits?: Map<string, { sessions: number; pages: number }> | null): PersonView[] {
  return people.map((p) => {
    const v = visits?.get(p.visitorId);
    const outcome = outcomeOf(p);
    return {
      id: p.visitorId,
      label: visitorLabel(p),
      number: p.visitorNumber,
      platform: p.platform || 'Direct',
      source: sourceLabel(p),
      channel: channelOf(p.medium),
      campaignState: campaignState(p.campaign),
      place: placeLabel(p.city, p.country),
      device: deviceLabel(p.device),
      sessions: v?.sessions ?? null,
      pages: v?.pages ?? null,
      outcome,
      outcomeLabel: p.stopReason ? (STOP_REASON_LABEL[p.stopReason] ?? p.stopReason) : (OUTCOMES.find((o) => o.key === outcome)?.label ?? ''),
      stopDetail: p.stopDetail ?? null,
      cartMinor: p.cartValueMinor ?? 0,
      contactable: p.contactable,
      orders: p.orders,
      revenueMinor: p.revenueMinor,
      lastSeenAt: p.lastSeenAt,
      firstSeenAt: p.firstSeenAt,
      products: p.productsViewed,
      landingPath: landingKey(p.landingPath),
      customerId: p.customer?.id ?? null,
      row: p,
    };
  });
}

const CART_STAGE: Record<string, string> = {
  CART_ACTIVE: 'Left in bag',
  BEGIN_CHECKOUT: 'Left at checkout',
  PAYMENT_INITIATED: 'Left while paying',
  PAYMENT_STUCK: 'Payment stuck',
};

/**
 * Open carts from `/checkout/abandoned`, kept only for people in view so the
 * global filters apply. A cart with no visitor behind it shows only when no
 * filter is set, since it cannot be placed in any source.
 */
export function cartViews(carts: AbandonedRow[] | null | undefined, view: PersonRow[], filtered: boolean): CartView[] {
  const byId = new Map(view.map((p) => [p.visitorId, p]));
  const out: CartView[] = [];
  (carts ?? []).forEach((c, i) => {
    if (c.stage === 'PAID') return;
    const person = c.visitorId ? byId.get(c.visitorId) : undefined;
    // A cart of someone outside the counted people (flagged, a bot) or the filters stays out;
    // one with no visitor behind it can't be placed in any source, so only shows unfiltered.
    if (c.visitorId ? !person : filtered) return;
    out.push({
      key: c.cartId ?? `${c.visitorId ?? 'unlinked'}-${i}`,
      visitorId: c.visitorId,
      label: person ? visitorLabel(person) : 'Unlinked cart',
      valueMinor: c.valueMinor,
      items: c.itemCount,
      stage: CART_STAGE[c.stage] ?? c.stage.toLowerCase().replace(/_/g, ' '),
      source: person ? sourceLabel(person) : (c.channel ?? 'Unknown source'),
      channel: person ? channelOf(person.medium) : null,
      contactable: c.contactable,
      lastSeenAt: c.lastSeenAt,
      products: person?.productsViewed ?? [],
    });
  });
  return out.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

/** Every distinct ad link that sent paid visitors, broken into its utm parts. */
export function adLinkRows(people: PersonRow[]): AdLinkRow[] {
  const paid = people.filter((p) => channelOf(p.medium) === 'paid');
  const groups = groupBy(paid, (p) => {
    const { path, utm } = parseUtm(p.landingUrl ?? p.landingPath ?? '');
    return [p.platform, landingKey(path), utm.utm_source, utm.utm_medium, utm.utm_campaign, utm.utm_content, utm.utm_term].join('|');
  });
  return [...groups]
    .map(([key, ps]) => {
      const p = ps[0];
      const { path, utm } = parseUtm(p.landingUrl ?? p.landingPath ?? '');
      const parts = {
        source: utm.utm_source,
        medium: utm.utm_medium,
        campaign: utm.utm_campaign ?? p.campaign,
        id: null,
        content: utm.utm_content,
        term: utm.utm_term,
      };
      const present = [parts.source, parts.medium, parts.campaign, parts.content, parts.term].filter((v) => v && v.trim()).length;
      return {
        key,
        platform: p.platform || 'Unknown',
        network: networkOf(p.platform),
        campaign: campaignLabel(p.campaign),
        state: campaignState(p.campaign),
        path: landingKey(path) || '/',
        visitors: ps.length,
        utm: parts,
        present,
      };
    })
    .sort((a, b) => b.visitors - a.visitors);
}

/* ── Social ads quality: what the code does today, and what the data shows ─ */

function campaignCheck(people: PersonRow[], network: 'Meta' | 'TikTok'): CheckCell {
  const paid = people.filter((p) => channelOf(p.medium) === 'paid' && networkOf(p.platform) === network);
  if (!paid.length) return { status: 'unk', label: 'No paid visits', note: 'No paid visitors from this platform in the range.' };
  const campaigns = [...groupBy(paid, (p) => (p.campaign ?? '').trim())];
  const bad = campaigns.filter(([raw]) => campaignState(raw) !== 'named');
  if (!bad.length) return { status: 'ok', label: `${campaigns.length} of ${campaigns.length}`, note: 'Every campaign sends a readable name.' };
  const notes = bad.map(([raw, ps]) => {
    const st = campaignState(raw);
    return st === 'macro'
      ? `One ad sends ${raw} (${ps.length} visitors)`
      : st === 'id-only'
        ? `Campaign ${raw} sends its ID only (${ps.length} visitors)`
        : `${ps.length} visitors with no campaign`;
  });
  return {
    status: bad.length === campaigns.length ? 'bad' : 'warn',
    label: `${campaigns.length - bad.length} of ${campaigns.length}`,
    note: notes.join('; '),
  };
}

function utmCheck(links: AdLinkRow[], network: 'Meta' | 'TikTok'): CheckCell {
  const mine = links.filter((l) => l.network === network);
  if (!mine.length) return { status: 'unk', label: 'No paid visits', note: 'No ad links from this platform in the range.' };
  const worst = Math.min(...mine.map((l) => l.present));
  const missing = new Set<string>();
  for (const l of mine) {
    for (const k of ['source', 'medium', 'campaign', 'content', 'term'] as const) if (!l.utm[k]) missing.add(k);
  }
  if (worst === 5) return { status: 'ok', label: '5 of 5', note: 'source, medium, campaign, content and term on every link.' };
  return { status: 'warn', label: `${worst} of 5`, note: `${[...missing].join(' and ')} missing on at least one link.` };
}

function purchaseValueCheck(recon: ReconcileReport | null | undefined): CheckCell {
  if (!recon) return { status: 'unk', label: 'Loading' };
  if (recon.purchaseEvents.count === 0) return { status: 'unk', label: 'Waiting', note: 'No purchase in this range to check.' };
  return recon.purchaseEvents.revenueMinor > 0
    ? { status: 'ok', label: egp(recon.purchaseEvents.revenueMinor), note: `${fmtInt(recon.purchaseEvents.count)} purchases sent with an EGP value.` }
    : { status: 'bad', label: 'EGP 0', note: 'Purchases were tracked with no value.' };
}

export function adsChecks(people: PersonRow[], links: AdLinkRow[], recon?: ReconcileReport | null): AdsCheck[] {
  const value = purchaseValueCheck(recon);
  return [
    {
      id: 'account',
      group: 'Account',
      name: 'Ad account connected',
      detail: 'The shop can read spend and campaign names from the platform.',
      meta: { status: 'unk', label: 'Needs access', note: 'Meta Business is not linked to the dashboard yet (backend#216).' },
      tiktok: { status: 'unk', label: 'Needs access', note: 'TikTok for Business is not linked yet (backend#218).' },
      from: 'platform',
    },
    {
      id: 'domain',
      group: 'Account',
      name: 'Ready to advertise minirueshop.com',
      detail: 'Domain verified, account active, payment method on file.',
      meta: { status: 'unk', label: 'Needs access', note: 'Check domain verification in Business settings.' },
      tiktok: { status: 'unk', label: 'Needs access', note: 'Check in TikTok Ads Manager.' },
      from: 'platform',
    },
    {
      id: 'pixel',
      group: 'Pixel',
      name: 'Browser pixel installed',
      detail: 'Loads on every storefront page, including route changes.',
      meta: { status: 'ok', note: 'Pixel 2165922481025159' },
      tiktok: { status: 'ok', note: 'Pixel DALS583C77U9262DR9Q0' },
      from: 'code',
    },
    {
      id: 'server',
      group: 'Server side',
      name: 'Server-side events',
      detail: 'Events sent from the server too, so ad blockers and iOS can’t hide them.',
      meta: {
        status: 'unk',
        label: 'Not confirmed',
        note: 'Conversions API code exists (backend#215) and only sends once the server has its Meta access token. The dashboard can’t see delivery yet (backend#231).',
      },
      tiktok: { status: 'warn', label: 'Purchase only', note: 'The Events API sends Purchase; other events are browser-only.' },
      from: 'code',
    },
    {
      id: 'dedup',
      group: 'Server side',
      name: 'No double counting',
      detail: 'Browser and server send the same event ID, so the platform counts one purchase.',
      meta: { status: 'ok', note: 'Shared ID purchase:{order id}, once server events are on.' },
      tiktok: { status: 'ok', note: 'Shared ID purchase:{order id}.' },
      from: 'code',
    },
    {
      id: 'standard',
      group: 'Events',
      name: 'Standard events',
      detail: 'PageView, ViewContent, AddToCart, InitiateCheckout, Purchase.',
      meta: { status: 'ok', label: '5 of 5' },
      tiktok: { status: 'ok', label: '5 of 5' },
      from: 'code',
    },
    {
      id: 'extra',
      group: 'Events',
      name: 'Extra events for optimisation',
      detail: 'AddPaymentInfo, Search, CompleteRegistration, Contact.',
      meta: { status: 'bad', label: '0 of 4', note: 'Not sent yet.' },
      tiktok: { status: 'bad', label: '0 of 4', note: 'Not sent yet.' },
      from: 'code',
    },
    {
      id: 'value',
      group: 'Events',
      name: 'Purchase value in EGP, above 0',
      detail: 'A purchase with a missing or zero value is rejected or useless for optimisation.',
      meta: value,
      tiktok: value,
      from: 'data',
    },
    {
      id: 'internal',
      group: 'Events',
      name: 'Test and owner traffic never sent',
      detail: 'Your own visits and test orders never reach the ad platforms as conversions.',
      meta: { status: 'ok', note: 'Excluded devices never load the pixel; the server skips internal orders.' },
      tiktok: { status: 'ok', note: 'Excluded devices never load the pixel; internal orders are skipped (backend c88e6bc).' },
      from: 'code',
    },
    {
      id: 'names',
      group: 'Campaigns',
      name: 'Every campaign has a readable name',
      detail: 'utm_campaign is a real name, not a number or an unfilled placeholder.',
      meta: campaignCheck(people, 'Meta'),
      tiktok: campaignCheck(people, 'TikTok'),
      from: 'data',
    },
    {
      id: 'utm',
      group: 'Campaigns',
      name: 'Full UTM on every ad link',
      detail: 'source, medium, campaign, content and term. (utm_id isn’t stored by analytics yet, backend#235.)',
      meta: utmCheck(links, 'Meta'),
      tiktok: utmCheck(links, 'TikTok'),
      from: 'data',
    },
    {
      id: 'catalogue',
      group: 'Catalogue',
      name: 'Product catalogue feed',
      detail: 'A live product feed so ads can show products and prices.',
      meta: { status: 'bad', note: 'Not set up (dashboard#118).' },
      tiktok: { status: 'bad', note: 'Not set up (dashboard#118).' },
      from: 'code',
    },
  ];
}

export interface PlatformScore {
  ok: number;
  warn: number;
  bad: number;
  unk: number;
  total: number;
  verdict: 'ready' | 'almost' | 'not-ready';
}

export function platformScore(checks: AdsCheck[], platform: 'meta' | 'tiktok'): PlatformScore {
  const st = checks.map((c) => c[platform].status);
  const s = {
    ok: st.filter((x) => x === 'ok').length,
    warn: st.filter((x) => x === 'warn').length,
    bad: st.filter((x) => x === 'bad').length,
    unk: st.filter((x) => x === 'unk').length,
    total: st.filter((x) => x !== 'na').length,
  };
  return { ...s, verdict: s.bad ? 'not-ready' : s.warn ? 'almost' : 'ready' };
}

/* ── Data quality ───────────────────────────────────────────────────────── */

const EXCLUSION_REASON: Record<string, { label: string; group: ExclusionRow['group']; rule: string }> = {
  UA_PATTERN: { label: 'Known bots and crawlers', group: 'bots', rule: 'Bot or crawler user agent' },
  UA_MISSING: { label: 'No browser signature', group: 'bots', rule: 'Missing or too-short user agent' },
  SERVER_ORIGIN: { label: 'Server-to-server requests', group: 'bots', rule: 'Arrived from a server, not a browser' },
  AI_AGENT: { label: 'AI agents', group: 'bots', rule: 'Signed AI agent or assistant' },
  WEBDRIVER: { label: 'Automated browsers', group: 'bots', rule: 'navigator.webdriver was on' },
  DATACENTER: { label: 'Data-centre traffic', group: 'bots', rule: 'IP belongs to a hosting provider' },
  INTERNAL: { label: 'You and staff', group: 'us', rule: 'Signed in to the dashboard, or a device marked as staff' },
  FLAG_OWNER: { label: 'Marked “This is us”', group: 'us', rule: 'Owner or test account, marked by an admin' },
  FLAG_INTERNAL: { label: 'Marked staff', group: 'us', rule: 'Staff, marked by an admin' },
  FLAG_BOT: { label: 'Marked bot', group: 'flagged', rule: 'A bot the filters missed, marked by an admin' },
  FLAG_SUSPICIOUS: { label: 'Marked suspicious', group: 'flagged', rule: 'Left out while an admin investigates' },
};

export function exclusionRows(q: QualityReport | null | undefined, countedPeople: number): ExclusionRow[] {
  if (!q) return [];
  const rows: ExclusionRow[] = q.botShareByReason.map((r) => {
    const meta = EXCLUSION_REASON[r.reason] ?? { label: r.reason.replace(/_/g, ' ').toLowerCase(), group: 'bots' as const, rule: 'Automatic filter' };
    return { reason: r.reason, label: meta.label, group: meta.group, events: r.count, share: pctOf(r.count, q.totalEvents), rule: meta.rule };
  });
  const countedEvents = Math.max(0, q.totalEvents - q.botEvents);
  rows.push({
    reason: 'COUNTED',
    label: 'Counted',
    group: 'counted',
    events: countedEvents,
    share: pctOf(countedEvents, q.totalEvents),
    rule: `${fmtInt(countedPeople)} unique people`,
  });
  return rows;
}

export function qaChecks(input: {
  quality?: QualityReport | null;
  recon?: ReconcileReport | null;
  uncredited: number;
  macro: number;
  idOnly: number;
  unknownLandings: number;
}): QaCheck[] {
  const { quality: q, recon } = input;
  const out: QaCheck[] = [];
  if (q) {
    const rejects = q.ingestRejects.reduce((s, r) => s + r.count, 0);
    out.push(
      rejects
        ? {
            id: 'rejects',
            status: 'warn',
            title: `${fmtInt(rejects)} events rejected at ingest`,
            detail: q.ingestRejects.map((r) => `${fmtInt(r.count)} ${r.reason.toLowerCase().replace(/_/g, ' ')}`).join(' · '),
            tag: 'Rejected',
          }
        : { id: 'rejects', status: 'ok', title: '0 events rejected at ingest', detail: 'No malformed or unknown events arrived.', tag: 'Pass' },
    );
    const failing = q.rollupJobs.filter((j) => j.consecutiveFailures > 0);
    out.push(
      failing.length
        ? {
            id: 'rollups',
            status: 'bad',
            title: `${failing.length} rollup ${failing.length === 1 ? 'job is' : 'jobs are'} failing`,
            detail: failing.map((j) => `${j.job}: ${j.lastError ?? 'failed'}`).join(' · '),
            tag: 'Failing',
          }
        : { id: 'rollups', status: 'ok', title: 'Every rollup job ran without error', detail: `${plural(q.rollupJobs.length, 'job')} checked.`, tag: 'Pass' },
    );
  }
  if (recon) {
    const diff = recon.orders.revenueMinor - recon.purchaseEvents.revenueMinor;
    out.push(
      diff === 0
        ? { id: 'totals', status: 'ok', title: '0 order total mismatches', detail: 'Tracked purchase values add up to the orders’ totals.', tag: 'Pass' }
        : {
            id: 'totals',
            status: 'warn',
            title: `Order totals differ by ${egp(Math.abs(diff))}`,
            detail: `Orders ${egp(recon.orders.revenueMinor)} vs tracked purchases ${egp(recon.purchaseEvents.revenueMinor)}.`,
            tag: 'Mismatch',
          },
    );
  }
  out.push(
    input.uncredited
      ? {
          id: 'names',
          status: 'warn',
          title: `${fmtInt(input.uncredited)} paid visitors have no campaign name`,
          detail: [
            input.macro ? `${fmtInt(input.macro)} from an ad sending a placeholder like __CAMPAIGN_NAME__` : '',
            input.idOnly ? `${fmtInt(input.idOnly)} from a campaign known only by its ID` : '',
          ]
            .filter(Boolean)
            .join('; ') || 'The ad link carries no campaign.',
          tag: 'Fix in ads',
          go: 'sources',
        }
      : { id: 'names', status: 'ok', title: 'Every paid visitor has a campaign name', detail: '', tag: 'Pass' },
  );
  out.push(
    input.unknownLandings
      ? {
          id: 'paths',
          status: 'warn',
          title: `${plural(input.unknownLandings, 'landing')} on unknown paths`,
          detail: 'Typos and old links the shop doesn’t serve. They still count as visits.',
          tag: 'Kept',
          go: 'sources',
        }
      : { id: 'paths', status: 'ok', title: 'Every landing page is a real shop page', detail: '', tag: 'Pass' },
  );
  const notYet = (id: string, title: string, detail: string): QaCheck => ({ id, status: 'unk', title, detail, tag: 'Not measured yet' });
  out.push(notYet('dupes', 'Duplicate events', 'Duplicates are dropped when they are written, but not counted, so this can’t be shown yet (backend#230).'));
  out.push(notYet('sequence', 'Impossible sequences', 'e.g. page_leave before its page_view. Not checked by the backend yet (backend#230).'));
  out.push(notYet('nobag', 'Checkouts without a bag', 'Needs per-person event order; only the furthest stage is known today (backend#230).'));
  out.push(notYet('drops', 'Events lost before they were saved', 'The write buffer has no counter yet (backend#230).'));
  return out;
}

/* ── The whole model ────────────────────────────────────────────────────── */

export interface AnalyticsModel {
  /** Counted visitors before the global filters: the canonical set. */
  all: PersonRow[];
  /** Counted visitors under the global filters: what every section shows. */
  view: PersonRow[];
  filtered: boolean;
  counts: StageCounts;
  steps: FunnelStep[];
  leak: number;
  channels: ChannelRow[];
  sources: SourceRow[];
  landings: (CountedRow & { unknown: boolean })[];
  paths: PathRow[];
  products: ProductView[];
  carts: CartView[];
  cartsValueMinor: number;
  outcomes: { key: Outcome; label: string; color: string; n: number }[];
  daily: { day: string; visitors: number }[];
  people: PersonView[];
  uncredited: { total: number; macro: number; idOnly: number; missing: number; paid: number };
  unknownLandings: { path: string; n: number }[];
  adLinks: AdLinkRow[];
  ads: AdsCheck[];
  scores: { meta: PlatformScore; tiktok: PlatformScore };
  exclusions: ExclusionRow[];
  qa: QaCheck[];
  rollupVisitors: number | null;
  /** Transitions that should never happen, counted from the people rows. */
  impossible: { orderWithoutCheckout: number; paidWithoutOrder: number };
  answers: Record<SectionId, Answer>;
  todo: NextStep[];
}

export function buildModel(input: ModelInputs): AnalyticsModel {
  const scope = input.range.traffic;
  const all = countedVisitors(input.people, scope);
  const filtered = activeFilterCount(input.filters) > 0;
  const view = filtered ? all.filter((p) => matchesFilters(p, input.filters)) : all;
  const counts = countStages(view);
  const steps = funnelSteps(counts);
  const leak = biggestDrop(steps);
  const channels = channelRows(view);
  const sources = sourceRows(view);
  const landings = landingRows(view, input.routes);
  const paths = pathRows(view);
  const products = productViews(view, input.products);
  const carts = cartViews(input.carts, view, filtered);
  const outcomes = outcomeSplit(view);
  const people = personViews(view, input.visits);
  const paid = view.filter((p) => channelOf(p.medium) === 'paid');
  const uncreditedPeople = paid.filter((p) => isUncredited(p.medium, p.campaign));
  const uncredited = {
    total: uncreditedPeople.length,
    macro: uncreditedPeople.filter((p) => campaignState(p.campaign) === 'macro').length,
    idOnly: uncreditedPeople.filter((p) => campaignState(p.campaign) === 'id-only').length,
    missing: uncreditedPeople.filter((p) => campaignState(p.campaign) === 'missing').length,
    paid: paid.length,
  };
  const unknownLandings = landings.filter((l) => l.unknown).map((l) => ({ path: l.key, n: l.visited }));
  const adLinks = adLinkRows(view);
  const ads = adsChecks(view, adLinks, input.recon);
  const scores = { meta: platformScore(ads, 'meta'), tiktok: platformScore(ads, 'tiktok') };
  const exclusions = exclusionRows(input.quality, all.length);
  const qa = qaChecks({
    quality: input.quality,
    recon: input.recon,
    uncredited: uncredited.total,
    macro: uncredited.macro,
    idOnly: uncredited.idOnly,
    unknownLandings: unknownLandings.reduce((s, l) => s + l.n, 0),
  });
  const daily = (input.timeseries ?? []).map((p) => ({ day: p.bucket.slice(0, 10), visitors: p.visitors }));
  const cartsValueMinor = carts.reduce((s, c) => s + c.valueMinor, 0);
  const base = {
    all,
    view,
    filtered,
    counts,
    steps,
    leak,
    channels,
    sources,
    landings,
    paths,
    products,
    carts,
    cartsValueMinor,
    outcomes,
    daily,
    people,
    uncredited,
    unknownLandings,
    adLinks,
    ads,
    scores,
    exclusions,
    qa,
    rollupVisitors: input.summary ? input.summary.visitors : null,
    impossible: {
      // A backend order, but tracking never saw that person reach checkout.
      orderWithoutCheckout: view.filter((p) => p.orders > 0 && !['checkout_step', 'paid', 'refunded'].includes(p.furthestStage ?? '')).length,
      // Tracking says paid, but no backend order is attributed to them.
      paidWithoutOrder: view.filter((p) => p.furthestStage === 'paid' && p.orders === 0).length,
    },
  };
  return { ...base, answers: answersFor(base, input), todo: nextSteps(base, input) };
}

type ModelBase = Omit<AnalyticsModel, 'answers' | 'todo'>;

/* ── The answer line on every section ───────────────────────────────────── */

export function answersFor(m: ModelBase, input: ModelInputs): Record<SectionId, Answer> {
  const c = m.counts;
  const leakStep = m.leak > 0 ? m.steps[m.leak] : null;
  const prevStep = m.leak > 0 ? m.steps[m.leak - 1] : null;
  const overview: Answer = c.visited
    ? {
        text: `${fmtInt(c.visited)} visitors, ${fmtInt(c.product)} viewed a product, ${fmtInt(c.bag)} added to bag, ${fmtInt(c.purchased)} bought. `,
        strong: leakStep && prevStep
          ? `The biggest drop is between ${prevStep.label.toLowerCase()} and ${leakStep.label.toLowerCase()}: ${fmtInt(leakStep.lost)} people lost.`
          : 'Nobody was lost between steps.',
        action: 'See what to do',
        jump: { section: 'overview', anchor: 'anx-next' },
      }
    : { text: 'No counted visitors in this range yet. ', strong: 'Pick a longer range, or check tracking in Data quality.', action: 'Open data quality', jump: { section: 'quality' } };

  const withCart = m.people.filter((p) => p.cartMinor > 0 && p.orders === 0);
  const noContact = withCart.filter((p) => !p.contactable).length;
  const contactLine =
    noContact === 0
      ? 'and every one of them can be contacted.'
      : noContact === withCart.length
        ? withCart.length === 1
          ? 'and they left no phone number.'
          : 'and none of them left a phone number.'
        : `and ${fmtInt(noContact)} of them left no phone number.`;
  const people: Answer = withCart.length
    ? {
        text: `${fmtInt(withCart.length)} of the ${fmtInt(m.people.length)} counted visitors left something in the bag, `,
        strong: contactLine,
        action: 'Open their journeys',
        jump: { section: 'journeys' },
      }
    : { text: `${fmtInt(m.people.length)} counted visitors in this range. `, strong: 'Nobody is holding an open bag.', action: 'Open their journeys', jump: { section: 'journeys' } };

  const top = m.outcomes[0];
  const journeys: Answer = top
    ? {
        text: `Most journeys end the same way: `,
        strong: `${fmtInt(top.n)} ${top.n === 1 ? 'person' : 'people'} ${top.label.toLowerCase()}.`,
        action: 'See the flow',
        jump: { section: 'flow' },
      }
    : { text: 'No journeys in this range. ', strong: 'Pick a longer range.', action: 'See the flow', jump: { section: 'flow' } };

  const u = m.uncredited;
  const sources: Answer = u.total
    ? {
        text: '',
        strong: `${fmtInt(u.total)} paid ${u.total === 1 ? 'visitor can’t' : 'visitors can’t'} be credited:`,
        action: 'Fix in ads quality',
        jump: { section: 'ads' },
      }
    : {
        text: `Paid ads brought ${fmtInt(u.paid)} of ${fmtInt(c.visited)} visitors. `,
        strong: u.paid ? 'Every paid visitor is credited to a named campaign.' : 'No paid visitors in this range.',
        action: 'Open ads quality',
        jump: { section: 'ads' },
      };
  if (u.total) {
    const bits = [
      u.macro ? `${fmtInt(u.macro)} arrived from an ad sending a placeholder like __CAMPAIGN_NAME__` : '',
      u.idOnly ? `${fmtInt(u.idOnly)} from a campaign known only by its ID` : '',
      u.missing ? `${fmtInt(u.missing)} with no campaign on the link` : '',
    ].filter(Boolean);
    sources.text = '';
    sources.strong = `${sources.strong} ${bits.join(', ')}.`;
  }

  const reachedBag = m.paths.filter((p) => p.bag > 0).length;
  const flowLeak = leakStep ? leakStep.label.toLowerCase() : 'the product page';
  const flow: Answer = m.paths.length
    ? {
        text: `Every path loses the most people before “${flowLeak}”. `,
        strong: `${fmtInt(reachedBag)} of ${fmtInt(m.paths.length)} paths reached the bag.`,
        action: 'Open data quality',
        jump: { section: 'quality' },
      }
    : { text: 'No paths in this range. ', strong: 'Pick a longer range.', action: 'Open data quality', jump: { section: 'quality' } };

  const ready = (s: PlatformScore) => s.verdict === 'ready';
  const serverMeta = m.ads.find((a) => a.id === 'server')?.meta.status;
  const ads: Answer = {
    text: '',
    strong:
      ready(m.scores.meta) && ready(m.scores.tiktok)
        ? 'Both platforms are ready to scale.'
        : !ready(m.scores.meta) && !ready(m.scores.tiktok)
          ? 'Neither platform is ready to scale:'
          : `${ready(m.scores.meta) ? 'TikTok' : 'Meta'} is not ready to scale:`,
    action: 'See the checks',
    jump: { section: 'ads', anchor: 'anx-adsm' },
  };
  if (!(ready(m.scores.meta) && ready(m.scores.tiktok))) {
    const why = [
      serverMeta !== 'ok' ? 'Meta server-side purchases aren’t confirmed' : '',
      u.total ? `${fmtInt(u.total)} paid visitors have no campaign name` : '',
      'no product catalogue feed yet',
    ].filter(Boolean);
    ads.strong = `${ads.strong} ${why.join(', ')}.`;
  }

  const needs = m.qa.filter((q) => q.status === 'warn' || q.status === 'bad').length;
  const recon = input.recon;
  const quality: Answer = {
    text: `Overview, People and Journeys all count the same ${fmtInt(m.all.length)} visitors. ${
      recon ? (recon.healthy ? 'Purchases reconcile to orders. ' : 'Purchases and orders disagree. ') : ''
    }`,
    strong: needs ? `${needs} ${needs === 1 ? 'check needs' : 'checks need'} a look.` : 'Every measured check passes.',
    action: 'See the checks',
    jump: { section: 'quality', anchor: 'anx-qa' },
  };

  return { overview, people, journeys, sources, flow, ads, quality };
}

/* ── What to do next, ranked by what each is costing ────────────────────── */

export function nextSteps(m: ModelBase, input: ModelInputs): NextStep[] {
  const out: NextStep[] = [];
  const c = m.counts;
  const paid = m.uncredited.paid;
  const paidBuyers = m.view.filter((p) => channelOf(p.medium) === 'paid' && p.orders > 0).length;
  if (paid >= 10 && paidBuyers === 0) {
    out.push({
      id: 'spend',
      severity: 'high',
      title: 'Hold ad spend.',
      detail: `${fmtInt(paid)} paid visitors, 0 purchases. Measure before spending more.`,
      go: 'flow',
      filters: { source: ['paid'] },
    });
  }
  if (m.leak > 0) {
    const s = m.steps[m.leak];
    const prev = m.steps[m.leak - 1];
    const topProduct = m.products[0];
    const productLeak = s.key === 'bag';
    out.push({
      id: 'leak',
      severity: 'high',
      title: productLeak ? 'Fix the product page leak.' : `Fix the drop before “${s.label}”.`,
      detail: `${fmtInt(prev.n)} ${prev.label.toLowerCase()}, ${fmtInt(s.n)} ${s.label.toLowerCase()}.${
        productLeak && topProduct
          ? ` Start with ${topProduct.name} (${fmtInt(topProduct.viewers)} viewed): price, delivery, trust, and the mobile Add-to-bag button.`
          : ''
      }`,
      go: 'people',
      search: productLeak && topProduct ? topProduct.name : undefined,
    });
  }
  if (m.uncredited.total) {
    out.push({
      id: 'names',
      severity: 'warn',
      title: 'Name the unnamed campaigns.',
      detail: `${fmtInt(m.uncredited.total)} paid visitors can’t be credited to any campaign.`,
      go: 'ads',
    });
  }
  const server = m.ads.find((a) => a.id === 'server');
  if (server && server.meta.status !== 'ok') {
    out.push({
      id: 'capi',
      severity: 'warn',
      title: 'Confirm Meta’s Conversions API is on.',
      detail: 'Until it is, Meta sees purchases from the browser only; ad blockers and iOS hide some.',
      go: 'ads',
    });
  }
  const unreachable = m.carts.filter((x) => !x.contactable);
  if (unreachable.length) {
    out.push({
      id: 'carts',
      severity: 'warn',
      title: 'Ask for a phone number earlier in checkout.',
      detail: `${fmtInt(m.carts.length)} open ${m.carts.length === 1 ? 'cart' : 'carts'} (${egp(m.cartsValueMinor)}) and ${
        unreachable.length === m.carts.length ? (m.carts.length === 1 ? 'it can’t' : 'none can') : `${fmtInt(unreachable.length)} can’t`
      } be contacted.`,
      go: 'journeys',
      visitorId: unreachable[0].visitorId ?? undefined,
    });
  }
  if (c.purchased === 0 || (input.recon && !input.recon.healthy)) {
    out.push({
      id: 'diag',
      severity: 'info',
      title: 'Treat Add-to-bag as a signal, not a goal.',
      detail: 'Optimise ads to Add-to-bag only until purchases reconcile to orders.',
      go: 'quality',
    });
  }
  return out;
}

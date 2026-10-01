import { apiFetch } from './client';

export type GiveawayPool = 'BOOTH' | 'ONLINE';
export type GiveawayPublicState = 'OFF' | 'OPEN' | 'DRAWN' | 'PENDING_DRAW' | 'NO_ENTRIES' | 'REVEALED';
/**
 * EXCLUDE and INCLUDE log an entrant taken out of the draw or put back.
 * Open-ended, so an action a newer backend adds still renders.
 */
export type GiveawayAuditAction =
  | 'CREATE' | 'UPDATE' | 'ENABLE' | 'DISABLE' | 'DRAW' | 'PICK' | 'RESET' | 'VOID' | 'HIDE' | 'SHOW'
  | 'EXCLUDE' | 'INCLUDE'
  | (string & {});

export interface GiveawayPutBody {
  enabled: boolean;
  minSpendMinor: number;
  countShipping: boolean;
  revealTime: string;
  title: string;
  /**
   * A catalogue product as the prize, or null for a custom prize. With a
   * product, an empty title or description and a null image fall back to the
   * product's own name, description and cover; anything set here wins.
   */
  prizeProductId: string | null;
  prizeTitle: string;
  prizeDescription: string;
  prizeGalleryItemId: string | null;
  terms: string;
}

/** Settings as the server returns them. `prizeProductId` is absent on a backend older than giveaway v2. */
export type GiveawaySettings = Omit<GiveawayPutBody, 'prizeProductId'> & { prizeProductId?: string | null };

export interface GiveawayConfig extends GiveawaySettings {
  id: string;
  pool: GiveawayPool;
  day: string;
  revealAt: string;
  version: number;
  updatedAt: string;
}

export interface GiveawayOrder {
  orderId: string;
  orderNumber: string;
  spendMinor: number;
}

export interface GiveawayEntrant {
  key: string;
  registered: boolean;
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  totalMinor: number;
  orders: GiveawayOrder[];
  /** Qualified and not removed from the draw. */
  eligible: boolean;
  /** When their spend reached the minimum; null while it has not. */
  qualifiedAt: string | null;
  /** Removed from the draw by an admin. Absent on an older backend, which means "not removed". */
  excluded?: boolean;
  /**
   * Legacy. Since backend 0.140.2 it mirrors `excluded`; before that it only masked the
   * public name. Read `excluded`, never this.
   */
  hidden?: boolean;
}

export interface GiveawayWinner {
  key: string;
  ref: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  registered: boolean;
  totalMinor: number;
  orders: GiveawayOrder[];
}

export interface GiveawayDraw {
  method: 'RANDOM' | 'MANUAL';
  drawnAt: string;
  drawnBy: string;
  entrantCount: number;
  listHash: string;
  winner: GiveawayWinner;
  winnerStillEligible: boolean;
}

export interface GiveawayAuditEntry {
  id: string;
  action: GiveawayAuditAction;
  detail: unknown;
  actor: string;
  at: string;
}

export interface GiveawayTopSpender {
  key: string;
  fullName: string;
  totalMinor: number;
  orderCount: number;
}

/** Admin-only figures for the pool and day, always from the live list (not the frozen draw). */
export interface GiveawayStats {
  /** Buyers whose spend reached the minimum, removed ones included. */
  entrantCount: number;
  eligibleCount: number;
  excludedCount: number;
  /** Every paid buyer in the pool that day, qualified or not. */
  buyerCount: number;
  /** Across every buyer. */
  totalSpendMinor: number;
  /** totalSpendMinor / buyerCount. */
  averageSpendMinor: number;
  /** Up to five, highest spend first, qualified or not. */
  topSpenders: GiveawayTopSpender[];
}

export interface GiveawayView {
  pool: GiveawayPool;
  day: string;
  today: string;
  timezone: 'Africa/Cairo';
  serverTime: string;
  giveaway: GiveawayConfig | null;
  prize: null | {
    title: string;
    description: string;
    imageUrl: string | null;
    mediaKind: 'image' | 'video';
    /** Set when the prize is a catalogue product; absent on an older backend. */
    productId?: string | null;
  };
  defaults: GiveawaySettings | null;
  publicState: GiveawayPublicState;
  /** Latest first. */
  entrants: GiveawayEntrant[];
  frozenKeys: string[] | null;
  draw: GiveawayDraw | null;
  audit: GiveawayAuditEntry[];
  /** Absent on a backend older than giveaway v2. */
  stats?: GiveawayStats | null;
}

const BASE = '/admin/giveaways';

export function getGiveaway(pool: GiveawayPool, day?: string): Promise<GiveawayView> {
  const params = new URLSearchParams({ pool });
  if (day) params.set('day', day);
  return apiFetch<GiveawayView>(`${BASE}?${params.toString()}`, { auth: true });
}

export function saveGiveaway(pool: GiveawayPool, day: string, body: GiveawayPutBody): Promise<GiveawayConfig> {
  return apiFetch<GiveawayConfig>(`${BASE}/${pool}/${day}`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(body),
  });
}

export function drawGiveaway(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`${BASE}/${id}/draw`, { method: 'POST', auth: true });
}

export function pickGiveawayWinner(id: string, key: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`${BASE}/${id}/pick`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ key }),
  });
}

export function resetGiveawayDraw(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`${BASE}/${id}/reset`, { method: 'POST', auth: true });
}

export function voidGiveawayDraw(id: string, reason: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`${BASE}/${id}/void`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ reason }),
  });
}

/**
 * Remove an entrant from the draw, or put them back. 409 while a draw exists.
 * The legacy `/hidden` route does the same since backend 0.140.2; this is the one to call.
 */
export function setGiveawayEntrantExcluded(id: string, key: string, excluded: boolean): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`${BASE}/${id}/excluded`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ key, excluded }),
  });
}

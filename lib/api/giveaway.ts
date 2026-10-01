import { apiFetch } from './client';

export type GiveawayPool = 'BOOTH' | 'ONLINE';
export type GiveawayPublicState = 'OFF' | 'OPEN' | 'DRAWN' | 'PENDING_DRAW' | 'NO_ENTRIES' | 'REVEALED';
export type GiveawayAuditAction = 'CREATE' | 'UPDATE' | 'ENABLE' | 'DISABLE' | 'DRAW' | 'PICK' | 'RESET' | 'VOID' | 'HIDE' | 'SHOW';

export interface GiveawayPutBody {
  enabled: boolean;
  minSpendMinor: number;
  countShipping: boolean;
  revealTime: string;
  title: string;
  prizeTitle: string;
  prizeDescription: string;
  prizeGalleryItemId: string | null;
  terms: string;
}

export interface GiveawayConfig extends GiveawayPutBody {
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
  eligible: boolean;
  qualifiedAt: string | null;
  hidden: boolean;
  publicName: string | null;
  phoneTail: string | null;
}

export interface GiveawayWinner {
  key: string;
  ref: string;
  publicName: string | null;
  phoneTail: string | null;
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
  };
  defaults: GiveawayPutBody | null;
  publicState: GiveawayPublicState;
  entrants: GiveawayEntrant[];
  frozenKeys: string[] | null;
  draw: GiveawayDraw | null;
  audit: GiveawayAuditEntry[];
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

export function setGiveawayEntrantHidden(id: string, key: string, hidden: boolean): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`${BASE}/${id}/hidden`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ key, hidden }),
  });
}

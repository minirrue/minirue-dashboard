import { apiFetch } from './client';

/**
 * The truth layer (dashboard#111, #90 S1): an admin's verdict on who counts
 * in analytics. Backend: minirue-backend 0.124.0 `/v1/analytics/flags`.
 */
export type TrafficClass = 'OWNER' | 'INTERNAL' | 'BOT' | 'SUSPICIOUS' | 'TRUSTED';
export type FlagSubjectType = 'VISITOR' | 'USER';

export interface TrafficFlag {
  id: string;
  subjectType: FlagSubjectType;
  subjectId: string;
  trafficClass: TrafficClass;
  reason: string | null;
  createdBy: string | null;
  createdAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
  affected: { visitors: number; events: number; orders: number; fromDay: string | null };
}

export function apiListTrafficFlags(activeOnly = false): Promise<{ items: TrafficFlag[] }> {
  return apiFetch(`/analytics/flags${activeOnly ? '?active=true' : ''}`, { auth: true });
}

export function apiTrafficFlagFor(
  subjectType: FlagSubjectType,
  subjectId: string,
): Promise<{ flag: TrafficFlag | null }> {
  return apiFetch(
    `/analytics/flags/subject/${subjectType}/${encodeURIComponent(subjectId)}`,
    { auth: true },
  );
}

export function apiSetTrafficFlag(input: {
  subjectType: FlagSubjectType;
  subjectId: string;
  trafficClass: TrafficClass;
  reason?: string | null;
}): Promise<TrafficFlag> {
  return apiFetch('/analytics/flags', { auth: true, method: 'POST', body: JSON.stringify(input) });
}

export function apiRevokeTrafficFlag(id: string): Promise<TrafficFlag> {
  return apiFetch(`/analytics/flags/${encodeURIComponent(id)}`, { auth: true, method: 'DELETE' });
}

/** A 30-minute "Exclude this device" link; `path` is relative to the API origin. */
export function apiMintDeviceLink(): Promise<{ path: string; expiresAt: string }> {
  return apiFetch('/analytics/flags/device-link', { auth: true, method: 'POST' });
}

/** What each verdict means, in the words the admin chooses by. */
export const TRAFFIC_CLASS_COPY: Record<TrafficClass, { label: string; short: string; consequence: string }> = {
  OWNER: {
    label: 'Owner / test account',
    short: 'Owner',
    consequence:
      'Every visit, cart and order is left out of analytics and never sent to Meta or TikTok. Past activity too.',
  },
  INTERNAL: {
    label: 'Staff',
    short: 'Staff',
    consequence: 'Treated like the owner: excluded everywhere, orders never reported as ad conversions.',
  },
  SUSPICIOUS: {
    label: 'Suspicious',
    short: 'Suspicious',
    consequence: 'Left out of counts while you investigate. Explain why so the team knows later.',
  },
  BOT: {
    label: 'Bot',
    short: 'Bot',
    consequence: 'Automated traffic the filters missed. Left out of every count.',
  },
  TRUSTED: {
    label: 'Real customer',
    short: 'Verified real',
    consequence: 'Counted even if the bot filters flagged it. Use when a real shopper was misclassified.',
  },
};

/** API origin the storefront beacons use, so a device link opens on the same host. */
export function apiOrigin(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002';
  return base.replace(/\/+$/, '');
}

import { apiFetch } from './client';
import type { StorefrontLayout } from './storefront';
import type { GovernorateRate } from '@/lib/shipping/governorate-rates';
import type { GovernorateKey } from '@/lib/geo/governorates';

export type { StorefrontLayout };
export type { GovernorateRate };

export interface BrandConfig {
  logoUrl: string | null;
  contactEmail: string;
  contactPhone: string | null;
  /**
   * The ONE admin-editable shop display name (2026-07-31 owner ask: "so
   * customer can't see mini rue and MiniRue and MINIRUE in different
   * places"). Read by the storefront header/footer, the support chat sender
   * name, and this dashboard's own chrome — see `useShopName` (lib/hooks/
   * use-shop-name.ts). `null` means unconfigured; every reader falls back to
   * the same default the backend uses (`DEFAULT_SHOP_DISPLAY_NAME`,
   * "MiniRue").
   */
  displayName: string | null;
}

export interface TaxRule {
  /**
   * Whether this shop charges VAT at all — distinct from a 0% rate, which
   * `vatPct: 0` alone could not express.
   *
   * Optional because a rule saved before the switch existed has no such key.
   * Absent means "charging, if there is a rate", which is what every shop that
   * predates the switch meant and what the server's `isVatCharged` decides.
   */
  enabled?: boolean;
  country: string;
  vatPct: number;
}

export interface ShippingZone {
  country: string;
  name: string;
  rateCents: number;
}

/**
 * What the storefront's /checkout/instapay page shows (minirue-backend#170).
 * Every field is nullable, and `null` means "use the storefront's default" —
 * never send `''`. The two images are plain URLs, the same convention as
 * `storefront.faviconUrl`.
 */
export interface InstapayGuide {
  /** An https:// InstaPay payment link. */
  payLink: string | null;
  /** The InstaPay address, e.g. `shop@instapay`. At most 64 characters. */
  handle: string | null;
  qrMediaUrl: string | null;
  exampleMediaUrl: string | null;
}

/**
 * Delivery methods (dashboard#84 / backend#186's pinned contract). Stored on
 * the authenticated settings payload under `fulfillment.delivery` — the
 * dashboard always sends the whole block on save, and the backend replaces it
 * wholesale (the `pricing` pattern, not the per-field-optional `instapay`
 * one), so every field here is required on write.
 */
export interface StandardDeliveryConfig {
  enabled: boolean;
  /** e.g. "2–5 working days". 1..80 chars. */
  etaLabel: string;
}

export interface SameDayDeliveryConfig {
  enabled: boolean;
  /** At least one governorate; closed list, dashboard#84's `lib/geo/governorates`. */
  governorates: GovernorateKey[];
  /** 'HH:mm', 24h. */
  windowStart: string;
  /** 'HH:mm', or the literal '24:00' for midnight/end-of-day. */
  windowEnd: string;
  /** 'HH:mm'. Must be at least 60 minutes before windowEnd. */
  cutoff: string;
  feeRangeMinor: { min: number; max: number };
  /** 1..1000 chars. */
  disclaimer: string;
}

export interface DeliveryConfig {
  standard: StandardDeliveryConfig;
  sameDay: SameDayDeliveryConfig;
}

export interface FulfillmentConfig {
  /** Optional: absent on any store that has never saved this block. */
  delivery?: DeliveryConfig;
}

export interface StoreSettings {
  currency: string;
  locale: string;
  shippingZones: ShippingZone[];
  /**
   * MiniRue's own shipping charge, used when no zone matches. Optional: a store
   * that has never set one gets the server default.
   */
  shipping?: {
    flatRateCents: number;
    currency: string;
    freeOverCents: number;
    /**
     * Per-governorate delivery fees (minirue-backend#83). The admin's table IS
     * the enum the storefront's checkout select is built from.
     *
     * Optional on BOTH sides of the wire, and the two absences mean different
     * things. Reading: a shop that has never configured one has no key at all.
     * Writing: the server treats an ABSENT `rates` as "leave the stored table
     * alone" and an explicit `[]` as "clear it" — deliberately, so an older
     * dashboard PATCHing only `{ flatRateCents, currency, freeOverCents }`
     * cannot wipe the table as a side effect of saving the flat rate. This
     * dashboard always loads the table before it saves, so it sends the array
     * explicitly; see `SettingsClient`'s `handleSubmit`.
     *
     * An empty table means "charge the global flat rate to everyone" — never
     * "ship free".
     */
    rates?: GovernorateRate[];
  };
  /** Absent on a store that has never had tax rules configured. */
  taxRules?: TaxRule[];
  /**
   * Payment-method rules (minirue-backend#105). `codMaxOrderMinor: null` (or
   * the block absent) means no cash-on-delivery limit — the default.
   */
  payments?: {
    codMaxOrderMinor: number | null;
    /**
     * The storefront's InstaPay payment guide (minirue-backend#170). Optional
     * on the wire: a PATCH of `payments` WITHOUT this key leaves the stored
     * guide untouched. When it is sent, all four keys go with it.
     */
    instapay?: InstapayGuide;
  };
  brand: BrandConfig;
  maintenanceMode: boolean;
  storefront?: StorefrontLayout;
  /**
   * Covers for the shop panel's two shortcut tiles — "All Products" and
   * "Bundles" on the storefront's /categories page. Gallery item ids: these are
   * what you SEND.
   *
   * Absent on any store that has never set one, in which case both tiles keep
   * their glyph.
   */
  shopPanel?: {
    allProductsImageMediaId: string | null;
    bundlesImageMediaId: string | null;
  };
  /**
   * The same two covers as resolved URLs — read-only, server-attached, and
   * never sent back. The picker needs a URL to draw the current choice while
   * the database keeps ids; the API strips this from any patch, so including it
   * in a save is harmless but pointless.
   */
  shopPanelImages?: {
    allProductsImageUrl: string | null;
    bundlesImageUrl: string | null;
  };
  /** Optional: absent on any row written before dashboard#84 / backend#186. */
  fulfillment?: FulfillmentConfig;
}

export async function apiGetSettings(): Promise<StoreSettings> {
  return apiFetch('/settings', { auth: true });
}

export async function apiUpdateSettings(data: Partial<StoreSettings>): Promise<StoreSettings> {
  return apiFetch('/settings', { method: 'PATCH', auth: true, body: JSON.stringify(data) });
}

/**
 * The public (unauthenticated) subset of settings — same shape as
 * `SettingsService.getPublicSettings` (minirue-backend). Used by
 * `useShopName` so the ONE shop name is readable before login (the login
 * page itself) and without re-fetching the whole authenticated settings
 * document everywhere else.
 */
export interface PublicSettings {
  /** Constant, not editable — the shop's fixed legal name. */
  storeName: string;
  /** The ONE admin-editable display name — see `BrandConfig.displayName`. */
  displayName: string;
  currency: string;
  logoUrl: string | null;
  /**
   * Optional: absent on any store that has never saved delivery settings
   * (dashboard#84 / backend#186). Published so the storefront's checkout can
   * build its method cards without an authenticated call. `sameDay.timezone`
   * is computed server-side, never stored — 'Africa/Cairo' at the time of
   * writing.
   */
  delivery?: DeliveryConfig & { sameDay: SameDayDeliveryConfig & { timezone: string } };
}

export async function apiGetPublicSettings(): Promise<PublicSettings> {
  return apiFetch('/settings/public');
}

export async function apiUploadBrandLogo(file: File): Promise<StoreSettings> {
  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return apiFetch('/settings/logo', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ mimeType: file.type, dataBase64 }),
  });
}

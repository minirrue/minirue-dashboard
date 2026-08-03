import { apiFetch } from './client';
import type { StorefrontLayout } from './storefront';

export type { StorefrontLayout };

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
  country: string;
  vatPct: number;
}

export interface ShippingZone {
  country: string;
  name: string;
  rateCents: number;
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
  };
  /** Absent on a store that has never had tax rules configured. */
  taxRules?: TaxRule[];
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

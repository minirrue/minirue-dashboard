import { apiFetch } from './client';

export interface BrandConfig {
  storeName: string;
  logoUrl: string | null;
  contactEmail: string;
  contactPhone: string | null;
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
  taxRules: TaxRule[];
  brand: BrandConfig;
  maintenanceMode: boolean;
  storefront?: StorefrontSettings;
}

export interface HeroSlideConfig {
  id: number;
  type: 'photo' | 'editorial';
  eyebrow: string;
  headline: string;
  sub: string;
  tagline: string;
  bg: string;
  bottle?: string;
  cap?: string;
  tile?: string;
}

export interface StorefrontSettings {
  announcementEnabled: boolean;
  announcementMessages: string[];
  announcementLinkUrl: string | null;
  announcementBackground: string | null;
  faviconUrl: string | null;
  footerTagline: string | null;
  heroSlides: HeroSlideConfig[];
}

export async function apiGetSettings(): Promise<StoreSettings> {
  return apiFetch('/settings', { auth: true });
}

export async function apiUpdateSettings(data: Partial<StoreSettings>): Promise<StoreSettings> {
  return apiFetch('/settings', { method: 'PATCH', auth: true, body: JSON.stringify(data) });
}

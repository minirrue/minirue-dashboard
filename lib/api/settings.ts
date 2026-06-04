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
}

export async function apiGetSettings(): Promise<StoreSettings> {
  return apiFetch('/settings', { auth: true });
}

export async function apiUpdateSettings(data: Partial<StoreSettings>): Promise<StoreSettings> {
  return apiFetch('/settings', { method: 'PATCH', auth: true, body: JSON.stringify(data) });
}

/**
 * Mirror of the backend's closed governorate list
 * (minirue-backend `src/common/geo/governorates.ts`, backend#186 /
 * dashboard#84's pinned contract). 27 keys — kept in sync by hand, English
 * labels only (this dashboard is English-only; Arabic labels are the
 * storefront's concern).
 *
 * Used by the same-day delivery Settings panel's governorate multi-select and
 * to label an order's delivery address in the same-day queue.
 */

export const GOVERNORATE_KEYS = [
  'ALEXANDRIA',
  'ASWAN',
  'ASYUT',
  'BEHEIRA',
  'BENI_SUEF',
  'CAIRO',
  'DAKAHLIA',
  'DAMIETTA',
  'FAIYUM',
  'GHARBIA',
  'GIZA',
  'ISMAILIA',
  'KAFR_EL_SHEIKH',
  'LUXOR',
  'MATROUH',
  'MINYA',
  'MONUFIA',
  'NEW_VALLEY',
  'NORTH_SINAI',
  'PORT_SAID',
  'QALYUBIA',
  'QENA',
  'RED_SEA',
  'SHARQIA',
  'SOHAG',
  'SOUTH_SINAI',
  'SUEZ',
] as const;

export type GovernorateKey = (typeof GOVERNORATE_KEYS)[number];

export const GOVERNORATE_LABELS: Record<GovernorateKey, string> = {
  ALEXANDRIA: 'Alexandria',
  ASWAN: 'Aswan',
  ASYUT: 'Asyut',
  BEHEIRA: 'Beheira',
  BENI_SUEF: 'Beni Suef',
  CAIRO: 'Cairo',
  DAKAHLIA: 'Dakahlia',
  DAMIETTA: 'Damietta',
  FAIYUM: 'Faiyum',
  GHARBIA: 'Gharbia',
  GIZA: 'Giza',
  ISMAILIA: 'Ismailia',
  KAFR_EL_SHEIKH: 'Kafr El Sheikh',
  LUXOR: 'Luxor',
  MATROUH: 'Matrouh',
  MINYA: 'Minya',
  MONUFIA: 'Monufia',
  NEW_VALLEY: 'New Valley',
  NORTH_SINAI: 'North Sinai',
  PORT_SAID: 'Port Said',
  QALYUBIA: 'Qalyubia',
  QENA: 'Qena',
  RED_SEA: 'Red Sea',
  SHARQIA: 'Sharqia',
  SOHAG: 'Sohag',
  SOUTH_SINAI: 'South Sinai',
  SUEZ: 'Suez',
};

export function isGovernorateKey(value: unknown): value is GovernorateKey {
  return typeof value === 'string' && (GOVERNORATE_KEYS as readonly string[]).includes(value);
}

export function governorateLabel(key: string): string {
  return isGovernorateKey(key) ? GOVERNORATE_LABELS[key] : key;
}

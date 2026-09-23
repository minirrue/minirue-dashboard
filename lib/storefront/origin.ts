/**
 * Where the shop lives, for "View live site" and the editor's real-storefront
 * preview (minirue-frontend `/_internal/draft-preview`, minirue-frontend#193).
 *
 * Always the production shop: its preview page lets both
 * https://dashboard.minirueshop.com and the local dashboard
 * (http://localhost:3021) frame it, so a local editor previews against the
 * real storefront components too.
 */
export const STOREFRONT_PRODUCTION_ORIGIN = 'https://minirueshop.com';

export function storefrontOrigin(): string {
  return STOREFRONT_PRODUCTION_ORIGIN;
}

export const DRAFT_PREVIEW_PATH = '/_internal/draft-preview';

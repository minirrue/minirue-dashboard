/**
 * Whether a picked image is big enough for the slot it is going into.
 *
 * The hero renders full-bleed and the storefront asks imgproxy for renders up
 * to 2560 CSS px at `dpr:2`. imgproxy does not upscale — correctly — so a
 * source smaller than the slot is simply served at its own size and the browser
 * stretches it.
 *
 * Measured on the live site (minirue-frontend#11): every image on the homepage
 * is smaller than the width it is rendered at, and the hero slides are the
 * worst of them — 340x454, 563x751, 663x424. A 340px source in a 2560px hero
 * is a 7.5x upscale, which is the visible pixelation that opened that issue.
 *
 * No amount of `sizes` tuning or srcset work fixes that; the storefront side is
 * already correct. It is an asset problem, and the only place to catch it is
 * where somebody chooses the asset.
 *
 * ## Why a warning rather than a block
 *
 * A shop owner mid-campaign with only a small crop to hand should be able to
 * ship it and fix it later. Refusing the save would mean no hero at all, which
 * is worse than a soft one — and the dimensions are advice, not correctness.
 *
 * The numbers are deliberately the RENDERED size rather than the ideal. 2560 is
 * what the largest srcset rung asks for; going beyond it buys nothing on any
 * display the shop serves, and asking for 5120 (2560 at dpr:2) would flag
 * almost every real photograph and get ignored.
 */

/** The widest render the storefront requests for a full-bleed desktop hero. */
export const HERO_DESKTOP_MIN_WIDTH = 2560;

/**
 * The mobile crop is portrait and never full-bleed on a wide screen, so it is
 * judged on the phone rungs rather than the desktop one — 1280 covers a 640px
 * viewport at dpr:2, which is the common case.
 */
export const HERO_MOBILE_MIN_WIDTH = 1280;

export type HeroSlot = 'desktop' | 'mobile';

export interface HeroImageWarning {
  /** How wide the source actually is. */
  width: number;
  /** How wide it needs to be for this slot. */
  needed: number;
  /** Rounded up, for the copy: "about 4x". */
  upscale: number;
  message: string;
}

/**
 * `null` when the image is fine, or when its width is unknown.
 *
 * An unknown width is NOT a warning. `gallery_items.width` is nullable and is
 * null for anything uploaded before the column existed, so treating null as
 * "too small" would flag a library of images that may be perfectly good and
 * teach everyone to ignore the badge.
 */
export function heroImageWarning(
  width: number | null | undefined,
  slot: HeroSlot,
): HeroImageWarning | null {
  if (typeof width !== 'number' || width <= 0) return null;

  const needed =
    slot === 'desktop' ? HERO_DESKTOP_MIN_WIDTH : HERO_MOBILE_MIN_WIDTH;
  if (width >= needed) return null;

  const upscale = Math.round((needed / width) * 10) / 10;
  return {
    width,
    needed,
    upscale,
    message:
      `This image is ${width}px wide and the ${slot} hero renders up to ` +
      `${needed}px, so it will be stretched about ${upscale}x and look soft. ` +
      `Re-export it at ${needed}px or wider.`,
  };
}

import {
  HERO_DESKTOP_MIN_WIDTH,
  HERO_MOBILE_MIN_WIDTH,
  heroImageWarning,
} from '@/lib/storefront/hero-image-guidance';

/**
 * Stopping the pixelation recurring (minirue-frontend#11).
 *
 * That issue's own Notes said to check the source resolution before changing
 * any code, and measuring the live site proved it right: every image on the
 * homepage is smaller than the width it is rendered at, and the hero slides are
 * the worst — 340x454, 563x751, 663x424.
 *
 * The storefront side is already correct: the hero emits a real srcset from
 * imgproxy at four widths. imgproxy does not upscale, correctly, so a source
 * smaller than the slot is served at its own size and the browser stretches it.
 * No `sizes` tuning fixes that.
 *
 * Re-exporting the current heroes fixes today. This is what stops it happening
 * again — the check at the point somebody chooses the asset.
 */

describe('heroImageWarning', () => {
  it('warns about a source narrower than the desktop hero renders', () => {
    const warning = heroImageWarning(340, 'desktop');

    expect(warning).not.toBeNull();
    expect(warning?.needed).toBe(HERO_DESKTOP_MIN_WIDTH);
    expect(warning?.width).toBe(340);
  });

  it('says how bad it is, in the terms the problem is described in', () => {
    // "About 7.5x" is actionable; "below the recommended width" is not. The
    // real worst case on the live site was 340px in a 2560px hero.
    const warning = heroImageWarning(340, 'desktop');

    expect(warning?.upscale).toBeCloseTo(7.5, 1);
    expect(warning?.message).toContain('340px');
    expect(warning?.message).toContain('2560px');
    expect(warning?.message).toContain('7.5');
  });

  it('tells them what to do about it', () => {
    // A warning that names a problem and no remedy just makes someone feel bad
    // about an image they cannot change without being told the target.
    expect(heroImageWarning(600, 'desktop')?.message).toMatch(
      /Re-export it at 2560px or wider/,
    );
  });

  it('is quiet at exactly the rendered width', () => {
    // The boundary. 2560 is what the largest srcset rung asks for — a source
    // that size is served unstretched, so flagging it would be wrong.
    expect(heroImageWarning(HERO_DESKTOP_MIN_WIDTH, 'desktop')).toBeNull();
  });

  it('is quiet above it', () => {
    expect(heroImageWarning(4000, 'desktop')).toBeNull();
  });

  it('holds the mobile crop to a lower bar', () => {
    /*
     * The portrait crop is never full-bleed on a wide screen, so it is judged
     * on the phone rungs — 1280 covers a 640px viewport at dpr:2.
     *
     * Using the desktop number here would flag almost every portrait crop and
     * get the warning ignored, which is worse than not having it.
     */
    expect(heroImageWarning(1400, 'mobile')).toBeNull();
    expect(heroImageWarning(1400, 'desktop')).not.toBeNull();
    expect(heroImageWarning(800, 'mobile')?.needed).toBe(HERO_MOBILE_MIN_WIDTH);
  });

  describe('an unknown width is not a warning', () => {
    /*
     * `gallery_items.width` is nullable and is null for everything uploaded
     * before the column existed. Treating that as "too small" would flag a
     * library of possibly-fine images and teach everyone to ignore the badge —
     * which would cost more than the warning is worth.
     */
    it('says nothing for null', () => {
      expect(heroImageWarning(null, 'desktop')).toBeNull();
    });

    it('says nothing for undefined', () => {
      // The lookup misses while the item is still being fetched.
      expect(heroImageWarning(undefined, 'desktop')).toBeNull();
    });

    it('says nothing for a nonsense width', () => {
      // A zero or negative would produce a divide-by-zero upscale and a
      // message claiming "about Infinityx".
      expect(heroImageWarning(0, 'desktop')).toBeNull();
      expect(heroImageWarning(-100, 'desktop')).toBeNull();
    });
  });

  it('matches the widths the storefront actually asks for', () => {
    /*
     * These are the RENDERED sizes, not an ideal. 2560 is the largest srcset
     * rung the backend emits; asking for 5120 (2560 at dpr:2) would be more
     * correct in theory and would flag almost every real photograph.
     *
     * Pinned so a later "round these up" does not quietly turn a useful warning
     * into noise.
     */
    expect(HERO_DESKTOP_MIN_WIDTH).toBe(2560);
    expect(HERO_MOBILE_MIN_WIDTH).toBe(1280);
  });
});

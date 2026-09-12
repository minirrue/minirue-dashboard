/**
 * Per-slide hero colour overrides — the pure half.
 *
 * ## Why this exists
 *
 * The hero's text colours are baked into the storefront theme
 * (minirue-frontend `components/storefront/SlideContent.tsx` and
 * `.mr-hero-cta` in `app/styles/mr-tokens.css`). That is fine while every hero
 * photograph is dark, and wrong the moment one is not: the owner reported the
 * tagline rendering gold over a pale product shot and being unreadable, and
 * there was nothing in the dashboard that could fix it.
 *
 * So each slide may now override six colours. Every one of them is optional
 * and nullable, and `null` means "use the theme default" — NOT "black".
 *
 * ## The contract, pinned across three repos
 *
 * The backend validates each field with exactly:
 *
 *     /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
 *
 * …or null. Anything else — `rgb()`, a named colour, an empty string, a
 * half-typed `#ab` — is rejected by zod, and zod rejects the WHOLE layout
 * save, not just the offending field. An admin editing a tagline would lose
 * their navbar edits with it. That is why `parseHexInput` below is the only
 * way a non-null value is ever produced from typed text, and why the native
 * `<input type="color">` (which can only emit `#rrggbb`) is the other.
 *
 * ## Why this file is not in lib/storefront/
 *
 * `lib/storefront/hero-image-guidance.ts` is the natural neighbour and the
 * precedent this module follows. That directory is owned by another in-flight
 * workstream for the duration of this change, so the module sits at the lib
 * root alongside the other flat pure modules (`capacity-model.ts`,
 * `changelog.ts`). Move it next to its neighbour once that settles.
 *
 * It lives in lib/ rather than beside the editor because
 * `lib/api/storefront.ts` depends on it: the save normaliser is the last gate
 * before the wire, and lib must not import from app.
 */

/** Byte-for-byte the backend's regex. Do not "improve" it — it is a contract. */
export const HERO_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** The six overridable slots, in the order they are painted on the slide. */
export const HERO_COLOR_FIELDS = [
  'eyebrowColor',
  'headlineColor',
  'subColor',
  'taglineColor',
  'ctaBgColor',
  'ctaTextColor',
] as const;

export type HeroColorField = (typeof HERO_COLOR_FIELDS)[number];

/**
 * What the storefront paints when the field is null.
 *
 * Read off the live components rather than invented, so the preview is the
 * actual current look and so "use a custom colour" starts from where the slide
 * already is instead of from #000000:
 *
 *   eyebrow   rgba(238,230,209,0.6)  SlideContent.tsx  -> #EEE6D1 opaque
 *   headline  var(--mr-cream-100)                      -> #FDFBF5
 *   sub       var(--mr-gold-300)                       -> #C9B483
 *   tagline   rgba(246,242,233,0.6)                    -> #F6F2E9 opaque
 *   cta fill  var(--mr-cream-100)    .mr-hero-cta      -> #FDFBF5
 *   cta text  var(--mr-ink-900)                        -> #0B0B0B
 *
 * The two translucent ones are stored here at full opacity. They are a
 * starting point for a picker and a preview, not a pixel-exact reproduction —
 * the opacity is part of the theme's treatment, and an admin who opens the
 * picker is about to change the colour anyway.
 *
 * These are DEFAULTS FOR DISPLAY ONLY. Seeding one into a slide happens only
 * when the admin explicitly asks to override; nothing here is ever written to
 * a slide merely because the editor was opened.
 */
export const HERO_COLOR_THEME_DEFAULTS: Record<HeroColorField, string> = {
  eyebrowColor: '#eee6d1',
  headlineColor: '#fdfbf5',
  subColor: '#c9b483',
  taglineColor: '#f6f2e9',
  ctaBgColor: '#fdfbf5',
  ctaTextColor: '#0b0b0b',
};

export const HERO_COLOR_LABELS: Record<HeroColorField, string> = {
  eyebrowColor: 'Eyebrow',
  headlineColor: 'Headline',
  subColor: 'Sub line',
  taglineColor: 'Tagline',
  ctaBgColor: 'Button fill',
  ctaTextColor: 'Button text',
};

/**
 * Turn whatever the admin typed into a contract-valid hex, or null if it is
 * not one yet.
 *
 * Deliberately forgiving about the two things people actually do — pasting a
 * brand hex without the `#`, and typing in capitals — and deliberately
 * unforgiving about everything else.
 *
 * `null` here does not mean "clear the field"; it means "this draft is not
 * committable", and the caller leaves the stored value alone. Clearing is a
 * separate, explicit action, because an admin who selects-all-and-deletes on
 * their way to typing a new hex has not asked to go back to the theme.
 */
export function parseHexInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return HERO_COLOR_PATTERN.test(withHash) ? withHash.toLowerCase() : null;
}

/**
 * The last gate before the wire: a contract-valid hex, or null.
 *
 * The UI is built so it cannot produce anything else, and this exists anyway.
 * A single malformed colour makes zod reject the WHOLE layout — the navbar,
 * the pages, every other slide — so the cost of a stray value is losing an
 * admin's entire editing session, and the cost of this function is one regex
 * per field per save. The ribbon's blank-item cleaning in
 * `normalizeStorefrontLayoutForSave` is here for exactly the same reason.
 *
 * Falling back to `null` rather than dropping the save is the right failure:
 * null is "theme default", which is a correct, visible hero.
 */
export function sanitizeHeroColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return HERO_COLOR_PATTERN.test(value) ? value : null;
}

/** `#abc` -> `#aabbcc`. Input must already have passed HERO_COLOR_PATTERN. */
export function expandHex(hex: string): string {
  const body = hex.slice(1);
  if (body.length !== 3) return hex.toLowerCase();
  return `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`.toLowerCase();
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(hex: string): number {
  const full = expandHex(hex);
  const channel = (offset: number) => {
    const v = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG 2.1 contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA for normal-size text. The hero's eyebrow and tagline are small. */
export const CONTRAST_AA_NORMAL = 4.5;
/** WCAG AA for large text (>=24px, or >=18.66px bold). The headline and sub. */
export const CONTRAST_AA_LARGE = 3;

/** Which AA threshold each slot is judged against, by its rendered size. */
export const HERO_COLOR_THRESHOLDS: Record<HeroColorField, number> = {
  eyebrowColor: CONTRAST_AA_NORMAL, // 11px, uppercase, wide tracking
  headlineColor: CONTRAST_AA_LARGE, // clamp(56px,7vw,96px)
  subColor: CONTRAST_AA_LARGE, // clamp(36px,4.5vw,60px)
  taglineColor: CONTRAST_AA_NORMAL, // 15-18px italic — the one the owner flagged
  ctaBgColor: CONTRAST_AA_NORMAL, // judged as the button pair, see below
  ctaTextColor: CONTRAST_AA_NORMAL,
};

export interface ContrastWarning {
  ratio: number;
  needed: number;
  message: string;
}

/**
 * A warning, never a block — the same trade `lib/storefront/hero-image-guidance.ts`
 * makes, for the same reason. A shop owner mid-campaign who wants a
 * low-contrast house style on a dark photograph should be able to ship it;
 * refusing the save would mean no hero at all, which is worse. `role="status"`
 * at the call site rather than `alert`, because it is advice and should not
 * interrupt them mid-task.
 *
 * Returns null when either side is unknown rather than guessing. An unknowable
 * ratio presented as a number is worse than no number: it teaches everyone to
 * ignore the badge.
 */
export function contrastWarning(
  foreground: string | null | undefined,
  background: string | null | undefined,
  needed: number,
  what: string,
): ContrastWarning | null {
  if (!foreground || !background) return null;
  if (!HERO_COLOR_PATTERN.test(foreground) || !HERO_COLOR_PATTERN.test(background)) {
    return null;
  }

  const ratio = Math.round(contrastRatio(foreground, background) * 10) / 10;
  if (ratio >= needed) return null;

  return {
    ratio,
    needed,
    message:
      `${what} contrast is ${ratio}:1, below the ${needed}:1 minimum for readable ` +
      `text. Try a lighter or darker shade.`,
  };
}

/**
 * The flat colour a slide's text sits on, when there is one we can measure.
 *
 * In `editorial` mode the slide renders on `slide.background`, which is a CSS
 * colour OR a gradient string. When it is a plain hex we can give a real,
 * computed contrast number for the four text colours. When it is a gradient,
 * or when the slide is a photograph, we cannot — the answer varies pixel to
 * pixel — so the live preview over the actual image is the guidance instead of
 * a number that would be a guess.
 */
export function measurableSlideBackground(
  mode: 'image' | 'editorial',
  background: string,
  hasImage: boolean,
): string | null {
  if (mode === 'image' && hasImage) return null;
  return parseHexInput(background);
}

/** How many of the six a slide overrides — the count on the collapsed summary. */
export function countSetColors(slide: Partial<Record<HeroColorField, string | null>>): number {
  return HERO_COLOR_FIELDS.filter((f) => slide[f] != null).length;
}

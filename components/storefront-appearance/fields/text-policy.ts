/**
 * The one place the tab decides what an admin's typing turns into.
 *
 * ## Why this is a module and not a convention
 *
 * Right now each call site decides for itself. `e.target.value || null` is
 * written out by hand at eleven of them (HeroEditor 420/558/568, JournalEditor
 * 193/214/332/337, CollabShowcaseEditor 158, ProductGridEditor 89, TrustEditor
 * 70/83, FooterEditor 87, StorefrontAppearanceClient 521) and plain
 * `e.target.value` at most of the rest, and trim-on-blur is attached to five
 * fields in the whole tab. So `"  "` typed into a hero headline is saved as
 * two spaces, the same two spaces typed into the favicon URL become null, and
 * which one you get depends on which editor you are in rather than on anything
 * about the field.
 *
 * Neither default is wrong — a nullable column wants null, a non-nullable one
 * wants `''` — but choosing per call site means nobody chooses, and the
 * whitespace only shows up later as a storefront rendering an empty gold bar
 * where a tagline used to be. Making it a prop with a default turns it into a
 * decision the field's author makes once.
 */

/** What an emptied-out field is stored as. */
export type EmptyPolicy = 'null' | 'empty';

/**
 * The value a field with policy `E` hands to its `onChange`.
 *
 * The conditional type is what makes this worth doing: a field left on the
 * default emits `string` and its call site needs no null handling, while a
 * field declared `emptyAs="null"` emits `string | null` and TypeScript makes
 * the call site acknowledge it. The eleven `|| null` sites become one prop.
 */
export type EmptyValue<E extends EmptyPolicy> = E extends 'null' ? string | null : string;

/**
 * Apply a field's policy to raw text.
 *
 * `trim` is deliberately separate from the empty policy. A field can want
 * trimming without being nullable (a hero headline: `''` is a legitimate
 * "no headline", `'  '` never is) and, in principle, the reverse.
 */
export function applyTextPolicy<E extends EmptyPolicy>(
  raw: string,
  opts: { trim: boolean; emptyAs: E },
): EmptyValue<E> {
  const text = opts.trim ? raw.trim() : raw;
  if (text === '' && opts.emptyAs === 'null') {
    return null as EmptyValue<E>;
  }
  return text as EmptyValue<E>;
}

/**
 * How close to `maxLength` the counter starts showing.
 *
 * A counter that is always on is noise — the hero headline's limit is 200 and
 * nobody writes a 200-character headline, so a permanent "13 / 200" on every
 * field teaches admins to ignore the number. One that appears as the limit
 * approaches is a warning. The threshold scales with the limit (10% of it) but
 * never drops below 10 characters, so a 40-character `bottle` field still
 * gives real notice rather than flashing up with four characters to go.
 */
export function counterThresholdFor(maxLength: number): number {
  return Math.max(10, Math.ceil(maxLength * 0.1));
}

export interface LengthState {
  /** Characters remaining before the limit. Negative when already over. */
  remaining: number;
  /** Whether the counter should be on screen at all. */
  show: boolean;
  /** Over the backend's maximum — this save would 400. */
  over: boolean;
  /** What the counter beside the label reads. Terse: it updates per keystroke. */
  message: string;
  /**
   * What the error line reads, when over. Deliberately not the same sentence
   * as the counter — two copies of one string in two places reads as a bug,
   * and the error has room to say what to do about it.
   */
  errorMessage: string | null;
}

/**
 * Work out what to tell the admin about a length-limited field.
 *
 * The `over` case is reachable even though the `<input maxLength>` attribute
 * stops typing past the limit: a value longer than the limit can already be
 * stored (these limits are not enforced client-side today, which is the whole
 * defect), and the browser will happily render it. Truncating it on sight
 * would silently destroy the admin's copy, so the field shows it, says how
 * far over it is, and leaves the cut to them.
 */
export function lengthState(length: number, maxLength: number, threshold: number): LengthState {
  const remaining = maxLength - length;
  if (remaining < 0) {
    const over = -remaining;
    const chars = `${over} character${over === 1 ? '' : 's'}`;
    return {
      remaining,
      show: true,
      over: true,
      message: `${over} over`,
      errorMessage: `Too long to save — remove ${chars}. The limit is ${maxLength}.`,
    };
  }
  return {
    remaining,
    show: remaining <= threshold,
    over: false,
    message: remaining === 0 ? 'No characters left' : `${remaining} characters left`,
    errorMessage: null,
  };
}

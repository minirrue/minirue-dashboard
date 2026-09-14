/**
 * The arithmetic a bundle screen argues with, with no React attached.
 *
 * A set exists to cost less than its parts. The form used to ask for "price for
 * the whole set" with nothing on screen saying what the parts cost, so the one
 * number that decides whether the set is worth selling was computed in the
 * admin's head — while the storefront was already showing the shopper
 * *"Instead of 1,700.00 EGP bought separately — you save 100.00 EGP"*. Same
 * sum, one side of the shop only. It lives here, pure, so it can be tested
 * against the backend's own rules rather than asserted through a rendered form.
 *
 * The limits below are not this file's opinion. They are transcribed from
 * `MemberSchema` / `CreateBundleSchema` in the backend's
 * `src/discounts/bundles.controller.ts`, which is what actually rejects a save:
 *
 *   members:  z.array(MemberSchema).min(1).max(6)
 *   quantity: z.number().int().min(1).max(99).default(1)
 *
 * Six is a product ceiling, not a technical one — the backend comment reads
 * "One member is allowed on purpose: a one-product set is a single item at a
 * special price, which the owner asked for. Six is the ceiling." Either way the
 * admin should read the limit up front instead of discovering it on the
 * seventh attempt, which is why it is exported and rendered rather than only
 * enforced.
 */

/** A set may be a single product at a special price. The backend allows it. */
export const MIN_MEMBERS = 1;
/** `z.array(MemberSchema).max(6)` — server-enforced on create AND on update. */
export const MAX_MEMBERS = 6;
/** `quantity: z.number().int().min(1).max(99)`. */
export const MAX_UNITS_PER_LINE = 99;

/**
 * One line of a set as the form holds it.
 *
 * `variantId: null` is a real, supported choice and not an omission — the
 * backend resolves a member with no variant to that product's cheapest variant
 * (`Math.min(...)` over its variant rows in `BundlesService.detail`). So "any
 * variant, cheapest" is a meaning, and the UI has to say which one is in play
 * rather than leaving the field absent.
 */
export interface DraftMember {
  productId: string;
  variantId: string | null;
  /** Units of this line in ONE set — the storefront's `unitsPerSet`. */
  quantity: number;
}

/** A line priced: what one unit costs, and what the line contributes. */
export interface PricedLine {
  unitMinor: number;
  quantity: number;
  lineMinor: number;
}

export interface BundleEconomics {
  /** What the members cost bought separately. The storefront's "Instead of". */
  componentTotalMinor: number;
  /** What the shopper keeps. Zero when the set is not cheaper. */
  savingMinor: number;
  /**
   * How much the set costs ABOVE its parts. Zero unless it does.
   *
   * Not an error: a gift box can legitimately cost more than its contents. It
   * must never happen by accident, though, so it is a distinct number rather
   * than a negative saving that reads as a saving at a glance.
   */
  overchargeMinor: number;
  /** 0–100, one decimal place. Null when there is nothing to divide by. */
  discountPercent: number | null;
  lines: PricedLine[];
  /** Every unit in the set — 2× shampoo + 1× conditioner is three things. */
  unitCount: number;
}

/** Minor units of one line, given the unit price and how many are in the set. */
export function lineTotalMinor(unitMinor: number, quantity: number): number {
  return Math.max(0, Math.round(unitMinor)) * Math.max(0, Math.round(quantity));
}

/**
 * The whole set's economics.
 *
 * `priceMinor` may be 0 while the admin has not typed a price yet; the
 * component sum still has to be visible then, because the sum is what tells
 * them what to type. Only the derived comparisons go quiet.
 */
export function computeEconomics(
  members: readonly { unitMinor: number; quantity: number }[],
  priceMinor: number,
): BundleEconomics {
  const lines: PricedLine[] = members.map((m) => ({
    unitMinor: Math.max(0, Math.round(m.unitMinor)),
    quantity: Math.max(0, Math.round(m.quantity)),
    lineMinor: lineTotalMinor(m.unitMinor, m.quantity),
  }));

  const componentTotalMinor = lines.reduce((sum, l) => sum + l.lineMinor, 0);
  const unitCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const price = Math.max(0, Math.round(priceMinor));

  const diff = componentTotalMinor - price;
  const priced = price > 0 && componentTotalMinor > 0;

  return {
    componentTotalMinor,
    savingMinor: priced && diff > 0 ? diff : 0,
    overchargeMinor: priced && diff < 0 ? -diff : 0,
    // One decimal, because a set at 1,699 off 1,700 is 0.1% off and rounding
    // that to "0%" tells the admin their price is free of any discount.
    discountPercent: priced
      ? Math.round((diff / componentTotalMinor) * 1000) / 10
      : null,
    lines,
    unitCount,
  };
}

/** `1234` → `12.34`. Grouped, so six figures are readable at a glance. */
export function formatMinor(minor: number): string {
  return (Math.round(minor) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** `12.5` → `12.5%`, `12` → `12%`. Never `12.0%`. */
export function formatPercent(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

/**
 * Move a line by `delta` places, clamped.
 *
 * Order is not decoration: `bundleItems.position` is what the backend writes
 * and what it reads back `orderBy`, so the order chosen here is the order the
 * set's contents are listed in everywhere else.
 */
export function moveMember<T>(list: readonly T[], index: number, delta: number): T[] {
  const next = [...list];
  const target = index + delta;
  if (index < 0 || index >= next.length || target < 0 || target >= next.length) {
    return next;
  }
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

export interface BundleDraft {
  name: string;
  priceMinor: number;
  members: readonly DraftMember[];
}

export type BundleFieldError = 'name' | 'price' | 'members';

/**
 * Everything the backend would reject, decided before the request.
 *
 * Deliberately the same four rules and no more — a client that invents extra
 * ones blocks saves the server would have accepted, which is the harder bug to
 * explain.
 */
export function validateDraft(draft: BundleDraft): Record<BundleFieldError, string | null> {
  const dup = duplicateLineIndex(draft.members);
  return {
    name: draft.name.trim() ? null : 'A set needs a name.',
    price:
      draft.priceMinor > 0
        ? null
        : 'A set needs a price above zero — the shop charges this, not the parts.',
    members:
      draft.members.length < MIN_MEMBERS
        ? 'A set needs at least one product in it.'
        : draft.members.length > MAX_MEMBERS
          ? `A set holds at most ${MAX_MEMBERS} lines.`
          : draft.members.some(
                (m) => m.quantity < 1 || m.quantity > MAX_UNITS_PER_LINE,
              )
            ? `Each line holds 1 to ${MAX_UNITS_PER_LINE} units.`
            : dup !== -1
              ? 'The same product and variant is in the set twice — raise its units instead.'
              : null,
  };
}

/**
 * Index of the first line that repeats an earlier one, or -1.
 *
 * Two lines naming the same product AND the same variant are one line at
 * quantity 2 as far as the cart is concerned: `planSetQty` on the storefront
 * writes `qty × unitsPerSet` per variant row, so a duplicate would be written
 * twice to the same row and one of the two writes would simply be lost.
 * Different variants of one product are NOT a duplicate — that is the whole
 * point of a "100 ML + 50 ML" set.
 */
export function duplicateLineIndex(members: readonly DraftMember[]): number {
  const seen = new Set<string>();
  for (let i = 0; i < members.length; i += 1) {
    const key = `${members[i].productId}::${members[i].variantId ?? '*'}`;
    if (seen.has(key)) return i;
    seen.add(key);
  }
  return -1;
}

export function isDraftValid(draft: BundleDraft): boolean {
  return Object.values(validateDraft(draft)).every((v) => v === null);
}

/**
 * `"17.00"` → `1700`. Anything that is not a positive number is 0.
 *
 * A price field is a text input whatever `type` it carries — a partially typed
 * "1." or a pasted "EGP 17" both reach this — and `Number('') === 0` would have
 * read an empty box as a free set rather than an unanswered question.
 */
export function parsePriceToMinor(input: string): number {
  const n = Number(String(input).trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

// ── Set pricing (minirue-dashboard#65, backend#166) ──────────────────────────

/** The engine's default saving when a set stores none (backend `DEFAULT_SET_SAVING_BP`). */
export const DEFAULT_SET_SAVING_BP = 1000;
/** `savingBp: 0..9000` in the `PUT sets/:id` schema. */
export const MAX_SET_SAVING_BP = 9000;

/** `"15"` → `1500`. Null for anything the backend would reject. */
export function parseSavingToBp(input: string): number | null {
  const text = String(input).trim();
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  const bp = Math.round(n * 100);
  return bp >= 0 && bp <= MAX_SET_SAVING_BP ? bp : null;
}

/** `1250` → `"12.5"`, for the saving input. */
export function savingBpToText(bp: number): string {
  return String(Math.round(bp) / 100);
}

/**
 * The parts less the saving, before the engine's floor and …9 rounding. Only
 * an estimate: the saved System price can come out higher.
 */
export function estimateSetPriceMinor(listTotalMinor: number, savingBp: number): number {
  return Math.round((listTotalMinor * (10000 - savingBp)) / 10000);
}

/** The exact `PUT sets/:id` body for the chosen mode. */
export function setPricingBody(
  mode: 'SYSTEM' | 'MANUAL',
  values: { savingBp: number; manualPriceMinor: number },
): { mode: 'SYSTEM'; savingBp: number } | { mode: 'MANUAL'; manualPriceMinor: number } {
  return mode === 'SYSTEM'
    ? { mode, savingBp: values.savingBp }
    : { mode, manualPriceMinor: values.manualPriceMinor };
}

/**
 * Which floor a typed price sits under. The no-loss floor is the lower one, so
 * a price under it is the worse news and is named first.
 */
export function floorBreach(
  priceMinor: number,
  floors: { law1ShownMinor: number; noLossShownMinor: number } | null,
): 'NO_LOSS' | 'LAW1' | null {
  if (!floors || priceMinor <= 0) return null;
  if (priceMinor < floors.noLossShownMinor) return 'NO_LOSS';
  if (priceMinor < floors.law1ShownMinor) return 'LAW1';
  return null;
}

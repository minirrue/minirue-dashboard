import type {
  FulfillmentItem,
  PriceKnowledge,
  PriceRounding,
  PricingSettings,
} from '@/lib/api/accounting';
import type { StoreSettings } from '@/lib/api/settings';

/**
 * Pure rules for the Costs & rules tab (minirue-dashboard#59).
 *
 * They mirror the backend `PricingSettingsSchema` (minirue-backend#158), so an
 * invalid draft is caught here, in words, before the PATCH is sent. The server
 * replaces the whole `pricing` block, so the output is always the whole block.
 *
 * Every number is typed as text. A blank field stays blank and is an error; it
 * is never read as 0, because a 0 box cost is a real figure that reprices the
 * shop.
 */

export const KNOWLEDGE_CLASSES: readonly PriceKnowledge[] = ['KNOWN_PRICE', 'KNOWN_BRAND', 'UNCOMPARABLE'];

export const LABEL_MAX = 40;
const AMOUNT_MAX_MINOR = 100_000_000_00;
const GUARDRAIL_MAX_BP = 9500;
const RULE_MAX_BP = 10_000;

export interface FulfillmentDraft {
  id: string;
  label: string;
  amountInput: string;
}

export interface ClassRuleDraft {
  undercut: string;
  premium: string;
  noMarketMin: string;
  noMarketMax: string;
}

export interface PricingDraft {
  items: FulfillmentDraft[];
  minMargin: string;
  maxMargin: string;
  classes: Record<PriceKnowledge, ClassRuleDraft>;
  rounding: PriceRounding;
}

/** `field` is a path such as `items.sticker.amount` or `classes.KNOWN_BRAND.undercut`. */
export interface DraftIssue {
  field: string;
  message: string;
}

const DECIMAL_2DP = /^\d+(\.\d{1,2})?$/;

/** "2.5" EGP → 250 piastres. Null for blank, junk, negatives or sub-piastre input. */
export function parseAmountInput(raw: string): number | null {
  const s = raw.trim();
  if (!DECIMAL_2DP.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** "8.5" percent → 850 basis points. Null for blank or junk. */
export function parsePercentInput(raw: string): number | null {
  const s = raw.trim();
  if (!DECIMAL_2DP.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** 4750 → "47.5", 10000 → "100", −250 → "−2.5". Whole numbers drop their decimals. */
export function formatAmount(minor: number): string {
  const abs = Math.abs(minor) / 100;
  const text = abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return minor < 0 ? `−${text}` : text;
}

function bpToInput(bp: number): string {
  return formatAmount(bp).replace(/,/g, '');
}

export function toDraft(settings: PricingSettings): PricingDraft {
  const classes = {} as Record<PriceKnowledge, ClassRuleDraft>;
  for (const k of KNOWLEDGE_CLASSES) {
    const c = settings.classes[k];
    classes[k] = {
      undercut: bpToInput(c.undercutBp),
      premium: bpToInput(c.premiumBp),
      noMarketMin: bpToInput(c.noMarketMinBp),
      noMarketMax: bpToInput(c.noMarketMaxBp),
    };
  }
  return {
    items: settings.fulfillmentItems.map((i) => ({
      id: i.id,
      label: i.label,
      amountInput: bpToInput(i.amountMinor),
    })),
    minMargin: bpToInput(settings.guardrails.minMarginBp),
    maxMargin: bpToInput(settings.guardrails.maxMarginBp),
    classes,
    rounding: settings.rounding,
  };
}

/** The live box & trip total. `complete` is false while any amount is unreadable. */
export function boxAndTripMinor(items: FulfillmentDraft[]): { totalMinor: number; complete: boolean } {
  let totalMinor = 0;
  let complete = true;
  for (const item of items) {
    const minor = parseAmountInput(item.amountInput);
    if (minor === null) complete = false;
    else totalMinor += minor;
  }
  return { totalMinor, complete };
}

/** First `item-N` id not already taken. Ids are never shown and never change once saved. */
export function newItemId(taken: Iterable<string>): string {
  const used = new Set(taken);
  let n = 1;
  while (used.has(`item-${n}`)) n += 1;
  return `item-${n}`;
}

/**
 * The delivery fee the pricing engine counts (F): 0 while a free-delivery
 * threshold is on, else the lowest fee an order can pay (the flat rate, or a
 * cheaper governorate offered at checkout). Mirrors the backend's
 * `resolveEffectiveShipping(...).minFeeCents`. Null when shipping is unknown.
 */
export function deliveryFeeMinor(shipping: StoreSettings['shipping'] | null | undefined): number | null {
  if (!shipping || typeof shipping.flatRateCents !== 'number') return null;
  if (shipping.freeOverCents > 0) return 0;
  return (shipping.rates ?? [])
    .filter((r) => r.enabled !== false && typeof r.feeCents === 'number')
    .reduce((min, r) => Math.min(min, r.feeCents), shipping.flatRateCents);
}

function readPercent(
  raw: string,
  field: string,
  maxBp: number,
  issues: DraftIssue[],
): number | null {
  if (raw.trim() === '') {
    issues.push({ field, message: 'Enter a percentage.' });
    return null;
  }
  const bp = parsePercentInput(raw);
  if (bp === null || bp > maxBp) {
    issues.push({ field, message: `Use a percentage from 0 to ${maxBp / 100}.` });
    return null;
  }
  return bp;
}

/**
 * Validates the draft. Returns the whole pricing block ready to PATCH, or
 * `settings: null` when any issue exists. Fields this tab does not edit
 * (strategy, USD rate, stale days, payback) are carried over from `base`.
 */
export function validatePricingDraft(
  draft: PricingDraft,
  base: PricingSettings,
): { issues: DraftIssue[]; settings: PricingSettings | null } {
  const issues: DraftIssue[] = [];

  const items: FulfillmentItem[] = [];
  for (const item of draft.items) {
    const label = item.label.trim();
    if (label === '') {
      issues.push({ field: `items.${item.id}.label`, message: 'Name this cost.' });
    } else if (label.length > LABEL_MAX) {
      issues.push({ field: `items.${item.id}.label`, message: `Keep the name to ${LABEL_MAX} characters.` });
    }
    let amountMinor: number | null = null;
    if (item.amountInput.trim() === '') {
      issues.push({ field: `items.${item.id}.amount`, message: 'Enter an amount. Type 0 if it costs nothing.' });
    } else {
      amountMinor = parseAmountInput(item.amountInput);
      if (amountMinor === null || amountMinor > AMOUNT_MAX_MINOR) {
        issues.push({ field: `items.${item.id}.amount`, message: 'Use an amount like 2.5, with up to 2 decimals.' });
        amountMinor = null;
      }
    }
    if (amountMinor !== null) items.push({ id: item.id, label, amountMinor });
  }

  const minMarginBp = readPercent(draft.minMargin, 'guardrails.min', GUARDRAIL_MAX_BP, issues);
  const maxMarginBp = readPercent(draft.maxMargin, 'guardrails.max', GUARDRAIL_MAX_BP, issues);
  if (minMarginBp !== null && maxMarginBp !== null && minMarginBp >= maxMarginBp) {
    issues.push({ field: 'guardrails.min', message: 'The lowest margin must be below the highest.' });
  }

  const classes = {} as PricingSettings['classes'];
  for (const k of KNOWLEDGE_CLASSES) {
    const c = draft.classes[k];
    const undercutBp = readPercent(c.undercut, `classes.${k}.undercut`, RULE_MAX_BP, issues);
    const premiumBp = readPercent(c.premium, `classes.${k}.premium`, RULE_MAX_BP, issues);
    const noMarketMinBp = readPercent(c.noMarketMin, `classes.${k}.noMarketMin`, RULE_MAX_BP, issues);
    const noMarketMaxBp = readPercent(c.noMarketMax, `classes.${k}.noMarketMax`, RULE_MAX_BP, issues);
    if (noMarketMinBp !== null && noMarketMaxBp !== null && noMarketMinBp > noMarketMaxBp) {
      issues.push({
        field: `classes.${k}.noMarketMin`,
        message: 'The lowest margin cannot be above the highest.',
      });
    }
    if (undercutBp !== null && premiumBp !== null && noMarketMinBp !== null && noMarketMaxBp !== null) {
      classes[k] = { undercutBp, premiumBp, noMarketMinBp, noMarketMaxBp };
    }
  }

  if (issues.length > 0 || minMarginBp === null || maxMarginBp === null) {
    return { issues, settings: null };
  }

  return {
    issues,
    settings: {
      ...base,
      fulfillmentItems: items,
      guardrails: { minMarginBp, maxMarginBp },
      classes,
      rounding: draft.rounding,
    },
  };
}

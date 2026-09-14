import type { PricingSettings } from '@/lib/api/accounting';
import {
  boxAndTripMinor,
  deliveryFeeMinor,
  formatAmount,
  newItemId,
  parseAmountInput,
  parsePercentInput,
  toDraft,
  validatePricingDraft,
} from '@/lib/accounting/validate';

/**
 * PG-DASHBOARD-ACCTG-006 (minirue-dashboard#59). The Costs & rules editor's
 * pure rules: they mirror the backend `PricingSettingsSchema` (backend#158),
 * and a blank amount is an error, never a zero.
 */

/** Backend `DEFAULT_PRICING_SETTINGS`, plus a set USD rate to prove pass-through. */
const base: PricingSettings = {
  fulfillmentItems: [
    { id: 'box', label: 'Box', amountMinor: 1500 },
    { id: 'sticker', label: 'Sticker', amountMinor: 250 },
    { id: 'fuel', label: 'Fuel', amountMinor: 3000 },
  ],
  strategyBp: 2500,
  usdRate: { egpPerUsd: '50.85', setAt: '2026-09-01T00:00:00.000Z' },
  guardrails: { minMarginBp: 1000, maxMarginBp: 8000 },
  classes: {
    KNOWN_PRICE: { undercutBp: 800, premiumBp: 0, noMarketMinBp: 1500, noMarketMaxBp: 2500 },
    KNOWN_BRAND: { undercutBp: 500, premiumBp: 500, noMarketMinBp: 2500, noMarketMaxBp: 4000 },
    UNCOMPARABLE: { undercutBp: 0, premiumBp: 1500, noMarketMinBp: 4000, noMarketMaxBp: 6500 },
  },
  rounding: 'END_9',
  staleDays: 30,
  paybackOrders: 1,
};

describe('parseAmountInput', () => {
  it('reads EGP as piastres', () => {
    expect(parseAmountInput('2.5')).toBe(250);
    expect(parseAmountInput(' 30 ')).toBe(3000);
    expect(parseAmountInput('0')).toBe(0);
    expect(parseAmountInput('48.25')).toBe(4825);
  });
  it('never turns blank or junk into 0', () => {
    expect(parseAmountInput('')).toBeNull();
    expect(parseAmountInput('   ')).toBeNull();
    expect(parseAmountInput('2.5abc')).toBeNull();
    expect(parseAmountInput('-3')).toBeNull();
    expect(parseAmountInput('1.234')).toBeNull();
  });
});

describe('parsePercentInput', () => {
  it('reads percent as basis points', () => {
    expect(parsePercentInput('10')).toBe(1000);
    expect(parsePercentInput('8.5')).toBe(850);
    expect(parsePercentInput('0')).toBe(0);
  });
  it('rejects blank and junk', () => {
    expect(parsePercentInput('')).toBeNull();
    expect(parsePercentInput('ten')).toBeNull();
  });
});

describe('boxAndTripMinor and formatAmount', () => {
  it('totals 47.5 per order for the defaults, and 48 after sticker 2.5 → 3', () => {
    const draft = toDraft(base);
    expect(formatAmount(boxAndTripMinor(draft.items).totalMinor)).toBe('47.5');
    draft.items[1] = { ...draft.items[1], amountInput: '3' };
    expect(formatAmount(boxAndTripMinor(draft.items).totalMinor)).toBe('48');
  });
  it('marks the total incomplete while an amount is blank', () => {
    const draft = toDraft(base);
    draft.items[1] = { ...draft.items[1], amountInput: '' };
    expect(boxAndTripMinor(draft.items)).toEqual({ totalMinor: 4500, complete: false });
  });
  it('formats fractional piastres and negatives', () => {
    expect(formatAmount(5250)).toBe('52.5');
    expect(formatAmount(4825)).toBe('48.25');
    expect(formatAmount(-250)).toBe('−2.5');
  });
});

describe('validatePricingDraft', () => {
  it('round-trips the settings unchanged, carrying the fields this tab does not edit', () => {
    const result = validatePricingDraft(toDraft(base), base);
    expect(result.issues).toEqual([]);
    expect(result.settings).toEqual(base);
  });

  it('builds the whole block with sticker at 3', () => {
    const draft = toDraft(base);
    draft.items[1] = { ...draft.items[1], amountInput: '3' };
    const { settings } = validatePricingDraft(draft, base);
    expect(settings?.fulfillmentItems[1]).toEqual({ id: 'sticker', label: 'Sticker', amountMinor: 300 });
    expect(settings?.usdRate).toEqual(base.usdRate);
    expect(settings?.classes).toEqual(base.classes);
  });

  it('a blank amount is an error and yields no settings to save', () => {
    const draft = toDraft(base);
    draft.items[1] = { ...draft.items[1], amountInput: '' };
    const { issues, settings } = validatePricingDraft(draft, base);
    expect(settings).toBeNull();
    expect(issues).toEqual([
      { field: 'items.sticker.amount', message: 'Enter an amount. Type 0 if it costs nothing.' },
    ]);
  });

  it('requires a name of 1 to 40 characters', () => {
    const draft = toDraft(base);
    draft.items[0] = { ...draft.items[0], label: '  ' };
    draft.items[2] = { ...draft.items[2], label: 'x'.repeat(41) };
    const fields = validatePricingDraft(draft, base).issues.map((i) => i.field);
    expect(fields).toEqual(['items.box.label', 'items.fuel.label']);
  });

  it('trims names before saving', () => {
    const draft = toDraft(base);
    draft.items[0] = { ...draft.items[0], label: ' Box ' };
    expect(validatePricingDraft(draft, base).settings?.fulfillmentItems[0].label).toBe('Box');
  });

  it('guardrails: 0–95%, and the lowest margin below the highest', () => {
    const draft = toDraft(base);
    draft.minMargin = '80';
    expect(validatePricingDraft(draft, base).issues).toEqual([
      { field: 'guardrails.min', message: 'The lowest margin must be below the highest.' },
    ]);
    draft.minMargin = '10';
    draft.maxMargin = '96';
    expect(validatePricingDraft(draft, base).issues).toEqual([
      { field: 'guardrails.max', message: 'Use a percentage from 0 to 95.' },
    ]);
  });

  it('class rules: blank is an error, over 100% is an error, no-market min above max is an error', () => {
    const draft = toDraft(base);
    draft.classes.KNOWN_BRAND = { ...draft.classes.KNOWN_BRAND, undercut: '' };
    draft.classes.UNCOMPARABLE = { ...draft.classes.UNCOMPARABLE, premium: '101' };
    draft.classes.KNOWN_PRICE = { ...draft.classes.KNOWN_PRICE, noMarketMin: '30' };
    const fields = validatePricingDraft(draft, base).issues.map((i) => i.field);
    expect(fields).toEqual([
      'classes.KNOWN_PRICE.noMarketMin',
      'classes.KNOWN_BRAND.undercut',
      'classes.UNCOMPARABLE.premium',
    ]);
  });

  it('saves the rounding choice', () => {
    const draft = toDraft(base);
    draft.rounding = 'NONE';
    expect(validatePricingDraft(draft, base).settings?.rounding).toBe('NONE');
  });
});

describe('newItemId', () => {
  it('returns the first free item-N id', () => {
    expect(newItemId(['box', 'item-1'])).toBe('item-2');
    expect(newItemId([])).toBe('item-1');
  });
});

describe('deliveryFeeMinor', () => {
  it('is the flat rate when there are no governorate rates', () => {
    expect(deliveryFeeMinor({ flatRateCents: 10000, currency: 'EGP', freeOverCents: 0 })).toBe(10000);
  });
  it('is the lowest fee any order can pay, ignoring rows not offered at checkout', () => {
    expect(
      deliveryFeeMinor({
        flatRateCents: 10000,
        currency: 'EGP',
        freeOverCents: 0,
        rates: [
          { key: 'cairo', label: 'Cairo', feeCents: 7000, enabled: true, aliases: [] },
          { key: 'aswan', label: 'Aswan', feeCents: 5000, enabled: false, aliases: [] },
        ],
      }),
    ).toBe(7000);
  });
  it('is 0 while a free-delivery threshold is on', () => {
    expect(deliveryFeeMinor({ flatRateCents: 10000, currency: 'EGP', freeOverCents: 150000 })).toBe(0);
  });
  it('is unknown without a shipping block', () => {
    expect(deliveryFeeMinor(undefined)).toBeNull();
  });
});

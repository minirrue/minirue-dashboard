import {
  MAX_MEMBERS,
  MAX_UNITS_PER_LINE,
  computeEconomics,
  duplicateLineIndex,
  formatMinor,
  formatPercent,
  isDraftValid,
  moveMember,
  parsePriceToMinor,
  validateDraft,
  type DraftMember,
} from '@/app/dashboard/bundles/bundle-economics';

/**
 * A bundle exists to cost less than its parts, and until now the admin setting
 * the price could not see what the parts cost — while the storefront was
 * already showing the shopper *"Instead of 1,700.00 EGP bought separately —
 * you save 100.00 EGP"*. These are that sum's tests, kept away from React so
 * they assert arithmetic rather than a rendered string.
 *
 * The limits asserted below are transcribed from the backend's own zod schema
 * in `src/discounts/bundles.controller.ts` — `members` min 1 max 6, `quantity`
 * int 1..99. If a test here fails because that schema changed, the UI is
 * telling admins a limit that is no longer true, which is the failure this
 * file is for.
 */
describe('bundle economics', () => {
  const line = (unitMinor: number, quantity = 1) => ({ unitMinor, quantity });

  it('sums what the members cost bought separately', () => {
    const e = computeEconomics([line(90000), line(80000)], 160000);

    expect(e.componentTotalMinor).toBe(170000);
    expect(formatMinor(e.componentTotalMinor)).toBe('1,700.00');
  });

  it('reports the exact saving the storefront shows', () => {
    // The worked example from the issue: 1,700 separately, 1,600 as a set.
    const e = computeEconomics([line(90000), line(80000)], 160000);

    expect(e.savingMinor).toBe(10000);
    expect(formatMinor(e.savingMinor)).toBe('100.00');
    expect(e.overchargeMinor).toBe(0);
  });

  it('gives the discount as a percentage of what the parts cost', () => {
    const e = computeEconomics([line(90000), line(80000)], 160000);

    // 100 off 1,700 is 5.88…% — shown to one decimal, never rounded to "6%"
    // when the difference between 5.9 and 6 is money.
    expect(e.discountPercent).toBeCloseTo(5.9, 1);
    expect(formatPercent(e.discountPercent!)).toBe('5.9%');
  });

  it('counts units per line into both the sum and the unit count', () => {
    // 2 x shampoo at 800 plus 1 x conditioner at 500.
    const e = computeEconomics([line(80000, 2), line(50000)], 180000);

    expect(e.componentTotalMinor).toBe(210000);
    expect(e.unitCount).toBe(3);
    expect(e.lines[0].lineMinor).toBe(160000);
  });

  it('calls a set priced above its parts an overcharge, not a negative saving', () => {
    // A gift box may legitimately cost more than its contents. It must never
    // happen by accident, and "saves -100.00" reads as a saving at a glance.
    const e = computeEconomics([line(90000), line(80000)], 180000);

    expect(e.savingMinor).toBe(0);
    expect(e.overchargeMinor).toBe(10000);
    expect(e.discountPercent).toBeLessThan(0);
  });

  it('shows the component sum before a price has been typed', () => {
    // The sum is what tells the admin what to type, so it cannot wait for the
    // price. Only the comparisons go quiet.
    const e = computeEconomics([line(90000), line(80000)], 0);

    expect(e.componentTotalMinor).toBe(170000);
    expect(e.savingMinor).toBe(0);
    expect(e.discountPercent).toBeNull();
  });

  it('has nothing to divide by when the set is empty', () => {
    const e = computeEconomics([], 160000);

    expect(e.componentTotalMinor).toBe(0);
    expect(e.discountPercent).toBeNull();
  });
});

describe('price parsing', () => {
  it('reads an empty box as unanswered, not as free', () => {
    expect(parsePriceToMinor('')).toBe(0);
    expect(parsePriceToMinor('   ')).toBe(0);
    expect(parsePriceToMinor('abc')).toBe(0);
    expect(parsePriceToMinor('-5')).toBe(0);
  });

  it('converts major units to the minor units the API takes', () => {
    expect(parsePriceToMinor('1600')).toBe(160000);
    expect(parsePriceToMinor('16.05')).toBe(1605);
    // Floating point: 19.99 * 100 is 1998.9999999999998 before rounding.
    expect(parsePriceToMinor('19.99')).toBe(1999);
  });
});

describe('line order', () => {
  const a = { productId: 'a', variantId: null, quantity: 1 };
  const b = { productId: 'b', variantId: null, quantity: 1 };
  const c = { productId: 'c', variantId: null, quantity: 1 };

  it('moves a line and leaves the rest in order', () => {
    expect(moveMember([a, b, c], 2, -1)).toEqual([a, c, b]);
    expect(moveMember([a, b, c], 0, 1)).toEqual([b, a, c]);
  });

  it('does nothing at either end rather than wrapping round', () => {
    expect(moveMember([a, b, c], 0, -1)).toEqual([a, b, c]);
    expect(moveMember([a, b, c], 2, 1)).toEqual([a, b, c]);
  });
});

describe('duplicate lines', () => {
  it('treats the same product AND variant twice as a duplicate', () => {
    // Two lines naming one variant are one cart row written twice; the
    // storefront's planSetQty writes qty x unitsPerSet per variant row, so one
    // of the two writes is simply lost.
    const members: DraftMember[] = [
      { productId: 'p1', variantId: 'v1', quantity: 1 },
      { productId: 'p1', variantId: 'v1', quantity: 1 },
    ];

    expect(duplicateLineIndex(members)).toBe(1);
  });

  it('does NOT treat two variants of one product as a duplicate', () => {
    // "100 ML and 50 ML of the same scent" is the exact set the old picker
    // made inexpressible. It is a legitimate set, not a mistake.
    const members: DraftMember[] = [
      { productId: 'p1', variantId: 'v-100ml', quantity: 1 },
      { productId: 'p1', variantId: 'v-50ml', quantity: 1 },
    ];

    expect(duplicateLineIndex(members)).toBe(-1);
  });

  it('treats two variant-less lines of one product as a duplicate', () => {
    // Both resolve to the same cheapest variant on the server, so they are the
    // same row twice even though neither names it.
    const members: DraftMember[] = [
      { productId: 'p1', variantId: null, quantity: 1 },
      { productId: 'p1', variantId: null, quantity: 1 },
    ];

    expect(duplicateLineIndex(members)).toBe(1);
  });
});

describe('draft validation — the backend schema, client-side', () => {
  const member = (i: number): DraftMember => ({
    productId: `p${i}`,
    variantId: null,
    quantity: 1,
  });
  const ok = {
    name: 'Evening Set',
    priceMinor: 160000,
    members: [member(1), member(2)],
  };

  it('accepts a set that the API would accept', () => {
    expect(isDraftValid(ok)).toBe(true);
  });

  it('accepts a one-product set', () => {
    // Deliberate, per the backend: "a one-product set is a single item at a
    // special price, which the owner asked for."
    expect(isDraftValid({ ...ok, members: [member(1)] })).toBe(true);
  });

  it('refuses an empty set', () => {
    expect(validateDraft({ ...ok, members: [] }).members).toMatch(/at least one/);
  });

  it('refuses a seventh line, and says the limit', () => {
    const seven = Array.from({ length: MAX_MEMBERS + 1 }, (_, i) => member(i));
    const message = validateDraft({ ...ok, members: seven }).members;

    expect(message).toContain(String(MAX_MEMBERS));
  });

  it('refuses units outside 1..99', () => {
    expect(
      validateDraft({
        ...ok,
        members: [{ ...member(1), quantity: MAX_UNITS_PER_LINE + 1 }],
      }).members,
    ).toMatch(/1 to 99/);
    expect(
      validateDraft({ ...ok, members: [{ ...member(1), quantity: 0 }] }).members,
    ).toMatch(/1 to 99/);
  });

  it('refuses a free set — priceMinor must be positive', () => {
    expect(validateDraft({ ...ok, priceMinor: 0 }).price).toBeTruthy();
  });

  it('refuses a nameless set, whitespace included', () => {
    expect(validateDraft({ ...ok, name: '   ' }).name).toBeTruthy();
  });

  it('flags a duplicate line rather than letting the save half-apply', () => {
    const dup = {
      ...ok,
      members: [
        { productId: 'p1', variantId: 'v1', quantity: 1 },
        { productId: 'p1', variantId: 'v1', quantity: 1 },
      ],
    };

    expect(validateDraft(dup).members).toMatch(/twice/);
  });
});

describe('formatting', () => {
  it('groups thousands so six figures are readable', () => {
    expect(formatMinor(170000)).toBe('1,700.00');
    expect(formatMinor(0)).toBe('0.00');
  });

  it('never writes a trailing .0 on a whole percentage', () => {
    expect(formatPercent(12)).toBe('12%');
    expect(formatPercent(12.5)).toBe('12.5%');
    expect(formatPercent(12.04)).toBe('12%');
  });
});

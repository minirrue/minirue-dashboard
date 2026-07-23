import { sumLinesMinor, poundsToMinor } from '@/app/dashboard/orders/ManualOrderModal';

describe('sumLinesMinor', () => {
  it('multiplies unit price by quantity across lines', () => {
    expect(
      sumLinesMinor([
        { unitPriceMinor: 12500, qty: 2 },
        { unitPriceMinor: 4000, qty: 1 },
      ]),
    ).toBe(29000);
  });

  it('is zero for an empty basket', () => {
    expect(sumLinesMinor([])).toBe(0);
  });
});

describe('poundsToMinor', () => {
  it('converts pounds typed by the admin to integer piastres', () => {
    expect(poundsToMinor('125.00')).toBe(12500);
    expect(poundsToMinor('0')).toBe(0);
  });

  it('returns null for input that is not a usable non-negative number', () => {
    expect(poundsToMinor('')).toBeNull();
    expect(poundsToMinor('-')).toBeNull();
    expect(poundsToMinor('abc')).toBeNull();
    expect(poundsToMinor('-5')).toBeNull();
  });
});

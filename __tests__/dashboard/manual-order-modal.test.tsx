import { sumLinesMinor } from '@/app/dashboard/orders/ManualOrderModal';

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

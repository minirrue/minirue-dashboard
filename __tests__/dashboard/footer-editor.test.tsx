import { togglePaymentBadge, blankColumn } from '@/app/dashboard/storefront-appearance/editors/FooterEditor';

describe('togglePaymentBadge', () => {
  it('adds a badge that is off', () => {
    expect(togglePaymentBadge(['visa'], 'instapay')).toEqual(['visa', 'instapay']);
  });

  it('removes a badge that is on', () => {
    expect(togglePaymentBadge(['visa', 'instapay'], 'visa')).toEqual(['instapay']);
  });
});

describe('blankColumn', () => {
  it('starts with an empty title and no links', () => {
    const col = blankColumn();
    expect(col.title).toBe('');
    expect(col.links).toEqual([]);
    expect(col.id).toMatch(/^col-/);
  });
});

import { validateDeliverySettings, validateSameDayDelivery } from '@/lib/settings/delivery-validate';
import type { DeliveryConfig } from '@/lib/api/settings';

function makeDelivery(overrides: Partial<DeliveryConfig['sameDay']> = {}): DeliveryConfig {
  return {
    standard: { enabled: true, etaLabel: '2–5 working days' },
    sameDay: {
      enabled: true,
      governorates: ['CAIRO', 'GIZA'],
      windowStart: '19:00',
      windowEnd: '24:00',
      cutoff: '17:00',
      feeRangeMinor: { min: 9000, max: 16000 },
      disclaimer: 'Fees confirmed after your order is confirmed.',
      ...overrides,
    },
  };
}

describe('validateSameDayDelivery — cutoff rule', () => {
  it('accepts a cutoff exactly 60 minutes before the window end', () => {
    expect(validateSameDayDelivery(makeDelivery().sameDay)).toEqual([]);
  });

  it('rejects a cutoff less than 60 minutes before the window end', () => {
    const errors = validateSameDayDelivery(makeDelivery({ cutoff: '23:30' }).sameDay);
    expect(errors).toContainEqual({
      field: 'cutoff',
      message: 'Cut-off must be at least 60 minutes before the window ends',
    });
  });

  it('accepts a cutoff well before the window end', () => {
    expect(validateSameDayDelivery(makeDelivery({ cutoff: '15:00' }).sameDay)).toEqual([]);
  });

  it('handles a windowEnd of 24:00 (midnight) correctly', () => {
    const errors = validateSameDayDelivery(
      makeDelivery({ windowEnd: '24:00', cutoff: '23:01' }).sameDay,
    );
    expect(errors.some((e) => e.field === 'cutoff')).toBe(true);
  });

  it('rejects windowStart after windowEnd', () => {
    const errors = validateSameDayDelivery(
      makeDelivery({ windowStart: '20:00', windowEnd: '19:00', cutoff: '15:00' }).sameDay,
    );
    expect(errors.some((e) => e.field === 'windowStart')).toBe(true);
  });
});

describe('validateSameDayDelivery — fee range', () => {
  it('accepts min <= max', () => {
    expect(validateSameDayDelivery(makeDelivery().sameDay)).toEqual([]);
  });

  it('rejects min > max', () => {
    const errors = validateSameDayDelivery(
      makeDelivery({ feeRangeMinor: { min: 20000, max: 10000 } }).sameDay,
    );
    expect(errors).toContainEqual({
      field: 'feeMin',
      message: 'Minimum fee must be at or below the maximum',
    });
  });
});

describe('validateSameDayDelivery — governorates and disclaimer', () => {
  it('rejects an empty governorate list', () => {
    const errors = validateSameDayDelivery(makeDelivery({ governorates: [] }).sameDay);
    expect(errors.some((e) => e.field === 'governorates')).toBe(true);
  });

  it('rejects a blank disclaimer', () => {
    const errors = validateSameDayDelivery(makeDelivery({ disclaimer: '   ' }).sameDay);
    expect(errors.some((e) => e.field === 'disclaimer')).toBe(true);
  });
});

describe('validateDeliverySettings', () => {
  it('is clean for a fully valid config', () => {
    expect(validateDeliverySettings(makeDelivery())).toEqual([]);
  });

  it('rejects a blank standard ETA label', () => {
    const config = makeDelivery();
    config.standard.etaLabel = '';
    expect(validateDeliverySettings(config).some((e) => e.field === 'etaLabel')).toBe(true);
  });
});
